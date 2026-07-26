import { env } from '$env/dynamic/private';
import { load } from 'cheerio';
import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import type { ExploreContentRating, ExploreItem, ExploreQuery, SourceConnector } from '../types';
import { isRetryableMetStatus, MetRequestScheduler, RetryableMetError } from './met-scheduler';

const FURAFFINITY_BASE_URL = 'https://www.furaffinity.net';
const DEFAULT_LIMIT = 48;
const DEFAULT_USER_AGENT = 'Pastiche/0.1 (local artist reference app)';

type FurAffinityFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type FurAffinityConnectorOptions = {
	fetch?: FurAffinityFetch;
	cache?: ServerCache;
	cookieA?: string | null;
	cookieB?: string | null;
	userAgent?: string;
	requestsPerSecond?: number;
};

export function createFurAffinityConnector(
	options: FurAffinityConnectorOptions = {}
): SourceConnector {
	const fetcher = options.fetch ?? fetch;
	const cache = options.cache ?? new ServerCache(1000);
	const cookieA =
		options.cookieA !== undefined
			? options.cookieA
			: (env.FURAFFINITY_COOKIE_A?.trim() ?? process.env.FURAFFINITY_COOKIE_A?.trim() ?? null);
	const cookieB =
		options.cookieB !== undefined
			? options.cookieB
			: (env.FURAFFINITY_COOKIE_B?.trim() ?? process.env.FURAFFINITY_COOKIE_B?.trim() ?? null);
	const userAgent =
		options.userAgent ??
		env.PASTICHE_FURAFFINITY_USER_AGENT?.trim() ??
		process.env.PASTICHE_FURAFFINITY_USER_AGENT?.trim() ??
		DEFAULT_USER_AGENT;
	const scheduler = new MetRequestScheduler({
		concurrency: 1,
		requestsPerSecond: Math.min(1, options.requestsPerSecond ?? 1),
		maxRetries: 2,
		baseRetryDelayMs: 1200
	});

	function assertConfigured() {
		if (cookieA && cookieB) return;
		throw new Error(
			'Fur Affinity is not configured. Add FURAFFINITY_COOKIE_A and FURAFFINITY_COOKIE_B from your own Fur Affinity session to .env.local, then restart Pastiche.'
		);
	}

	async function furAffinityHtml(url: URL): Promise<string> {
		assertConfigured();
		await assertRobotsAllowed(url);
		return scheduler.schedule(async () => {
			const response = await fetcher(url, {
				headers: {
					accept: 'text/html,application/xhtml+xml',
					'accept-encoding': 'gzip',
					cookie: `a=${cookieA}; b=${cookieB}`,
					'user-agent': userAgent
				},
				redirect: 'follow',
				signal: AbortSignal.timeout(25_000)
			});
			if (!response.ok) {
				const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 240);
				if (isRetryableMetStatus(response.status)) {
					throw new RetryableMetError(
						response.status,
						furAffinityErrorMessage(response.status, detail),
						parseRetryAfter(response.headers.get('retry-after'))
					);
				}
				throw new Error(furAffinityErrorMessage(response.status, detail));
			}
			return response.text();
		});
	}

	async function assertRobotsAllowed(url: URL) {
		const rules = await cache.getOrFetch('furaffinity:robots', 24 * 60 * 60 * 1000, async () => {
			const response = await fetcher(new URL('/robots.txt', FURAFFINITY_BASE_URL), {
				headers: { 'user-agent': userAgent },
				signal: AbortSignal.timeout(10_000)
			});
			return response.ok ? parseRobots(await response.text()) : [];
		});
		const blocked = rules
			.filter((rule) => rule.type === 'disallow' && rule.value !== '/')
			.some((rule) => url.pathname.startsWith(rule.value));
		if (blocked) throw new Error('Fur Affinity does not permit automated access to this page.');
	}

	async function getSubmission(nativeId: string): Promise<ExploreItem> {
		return cache.getOrFetch(
			`furaffinity:submission:${nativeId}`,
			SERVER_OBJECT_TTL_MS,
			async () => {
				const url = new URL(`/view/${nativeId}/`, FURAFFINITY_BASE_URL);
				const item = normalizeFurAffinitySubmission(await furAffinityHtml(url), nativeId);
				if (!item) throw new Error(`Fur Affinity submission has no usable image: ${nativeId}`);
				return item;
			}
		);
	}

	return {
		id: 'furaffinity',
		displayName: 'Fur Affinity',
		supportedFilters: ['artist', 'has_image'],
		async getDepartments() {
			return [];
		},
		async search(query) {
			const artist = normalizeUsername(query.artist ?? '');
			if (!artist) {
				if (query.tag?.trim()) {
					throw new Error('Fur Affinity tag search is not available in this version.');
				}
				return { items: [], total: 0, nextCursor: null };
			}
			const page = parsePageCursor(query.cursor);
			const url = new URL(`/gallery/${encodeURIComponent(artist)}/${page}/`, FURAFFINITY_BASE_URL);
			const html = await cache.getOrFetch(
				`furaffinity:gallery:${artist}:${page}`,
				SERVER_SEARCH_TTL_MS,
				() => furAffinityHtml(url)
			);
			const parsed = normalizeFurAffinityGallery(html, artist);
			const items = parsed.items
				.filter((item) => permitsContent(item, query.contentSafety ?? 'blur'))
				.slice(0, Math.max(1, query.limit || DEFAULT_LIMIT));
			return {
				items,
				total: null,
				nextCursor: parsed.hasNext ? `page:${page + 1}` : null
			};
		},
		async getById(id) {
			const nativeId = parseFurAffinityNativeId(id);
			if (!nativeId) throw new Error(`Invalid Fur Affinity item id: ${id}`);
			return getSubmission(nativeId);
		}
	};
}

