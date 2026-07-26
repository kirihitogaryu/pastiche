import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExploreItem } from '$lib/explore/types';
import { WikimediaTemporaryError } from '$lib/explore/wikimedia-request';
import { RetryableMetError } from '$lib/explore/connectors/met-scheduler';

const search = vi.fn();
const searchArtic = vi.fn();
const searchWikidata = vi.fn();
const searchDanbooru = vi.fn();
const searchDeviantArt = vi.fn();

vi.mock('$lib/explore/connectors', () => ({
	getExploreConnector: (source = 'met') =>
		source === 'artic'
			? { search: searchArtic }
			: source === 'wikidata'
				? { search: searchWikidata }
				: source === 'danbooru'
					? { search: searchDanbooru }
					: source === 'deviantart'
						? { search: searchDeviantArt }
						: { search },
	isSourceId: (value: string) =>
		value === 'met' ||
		value === 'artic' ||
		value === 'wikidata' ||
		value === 'danbooru' ||
		value === 'deviantart'
}));

const sampleItem: ExploreItem = {
	id: 'met-1',
	source: 'met',
	detailUrl: 'https://example.test/met-1',
	title: 'A Study',
	artistRaw: 'An Artist',
	artistBio: null,
	artistNationality: null,
	dateDisplay: '1900',
	yearStart: 1900,
	yearEnd: 1900,
	medium: 'Oil on canvas',
	mediumCategory: 'oil',
	objectName: 'Painting',
	department: 'Paintings',
	culture: null,
	period: null,
	thumbUrl: 'https://example.test/thumb.jpg',
	imageUrl: 'https://example.test/image.jpg',
	additionalImages: [],
	isIIIF: false,
	description: null,
	tags: [],
	isHighlight: false,
	isPublicDomain: true,
	rawMetadata: {}
};

