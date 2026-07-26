import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from '../server-cache';
import type { ExploreQuery } from '../types';
import {
	buildDanbooruPostsUrl,
	createDanbooruConnector,
	matchesDanbooruBlacklist,
	normalizeDanbooruPost,
	parseDanbooruNativeId
} from './danbooru';

const post = {
	id: 42,
	created_at: '2026-07-24T04:05:14.073-04:00',
	score: 18,
	source: 'https://artist.example/post/42',
	rating: 'q',
	image_width: 1200,
	image_height: 900,
	file_ext: 'png',
	file_size: 123456,
	fav_count: 7,
	tag_string: 'dragon green_scales original',
	tag_string_general: 'dragon green_scales',
	tag_string_character: '',
	tag_string_copyright: 'original',
	tag_string_artist: 'test_artist',
	tag_string_meta: '',
	file_url: 'https://cdn.donmai.us/original/test.png',
	large_file_url: 'https://cdn.donmai.us/sample/test.jpg',
	preview_file_url: 'https://cdn.donmai.us/180x180/test.jpg',
	media_asset: {
		variants: [
			{ type: '720x720', url: 'https://cdn.donmai.us/720x720/test.webp' },
			{ type: 'original', url: 'https://cdn.donmai.us/original/test.png' }
		]
	}
};

describe('Danbooru connector helpers', () => {
	it('normalizes posts with original images, artist names, tags, and ratings', () => {
		expect(normalizeDanbooruPost(post)).toMatchObject({
			id: 'danbooru-42',
			source: 'danbooru',
			title: 'test artist · #42',
			artistRaw: 'test artist',
			thumbUrl: 'https://cdn.donmai.us/720x720/test.webp',
			imageUrl: 'https://cdn.donmai.us/original/test.png',
			contentRating: 'questionable',
			tags: ['dragon', 'green_scales', 'original']
		});
	});

	it('builds stable before-id pagination URLs', () => {
		const query: ExploreQuery = { tag: 'green dragon', cursor: 'b42', limit: 40 };
		const url = buildDanbooruPostsUrl(query, 'green dragon');
		expect(url.pathname).toBe('/posts.json');
		expect(url.searchParams.get('tags')).toBe('green dragon');
		expect(url.searchParams.get('page')).toBe('b42');
		expect(url.searchParams.get('limit')).toBe('100');
	});

	it('matches blacklist lines as AND rules and lines as OR rules', () => {
		const item = normalizeDanbooruPost(post);
		expect(item).not.toBeNull();
		if (!item) return;
		expect(matchesDanbooruBlacklist(item, 'dragon rating:q')).toBe(true);
		expect(matchesDanbooruBlacklist(item, 'cat, green_scales')).toBe(true);
		expect(matchesDanbooruBlacklist(item, 'dragon -green_scales')).toBe(false);
	});

	it('parses only namespaced or numeric post ids', () => {
		expect(parseDanbooruNativeId('danbooru-42')).toBe(42);
		expect(parseDanbooruNativeId('42')).toBe(42);
		expect(parseDanbooruNativeId('met-42')).toBeNull();
	});
});

describe('Danbooru connector', () => {
	it('resolves an artist and returns normalized posts', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			if (url.pathname === '/artists.json') {
				return Response.json([
					{ name: 'someone_else', other_names: [] },
					{ name: 'test_artist', other_names: ['Test Artist'] }
				]);
			}
			if (url.pathname === '/posts.json') {
				expect(url.searchParams.get('tags')).toBe('test_artist');
				return Response.json([post]);
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		const connector = createDanbooruConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			login: null,
			apiKey: null,
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			artist: 'Test Artist',
			contentSafety: 'show',
			limit: 40
		});

		expect(page.items).toHaveLength(1);
		expect(page.items[0]?.id).toBe('danbooru-42');
		expect(page.nextCursor).toBe('b42');

		await connector.search({
			artist: 'Test Artist',
			contentSafety: 'hide',
			limit: 40
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('hides non-general work and applies blacklist rules without live calls', async () => {
		const fetchMock = vi.fn(async () => Response.json([post]));
		const connector = createDanbooruConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			login: null,
			apiKey: null,
			requestsPerSecond: 1000
		});

		await expect(
			connector.search({ tag: 'dragon', contentSafety: 'hide', limit: 40 })
		).resolves.toMatchObject({ items: [] });
		await expect(
			connector.search({
				tag: 'dragon',
				contentSafety: 'show',
				blacklist: 'green_scales',
				limit: 40
			})
		).resolves.toMatchObject({ items: [] });
	});

	it('retries a rate-limited request and identifies compressed API traffic', async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const headers = init?.headers as Record<string, string>;
			expect(headers['user-agent']).toContain('Pastiche');
			expect(headers['accept-encoding']).toBe('gzip');
			if (fetchMock.mock.calls.length === 1) {
				return new Response(null, { status: 429, headers: { 'retry-after': '0' } });
			}
			return Response.json([post]);
		});
		const connector = createDanbooruConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			login: null,
			apiKey: null,
			requestsPerSecond: 1000
		});

		const page = await connector.search({ tag: 'dragon', contentSafety: 'show', limit: 40 });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(page.items).toHaveLength(1);
	});
});
