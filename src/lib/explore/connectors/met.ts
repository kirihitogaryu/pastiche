import type { ExploreItem, ExploreQuery, SourceConnector, SourceDepartment } from '../types';
import { normalizeMedium } from '../medium';
import {
	metServerCache,
	ServerCache,
	SERVER_OBJECT_TTL_MS,
	SERVER_SEARCH_TTL_MS
} from '../server-cache';
import { isRetryableMetStatus, MetRequestScheduler, RetryableMetError } from './met-scheduler';

const MET_BASE_URL = 'https://collectionapi.metmuseum.org/public/collection/v1';
const DEFAULT_LIMIT = 20;
const MAX_DETAIL_SCAN_MULTIPLIER = 4;
const MET_HEADERS = {
	accept: 'application/json',
	'user-agent': 'Pastiche local development Explore client'
};
const MET_MEDIUM_KEYWORDS: Array<{ pattern: RegExp; medium: string }> = [
	{
		pattern: /\bpaintings?\b|\boil\b|\btempera\b|\bfresco\b|\bwatercolou?r\b/i,
		medium: 'Paintings'
	},
	{ pattern: /\bsculptures?\b|\bstatues?\b|\bbusts?\b/i, medium: 'Sculpture' },
	{ pattern: /\bphotos?\b|\bphotographs?\b|\bphotography\b/i, medium: 'Photographs' },
	{ pattern: /\bdrawings?\b|\bsketch(?:es)?\b/i, medium: 'Drawings' },
	{ pattern: /\bprints?\b|\betchings?\b|\bengraving(?:s)?\b|\blithographs?\b/i, medium: 'Prints' },
	{ pattern: /\btextiles?\b|\bfabric\b|\bsilk\b|\bweaving(?:s)?\b/i, medium: 'Textiles' },
	{ pattern: /\bceramics?\b|\bpottery\b|\bporcelain\b/i, medium: 'Ceramics' },
	{ pattern: /\bfurniture\b|\bchairs?\b|\bcabinets?\b|\btables?\b/i, medium: 'Furniture' },
	{ pattern: /\bglass\b/i, medium: 'Glass' },
	{ pattern: /\bmetalwork\b|\bbronze\b|\bsilver\b|\bgold\b/i, medium: 'Metalwork' }
];

type MetFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type MetConnectorOptions = {
	fetch?: MetFetch;
	requestsPerSecond?: number;
	concurrency?: number;
	cache?: ServerCache;
};

class MetHttpError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'MetHttpError';
	}
}

type MetSearchResponse = {
	total: number;
	objectIDs: number[] | null;
};

type MetDepartmentResponse = {
	departments: Array<{ departmentId: number; displayName: string }>;
};

type MetTag = {
	term?: unknown;
};

type MetObject = {
	objectID?: unknown;
	objectURL?: unknown;
	title?: unknown;
	artistPrefix?: unknown;
	artistDisplayName?: unknown;
	artistDisplayBio?: unknown;
	artistNationality?: unknown;
	objectDate?: unknown;
	objectBeginDate?: unknown;
	objectEndDate?: unknown;
	medium?: unknown;
	objectName?: unknown;
	department?: unknown;
	culture?: unknown;
	period?: unknown;
	primaryImage?: unknown;
	primaryImageSmall?: unknown;
	additionalImages?: unknown;
	tags?: unknown;
	isHighlight?: unknown;
	isPublicDomain?: unknown;
	dynasty?: unknown;
	reign?: unknown;
	portfolio?: unknown;
	artistBeginDate?: unknown;
	artistEndDate?: unknown;
	artistWikidata_URL?: unknown;
	artistULAN_URL?: unknown;
	objectWikidata_URL?: unknown;
	constituents?: unknown;
	accessionNumber?: unknown;
	accessionYear?: unknown;
};