describe('POST /explore/api/search', () => {
	beforeEach(() => {
		search.mockReset();
		searchArtic.mockReset();
		searchWikidata.mockReset();
		searchDanbooru.mockReset();
		searchDeviantArt.mockReset();
		vi.resetModules();
	});

	it('returns normalized Explore search pages', async () => {
		search.mockResolvedValue({ items: [sampleItem], total: 1, nextCursor: null });
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ keyword: 'study', limit: 20 })
			})
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=3600, stale-while-revalidate=86400'
		);
		await expect(response.json()).resolves.toEqual({
			items: [sampleItem],
			total: 1,
			nextCursor: null
		});
		expect(search).toHaveBeenCalledWith({ keyword: 'study', limit: 20 });
	});

	it('routes source-aware search requests to the requested connector', async () => {
		searchArtic.mockResolvedValue({ items: [], total: 0, nextCursor: null });
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'artic', query: { keyword: 'seurat', limit: 20 } })
			})
		});

		expect(response.status).toBe(200);
		expect(searchArtic).toHaveBeenCalledWith({ keyword: 'seurat', limit: 20 });
		expect(search).not.toHaveBeenCalled();
	});

	it('accepts Danbooru artist, safety, and blacklist search fields', async () => {
		searchDanbooru.mockResolvedValue({ items: [], total: null, nextCursor: null });
		const { POST } = await import('./+server');
		const query = {
			artist: 'test artist',
			contentSafety: 'blur',
			blacklist: 'ai-generated rating:e',
			limit: 40
		};

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'danbooru', query })
			})
		});

		expect(response.status).toBe(200);
		expect(searchDanbooru).toHaveBeenCalledWith(query);
	});

	it('routes DeviantArt artist searches to the configured provider', async () => {
		searchDeviantArt.mockResolvedValue({ items: [], total: null, nextCursor: null });
		const { POST } = await import('./+server');
		const query = { artist: 'loish', contentSafety: 'blur', limit: 24 };

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'deviantart', query })
			})
		});

		expect(response.status).toBe(200);
		expect(searchDeviantArt).toHaveBeenCalledWith(query);
	});

	it('accepts DeviantArt date bounds and loaded-result sort order', async () => {
		searchDeviantArt.mockResolvedValue({ items: [], total: null, nextCursor: null });
		const { POST } = await import('./+server');
		const query = {
			artist: 'loish',
			dateFrom: '2010-01-01',
			dateTo: '2016-01-01',
			sort: 'popular',
			contentSafety: 'blur',
			limit: 24
		};

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'deviantart', query })
			})
		});

		expect(response.status).toBe(200);
		expect(searchDeviantArt).toHaveBeenCalledWith(query);
	});

	it('accepts Wikidata subject search queries', async () => {
		searchWikidata.mockResolvedValue({ items: [], total: null, nextCursor: null });
		const { POST } = await import('./+server');

		const query = {
			depicts: [{ id: 'Q33767', label: 'hand', description: 'part of the forearm' }],
			workType: 'painting',
			limit: 20
		};
		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'wikidata', query })
			})
		});

		expect(response.status).toBe(200);
		expect(searchWikidata).toHaveBeenCalledWith(query);
	});

	it('accepts Wikimedia artwork mode queries', async () => {
		searchWikidata.mockResolvedValue({ items: [], total: null, nextCursor: null });
		const { POST } = await import('./+server');

		const query = {
			wikidataMode: 'movement',
			wikidataEntities: [{ id: 'Q1404472', label: 'Renaissance', description: null }],
			workType: 'painting',
			limit: 20
		};
		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'wikidata', query })
			})
		});

		expect(response.status).toBe(200);
		expect(searchWikidata).toHaveBeenCalledWith(query);
	});

	it('accepts Wikimedia reference token queries', async () => {
		searchWikidata.mockResolvedValue({ items: [], total: null, nextCursor: null });
		const { POST } = await import('./+server');

		const query = {
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{
					kind: 'entity',
					id: 'Q140',
					label: 'lion',
					description: 'species of mammal',
					role: 'subject'
				},
				{ kind: 'text', value: 'female', match: 'boost' }
			],
			wikimediaReferenceFilters: {
				subjects: ['animals', 'faces'],
				qualifiers: [],
				formats: ['photograph', 'artwork', 'illustration'],
				quality: 'valued',
				includeWikidataArt: true,
				includeCommonsStructured: true,
				includeCommonsCategories: true,
				includeCommonsText: true,
				excludeSvg: true,
				minResolution: 'standard'
			},
			limit: 20
		};
		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'wikidata', query })
			})
		});

		expect(response.status).toBe(200);
		expect(searchWikidata).toHaveBeenCalledWith(query);
	});

	it('rejects malformed Wikimedia reference tokens', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({
					source: 'wikidata',
					query: {
						wikimediaMode: 'reference',
						wikimediaReferenceTokens: [{ kind: 'entity', id: 'lion', label: 'lion' }],
						limit: 20
					}
				})
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore query' });
		expect(searchWikidata).not.toHaveBeenCalled();
	});

	it('rejects malformed Wikimedia reference filter subjects', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({
					source: 'wikidata',
					query: {
						wikimediaMode: 'reference',
						wikimediaReferenceFilters: {
							subjects: ['animals', 'cartoon_actor'],
							qualifiers: [],
							formats: ['photograph'],
							quality: 'valued',
							includeWikidataArt: true,
							includeCommonsStructured: true,
							includeCommonsCategories: true,
							includeCommonsText: true,
							excludeSvg: true,
							minResolution: 'standard'
						},
						limit: 20
					}
				})
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore query' });
		expect(searchWikidata).not.toHaveBeenCalled();
	});

	it('rejects malformed Wikimedia artwork modes', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({
					source: 'wikidata',
					query: {
						wikidataMode: 'collection',
						wikidataEntities: [{ id: 'Q33767', label: 'hand', description: null }],
						limit: 20
					}
				})
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore query' });
		expect(searchWikidata).not.toHaveBeenCalled();
	});

	it('returns retry-aware temporary errors for Wikimedia cooldowns', async () => {
		searchWikidata.mockRejectedValue(
			new WikimediaTemporaryError(
				503,
				'Wikidata is taking a breather. Try again in a moment.',
				12,
				'sparql'
			)
		);
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({
					source: 'wikidata',
					query: {
						depicts: [{ id: 'Q33767', label: 'hand', description: null }],
						limit: 20
					}
				})
			})
		});

		expect(response.status).toBe(503);
		expect(response.headers.get('retry-after')).toBe('12');
		await expect(response.json()).resolves.toEqual({
			error: 'Wikidata is taking a breather. Try again in a moment.',
			retryAfterSeconds: 12
		});
	});

	it('returns retry-aware rate-limit responses for other Explore providers', async () => {
		searchDanbooru.mockRejectedValue(
			new RetryableMetError(429, 'Danbooru is rate-limiting searches. Try again in a moment.', 7)
		);
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({
					source: 'danbooru',
					query: { tag: 'dragon', contentSafety: 'blur', limit: 40 }
				})
			})
		});

		expect(response.status).toBe(429);
		expect(response.headers.get('retry-after')).toBe('7');
		await expect(response.json()).resolves.toEqual({
			error: 'Danbooru is rate-limiting searches. Try again in a moment.',
			retryAfterSeconds: 7
		});
	});

	it('rejects malformed Wikidata subject queries', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({
					source: 'wikidata',
					query: { depicts: [{ id: 'not-a-qid', label: 'hand', description: null }], limit: 20 }
				})
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore query' });
		expect(searchWikidata).not.toHaveBeenCalled();
	});

	it('rejects source-aware search requests with unsupported sources', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ source: 'nope', query: { keyword: 'study', limit: 20 } })
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore source' });
	});

	it('rejects search requests with limits above the route maximum', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ keyword: 'study', limit: 101 })
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore query' });
		expect(search).not.toHaveBeenCalled();
	});

	it('rejects malformed request bodies', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/explore/api/search', {
				method: 'POST',
				body: JSON.stringify({ keyword: 'study' })
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: 'Invalid Explore query' });
	});
});
