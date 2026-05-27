import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from './server-cache';
import { buildWikidataEntitySearchUrl, searchWikidataEntities } from './wikidata-entities';

function testCache() {
	return new ServerCache(20);
}

describe('Wikidata entity search ranking', () => {
	it('prefers visual concepts over sports, names, and media titles', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				search: [
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
				]
			})
		);

		const entities = await searchWikidataEntities('hand', {
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q33767', label: 'hand' });
	});

	it('prefers the dragon creature over family names and media entities', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				search: [
					{ id: 'Q37493975', label: 'Dragon', description: 'family name' },
					{ id: 'Q7559', label: 'dragon', description: 'legendary winged, fire-breathing reptile' },
					{ id: 'Q114832799', label: 'Dragon', description: 'Snake clone video game' }
				]
			})
		);

		const entities = await searchWikidataEntities('dragon', {
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q7559', label: 'dragon' });
	});

	it('uses the requested mode to rank entity suggestions by category', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				search: [
					{ id: 'Q1', label: 'Leonardo', description: 'fictional character in a film' },
					{ id: 'Q762', label: 'Leonardo da Vinci', description: 'Italian artist and painter' }
				]
			})
		);

		const entities = await searchWikidataEntities('leonardo', {
			mode: 'artist',
			fetch: fetchMock,
			limit: 8,
			cache: testCache()
		});

		expect(entities[0]).toMatchObject({ id: 'Q762', label: 'Leonardo da Vinci' });
	});

	it('adds maxlag to entity search URLs', () => {
		const url = buildWikidataEntitySearchUrl('hand', 8);

		expect(url.searchParams.get('maxlag')).toBe('5');
		expect(url.searchParams.get('search')).toBe('hand');
	});

	it('caches repeated autocomplete terms server-side', async () => {
		const cache = testCache();
		const fetchMock = vi.fn(async () =>
			Response.json({
				search: [{ id: 'Q33767', label: 'hand', description: 'extremity at the end of an arm' }]
			})
		);

		await searchWikidataEntities('hand', { fetch: fetchMock, limit: 8, cache });
		await searchWikidataEntities('hand', { fetch: fetchMock, limit: 8, cache });

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('separates autocomplete cache entries by mode', async () => {
		const cache = testCache();
		const fetchMock = vi.fn(async () =>
			Response.json({
				search: [{ id: 'Q33767', label: 'hand', description: 'extremity at the end of an arm' }]
			})
		);

		await searchWikidataEntities('hand', { mode: 'depicts', fetch: fetchMock, limit: 8, cache });
		await searchWikidataEntities('hand', {
			mode: 'main_subject',
			fetch: fetchMock,
			limit: 8,
			cache
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