export function createMetConnector(options: MetConnectorOptions = {}): SourceConnector {
	const fetcher = options.fetch ?? fetch;
	const scheduler = new MetRequestScheduler({
		concurrency: options.concurrency ?? 15,
		requestsPerSecond: options.requestsPerSecond ?? 72
	});
	const cache = options.cache ?? new ServerCache();
	let departmentsPromise: Promise<SourceDepartment[]> | null = null;

	async function metJson<T>(url: URL): Promise<T> {
		return scheduler.schedule(async () => {
			const response = await fetcher(url, { headers: MET_HEADERS });
			if (!response.ok) {
				if (isRetryableMetStatus(response.status)) {
					throw new RetryableMetError(
						response.status,
						response.status === 429
							? 'The Met is rate-limiting requests. Try again in a moment.'
							: `Met request failed with ${response.status}`,
						parseRetryAfter(response.headers.get('retry-after'))
					);
				}
				throw new MetHttpError(response.status, metHttpMessage(response.status));
			}
			return (await response.json()) as T;
		});
	}

	async function getObjectByNativeId(nativeId: number): Promise<ExploreItem | null> {
		return cache.getOrFetch(`met:object:${nativeId}`, SERVER_OBJECT_TTL_MS, async () => {
			try {
				const object = await metJson<MetObject>(new URL(`${MET_BASE_URL}/objects/${nativeId}`));
				const item = normalizeMetObject(object);
				return item;
			} catch (error) {
				if (error instanceof MetHttpError && error.status === 404) {
					return null;
				}
				throw error;
			}
		});
	}

	return {
		id: 'met',
		displayName: 'The Met',
		supportedFilters: [
			'keyword',
			'artist',
			'tag',
			'year_range',
			'medium',
			'department',
			'public_domain',
			'has_image',
			'is_highlight'
		],
		async getDepartments() {
			departmentsPromise ??= metJson<MetDepartmentResponse>(
				new URL(`${MET_BASE_URL}/departments`)
			).then((data) =>
				data.departments.map((department) => ({
					id: String(department.departmentId),
					label: department.displayName
				}))
			);
			return departmentsPromise;
		},
		async search(query) {
			const searches = await Promise.all(
				buildMetSearchUrls(query).map(async (searchUrl) =>
					cache.getOrFetch(`met:search:${searchUrl.search}`, SERVER_SEARCH_TTL_MS, () =>
						metJson<MetSearchResponse>(searchUrl)
					)
				)
			);
			const objectIds = mergeObjectIds(
				searches.map((data) => (Array.isArray(data.objectIDs) ? data.objectIDs : []))
			);
			const offset = parseCursor(query.cursor);
			const limit = query.limit || DEFAULT_LIMIT;
			const scanLimit = Math.max(limit, limit * MAX_DETAIL_SCAN_MULTIPLIER);
			const items: ExploreItem[] = [];
			let consumedOffset = offset;

			while (consumedOffset < objectIds.length && items.length < limit) {
				if (consumedOffset - offset >= scanLimit) break;

				const remainingItems = limit - items.length;
				const remainingScan = scanLimit - (consumedOffset - offset);
				const batchSize = Math.min(remainingItems, remainingScan);
				const pageIds = objectIds.slice(consumedOffset, consumedOffset + batchSize);
				if (pageIds.length === 0) break;

				consumedOffset += pageIds.length;
				const batchItems = (await Promise.all(pageIds.map((id) => getObjectByNativeId(id)))).filter(
					(item): item is ExploreItem => item !== null
				);
				items.push(...batchItems.slice(0, remainingItems));
			}

			return {
				items,
				total: objectIds.length,
				nextCursor: consumedOffset < objectIds.length ? String(consumedOffset) : null
			};
		},
		async getById(id) {
			const nativeId = parseMetNativeId(id);
			if (nativeId === null) throw new Error(`Invalid Met item id: ${id}`);
			const item = await getObjectByNativeId(nativeId);
			if (!item) throw new Error(`Met item has no usable image: ${id}`);
			return item;
		}
	};
}

export const metConnector = createMetConnector({ cache: metServerCache });

export function buildMetSearchUrl(
	query: ExploreQuery,
	overrides: {
		artistOrCulture?: boolean;
		title?: boolean;
		tags?: boolean;
		medium?: string;
	} = {}
): URL {
	const url = new URL(`${MET_BASE_URL}/search`);
	const q = query.tag?.trim() || query.artist?.trim() || query.keyword?.trim() || '*';

	if (overrides.artistOrCulture || query.artist?.trim()) {
		url.searchParams.set('artistOrCulture', 'true');
	}
	if (overrides.title) url.searchParams.set('title', 'true');
	if (overrides.tags || query.tag?.trim()) url.searchParams.set('tags', 'true');
	if (Number.isInteger(query.yearFrom)) url.searchParams.set('dateBegin', String(query.yearFrom));
	if (Number.isInteger(query.yearTo)) url.searchParams.set('dateEnd', String(query.yearTo));
	const medium = overrides.medium ?? query.medium?.trim();
	if (medium) url.searchParams.set('medium', medium);
	if (query.department?.trim()) url.searchParams.set('departmentId', query.department.trim());
	if (query.publicDomainOnly) url.searchParams.set('isPublicDomain', 'true');
	if (query.hasImageOnly !== false) url.searchParams.set('hasImages', 'true');
	if (query.isHighlightOnly) url.searchParams.set('isHighlight', 'true');
	url.searchParams.set('q', q);

	return url;
}

