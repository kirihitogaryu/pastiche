import { env } from '$env/dynamic/private';
import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import type {
	ExploreContentRating,
	ExploreItem,
	ExplorePage,
	ExploreQuery,
	SourceConnector
} from '../types';
import { isRetryableMetStatus, MetRequestScheduler, RetryableMetError } from './met-scheduler';

const DEVIANTART_BASE_URL = 'https://www.deviantart.com';
const DEVIANTART_API_URL = `${DEVIANTART_BASE_URL}/api/v1/oauth2`;
const DEVIANTART_TOKEN_URL = `${DEVIANTART_BASE_URL}/oauth2/token`;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const MAX_GALLERY_OFFSET = 50_000;
const TOKEN_EXPIRY_SAFETY_MS = 60_000;
const DEFAULT_USER_AGENT = 'Pastiche/0.1 (local artist reference app)';

type DeviantArtFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type DeviantArtConnectorOptions = {
	fetch?: DeviantArtFetch;
	cache?: ServerCache;
	clientId?: string | null;
	clientSecret?: string | null;
	userAgent?: string;
	concurrency?: number;
	requestsPerSecond?: number;
	now?: () => number;
};

type DeviantArtTokenResponse = {
	access_token?: unknown;
	expires_in?: unknown;
	error?: unknown;
	error_description?: unknown;
};

type DeviantArtImage = {
	src?: unknown;
	width?: unknown;
	height?: unknown;
	filesize?: unknown;
	transparency?: unknown;
};

type DeviantArtAuthor = {
	userid?: unknown;
	username?: unknown;
	usericon?: unknown;
	type?: unknown;
};

type DeviantArtDeviation = {
	deviationid?: unknown;
	url?: unknown;
	title?: unknown;
	is_mature?: unknown;
	is_downloadable?: unknown;
	published_time?: unknown;
	category_path?: unknown;
	author?: DeviantArtAuthor | null;
	content?: DeviantArtImage | null;
	thumbs?: unknown;
	excerpt?: unknown;
	stats?: {
		comments?: unknown;
		favourites?: unknown;
	} | null;
};

type DeviantArtMetadata = {
	deviationid?: unknown;
	description?: unknown;
	license?: unknown;
	tags?: unknown;
	is_mature?: unknown;
};

type DeviantArtPageResponse = {
	results?: unknown;
	has_more?: unknown;
	next_offset?: unknown;
	next_cursor?: unknown;
};

type DeviantArtMetadataResponse = {
	metadata?: unknown;
};

