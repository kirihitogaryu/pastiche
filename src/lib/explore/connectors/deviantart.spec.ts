import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from '../server-cache';
import type { ExploreQuery } from '../types';
import {
	buildDeviantArtSearchUrl,
	createDeviantArtConnector,
	normalizeDeviantArtDeviation,
	normalizeDeviantArtPage,
	parseDeviantArtNativeId
} from './deviantart';

const deviationId = '9B52BC18-A3C0-8F6E-9A3D-CC30EE0EB4BC';
const deviation = {
	deviationid: deviationId,
	url: 'https://www.deviantart.com/test-artist/art/Dragon-Study-123',
	title: 'Dragon Study',
	is_mature: false,
	is_downloadable: true,
	published_time: '1667326321',
	category_path: 'digitalart/drawings',
	author: {
		userid: 'AUTHOR-ID',
		username: 'Test-Artist',
		type: 'regular'
	},
	content: {
		src: 'https://images.example.test/full.jpg',
		width: 1200,
		height: 1600,
		filesize: 320000
	},
	thumbs: [
		{ src: 'https://images.example.test/150.jpg', width: 112, height: 150 },
		{ src: 'https://images.example.test/300.jpg', width: 225, height: 300 }
	]
};

describe('DeviantArt connector helpers', () => {
	it('builds artist and tag requests with bounded pagination', () => {
		const artistUrl = buildDeviantArtSearchUrl({
			artist: 'Test-Artist',
			contentSafety: 'hide',
			cursor: 'offset:24',
			limit: 40
		} satisfies ExploreQuery);
		expect(artistUrl?.pathname).toBe('/api/v1/oauth2/gallery/all');
		expect(artistUrl?.searchParams.get('username')).toBe('Test-Artist');
		expect(artistUrl?.searchParams.get('offset')).toBe('24');
		expect(artistUrl?.searchParams.get('limit')).toBe('24');
		expect(artistUrl?.searchParams.get('mature_content')).toBe('false');

		const tagUrl = buildDeviantArtSearchUrl({
			tag: '#dragon art',
			contentSafety: 'blur',
			cursor: 'cursor:next-page',
			limit: 40
		} satisfies ExploreQuery);
		expect(tagUrl?.pathname).toBe('/api/v1/oauth2/browse/tags');
		expect(tagUrl?.searchParams.get('tag')).toBe('dragonart');
		expect(tagUrl?.searchParams.get('cursor')).toBe('next-page');
		expect(tagUrl?.searchParams.get('mature_content')).toBe('true');
	});

	it('normalizes author identity, images, metadata, and mature state', () => {
		expect(
			normalizeDeviantArtDeviation(deviation, {
				deviationid: deviationId,
				description: '<p>A study of a &amp; b.</p>',
				license: 'No License',
				tags: [{ tag_name: 'dragon' }, { tag_name: 'characterdesign' }],
				is_mature: true
			})
		).toMatchObject({
			id: `deviantart-${deviationId}`,
			source: 'deviantart',
			title: 'Dragon Study',
			artistRaw: 'Test-Artist',
			thumbUrl: 'https://images.example.test/300.jpg',
			imageUrl: 'https://images.example.test/full.jpg',
			description: 'A study of a & b.',
			tags: ['dragon', 'characterdesign'],
			contentRating: 'sensitive',
			rawMetadata: {
				deviantart: {
					authorUsername: 'Test-Artist',
					authorProfileUrl: 'https://www.deviantart.com/Test-Artist',
					width: 1200,
					height: 1600
				}
			}
		});
	});

	it('parses namespaced deviation UUIDs', () => {
		expect(parseDeviantArtNativeId(`deviantart-${deviationId}`)).toBe(deviationId);
		expect(parseDeviantArtNativeId('deviantart-42')).toBeNull();
	});

	it('filters exact date bounds and ranks loaded results by DeviantArt popularity', () => {
		const olderPopular = {
			...deviation,
			deviationid: '11111111-1111-1111-1111-111111111111',
			title: 'Older popular work',
			published_time: '1451520000',
			stats: { favourites: 500, comments: 30 }
		};
		const newerQuiet = {
			...deviation,
			deviationid: '22222222-2222-2222-2222-222222222222',
			title: 'Newer quiet work',
			published_time: '1451692800',
			stats: { favourites: 10, comments: 2 }
		};
		const page = normalizeDeviantArtPage(
			{ results: [newerQuiet, olderPopular], has_more: true, next_offset: 24 },
			{
				artist: 'Test-Artist',
				dateFrom: '2015-01-01',
				dateTo: '2016-01-02',
				sort: 'popular',
				limit: 24
			}
		);

		expect(page.items.map((item) => item.title)).toEqual(['Older popular work']);
		expect(page.nextCursor).toBe('offset:24');
		expect(page.items[0].rawMetadata.deviantart).toMatchObject({
			favourites: 500,
			comments: 30
		});
	});

	it('stops pagination after crossing the lower date boundary', () => {
		const page = normalizeDeviantArtPage(
			{
				results: [
					{ ...deviation, published_time: '1451692800' },
					{
						...deviation,
						deviationid: '33333333-3333-3333-3333-333333333333',
						published_time: '1420070399'
					}
				],
				has_more: true,
				next_offset: 24
			},
			{ artist: 'Test-Artist', dateFrom: '2016-01-01', limit: 24 }
		);

		expect(page.items).toHaveLength(1);
		expect(page.nextCursor).toBeNull();
	});
});

