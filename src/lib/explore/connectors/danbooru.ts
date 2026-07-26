import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import { isRetryableMetStatus, MetRequestScheduler, RetryableMetError } from './met-scheduler';
import type { ExploreContentRating, ExploreItem, ExploreQuery, SourceConnector } from '../types';

const DANBOORU_BASE_URL = 'https://danbooru.donmai.us';
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const MAX_FETCH_MULTIPLIER = 4;
const DEFAULT_USER_AGENT = 'Pastiche/0.1 (local artist reference app)';

type DanbooruFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type DanbooruConnectorOptions = {
	fetch?: DanbooruFetch;
	cache?: ServerCache;
	login?: string | null;
	apiKey?: string | null;
	userAgent?: string;
	concurrency?: number;
	requestsPerSecond?: number;
};

type DanbooruMediaVariant = {
	type?: unknown;
	url?: unknown;
};

type DanbooruPost = {
	id?: unknown;
	created_at?: unknown;
	score?: unknown;
	source?: unknown;
	rating?: unknown;
	image_width?: unknown;
	image_height?: unknown;
	file_ext?: unknown;
	file_size?: unknown;
	fav_count?: unknown;
	tag_string?: unknown;
	tag_string_general?: unknown;
	tag_string_character?: unknown;
	tag_string_copyright?: unknown;
	tag_string_artist?: unknown;
	tag_string_meta?: unknown;
	file_url?: unknown;
	large_file_url?: unknown;
	preview_file_url?: unknown;
	media_asset?: {
		variants?: unknown;
	} | null;
};

type DanbooruArtist = {
	name?: unknown;
	other_names?: unknown;
	group_name?: unknown;
	is_deleted?: unknown;
	is_banned?: unknown;
};

export function createDanbooruConnector(options: DanbooruConnectorOptions = {}): SourceConnector {
	const fetcher = options.fetch ?? fetch;
	const cache = options.cache ?? new ServerCache(1200);
	const scheduler = new MetRequestScheduler({
		concurrency: options.concurrency ?? 2,
		requestsPerSecond: options.requestsPerSecond ?? 2,
		maxRetries: 2,
		baseRetryDelayMs: 500
	});
	const login = options.login ?? process.env.DANBOORU_LOGIN?.trim() ?? null;
	const apiKey = options.apiKey ?? process.env.DANBOORU_API_KEY?.trim() ?? null;
	const userAgent =
		options.userAgent ?? process.env.PASTICHE_DANBOORU_USER_AGENT?.trim() ?? DEFAULT_USER_AGENT;

	async function danbooruJson<T>(url: URL): Promise<T> {
		return scheduler.schedule(async () => {
			const headers: Record<string, string> = {
				accept: 'application/json',
				'accept-encoding': 'gzip',
				'user-agent': userAgent
			};
			if (login && apiKey) {
				headers.authorization = `Basic ${Buffer.from(`${login}:${apiKey}`).toString('base64')}`;
			}

			const response = await fetcher(url, {
				headers,
				signal: AbortSignal.timeout(20_000)
			});
			if (!response.ok) {
				const detail = await responseText(response);
				if (isRetryableMetStatus(response.status)) {
					throw new RetryableMetError(
						response.status,
						danbooruErrorMessage(response.status, detail),
						parseRetryAfter(response.headers.get('retry-after'))
					);
				}
				throw new Error(danbooruErrorMessage(response.status, detail));
			}
			return (await response.json()) as T;
		});
	}

	async function getPost(nativeId: number): Promise<ExploreItem | null> {
		return cache.getOrFetch(`danbooru:post:${nativeId}`, SERVER_OBJECT_TTL_MS, async () => {
			const post = await danbooruJson<DanbooruPost>(
				new URL(`/posts/${nativeId}.json`, DANBOORU_BASE_URL)
			);
			return normalizeDanbooruPost(post);
		});
	}

	return {
		id: 'danbooru',
		displayName: 'Danbooru',
		supportedFilters: ['artist', 'tag', 'has_image'],
		async getDepartments() {
			return [];
		},
		async search(query) {
			const limit = clampLimit(query.limit);
			const artist = query.artist?.trim();
			const search = artist
				? await cache.getOrFetch(
						`danbooru:artist-resolution:${normalizeComparable(artist)}`,
						SERVER_OBJECT_TTL_MS,
						() => resolveDanbooruSearch(query, danbooruJson)
					)
				: await resolveDanbooruSearch(query, danbooruJson);
			if (!search) return { items: [], total: 0, nextCursor: null };

			const url = buildDanbooruPostsUrl(query, search, limit);
			const posts = await cache.getOrFetch(
				`danbooru:search:${url.search}`,
				SERVER_SEARCH_TTL_MS,
				() => danbooruJson<DanbooruPost[]>(url)
			);
			const normalized = posts
				.map(normalizeDanbooruPost)
				.filter((item): item is ExploreItem => item !== null)
				.filter((item) => permitsContent(item, query.contentSafety ?? 'blur'))
				.filter((item) => !matchesDanbooruBlacklist(item, query.blacklist ?? ''))
				.slice(0, limit);
			const lastPostId = numberOrNull(posts.at(-1)?.id);

			return {
				items: normalized,
				total: null,
				nextCursor: posts.length > 0 && lastPostId !== null ? `b${lastPostId}` : null
			};
		},
		async getById(id) {
			const nativeId = parseDanbooruNativeId(id);
			if (nativeId === null) throw new Error(`Invalid Danbooru item id: ${id}`);
			const item = await getPost(nativeId);
			if (!item) throw new Error(`Danbooru post has no usable image: ${id}`);
			return item;
		}
	};
}