export function createDeviantArtConnector(
	options: DeviantArtConnectorOptions = {}
): SourceConnector {
	const fetcher = options.fetch ?? fetch;
	const cache = options.cache ?? new ServerCache(1200);
	const clientId =
		options.clientId !== undefined
			? options.clientId
			: (env.DEVIANTART_CLIENT_ID?.trim() ?? process.env.DEVIANTART_CLIENT_ID?.trim() ?? null);
	const clientSecret =
		options.clientSecret !== undefined
			? options.clientSecret
			: (env.DEVIANTART_CLIENT_SECRET?.trim() ??
				process.env.DEVIANTART_CLIENT_SECRET?.trim() ??
				null);
	const userAgent =
		options.userAgent ??
		env.PASTICHE_DEVIANTART_USER_AGENT?.trim() ??
		process.env.PASTICHE_DEVIANTART_USER_AGENT?.trim() ??
		DEFAULT_USER_AGENT;
	const now = options.now ?? Date.now;
	const scheduler = new MetRequestScheduler({
		concurrency: options.concurrency ?? 2,
		requestsPerSecond: options.requestsPerSecond ?? 2,
		maxRetries: 3,
		baseRetryDelayMs: 1000
	});
	let token: { value: string; expiresAt: number } | null = null;
	let tokenPending: Promise<string> | null = null;

	function assertConfigured() {
		if (clientId && clientSecret) return;
		throw new Error(
			'DeviantArt is not configured. Add DEVIANTART_CLIENT_ID and DEVIANTART_CLIENT_SECRET to .env.local, then restart Pastiche.'
		);
	}

	async function getAccessToken(force = false): Promise<string> {
		assertConfigured();
		if (!force && token && token.expiresAt > now() + TOKEN_EXPIRY_SAFETY_MS) return token.value;
		if (!force && tokenPending) return tokenPending;

		tokenPending = (async () => {
			const response = await fetcher(DEVIANTART_TOKEN_URL, {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'accept-encoding': 'gzip',
					authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': userAgent
				},
				body: 'grant_type=client_credentials',
				signal: AbortSignal.timeout(20_000)
			});
			const payload = (await responseJson(response)) as DeviantArtTokenResponse;
			if (!response.ok) {
				throw responseError(response, payload, 'DeviantArt authentication failed');
			}
			const value = stringOrNull(payload.access_token);
			if (!value) throw new Error('DeviantArt authentication returned no access token.');
			const expiresIn = Math.max(60, numberOrNull(payload.expires_in) ?? 3600);
			token = { value, expiresAt: now() + expiresIn * 1000 };
			return value;
		})().finally(() => {
			tokenPending = null;
		});

		return tokenPending;
	}

	async function apiJson<T>(url: URL): Promise<T> {
		return scheduler.schedule(async () => {
			let accessToken = await getAccessToken();
			let response = await apiFetch(url, accessToken);
			if (response.status === 401) {
				token = null;
				accessToken = await getAccessToken(true);
				response = await apiFetch(url, accessToken);
			}
			const payload = await responseJson(response);
			if (!response.ok) {
				throw responseError(response, payload, 'DeviantArt request failed');
			}
			return payload as T;
		});
	}

	function apiFetch(url: URL, accessToken: string) {
		return fetcher(url, {
			headers: {
				accept: 'application/json',
				'accept-encoding': 'gzip',
				authorization: `Bearer ${accessToken}`,
				'dA-minor-version': '20240701',
				'user-agent': userAgent
			},
			signal: AbortSignal.timeout(20_000)
		});
	}

	async function getDeviation(nativeId: string): Promise<ExploreItem> {
		return cache.getOrFetch(`deviantart:deviation:${nativeId}`, SERVER_OBJECT_TTL_MS, async () => {
			const deviation = await apiJson<DeviantArtDeviation>(
				new URL(`${DEVIANTART_API_URL}/deviation/${encodeURIComponent(nativeId)}`)
			);
			const metadataUrl = new URL(`${DEVIANTART_API_URL}/deviation/metadata`);
			metadataUrl.searchParams.append('deviationids[]', nativeId);
			const metadataPromise = apiJson<DeviantArtMetadataResponse>(metadataUrl).catch(() => ({
				metadata: []
			}));
			const downloadPromise =
				deviation.is_downloadable === true
					? apiJson<DeviantArtImage>(
							new URL(`${DEVIANTART_API_URL}/deviation/download/${encodeURIComponent(nativeId)}`)
						).catch(() => null)
					: Promise.resolve(null);
			const [metadataResponse, download] = await Promise.all([metadataPromise, downloadPromise]);
			const metadata = metadataFor(metadataResponse, nativeId);
			const item = normalizeDeviantArtDeviation(deviation, metadata, download);
			if (!item) throw new Error(`DeviantArt deviation has no usable image: ${nativeId}`);
			return item;
		});
	}

	return {
		id: 'deviantart',
		displayName: 'DeviantArt',
		supportedFilters: ['artist', 'tag', 'has_image', 'year_range', 'sort'],
		async getDepartments() {
			return [];
		},
		async search(query) {
			assertConfigured();
			const url = buildDeviantArtSearchUrl(query);
			if (!url) return { items: [], total: 0, nextCursor: null };
			if (query.artist?.trim() && !query.cursor && validDateTimestamp(query.dateTo) !== null) {
				const offset = await cache.getOrFetch(
					`deviantart:date-boundary:${query.artist.trim().toLocaleLowerCase()}:${query.dateTo}:${query.contentSafety ?? 'blur'}`,
					SERVER_OBJECT_TTL_MS,
					() =>
						findArtistDateBoundary(
							query.artist!.trim(),
							query.dateTo!,
							query.contentSafety !== 'hide',
							apiJson
						)
				);
				if (offset > 0) url.searchParams.set('offset', String(offset));
			}
			const response = await cache.getOrFetch(
				`deviantart:search:${url.pathname}:${url.search}`,
				SERVER_SEARCH_TTL_MS,
				() => apiJson<DeviantArtPageResponse>(url)
			);
			return normalizeDeviantArtPage(response, query);
		},
		async getById(id) {
			const nativeId = parseDeviantArtNativeId(id);
			if (!nativeId) throw new Error(`Invalid DeviantArt item id: ${id}`);
			return getDeviation(nativeId);
		}
	};
}

