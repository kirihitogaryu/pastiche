import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import type { ExploreContentRating, ExploreItem, ExploreQuery, SourceConnector } from '../types';
import { isRetryableMetStatus, MetRequestScheduler, RetryableMetError } from './met-scheduler';

const BLUESKY_API_URL = 'https://public.api.bsky.app';
const BLUESKY_SEARCH_API_URL = 'https://api.bsky.app';
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const DEFAULT_USER_AGENT = 'Pastiche/0.1 (local artist reference app)';

type BlueskyFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type BlueskyConnectorOptions = {
	fetch?: BlueskyFetch;
	cache?: ServerCache;
	userAgent?: string;
	concurrency?: number;
	requestsPerSecond?: number;
};

type BlueskyImageView = {
	thumb?: unknown;
	fullsize?: unknown;
	alt?: unknown;
	aspectRatio?: { width?: unknown; height?: unknown } | null;
};

type BlueskyPostView = {
	uri?: unknown;
	cid?: unknown;
	author?: {
		did?: unknown;
		handle?: unknown;
		displayName?: unknown;
	} | null;
	record?: {
		text?: unknown;
		createdAt?: unknown;
		tags?: unknown;
	} | null;
	embed?: {
		$type?: unknown;
		images?: unknown;
		media?: { images?: unknown } | null;
	} | null;
	labels?: unknown;
	indexedAt?: unknown;
	replyCount?: unknown;
	repostCount?: unknown;
	likeCount?: unknown;
};

type BlueskyAuthorFeedResponse = {
	feed?: unknown;
	cursor?: unknown;
};

type BlueskySearchResponse = {
	posts?: unknown;
	cursor?: unknown;
	hitsTotal?: unknown;
};

type BlueskyPostsResponse = {
	posts?: unknown;
};

export function createBlueskyConnector(options: BlueskyConnectorOptions = {}): SourceConnector {
	const fetcher = options.fetch ?? fetch;
	const cache = options.cache ?? new ServerCache(1200);
	const userAgent =
		options.userAgent ?? process.env.PASTICHE_BLUESKY_USER_AGENT?.trim() ?? DEFAULT_USER_AGENT;
	const scheduler = new MetRequestScheduler({
		concurrency: options.concurrency ?? 3,
		requestsPerSecond: options.requestsPerSecond ?? 5,
		maxRetries: 3,
		baseRetryDelayMs: 600
	});

	async function blueskyJson<T>(url: URL): Promise<T> {
		return scheduler.schedule(async () => {
			const response = await fetcher(url, {
				headers: {
					accept: 'application/json',
					'accept-encoding': 'gzip',
					'user-agent': userAgent
				},
				signal: AbortSignal.timeout(20_000)
			});
			if (!response.ok) {
				const detail = await responseText(response);
				if (isRetryableMetStatus(response.status)) {
					throw new RetryableMetError(
						response.status,
						blueskyErrorMessage(response.status, detail),
						parseRetryAfter(response.headers.get('retry-after'))
					);
				}
				throw new Error(blueskyErrorMessage(response.status, detail));
			}
			return (await response.json()) as T;
		});
	}

	async function getPost(uri: string): Promise<ExploreItem> {
		return cache.getOrFetch(`bluesky:post:${uri}`, SERVER_OBJECT_TTL_MS, async () => {
			const url = new URL('/xrpc/app.bsky.feed.getPosts', BLUESKY_API_URL);
			url.searchParams.append('uris', uri);
			const response = await blueskyJson<BlueskyPostsResponse>(url);
			const post = arrayOf<BlueskyPostView>(response.posts)[0];
			const item = post ? normalizeBlueskyPost(post) : null;
			if (!item) throw new Error('That Bluesky post has no supported image.');
			return item;
		});
	}

	return {
		id: 'bluesky',
		displayName: 'Bluesky',
		supportedFilters: ['artist', 'tag', 'has_image', 'sort'],
		async getDepartments() {
			return [];
		},
		async search(query) {
			const artist = normalizeActor(query.artist ?? '');
			const tagQuery = query.tag?.trim() ?? query.keyword?.trim() ?? '';
			if (!artist && !tagQuery) return { items: [], total: 0, nextCursor: null };

			const url = artist
				? buildBlueskyAuthorFeedUrl(artist, query)
				: buildBlueskyTagSearchUrl(tagQuery, query);
			const response = await cache.getOrFetch(
				`bluesky:search:${url.pathname}:${url.search}`,
				SERVER_SEARCH_TTL_MS,
				() =>
					artist
						? blueskyJson<BlueskyAuthorFeedResponse>(url)
						: blueskyJson<BlueskySearchResponse>(url)
			);
			const posts = artist
				? arrayOf<Record<string, unknown>>((response as BlueskyAuthorFeedResponse).feed)
						.filter((entry) => !entry.reason && !entry.reply)
						.map((entry) => entry.post)
						.filter(isRecord)
				: arrayOf<Record<string, unknown>>((response as BlueskySearchResponse).posts);
			const items = posts
				.map((post) => normalizeBlueskyPost(post as BlueskyPostView))
				.filter((item): item is ExploreItem => item !== null)
				.filter((item) => permitsContent(item, query.contentSafety ?? 'blur'));

			return {
				items,
				total: artist ? null : numberOrNull((response as BlueskySearchResponse).hitsTotal),
				nextCursor: stringOrNull(response.cursor)
			};
		},
		async getById(id) {
			const uri = decodeBlueskyItemId(id);
			if (!uri) throw new Error(`Invalid Bluesky item id: ${id}`);
			return getPost(uri);
		}
	};
}