export const danbooruConnector = createDanbooruConnector();

export function buildDanbooruPostsUrl(
	query: ExploreQuery,
	search: string,
	limit = clampLimit(query.limit)
): URL {
	const url = new URL('/posts.json', DANBOORU_BASE_URL);
	url.searchParams.set('tags', search);
	url.searchParams.set('limit', String(Math.min(MAX_LIMIT, limit * MAX_FETCH_MULTIPLIER)));
	if (query.cursor?.trim()) url.searchParams.set('page', query.cursor.trim());
	return url;
}

export async function resolveDanbooruSearch(
	query: ExploreQuery,
	request: <T>(url: URL) => Promise<T>
): Promise<string | null> {
	const artist = query.artist?.trim();
	if (!artist) return normalizeDanbooruTagQuery(query.tag ?? query.keyword ?? '');

	const url = new URL('/artists.json', DANBOORU_BASE_URL);
	url.searchParams.set('search[any_name_matches]', `*${normalizeSearchFragment(artist)}*`);
	url.searchParams.set('search[order]', 'post_count');
	url.searchParams.set('limit', '12');
	const artists = await request<DanbooruArtist[]>(url);
	const match = rankArtistMatch(artist, artists);
	return match ? stringOrNull(match.name) : normalizeDanbooruTag(artist);
}

