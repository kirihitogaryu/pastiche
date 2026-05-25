import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from '../server-cache';
import type { ExploreQuery } from '../types';
import { buildMetSearchUrl, createMetConnector, normalizeMetObject, parseMetNativeId } from './met';

const baseObject = {
	objectID: 437133,
	objectURL: 'https://www.metmuseum.org/art/collection/search/437133',
	title: 'Wheat Field with Cypresses',
	artistPrefix: '',
	artistDisplayName: 'Vincent van Gogh',
	artistDisplayBio: 'Dutch, 1853-1890',
	artistNationality: 'Dutch',
	objectDate: '1889',
	objectBeginDate: 1889,
	objectEndDate: 1889,
	medium: 'Oil on canvas',
	objectName: 'Painting',
	department: 'European Paintings',
	culture: '',
	period: '',
	primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg',
	primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg',
	additionalImages: ['https://images.metmuseum.org/CRDImages/ep/original/DT1568.jpg'],
	tags: [{ term: 'Landscape' }, { term: 'Cypress' }],
	isHighlight: true,
	isPublicDomain: true,
	dynasty: '',
	reign: '',
	portfolio: '',
	artistBeginDate: '1853',
	artistEndDate: '1890',
	artistWikidata_URL: 'https://www.wikidata.org/wiki/Q5582',
	artistULAN_URL: '',
	objectWikidata_URL: '',
	constituents: [],
	accessionNumber: '1993.132',
	accessionYear: '1993'
};

describe('Met connector helpers', () => {
	it('builds Met search URLs from supported query fields', () => {
		const query: ExploreQuery = {
			keyword: 'van gogh',
			artist: 'vincent',
			tag: 'Landscape',
			yearFrom: 1880,
			yearTo: 1890,
			medium: 'Paintings',
			department: '11',
			publicDomainOnly: true,
			hasImageOnly: true,
			isHighlightOnly: true,
			color: '#ff0000',
			limit: 20
		};

		const url = buildMetSearchUrl(query);

		expect(url.pathname).toBe('/public/collection/v1/search');
		expect(url.searchParams.get('q')).toBe('Landscape');
		expect(url.searchParams.get('artistOrCulture')).toBe('true');
		expect(url.searchParams.get('tags')).toBe('true');
		expect(url.searchParams.get('dateBegin')).toBe('1880');
		expect(url.searchParams.get('dateEnd')).toBe('1890');
		expect(url.searchParams.get('medium')).toBe('Paintings');
		expect(url.searchParams.get('departmentId')).toBe('11');
		expect(url.searchParams.get('isPublicDomain')).toBe('true');
		expect(url.searchParams.get('hasImages')).toBe('true');
		expect(url.searchParams.get('isHighlight')).toBe('true');
		expect(url.searchParams.has('color')).toBe(false);
		expect(url.searchParams.toString().indexOf('artistOrCulture=true')).toBeLessThan(
			url.searchParams.toString().indexOf('q=Landscape')
		);
	});

	it('normalizes complete Met object records', () => {
		const item = normalizeMetObject(baseObject);

		expect(item).not.toBeNull();
		if (!item) return;
		expect(item).toMatchObject({
			id: 'met-437133',
			source: 'met',
			title: 'Wheat Field with Cypresses',
			artistRaw: 'Vincent van Gogh',
			artistBio: 'Dutch, 1853-1890',
			artistNationality: 'Dutch',
			dateDisplay: '1889',
			yearStart: 1889,
			yearEnd: 1889,
			medium: 'Oil on canvas',
			mediumCategory: 'oil',
			objectName: 'Painting',
			department: 'European Paintings',
			culture: null,
			period: null,
			thumbUrl: baseObject.primaryImageSmall,
			imageUrl: baseObject.primaryImage,
			additionalImages: baseObject.additionalImages,
			isIIIF: false,
			description: null,
			tags: ['Landscape', 'Cypress'],
			isHighlight: true,
			isPublicDomain: true
		});
		expect(item.rawMetadata.accessionNumber).toBe('1993.132');
	});

	it('skips Met object records without usable image URLs', () => {
		expect(
			normalizeMetObject({ ...baseObject, primaryImage: '', primaryImageSmall: '' })
		).toBeNull();
	});

	it('parses namespaced Met ids', () => {
		expect(parseMetNativeId('met-437133')).toBe(437133);
		expect(parseMetNativeId('437133')).toBe(437133);
		expect(parseMetNativeId('artic-123')).toBeNull();
		expect(parseMetNativeId('met-nope')).toBeNull();
	});
});