export const furAffinityConnector = createFurAffinityConnector();

export function normalizeFurAffinityGallery(html: string, artist: string) {
	const $ = load(html);
	const items: ExploreItem[] = [];
	const seen = new Set<string>();
	$('figure[id^="sid-"], figure').each((_index, element) => {
		const figure = $(element);
		const link = figure.find('a[href*="/view/"]').first();
		const href = link.attr('href');
		const nativeId = href?.match(/\/view\/(\d+)/)?.[1];
		if (!nativeId || seen.has(nativeId)) return;
		const image = figure.find('img').first();
		const thumb = absoluteUrl(
			image.attr('data-src') ?? image.attr('data-original') ?? image.attr('src')
		);
		if (!thumb) return;
		seen.add(nativeId);
		const title =
			figure.find('figcaption a[href*="/view/"]').first().text().trim() ||
			image.attr('alt')?.trim() ||
			`Fur Affinity #${nativeId}`;
		const authorLink = figure.find('a[href^="/user/"]').first();
		const author = authorLink.text().trim() || artist;
		const contentRating = ratingFromElement(figure.attr('class'), figure.attr('data-rating'));
		items.push({
			id: `furaffinity-${nativeId}`,
			source: 'furaffinity',
			detailUrl: `${FURAFFINITY_BASE_URL}/view/${nativeId}/`,
			title,
			artistRaw: author,
			artistBio: null,
			artistNationality: null,
			dateDisplay: null,
			yearStart: null,
			yearEnd: null,
			medium: null,
			mediumCategory: null,
			objectName: 'Image submission',
			department: 'Fur Affinity',
			culture: null,
			period: null,
			thumbUrl: thumb,
			imageUrl: thumb,
			additionalImages: [],
			isIIIF: false,
			description: null,
			tags: [],
			isHighlight: false,
			isPublicDomain: false,
			contentRating,
			rawMetadata: {
				furaffinity: {
					submissionId: nativeId,
					authorUsername: author,
					authorProfileUrl: `${FURAFFINITY_BASE_URL}/user/${encodeURIComponent(author)}/`,
					partial: true
				}
			}
		});
	});

	const hasNext =
		$('a[rel="next"], a.button.standard.right, a:contains("Next")')
			.toArray()
			.some((element) => ($(element).attr('href') ?? '').includes('/gallery/')) ||
		items.length >= 24;
	return { items, hasNext };
}