export function normalizeDanbooruPost(post: DanbooruPost): ExploreItem | null {
	const id = numberOrNull(post.id);
	const original = stringOrNull(post.file_url) ?? variantUrl(post, 'original');
	const sample =
		variantUrl(post, '720x720') ??
		stringOrNull(post.large_file_url) ??
		variantUrl(post, 'sample') ??
		stringOrNull(post.preview_file_url);
	if (id === null || (!original && !sample)) return null;

	const artistTags = splitTags(post.tag_string_artist);
	const generalTags = splitTags(post.tag_string_general);
	const characterTags = splitTags(post.tag_string_character);
	const copyrightTags = splitTags(post.tag_string_copyright);
	const metaTags = splitTags(post.tag_string_meta);
	const allTags = splitTags(post.tag_string);
	const createdAt = stringOrNull(post.created_at);
	const contentRating = normalizeRating(post.rating);

	return {
		id: `danbooru-${id}`,
		source: 'danbooru',
		detailUrl: `${DANBOORU_BASE_URL}/posts/${id}`,
		title: artistTags.length > 0 ? `${displayTag(artistTags[0])} · #${id}` : `Danbooru #${id}`,
		artistRaw: artistTags.length > 0 ? artistTags.map(displayTag).join(', ') : null,
		artistBio: null,
		artistNationality: null,
		dateDisplay: createdAt ? createdAt.slice(0, 10) : null,
		yearStart: createdAt ? Number.parseInt(createdAt.slice(0, 4), 10) || null : null,
		yearEnd: createdAt ? Number.parseInt(createdAt.slice(0, 4), 10) || null : null,
		medium: null,
		mediumCategory: null,
		objectName: 'Image post',
		department: 'Danbooru',
		culture: copyrightTags.length > 0 ? copyrightTags.map(displayTag).join(', ') : null,
		period: null,
		thumbUrl: sample ?? original,
		imageUrl: original ?? sample,
		mimeType: mimeTypeForExtension(stringOrNull(post.file_ext)),
		additionalImages: [],
		isIIIF: false,
		description: sourceDescription(post.source),
		tags:
			allTags.length > 0
				? allTags
				: [...generalTags, ...characterTags, ...copyrightTags, ...metaTags],
		isHighlight: false,
		isPublicDomain: false,
		contentRating,
		rawMetadata: {
			danbooru: {
				postId: id,
				rating: stringOrNull(post.rating),
				score: numberOrNull(post.score),
				favoriteCount: numberOrNull(post.fav_count),
				width: numberOrNull(post.image_width),
				height: numberOrNull(post.image_height),
				fileSize: numberOrNull(post.file_size),
				fileExtension: stringOrNull(post.file_ext),
				source: stringOrNull(post.source),
				artistTags,
				generalTags,
				characterTags,
				copyrightTags,
				metaTags
			}
		}
	};
}

function mimeTypeForExtension(extension: string | null) {
	if (!extension) return null;
	const normalized = extension.toLowerCase().replace(/^\./, '');
	if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
	if (normalized === 'gif') return 'image/gif';
	if (normalized === 'png' || normalized === 'webp') return `image/${normalized}`;
	return null;
}