export const blueskyConnector = createBlueskyConnector();

export function buildBlueskyAuthorFeedUrl(actor: string, query: ExploreQuery): URL {
	const url = new URL('/xrpc/app.bsky.feed.getAuthorFeed', BLUESKY_API_URL);
	url.searchParams.set('actor', actor);
	url.searchParams.set('filter', 'posts_with_media');
	url.searchParams.set('includePins', 'false');
	url.searchParams.set('limit', String(clampLimit(query.limit)));
	if (query.cursor?.trim()) url.searchParams.set('cursor', query.cursor.trim());
	return url;
}

export function buildBlueskyTagSearchUrl(search: string, query: ExploreQuery): URL {
	// Bluesky exposes search from the AppView host used by its own client. The
	// cached public host serves author feeds but currently rejects searchPosts.
	const url = new URL('/xrpc/app.bsky.feed.searchPosts', BLUESKY_SEARCH_API_URL);
	url.searchParams.set('q', search);
	url.searchParams.set('sort', query.sort === 'popular' ? 'top' : 'latest');
	url.searchParams.set('limit', String(clampLimit(query.limit)));
	for (const tag of explicitTags(search)) url.searchParams.append('tag', tag);
	if (query.cursor?.trim()) url.searchParams.set('cursor', query.cursor.trim());
	return url;
}

export function normalizeBlueskyPost(post: BlueskyPostView): ExploreItem | null {
	const uri = stringOrNull(post.uri);
	const authorDid = stringOrNull(post.author?.did);
	const handle = stringOrNull(post.author?.handle);
	const images = blueskyImages(post.embed);
	if (!uri || !authorDid || images.length === 0) return null;
	const rkey = uri.split('/').at(-1);
	if (!rkey) return null;

	const record = isRecord(post.record) ? post.record : {};
	const text = stringOrNull(record.text) ?? '';
	const createdAt = stringOrNull(record.createdAt) ?? stringOrNull(post.indexedAt);
	const displayName = stringOrNull(post.author?.displayName);
	const authorLabel = displayName || handle || authorDid;
	const tags = uniqueStrings([...arrayOf<string>(record.tags), ...hashtagsFromText(text)]);
	const contentRating = blueskyContentRating(post.labels);
	const primary = images[0];

	return {
		id: encodeBlueskyItemId(uri),
		source: 'bluesky',
		detailUrl: `https://bsky.app/profile/${encodeURIComponent(authorDid)}/post/${encodeURIComponent(rkey)}`,
		title: titleFromPost(text, authorLabel),
		artistRaw: authorLabel,
		artistBio: null,
		artistNationality: null,
		dateDisplay: createdAt ? createdAt.slice(0, 10) : null,
		yearStart: createdAt ? Number.parseInt(createdAt.slice(0, 4), 10) || null : null,
		yearEnd: createdAt ? Number.parseInt(createdAt.slice(0, 4), 10) || null : null,
		medium: null,
		mediumCategory: null,
		objectName: images.length > 1 ? `Image post · ${images.length} images` : 'Image post',
		department: 'Bluesky',
		culture: null,
		period: null,
		thumbUrl: primary.thumb ?? primary.fullsize,
		imageUrl: primary.fullsize ?? primary.thumb,
		additionalImages: images.slice(1).map((image) => image.fullsize ?? image.thumb),
		isIIIF: false,
		description: text || primary.alt || null,
		tags,
		isHighlight: false,
		isPublicDomain: false,
		contentRating,
		rawMetadata: {
			bluesky: {
				uri,
				cid: stringOrNull(post.cid),
				authorDid,
				authorHandle: handle,
				authorDisplayName: displayName,
				authorProfileUrl: `https://bsky.app/profile/${encodeURIComponent(handle ?? authorDid)}`,
				width: primary.width,
				height: primary.height,
				imageCount: images.length,
				imageAlts: images.map((image) => image.alt),
				labels: arrayOf<Record<string, unknown>>(post.labels).map((label) => label.val),
				replyCount: numberOrNull(post.replyCount),
				repostCount: numberOrNull(post.repostCount),
				likeCount: numberOrNull(post.likeCount)
			}
		}
	};
}

