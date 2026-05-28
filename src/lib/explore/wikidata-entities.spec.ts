import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from './server-cache';
import { buildWikidataEntitySearchUrl, searchWikidataEntities } from './wikidata-entities';

function testCache() {
	return new ServerCache(20);
}

function entitySearchFetch(search: unknown[], usageQids: string[]) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = new URL(input.toString());
		if (url.hostname === 'query.wikidata.org') {
			return Response.json({
				results: {
					bindings: usageQids.map((qid, index) => ({
						entity: { value: `http://www.wikidata.org/entity/${qid}` },
						usage: { value: String(usageQids.length - index) }
					}))
				}
			});
		}
		return Response.json({ search });
	});
}

describe('Wikidata entity search ranking', () => {
	it('prefers visual concepts over sports, names, and media titles', async () => {
		const fetchMock = entitySearchFetch(
			[
				{
					id: 'Q5',
					label: 'handball',
					description: 'team sport played with a thrown ball and goals'
				},
				{
					id: 'Q33767',
					label: 'hand',
					description: 'extremity at the end of an arm or forelimb'
				},
				{ id: 'Q5647563', label: 'Hands', description: 'family name' },
				{ id: 'Q375323', label: 'Hands', description: 'album by Little Boots' }
			],
			['Q33767']
		);

		const entities = await searchWikidataEntities('hand', {
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q33767', label: 'hand' });
	});

	it('prefers the dragon creature over family names and media entities', async () => {
		const fetchMock = entitySearchFetch(
			[
				{ id: 'Q37493975', label: 'Dragon', description: 'family name' },
				{ id: 'Q7559', label: 'dragon', description: 'legendary winged, fire-breathing reptile' },
				{ id: 'Q114832799', label: 'Dragon', description: 'Snake clone video game' }
			],
			['Q7559']
		);

		const entities = await searchWikidataEntities('dragon', {
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q7559', label: 'dragon' });
	});

	it('uses the requested mode to rank entity suggestions by category', async () => {
		const fetchMock = entitySearchFetch(
			[
				{ id: 'Q131785633', label: 'Pablo', description: 'fictional character created by Meneses Monroy' },
				{ id: 'Q1', label: 'Leonardo', description: 'fictional character in a film' },
				{ id: 'Q762', label: 'Leonardo da Vinci', description: 'Italian artist and painter' }
			],
			['Q762']
		);

		const entities = await searchWikidataEntities('leonardo', {
			mode: 'artist',
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q762', label: 'Leonardo da Vinci' });
	});

	it('prefers visual artists over exact-name non-art entities in artist mode', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					search: [
						{
							id: 'Q131785633',
							label: 'Pablo',
							description: 'fictional character created by Meneses Monroy'
						},
						{
							id: 'Q5593',
							label: 'Pablo Picasso',
							description: 'Spanish painter and sculptor (1881–1973)'
						},
						{
							id: 'Q37693',
							label: 'Paul Gauguin',
							description: 'French painter and printmaker (1848–1903)'
						},
						{ id: 'Q2045138', label: 'Pablo', description: 'male given name' }
					]
				})
			)
			.mockResolvedValueOnce(
				Response.json({
					results: {
						bindings: [
							{
								entity: { value: 'http://www.wikidata.org/entity/Q5593' },
								usage: { value: '24' }
							},
							{
								entity: { value: 'http://www.wikidata.org/entity/Q37693' },
								usage: { value: '99' }
							}
						]
					}
				})
			);

		const entities = await searchWikidataEntities('Pablo', {
			mode: 'artist',
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q5593', label: 'Pablo Picasso' });
		expect(entities).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1]?.[0]?.toString()).toContain('query.wikidata.org');
	});

	it('adds maxlag to entity search URLs', () => {
		const url = buildWikidataEntitySearchUrl('hand', 8);

		expect(url.searchParams.get('maxlag')).toBe('5');
		expect(url.searchParams.get('search')).toBe('hand');
	});

	it('caches repeated autocomplete terms server-side', async () => {
		const cache = testCache();
		const fetchMock = entitySearchFetch(
			[{ id: 'Q33767', label: 'hand', description: 'extremity at the end of an arm' }],
			['Q33767']
		);

		await searchWikidataEntities('hand', { fetch: fetchMock, limit: 8, cache });
		await searchWikidataEntities('hand', { fetch: fetchMock, limit: 8, cache });

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('separates autocomplete cache entries by mode', async () => {
		const cache = testCache();
		const fetchMock = entitySearchFetch(
			[{ id: 'Q33767', label: 'hand', description: 'extremity at the end of an arm' }],
			['Q33767']
		);

		await searchWikidataEntities('hand', { mode: 'depicts', fetch: fetchMock, limit: 8, cache });
		await searchWikidataEntities('hand', {
			mode: 'main_subject',
			fetch: fetchMock,
			limit: 8,
			cache
		});

		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
});