export function parseDanbooruNativeId(id: string): number | null {
	const match = /^(?:danbooru-)?(\d+)$/.exec(id);
	if (!match) return null;
	const parsed = Number(match[1]);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeDanbooruTagQuery(value: string): string | null {
	const tokens = value
		.trim()
		.split(/\s+/)
		.map((token) => normalizeDanbooruTag(token))
		.filter((token): token is string => Boolean(token));
	return tokens.length > 0 ? tokens.join(' ') : null;
}

export function matchesDanbooruBlacklist(item: ExploreItem, blacklist: string): boolean {
	const tags = new Set(item.tags.map((tag) => tag.toLowerCase()));
	const rating = item.contentRating ?? 'general';
	const rules = blacklist
		.split(/\r?\n|,/)
		.map((rule) => rule.trim())
		.filter(Boolean);

	return rules.some((rule) => {
		const terms = rule.split(/\s+/).filter(Boolean);
		return (
			terms.length > 0 &&
			terms.every((term) => {
				const negated = term.startsWith('-');
				const normalized = normalizeDanbooruTag(negated ? term.slice(1) : term);
				if (!normalized) return false;
				const present = normalized.startsWith('rating:')
					? ratingMatches(rating, normalized.slice('rating:'.length))
					: tags.has(normalized);
				return negated ? !present : present;
			})
		);
	});
}

function permitsContent(item: ExploreItem, mode: ExploreQuery['contentSafety']) {
	return mode !== 'hide' || item.contentRating === 'general' || item.contentRating == null;
}

function rankArtistMatch(query: string, artists: DanbooruArtist[]): DanbooruArtist | null {
	const normalizedQuery = normalizeComparable(query);
	const candidates = artists.filter(
		(artist) => artist.is_deleted !== true && artist.is_banned !== true && stringOrNull(artist.name)
	);
	return (
		candidates
			.map((artist) => {
				const names = [
					stringOrNull(artist.name),
					stringOrNull(artist.group_name),
					...arrayOfStrings(artist.other_names)
				].filter((name): name is string => Boolean(name));
				const normalizedNames = names.map(normalizeComparable);
				const score = normalizedNames.reduce((best, name) => {
					if (name === normalizedQuery) return Math.max(best, 100);
					if (name.startsWith(normalizedQuery)) return Math.max(best, 75);
					if (name.includes(normalizedQuery)) return Math.max(best, 50);
					return best;
				}, 0);
				return { artist, score };
			})
			.sort((a, b) => b.score - a.score)[0]?.artist ?? null
	);
}

function normalizeDanbooruTag(value: string): string | null {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return null;
	const prefix = trimmed.startsWith('-') ? '-' : '';
	const body = prefix ? trimmed.slice(1) : trimmed;
	if (!body) return null;
	if (body.includes(':')) {
		const [key, ...rest] = body.split(':');
		return `${prefix}${key.replace(/\s+/g, '_')}:${rest.join(':').replace(/\s+/g, '_')}`;
	}
	return `${prefix}${body.replace(/\s+/g, '_')}`;
}

function normalizeSearchFragment(value: string) {
	return value.trim().replace(/\*/g, '').replace(/\s+/g, '_');
}

function normalizeComparable(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
}

function splitTags(value: unknown): string[] {
	const stringValue = stringOrNull(value);
	return stringValue ? stringValue.split(/\s+/).filter(Boolean) : [];
}

function displayTag(value: string) {
	return value.replaceAll('_', ' ');
}

function sourceDescription(value: unknown) {
	const source = stringOrNull(value);
	return source ? `Originally posted at ${source}` : null;
}

function normalizeRating(value: unknown): ExploreContentRating | null {
	if (value === 'g') return 'general';
	if (value === 's') return 'sensitive';
	if (value === 'q') return 'questionable';
	if (value === 'e') return 'explicit';
	return null;
}

function ratingMatches(rating: ExploreContentRating, value: string) {
	const normalized = value.toLowerCase();
	return (
		normalized === rating ||
		(normalized === 'g' && rating === 'general') ||
		(normalized === 's' && rating === 'sensitive') ||
		(normalized === 'q' && rating === 'questionable') ||
		(normalized === 'e' && rating === 'explicit')
	);
}

function variantUrl(post: DanbooruPost, type: string): string | null {
	if (!Array.isArray(post.media_asset?.variants)) return null;
	const variant = (post.media_asset.variants as DanbooruMediaVariant[]).find(
		(candidate) => candidate.type === type
	);
	return stringOrNull(variant?.url);
}

function clampLimit(limit: number) {
	return Math.min(MAX_LIMIT, Math.max(1, Number.isInteger(limit) ? limit : DEFAULT_LIMIT));
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function arrayOfStrings(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
		: [];
}

async function responseText(response: Response) {
	try {
		return (await response.text()).slice(0, 240);
	} catch {
		return '';
	}
}

function danbooruErrorMessage(status: number, detail: string) {
	if (status === 401 || status === 403) {
		return 'Danbooru rejected this request. Check the optional login and API key configuration.';
	}
	if (status === 410) return 'Danbooru cannot page any farther through these results.';
	if (status === 422 || status === 424) {
		return detail || 'Danbooru could not understand that tag search.';
	}
	if (status === 429) return 'Danbooru is rate-limiting searches. Try again in a moment.';
	return `Danbooru request failed with ${status}${detail ? `: ${detail}` : ''}`;
}

function parseRetryAfter(value: string | null): number | null {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
	const date = Date.parse(value);
	if (!Number.isFinite(date)) return null;
	return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}