function blueskyImages(embed: BlueskyPostView['embed']) {
	if (!isRecord(embed)) return [];
	const source = Array.isArray(embed.images)
		? embed.images
		: isRecord(embed.media) && Array.isArray(embed.media.images)
			? embed.media.images
			: [];
	return source
		.map((value) => {
			const image = value as BlueskyImageView;
			const thumb = stringOrNull(image.thumb);
			const fullsize = stringOrNull(image.fullsize);
			if (!thumb && !fullsize) return null;
			return {
				thumb,
				fullsize: fullsize ?? thumb!,
				alt: stringOrNull(image.alt),
				width: numberOrNull(image.aspectRatio?.width),
				height: numberOrNull(image.aspectRatio?.height)
			};
		})
		.filter((image): image is NonNullable<typeof image> => image !== null);
}

function blueskyContentRating(labels: unknown): ExploreContentRating {
	const values = arrayOf<Record<string, unknown>>(labels)
		.map((label) => stringOrNull(label.val)?.toLocaleLowerCase())
		.filter((value): value is string => Boolean(value));
	if (values.some((value) => ['porn', 'sexual', 'nudity'].includes(value))) return 'explicit';
	if (values.some((value) => ['graphic-media', 'gore'].includes(value))) return 'sensitive';
	if (values.some((value) => ['suggestive', 'adult'].includes(value))) return 'questionable';
	return 'general';
}

function permitsContent(item: ExploreItem, safety: 'hide' | 'blur' | 'show') {
	return safety !== 'hide' || item.contentRating === 'general';
}

function encodeBlueskyItemId(uri: string) {
	return `bluesky-${Buffer.from(uri, 'utf8').toString('base64url')}`;
}

function decodeBlueskyItemId(id: string) {
	if (!id.startsWith('bluesky-')) return null;
	try {
		const uri = Buffer.from(id.slice('bluesky-'.length), 'base64url').toString('utf8');
		return uri.startsWith('at://') ? uri : null;
	} catch {
		return null;
	}
}

function normalizeActor(value: string) {
	const trimmed = value.trim().replace(/^@/, '');
	if (!trimmed) return '';
	try {
		const url = new URL(trimmed);
		if (url.hostname === 'bsky.app') {
			const parts = url.pathname.split('/').filter(Boolean);
			if (parts[0] === 'profile' && parts[1]) return decodeURIComponent(parts[1]);
		}
	} catch {
		// A handle or DID is the normal input.
	}
	return trimmed;
}

function explicitTags(value: string) {
	if (!value.includes(',') && !value.trim().startsWith('#')) return [];
	return uniqueStrings(
		value
			.split(/[,\s]+/)
			.map((tag) => tag.replace(/^#/, '').trim())
			.filter(Boolean)
	);
}

function hashtagsFromText(value: string) {
	return Array.from(value.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu), (match) => match[1]);
}

function titleFromPost(text: string, author: string) {
	const firstLine = text.split(/\r?\n/, 1)[0]?.trim();
	if (!firstLine) return `Image post by ${author}`;
	return firstLine.length > 90 ? `${firstLine.slice(0, 87).trimEnd()}…` : firstLine;
}

function uniqueStrings(values: string[]) {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clampLimit(value: number) {
	return Math.min(MAX_LIMIT, Math.max(1, Math.round(value || DEFAULT_LIMIT)));
}

function arrayOf<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
	const numeric = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(numeric) ? numeric : null;
}

function parseRetryAfter(value: string | null) {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function responseText(response: Response) {
	try {
		return (await response.text()).slice(0, 400);
	} catch {
		return '';
	}
}

function blueskyErrorMessage(status: number, detail: string) {
	if (status === 429) return 'Bluesky is rate limiting requests. Pastiche will retry shortly.';
	if (status === 400 || status === 404) return 'That Bluesky artist or search could not be found.';
	return `Bluesky request failed (HTTP ${status})${detail ? `: ${detail}` : ''}`;
}
