import { buildIiifImageUrl, normalizeIiifBaseUrl } from '../iiif';
import { normalizeMedium } from '../medium';
import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import type { ExploreItem, ExploreQuery, SourceConnector } from '../types';
import { isRetryableMetStatus, MetRequestScheduler, RetryableMetError } from './met-scheduler';

type ArticArtwork = Record<string, unknown>;

type ArticFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ArticConnectorOptions = {
	fetch?: ArticFetch;
	requestsPerSecond?: number;
	concurrency?: number;
	cache?: ServerCache;
};

type ArticSearchResponse = {
	config?: {
		iiif_url?: unknown;
	};
	pagination?: {
		total?: unknown;
		current_page?: unknown;
		total_pages?: unknown;
	};
	data?: unknown;
};

type ArticObjectResponse = {
	config?: {
		iiif_url?: unknown;
	};
	data?: unknown;
};

const ARTIC_BASE_URL = 'https://api.artic.edu/api/v1';
const DEFAULT_LIMIT = 20;
const ARTIC_FIELDS = [
	'id',
	'title',
	'artist_display',
	'date_display',
	'date_start',
	'date_end',
	'medium_display',
	'artwork_type_title',
	'department_title',
	'place_of_origin',
	'style_title',
	'image_id',
	'alt_image_ids',
	'api_link',
	'web_url',
	'is_public_domain',
	'is_boosted',
	'category_titles',
	'term_titles',
	'classification_titles',
	'subject_titles',
	'description',
	'thumbnail'
].join(',');
const ARTIC_HEADERS = {
	accept: 'application/json',
	'user-agent': 'Pastiche local development Explore client'
};
const DEFAULT_IIIF_BASE_URL = 'https://www.artic.edu/iiif/2';

export const articServerCache = new ServerCache(2000);

export function createArticConnector(options: ArticConnectorOptions = {}): SourceConnector {
	const fetcher = options.fetch ?? fetch;
	const scheduler = new MetRequestScheduler({
		concurrency: options.concurrency ?? 5,
		requestsPerSecond: options.requestsPerSecond ?? 5
	});
	const cache = options.cache ?? new ServerCache(2000);

	async function articJson<T>(url: URL): Promise<T> {
		return scheduler.schedule(async () => {
			const response = await fetcher(url, { headers: ARTIC_HEADERS });
			if (!response.ok) {
				if (isRetryableMetStatus(response.status)) {
					throw new RetryableMetError(
						response.status,
						`Art Institute request failed with ${response.status}`,
						parseRetryAfter(response.headers.get('retry-after'))
					);
				}
				throw new Error(`Art Institute request failed with ${response.status}`);
			}
			return (await response.json()) as T;
		});
	}

	async function getObjectByNativeId(nativeId: number): Promise<ExploreItem | null> {
		return cache.getOrFetch(`artic:object:${nativeId}`, SERVER_OBJECT_TTL_MS, async () => {
			const response = await articJson<ArticObjectResponse>(
				new URL(`${ARTIC_BASE_URL}/artworks/${nativeId}`)
			);
			return normalizeArticArtwork(
				response.data as ArticArtwork,
				stringOrNull(response.config?.iiif_url) ?? DEFAULT_IIIF_BASE_URL
			);
		});
	}

	return {
		id: 'artic',
		displayName: 'Art Institute of Chicago',
		supportedFilters: ['keyword', 'artist', 'tag', 'public_domain', 'has_image'],
		async getDepartments() {
			return [];
		},
		async search(query) {
			const url = buildArticSearchUrl(query);
			const response = await cache.getOrFetch(
				`artic:search:${url.search}`,
				SERVER_SEARCH_TTL_MS,
				() => articJson<ArticSearchResponse>(url)
			);
			const iiifBaseUrl = stringOrNull(response.config?.iiif_url) ?? DEFAULT_IIIF_BASE_URL;
			const artworks = Array.isArray(response.data) ? response.data : [];
			const items = artworks
				.map((artwork) => normalizeArticArtwork(artwork as ArticArtwork, iiifBaseUrl))
				.filter((item): item is ExploreItem => item !== null);
			const currentPage = numberOrNull(response.pagination?.current_page) ?? 1;
			const totalPages = numberOrNull(response.pagination?.total_pages) ?? currentPage;

			return {
				items,
				total: numberOrNull(response.pagination?.total) ?? items.length,
				nextCursor: currentPage < totalPages ? String(currentPage + 1) : null
			};
		},
		async getById(id) {
			const nativeId = parseArticNativeId(id);
			if (nativeId === null) throw new Error(`Invalid Art Institute item id: ${id}`);
			const item = await getObjectByNativeId(nativeId);
			if (!item) throw new Error(`Art Institute item has no usable image: ${id}`);
			return item;
		}
	};
}

export const articConnector = createArticConnector({ cache: articServerCache });