export function normalizeFurAffinitySubmission(html: string, nativeId: string): ExploreItem | null {
	const $ = load(html);
	const image = $('img#submissionImg, .submission-content img, img[data-fullview-src]')
		.filter((_index, element) => {
			const src =
				$(element).attr('data-fullview-src') ??
				$(element).attr('data-src') ??
				$(element).attr('src') ??
				'';
			return !src.includes('avatar') && !src.includes('/themes/');
		})
		.first();
	const imageUrl = absoluteUrl(
		image.attr('data-fullview-src') ??
			image.attr('data-original') ??
			image.attr('data-src') ??
			image.attr('src') ??
			$('meta[property="og:image"]').attr('content')
	);
	if (!imageUrl) return null;

	const title =
		$('.submission-title p').first().text().trim() ||
		$('meta[property="og:title"]').attr('content')?.trim() ||
		$('h2').first().text().trim() ||
		`Fur Affinity #${nativeId}`;
	const authorLink = $('a[href^="/user/"]')
		.filter((_i, element) => {
			return !$(element).closest('.comments-list').length;
		})
		.first();
	const authorFromPath = authorLink.attr('href')?.match(/\/user\/([^/]+)/)?.[1];
	const author = authorLink.text().trim() || authorFromPath || null;
	const authorUsername = authorFromPath ?? author;
	const dateElement = $('time[datetime], span.popup_date').first();
	const date =
		dateElement.attr('datetime') ??
		dateElement.attr('title') ??
		dateElement.attr('data-timestamp') ??
		dateElement.text().trim() ??
		null;
	const dateDisplay = normalizeDate(date);
	const tags = uniqueStrings(
		$('a[href*="/search/@keywords"], .tags-row a, section.tags a')
			.toArray()
			.map((element) => $(element).text().trim())
	);
	const description =
		$('.submission-description, .user-submitted-links').first().text().trim() ||
		$('meta[property="og:description"]').attr('content')?.trim() ||
		null;
	const ratingText =
		$('[class*="rating"], .rating').first().attr('class') ??
		$('[class*="rating"], .rating').first().text();
	const contentRating = ratingFromElement(ratingText, null);
	const width = positiveNumber(image.attr('data-width') ?? image.attr('width'));
	const height = positiveNumber(image.attr('data-height') ?? image.attr('height'));

	return {
		id: `furaffinity-${nativeId}`,
		source: 'furaffinity',
		detailUrl: `${FURAFFINITY_BASE_URL}/view/${nativeId}/`,
		title,
		artistRaw: author,
		artistBio: null,
		artistNationality: null,
		dateDisplay,
		yearStart: dateDisplay ? Number.parseInt(dateDisplay.slice(0, 4), 10) || null : null,
		yearEnd: dateDisplay ? Number.parseInt(dateDisplay.slice(0, 4), 10) || null : null,
		medium: null,
		mediumCategory: null,
		objectName: 'Image submission',
		department: 'Fur Affinity',
		culture: null,
		period: null,
		thumbUrl: imageUrl,
		imageUrl,
		additionalImages: [],
		isIIIF: false,
		description,
		tags,
		isHighlight: false,
		isPublicDomain: false,
		contentRating,
		rawMetadata: {
			furaffinity: {
				submissionId: nativeId,
				authorUsername,
				authorProfileUrl: authorUsername
					? `${FURAFFINITY_BASE_URL}/user/${encodeURIComponent(authorUsername)}/`
					: null,
				width,
				height,
				rating: contentRating,
				partial: false
			}
		}
	};
}

function parseRobots(value: string) {
	const rules: Array<{ type: 'disallow'; value: string }> = [];
	let applies = false;
	for (const rawLine of value.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*$/, '').trim();
		const [field, ...rest] = line.split(':');
		const detail = rest.join(':').trim();
		if (field?.trim().toLocaleLowerCase() === 'user-agent') {
			applies = detail === '*';
		} else if (applies && field?.trim().toLocaleLowerCase() === 'disallow' && detail) {
			rules.push({ type: 'disallow', value: detail });
		}
	}
	return rules;
}

function normalizeUsername(value: string) {
	const trimmed = value.trim().replace(/^@/, '');
	if (!trimmed) return '';
	try {
		const url = new URL(trimmed);
		if (url.hostname.endsWith('furaffinity.net')) {
			return decodeURIComponent(url.pathname.match(/\/(?:user|gallery)\/([^/]+)/)?.[1] ?? '');
		}
	} catch {
		// A username is the normal input.
	}
	return trimmed.replace(/[^a-zA-Z0-9_.~-]/g, '');
}

function parsePageCursor(value: string | undefined) {
	const match = value?.match(/^page:(\d+)$/);
	return match ? Math.max(1, Number.parseInt(match[1], 10)) : 1;
}

function parseFurAffinityNativeId(id: string) {
	return id.match(/^furaffinity-(\d+)$/)?.[1] ?? null;
}

function ratingFromElement(...values: Array<string | null | undefined>): ExploreContentRating {
	const value = values.filter(Boolean).join(' ').toLocaleLowerCase();
	if (/\badult\b|\br-adult\b|\bexplicit\b/.test(value)) return 'explicit';
	if (/\bmature\b|\br-mature\b/.test(value)) return 'questionable';
	return 'general';
}

function permitsContent(item: ExploreItem, safety: 'hide' | 'blur' | 'show') {
	return safety !== 'hide' || item.contentRating === 'general';
}

function absoluteUrl(value: string | null | undefined) {
	if (!value?.trim()) return null;
	try {
		return new URL(value.trim(), FURAFFINITY_BASE_URL).toString();
	} catch {
		return null;
	}
}

function normalizeDate(value: string | null) {
	if (!value) return null;
	const timestamp = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value);
	return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

function positiveNumber(value: unknown) {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function uniqueStrings(values: string[]) {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseRetryAfter(value: string | null) {
	if (!value) return null;
	const seconds = Number(value);
	return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
}

function furAffinityErrorMessage(status: number, detail: string) {
	if (status === 401 || status === 403) {
		return 'Fur Affinity rejected the configured session. Refresh FURAFFINITY_COOKIE_A and FURAFFINITY_COOKIE_B, then restart Pastiche.';
	}
	if (status === 404) return 'That Fur Affinity artist or submission could not be found.';
	if (status === 429) return 'Fur Affinity is rate limiting requests. Pastiche will retry slowly.';
	return `Fur Affinity request failed (HTTP ${status})${detail ? `: ${detail}` : ''}`;
}