export const deviantArtConnector = createDeviantArtConnector();

export function buildDeviantArtSearchUrl(query: ExploreQuery): URL | null {
	const artist = query.artist?.trim();
	const tag = normalizeDeviantArtTag(query.tag ?? query.keyword ?? '');
	if (!artist && !tag) return null;

	const url = new URL(
		artist ? `${DEVIANTART_API_URL}/gallery/all` : `${DEVIANTART_API_URL}/browse/tags`
	);
	const limit = Math.max(1, Math.min(artist ? DEFAULT_LIMIT : MAX_LIMIT, query.limit));
	url.searchParams.set(artist ? 'username' : 'tag', artist ?? tag ?? '');
	url.searchParams.set('limit', String(limit));
	url.searchParams.set('with_session', 'false');
	url.searchParams.set('mature_content', query.contentSafety === 'hide' ? 'false' : 'true');

	const cursor = query.cursor?.trim();
	if (cursor?.startsWith('offset:')) {
		const offset = Number.parseInt(cursor.slice('offset:'.length), 10);
		if (Number.isSafeInteger(offset) && offset >= 0) url.searchParams.set('offset', String(offset));
	} else if (!artist && cursor?.startsWith('cursor:')) {
		url.searchParams.set('cursor', cursor.slice('cursor:'.length));
	}
	return url;
}

export function normalizeDeviantArtPage(
	response: DeviantArtPageResponse,
	query: ExploreQuery
): ExplorePage {
	const results = Array.isArray(response.results) ? response.results : [];
	const items = results
		.map((result) => normalizeDeviantArtDeviation(result as DeviantArtDeviation))
		.filter((item): item is ExploreItem => item !== null)
		.filter((item) => query.contentSafety !== 'hide' || item.contentRating === 'general')
		.filter((item) => matchesDateBounds(item.dateDisplay, query.dateFrom, query.dateTo))
		.sort(query.sort === 'popular' ? compareDeviantArtPopularity : () => 0);
	let nextCursor =
		response.has_more === true
			? stringOrNull(response.next_cursor)
				? `cursor:${stringOrNull(response.next_cursor)}`
				: numberOrNull(response.next_offset) !== null
					? `offset:${numberOrNull(response.next_offset)}`
					: null
			: null;
	if (query.dateFrom && galleryHasCrossedLowerBound(results, query.dateFrom)) {
		nextCursor = null;
	}
	return { items, total: null, nextCursor };
}