describe('Met connector', () => {
	it('uses /search and object detail endpoints without calling the full /objects dump', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				return Response.json({ total: 1, objectIDs: [437133] });
			}
			if (url.endsWith('/objects/437133')) {
				return Response.json(baseObject);
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		const connector = createMetConnector({ fetch: fetchMock, requestsPerSecond: 1000 });

		const page = await connector.search({ keyword: 'wheat', limit: 20 });

		expect(page.items).toHaveLength(1);
		expect(page.items[0]?.id).toBe('met-437133');
		expect(page.total).toBe(1);
		expect(page.nextCursor).toBeNull();
		expect(fetchMock).not.toHaveBeenCalledWith(
			expect.stringMatching(/\/public\/collection\/v1\/objects$/)
		);
	});

	it('merges keyword, artist, title, tag, and medium searches for broad text queries', async () => {
		const searchUrls: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				searchUrls.push(url);
				const params = new URL(url).searchParams;
				if (params.get('artistOrCulture') === 'true') {
					return Response.json({ total: 1, objectIDs: [2] });
				}
				if (params.get('title') === 'true') {
					return Response.json({ total: 1, objectIDs: [3] });
				}
				if (params.get('tags') === 'true') {
					return Response.json({ total: 1, objectIDs: [4] });
				}
				if (params.get('medium') === 'Paintings') {
					return Response.json({ total: 1, objectIDs: [5] });
				}
				return Response.json({ total: 1, objectIDs: [1] });
			}

			const nativeId = Number(url.split('/').at(-1));
			return Response.json({
				...baseObject,
				objectID: nativeId,
				title: `Object ${nativeId}`
			});
		});
		const connector = createMetConnector({ fetch: fetchMock, requestsPerSecond: 1000 });

		const page = await connector.search({ keyword: 'painting', limit: 5 });

		expect(page.items.map((item) => item.id)).toEqual([
			'met-1',
			'met-2',
			'met-3',
			'met-4',
			'met-5'
		]);
		expect(searchUrls).toHaveLength(5);
		expect(searchUrls.some((url) => new URL(url).searchParams.get('artistOrCulture'))).toBe(true);
		expect(searchUrls.some((url) => new URL(url).searchParams.get('medium') === 'Paintings')).toBe(
			true
		);
	});

	it('keeps artist/culture before q when building artist search variants', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				const queryString = url.split('?')[1] ?? '';
				const hasArtistBeforeQ =
					queryString.indexOf('artistOrCulture=true') > -1 &&
					queryString.indexOf('artistOrCulture=true') < queryString.indexOf('q=Monet');
				return Response.json({
					total: hasArtistBeforeQ ? 1 : 0,
					objectIDs: hasArtistBeforeQ ? [437133] : null
				});
			}
			return Response.json({ ...baseObject, objectID: 437133, artistDisplayName: 'Claude Monet' });
		});
		const connector = createMetConnector({ fetch: fetchMock, requestsPerSecond: 1000 });

		const page = await connector.search({ artist: 'Monet', limit: 1 });

		expect(page.items.map((item) => item.artistRaw)).toEqual(['Claude Monet']);
	});

	it('returns an empty page when Met search has no object IDs', async () => {
		const connector = createMetConnector({
			fetch: vi.fn(async () => Response.json({ total: 0, objectIDs: null })),
			requestsPerSecond: 1000
		});

		await expect(connector.search({ keyword: 'nothing', limit: 20 })).resolves.toEqual({
			items: [],
			total: 0,
			nextCursor: null
		});
	});

	it('continues through Met object IDs until a page has the requested number of usable images', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				return Response.json({ total: 3, objectIDs: [1, 2, 3] });
			}
			if (url.endsWith('/objects/1')) {
				return Response.json({
					...baseObject,
					objectID: 1,
					primaryImage: '',
					primaryImageSmall: ''
				});
			}
			if (url.endsWith('/objects/2')) {
				return Response.json({ ...baseObject, objectID: 2, title: 'Second object' });
			}
			if (url.endsWith('/objects/3')) {
				return Response.json({ ...baseObject, objectID: 3, title: 'Third object' });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		const connector = createMetConnector({ fetch: fetchMock, requestsPerSecond: 1000 });

		const page = await connector.search({ keyword: 'sculpture', limit: 2 });

		expect(page.items.map((item) => item.id)).toEqual(['met-2', 'met-3']);
		expect(page.nextCursor).toBeNull();
	});

	it('returns a cursor after the raw Met ID consumed while filling a usable page', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				return Response.json({ total: 4, objectIDs: [1, 2, 3, 4] });
			}
			const nativeId = Number(url.split('/').at(-1));
			if (nativeId === 1) {
				return Response.json({
					...baseObject,
					objectID: 1,
					primaryImage: '',
					primaryImageSmall: ''
				});
			}
			return Response.json({
				...baseObject,
				objectID: nativeId,
				title: `Object ${nativeId}`
			});
		});
		const connector = createMetConnector({ fetch: fetchMock, requestsPerSecond: 1000 });

		const page = await connector.search({ keyword: 'sculpture', limit: 2 });

		expect(page.items.map((item) => item.id)).toEqual(['met-2', 'met-3']);
		expect(page.nextCursor).toBe('3');
	});

	it('skips missing Met object detail records while filling search pages', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				return Response.json({ total: 3, objectIDs: [1, 2, 3] });
			}
			if (url.endsWith('/objects/1')) {
				return new Response(JSON.stringify({ message: 'Object not found' }), { status: 404 });
			}
			const nativeId = Number(url.split('/').at(-1));
			return Response.json({
				...baseObject,
				objectID: nativeId,
				title: `Object ${nativeId}`
			});
		});
		const connector = createMetConnector({ fetch: fetchMock, requestsPerSecond: 1000 });

		const page = await connector.search({ limit: 2 });

		expect(page.items.map((item) => item.id)).toEqual(['met-2', 'met-3']);
		expect(page.nextCursor).toBeNull();
	});

	it('caches Met search responses and normalized object records on the server', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				return Response.json({ total: 1, objectIDs: [437133] });
			}
			if (url.endsWith('/objects/437133')) {
				return Response.json(baseObject);
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		const connector = createMetConnector({
			fetch: fetchMock,
			requestsPerSecond: 1000,
			cache: new ServerCache()
		});

		await connector.search({ keyword: 'wheat', limit: 20 });
		await connector.search({ keyword: 'wheat', limit: 20 });

		expect(fetchMock).toHaveBeenCalledTimes(5);
		expect(fetchMock.mock.calls.filter(([input]) => input.toString().includes('/search?'))).toHaveLength(
			4
		);
		expect(
			fetchMock.mock.calls.filter(([input]) => input.toString().endsWith('/objects/437133'))
		).toHaveLength(1);
	});

	it('deduplicates concurrent Met object detail requests', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.includes('/search?')) {
				return Response.json({ total: 1, objectIDs: [437133] });
			}
			if (url.endsWith('/objects/437133')) {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return Response.json(baseObject);
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		const connector = createMetConnector({
			fetch: fetchMock,
			requestsPerSecond: 1000,
			cache: new ServerCache()
		});

		const [first, second] = await Promise.all([
			connector.getById('met-437133'),
			connector.getById('met-437133')
		]);

		expect(first.id).toBe('met-437133');
		expect(second.id).toBe('met-437133');
		expect(
			fetchMock.mock.calls.filter(([input]) => input.toString().endsWith('/objects/437133'))
		).toHaveLength(1);
	});
});