export function buildArticSearchUrl(query: ExploreQuery): URL {
	const url = new URL(`${ARTIC_BASE_URL}/artworks/search`);
	const q = query.tag?.trim() || query.artist?.trim() || query.keyword?.trim() || '*';
	const limit = query.limit || DEFAULT_LIMIT;
	const page = parseArticCursor(query.cursor);
	const hasMetadataFilters = Boolean(
		query.mediumCategory || query.objectName || query.department || query.culture || query.period
	);

	url.searchParams.set('limit', String(limit));
	url.searchParams.set('page', String(page));
	url.searchParams.set('fields', ARTIC_FIELDS);

	if (!hasMetadataFilters) {
		url.searchParams.set('q', q);
		if (query.hasImageOnly !== false) url.searchParams.set('query[exists][field]', 'image_id');
		if (query.publicDomainOnly) url.searchParams.set('query[term][is_public_domain]', 'true');
		return url;
	}

	let mustIndex = 0;
	if (q !== '*') {
		url.searchParams.set(`query[bool][must][${mustIndex}][query_string][query]`, q);
		mustIndex += 1;
	}
	if (query.mediumCategory?.trim()) {
		url.searchParams.set(
			`query[bool][must][${mustIndex}][match][medium_display]`,
			query.mediumCategory.trim()
		);
		mustIndex += 1;
	}
	if (query.objectName?.trim()) {
		url.searchParams.set(
			`query[bool][must][${mustIndex}][match_phrase][artwork_type_title]`,
			query.objectName.trim()
		);
		mustIndex += 1;
	}
	if (query.department?.trim()) {
		url.searchParams.set(
			`query[bool][must][${mustIndex}][match_phrase][department_title]`,
			query.department.trim()
		);
		mustIndex += 1;
	}
	if (query.culture?.trim()) {
		addCultureLocationFilter(url, mustIndex, query.culture.trim());
		mustIndex += 1;
	}
	if (query.period?.trim()) {
		url.searchParams.set(
			`query[bool][must][${mustIndex}][match_phrase][style_title]`,
			query.period.trim()
		);
		mustIndex += 1;
	}
	if (query.hasImageOnly !== false) {
		url.searchParams.set(`query[bool][must][${mustIndex}][exists][field]`, 'image_id');
		mustIndex += 1;
	}
	if (query.publicDomainOnly) {
		url.searchParams.set(`query[bool][must][${mustIndex}][term][is_public_domain]`, 'true');
	}

	return url;
}

function addCultureLocationFilter(url: URL, mustIndex: number, value: string) {
	url.searchParams.set(
		`query[bool][must][${mustIndex}][bool][should][0][match_phrase][place_of_origin]`,
		value
	);
	url.searchParams.set(
		`query[bool][must][${mustIndex}][bool][should][1][match_phrase][subject_titles]`,
		value
	);
	url.searchParams.set(
		`query[bool][must][${mustIndex}][bool][should][2][match_phrase][term_titles]`,
		value
	);
}

export function parseArticNativeId(id: string): number | null {
	const raw = id.startsWith('artic-') ? id.slice(6) : id;
	if (!/^\d+$/.test(raw)) return null;
	return Number(raw);
}

function parseArticCursor(cursor: string | undefined): number {
	if (!cursor) return 1;
	const parsed = Number(cursor);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseRetryAfter(value: string | null): number | null {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return seconds;
	const date = Date.parse(value);
	if (!Number.isFinite(date)) return null;
	return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export function buildArticIiifBaseUrl(iiifBaseUrl: string, imageId: string): string {
	return `${normalizeIiifBaseUrl(iiifBaseUrl)}/${imageId}`;
}

export function normalizeArticArtwork(
	artwork: ArticArtwork,
	iiifBaseUrl: string
): ExploreItem | null {
	const id = numberOrNull(artwork.id);
	if (id === null) return null;

	const imageId = stringOrNull(artwork.image_id);
	if (imageId === null) return null;

	const imageUrl = buildArticIiifBaseUrl(iiifBaseUrl, imageId);
	const medium = stringOrNull(artwork.medium_display);
	const artist = splitArtistDisplay(artwork.artist_display);
	const tags = uniqueStrings([
		...stringArray(artwork.category_titles),
		...stringArray(artwork.term_titles),
		...stringArray(artwork.classification_titles),
		...stringArray(artwork.subject_titles)
	]);

	return {
		id: `artic-${id}`,
		source: 'artic',
		detailUrl: stringOrNull(artwork.web_url) ?? `https://www.artic.edu/artworks/${id}`,
		title: stringOrNull(artwork.title) ?? 'Untitled',
		artistRaw: artist.name,
		artistBio: artist.bio,
		artistNationality: null,
		dateDisplay: stringOrNull(artwork.date_display),
		yearStart: numberOrNull(artwork.date_start),
		yearEnd: numberOrNull(artwork.date_end),
		medium,
		mediumCategory: normalizeMedium(medium),
		objectName: stringOrNull(artwork.artwork_type_title),
		department: stringOrNull(artwork.department_title),
		culture: stringOrNull(artwork.place_of_origin),
		period: stringOrNull(artwork.style_title),
		thumbUrl: buildIiifImageUrl(imageUrl, '400,'),
		imageUrl,
		additionalImages: stringArray(artwork.alt_image_ids).map((altImageId) =>
			buildArticIiifBaseUrl(iiifBaseUrl, altImageId)
		),
		isIIIF: true,
		description: stringOrNull(artwork.description),
		tags,
		isHighlight: Boolean(artwork.is_boosted),
		isPublicDomain: booleanOrNull(artwork.is_public_domain),
		rawMetadata: {
			api_link: artwork.api_link,
			image_id: artwork.image_id,
			alt_image_ids: artwork.alt_image_ids,
			thumbnail: artwork.thumbnail,
			artist_id: artwork.artist_id,
			style_id: artwork.style_id
		}
	};
}

export function splitArtistDisplay(value: unknown): {
	name: string | null;
	bio: string | null;
} {
	const artistDisplay = stringOrNull(value);
	if (artistDisplay === null) return { name: null, bio: null };

	const lines = artistDisplay
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	return {
		name: lines[0] ?? null,
		bio: lines.slice(1).join(', ') || null
	};
}

export function stringOrNull(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function booleanOrNull(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
}

export function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => stringOrNull(item)).filter((item): item is string => item !== null);
}

export function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		unique.push(value);
	}

	return unique;
}