export function normalizeDeviantArtDeviation(
	deviation: DeviantArtDeviation,
	metadata: DeviantArtMetadata | null = null,
	download: DeviantArtImage | null = null
): ExploreItem | null {
	const nativeId = stringOrNull(deviation.deviationid);
	const detailUrl = stringOrNull(deviation.url);
	const content = imageOrNull(deviation.content);
	const thumbs = Array.isArray(deviation.thumbs)
		? deviation.thumbs.map(imageOrNull).filter((image): image is DeviantArtImage => image !== null)
		: [];
	const largestThumb =
		[...thumbs].sort((left, right) => imageArea(right) - imageArea(left))[0] ?? null;
	const image = imageOrNull(download) ?? content ?? largestThumb;
	const imageUrl = stringOrNull(image?.src);
	if (!nativeId || !detailUrl || !imageUrl) return null;

	const username = stringOrNull(deviation.author?.username);
	const timestamp = numberOrNull(deviation.published_time);
	const published = timestamp === null ? null : new Date(timestamp * 1000);
	const tags = normalizeMetadataTags(metadata?.tags);
	const description =
		plainText(stringOrNull(metadata?.description)) ??
		plainText(stringOrNull(deviation.excerpt)) ??
		null;
	const mature = metadata?.is_mature === true || deviation.is_mature === true;
	const dimensions = content ?? image;

	return {
		id: `deviantart-${nativeId}`,
		source: 'deviantart',
		detailUrl,
		title: stringOrNull(deviation.title) ?? `DeviantArt · ${nativeId}`,
		artistRaw: username,
		artistBio: null,
		artistNationality: null,
		dateDisplay:
			published && !Number.isNaN(published.valueOf()) ? published.toISOString().slice(0, 10) : null,
		yearStart: published && !Number.isNaN(published.valueOf()) ? published.getUTCFullYear() : null,
		yearEnd: published && !Number.isNaN(published.valueOf()) ? published.getUTCFullYear() : null,
		medium: null,
		mediumCategory: null,
		objectName: 'Deviation',
		department: 'DeviantArt',
		culture: stringOrNull(deviation.category_path),
		period: null,
		thumbUrl: stringOrNull(largestThumb?.src) ?? stringOrNull(content?.src) ?? imageUrl,
		imageUrl,
		additionalImages: [],
		isIIIF: false,
		description,
		tags,
		isHighlight: false,
		isPublicDomain: false,
		contentRating: (mature ? 'sensitive' : 'general') satisfies ExploreContentRating,
		rawMetadata: {
			deviantart: {
				deviationId: nativeId,
				authorId: stringOrNull(deviation.author?.userid),
				authorUsername: username,
				authorProfileUrl: username
					? `${DEVIANTART_BASE_URL}/${encodeURIComponent(username)}`
					: null,
				authorType: stringOrNull(deviation.author?.type),
				isMature: mature,
				isDownloadable: deviation.is_downloadable === true,
				license: stringOrNull(metadata?.license),
				width: numberOrNull(dimensions?.width),
				height: numberOrNull(dimensions?.height),
				fileSize: numberOrNull(image?.filesize),
				publishedAt:
					published && !Number.isNaN(published.valueOf()) ? published.toISOString() : null,
				favourites: numberOrNull(deviation.stats?.favourites),
				comments: numberOrNull(deviation.stats?.comments),
				tags
			}
		}
	};
}

export function parseDeviantArtNativeId(id: string): string | null {
	const nativeId = id.startsWith('deviantart-') ? id.slice('deviantart-'.length) : id;
	return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(nativeId)
		? nativeId.toUpperCase()
		: null;
}

function normalizeDeviantArtTag(value: string): string | null {
	const normalized = value.trim().replace(/^#+/, '').replace(/\s+/g, '');
	return normalized || null;
}

async function findArtistDateBoundary(
	artist: string,
	dateTo: string,
	includeMature: boolean,
	apiJson: <T>(url: URL) => Promise<T>
): Promise<number> {
	const cutoff = validDateTimestamp(dateTo);
	if (cutoff === null) return 0;
	const probe = async (offset: number) => {
		const url = new URL(`${DEVIANTART_API_URL}/gallery/all`);
		url.searchParams.set('username', artist);
		url.searchParams.set('limit', '1');
		url.searchParams.set('offset', String(offset));
		url.searchParams.set('with_session', 'false');
		url.searchParams.set('mature_content', includeMature ? 'true' : 'false');
		const response = await apiJson<DeviantArtPageResponse>(url);
		const first = Array.isArray(response.results)
			? (response.results[0] as DeviantArtDeviation | undefined)
			: undefined;
		return first ? numberOrNull(first.published_time) : null;
	};

	const newest = await probe(0);
	if (newest === null || newest * 1000 < cutoff) return 0;

	let lower = 0;
	let upper = DEFAULT_LIMIT;
	while (upper < MAX_GALLERY_OFFSET) {
		const timestamp = await probe(upper);
		if (timestamp === null || timestamp * 1000 < cutoff) break;
		lower = upper;
		upper = Math.min(MAX_GALLERY_OFFSET, upper * 2);
		if (upper === lower) break;
	}

	while (upper - lower > 1) {
		const middle = Math.floor((lower + upper) / 2);
		const timestamp = await probe(middle);
		if (timestamp === null || timestamp * 1000 < cutoff) {
			upper = middle;
		} else {
			lower = middle;
		}
	}
	return Math.floor(upper / DEFAULT_LIMIT) * DEFAULT_LIMIT;
}

function matchesDateBounds(
	dateDisplay: string | null,
	dateFrom?: string,
	dateTo?: string
): boolean {
	if (!dateFrom && !dateTo) return true;
	if (!dateDisplay) return false;
	const timestamp = Date.parse(`${dateDisplay}T00:00:00.000Z`);
	if (!Number.isFinite(timestamp)) return false;
	const from = validDateTimestamp(dateFrom);
	const to = validDateTimestamp(dateTo);
	return (from === null || timestamp >= from) && (to === null || timestamp < to);
}

function galleryHasCrossedLowerBound(results: unknown[], dateFrom: string) {
	const from = validDateTimestamp(dateFrom);
	if (from === null) return false;
	const timestamps = results
		.map((result) =>
			typeof result === 'object' && result !== null
				? numberOrNull((result as DeviantArtDeviation).published_time)
				: null
		)
		.filter((value): value is number => value !== null);
	return timestamps.length > 0 && Math.min(...timestamps) * 1000 < from;
}

function compareDeviantArtPopularity(left: ExploreItem, right: ExploreItem) {
	const leftMetadata = deviantArtMetadata(left);
	const rightMetadata = deviantArtMetadata(right);
	return (
		rightMetadata.favourites - leftMetadata.favourites ||
		rightMetadata.comments - leftMetadata.comments
	);
}

function deviantArtMetadata(item: ExploreItem) {
	const value = item.rawMetadata.deviantart;
	const record =
		typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
	return {
		favourites: numberOrNull(record.favourites) ?? 0,
		comments: numberOrNull(record.comments) ?? 0
	};
}

function validDateTimestamp(value?: string) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const timestamp = Date.parse(`${value}T00:00:00.000Z`);
	return Number.isFinite(timestamp) ? timestamp : null;
}