describe('DeviantArt connector', () => {
	it('caches one client token across search requests and uses compressed identified traffic', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input));
			const headers = init?.headers as Record<string, string>;
			expect(headers['user-agent']).toContain('Pastiche');
			expect(headers['accept-encoding']).toBe('gzip');
			if (url.pathname === '/oauth2/token') {
				expect(headers.authorization).toMatch(/^Basic /);
				return Response.json({ access_token: 'test-token', expires_in: 3600 });
			}
			expect(headers.authorization).toBe('Bearer test-token');
			expect(headers['dA-minor-version']).toBe('20240701');
			return Response.json({
				results: [deviation],
				has_more: true,
				next_offset: 24
			});
		});
		const connector = createDeviantArtConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			clientId: 'client-id',
			clientSecret: 'client-secret',
			requestsPerSecond: 1000
		});

		const first = await connector.search({
			artist: 'Test-Artist',
			contentSafety: 'show',
			limit: 40
		});
		const second = await connector.search({
			tag: 'dragon',
			contentSafety: 'show',
			limit: 40
		});

		expect(first.items).toHaveLength(1);
		expect(first.nextCursor).toBe('offset:24');
		expect(second.items).toHaveLength(1);
		expect(
			fetchMock.mock.calls.filter(([input]) => String(input).includes('/oauth2/token'))
		).toHaveLength(1);
	});

	it('refreshes an expired token after one unauthorized response', async () => {
		let tokenCount = 0;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			if (url.pathname === '/oauth2/token') {
				tokenCount += 1;
				return Response.json({ access_token: `token-${tokenCount}`, expires_in: 3600 });
			}
			if (tokenCount === 1) {
				return Response.json(
					{ error: 'unauthorized', error_description: 'Expired token' },
					{ status: 401 }
				);
			}
			return Response.json({ results: [deviation], has_more: false });
		});
		const connector = createDeviantArtConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			clientId: 'client-id',
			clientSecret: 'client-secret',
			requestsPerSecond: 1000
		});

		await expect(
			connector.search({ tag: 'dragon', contentSafety: 'show', limit: 40 })
		).resolves.toMatchObject({ items: [{ id: `deviantart-${deviationId}` }] });
		expect(tokenCount).toBe(2);
	});

	it('returns an actionable error when credentials are absent', async () => {
		const connector = createDeviantArtConnector({
			fetch: vi.fn(),
			cache: new ServerCache(),
			clientId: null,
			clientSecret: null,
			requestsPerSecond: 1000
		});
		await expect(connector.search({ artist: 'test', limit: 24 })).rejects.toThrow(
			'DEVIANTART_CLIENT_ID'
		);
	});
});