function buildMetSearchUrls(query: ExploreQuery): URL[] {
	const urls = [buildMetSearchUrl(query)];
	const keyword = query.keyword?.trim();

	if (!keyword || query.artist?.trim() || query.tag?.trim() || query.medium?.trim()) return urls;

	urls.push(
		buildMetSearchUrl(query, { artistOrCulture: true }),
		buildMetSearchUrl(query, { title: true }),
		buildMetSearchUrl(query, { tags: true })
	);

	for (const medium of inferMetMediumFilters(keyword)) {
		urls.push(buildMetSearchUrl(query, { medium }));
	}

	return dedupeUrls(urls);
}

function inferMetMediumFilters(keyword: string): string[] {
	const matches = MET_MEDIUM_KEYWORDS.filter(({ pattern }) => pattern.test(keyword)).map(
		({ medium }) => medium
	);
	return [...new Set(matches)];
}

function dedupeUrls(urls: URL[]): URL[] {
	const seen = new Set<string>();
	return urls.filter((url) => {
		const key = url.toString();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function mergeObjectIds(idGroups: number[][]): number[] {
	const seen = new Set<number>();
	const merged: number[] = [];
	const maxLength = Math.max(0, ...idGroups.map((ids) => ids.length));

	for (let index = 0; index < maxLength; index += 1) {
		for (const ids of idGroups) {
			const id = ids[index];
			if (id === undefined || seen.has(id)) continue;
			seen.add(id);
			merged.push(id);
		}
	}

	return merged;
}

export function parseMetNativeId(id: string): number | null {
	const raw = id.startsWith('met-') ? id.slice(4) : id;
	if (!/^\d+$/.test(raw)) return null;
	return Number(raw);
}

export function normalizeMetObject(object: MetObject): ExploreItem | null {
	const objectID = numberOrNull(object.objectID);
	if (objectID === null) return null;

	const primaryImage = stringOrNull(object.primaryImage);
	const primaryImageSmall = stringOrNull(object.primaryImageSmall);
	const imageUrl = primaryImage || primaryImageSmall;
	if (!imageUrl) return null;

	const artistRaw = [stringOrNull(object.artistPrefix), stringOrNull(object.artistDisplayName)]
		.filter((value): value is string => Boolean(value))
		.join(' ');
	const medium = stringOrNull(object.medium);

	return {
		id: `met-${objectID}`,
		source: 'met',
		detailUrl: stringOrNull(object.objectURL) ?? '',
		title: stringOrNull(object.title) ?? 'Untitled',
		artistRaw: artistRaw || null,
		artistBio: stringOrNull(object.artistDisplayBio),
		artistNationality: stringOrNull(object.artistNationality),
		dateDisplay: stringOrNull(object.objectDate),
		yearStart: numberOrNull(object.objectBeginDate),
		yearEnd: numberOrNull(object.objectEndDate),
		medium,
		mediumCategory: normalizeMedium(medium),
		objectName: stringOrNull(object.objectName),
		department: stringOrNull(object.department),
		culture: stringOrNull(object.culture),
		period: stringOrNull(object.period),
		thumbUrl: primaryImageSmall,
		imageUrl,
		additionalImages: stringArray(object.additionalImages),
		isIIIF: false,
		description: null,
		tags: tagsArray(object.tags),
		isHighlight: Boolean(object.isHighlight),
		isPublicDomain: booleanOrNull(object.isPublicDomain),
		rawMetadata: {
			dynasty: object.dynasty,
			reign: object.reign,
			portfolio: object.portfolio,
			artistBeginDate: object.artistBeginDate,
			artistEndDate: object.artistEndDate,
			artistWikidata_URL: object.artistWikidata_URL,
			artistULAN_URL: object.artistULAN_URL,
			objectWikidata_URL: object.objectWikidata_URL,
			constituents: object.constituents,
			accessionNumber: object.accessionNumber,
			accessionYear: object.accessionYear
		}
	};
}

function parseCursor(cursor: string | undefined): number {
	if (!cursor) return 0;
	const parsed = Number(cursor);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function metHttpMessage(status: number): string {
	if (status === 403) {
		return 'The Met temporarily blocked or rate-limited this request. Try again in a moment.';
	}
	return `Met request failed with ${status}`;
}

function parseRetryAfter(value: string | null): number | null {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return seconds;
	const date = Date.parse(value);
	if (!Number.isFinite(date)) return null;
	return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function tagsArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((tag: MetTag) => stringOrNull(tag.term))
		.filter((term): term is string => term !== null);
}