function metadataFor(
	response: DeviantArtMetadataResponse,
	nativeId: string
): DeviantArtMetadata | null {
	if (!Array.isArray(response.metadata)) return null;
	return (
		(response.metadata.find(
			(entry) =>
				typeof entry === 'object' &&
				entry !== null &&
				stringOrNull((entry as DeviantArtMetadata).deviationid)?.toUpperCase() ===
					nativeId.toUpperCase()
		) as DeviantArtMetadata | undefined) ?? null
	);
}

function normalizeMetadataTags(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [
		...new Set(
			value
				.map((entry) => {
					if (typeof entry === 'string') return entry.trim();
					if (typeof entry !== 'object' || entry === null) return '';
					return (
						stringOrNull((entry as Record<string, unknown>).tag_name) ??
						stringOrNull((entry as Record<string, unknown>).name) ??
						''
					);
				})
				.filter(Boolean)
		)
	];
}

function imageOrNull(value: unknown): DeviantArtImage | null {
	if (typeof value !== 'object' || value === null) return null;
	return stringOrNull((value as DeviantArtImage).src) ? (value as DeviantArtImage) : null;
}

function imageArea(image: DeviantArtImage) {
	return (numberOrNull(image.width) ?? 0) * (numberOrNull(image.height) ?? 0);
}

function plainText(value: string | null): string | null {
	if (!value) return null;
	const normalized = value
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s+/g, '\n')
		.trim();
	return normalized || null;
}

async function responseJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return {};
	}
}

function responseError(response: Response, payload: unknown, fallback: string): Error {
	const record =
		typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
	const detail =
		stringOrNull(record.error_description) ??
		stringOrNull(record.error) ??
		`${fallback}: HTTP ${response.status}`;
	if (isRetryableMetStatus(response.status)) {
		return new RetryableMetError(
			response.status,
			deviantArtErrorMessage(response.status, detail),
			parseRetryAfter(response.headers.get('retry-after'))
		);
	}
	return new Error(deviantArtErrorMessage(response.status, detail));
}

function deviantArtErrorMessage(status: number, detail: string) {
	if (status === 400 && /user not found/i.test(detail))
		return 'That DeviantArt artist could not be found.';
	if (status === 401)
		return 'DeviantArt credentials were rejected. Check .env.local and restart Pastiche.';
	if (status === 429)
		return 'DeviantArt is rate-limiting requests. Pastiche will retry with backoff.';
	if (status >= 500) return 'DeviantArt is temporarily unavailable.';
	return detail || `DeviantArt request failed with HTTP ${status}.`;
}

function parseRetryAfter(value: string | null): number | null {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
	const date = Date.parse(value);
	if (!Number.isFinite(date)) return null;
	return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
	const number =
		typeof value === 'number'
			? value
			: typeof value === 'string' && value.trim()
				? Number(value)
				: NaN;
	return Number.isFinite(number) ? number : null;
}
