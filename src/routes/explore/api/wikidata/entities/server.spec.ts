import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WikimediaTemporaryError } from '$lib/explore/wikimedia-request';

const searchEntities = vi.fn();

vi.mock('$lib/explore/wikidata-entities', () => ({
	searchWikidataEntities: searchEntities
}));

describe('GET /explore/api/wikidata/entities', () => {
	beforeEach(() => {
		searchEntities.mockReset();
		vi.resetModules();
	});

	it('returns Wikidata entity suggestions for chip autocomplete', async () => {
		searchEntities.mockResolvedValue([
			{ id: 'Q33767', label: 'hand', description: 'part of the forearm distal to the wrist' }
		]);
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/explore/api/wikidata/entities?search=hand')
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			entities: [
				{ id: 'Q33767', label: 'hand', description: 'part of the forearm distal to the wrist' }
			]
		});
		expect(searchEntities).toHaveBeenCalledWith('hand', { limit: 8, mode: 'depicts' });
	});

	it('passes Wikimedia entity search mode to suggestion lookup', async () => {
		searchEntities.mockResolvedValue([
			{ id: 'Q762', label: 'Leonardo da Vinci', description: 'Italian artist' }
		]);
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/explore/api/wikidata/entities?search=leonardo&mode=artist')
		});

		expect(response.status).toBe(200);
		expect(searchEntities).toHaveBeenCalledWith('leonardo', { limit: 8, mode: 'artist' });
	});

	it('rejects unsupported entity search modes', async () => {
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/explore/api/wikidata/entities?search=hand&mode=title')
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Invalid Wikidata entity search mode'
		});
		expect(searchEntities).not.toHaveBeenCalled();
	});

	it('rejects very short searches', async () => {
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/explore/api/wikidata/entities?search=h')
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Search must be at least 2 characters'
		});
		expect(searchEntities).not.toHaveBeenCalled();
	});

	it('returns retry-aware temporary errors for Wikimedia cooldowns', async () => {
		searchEntities.mockRejectedValue(
			new WikimediaTemporaryError(
				503,
				'Wikimedia is taking a breather. Try again in a moment.',
				9,
				'action'
			)
		);
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/explore/api/wikidata/entities?search=hand')
		});

		expect(response.status).toBe(503);
		expect(response.headers.get('retry-after')).toBe('9');
		await expect(response.json()).resolves.toEqual({
			error: 'Wikimedia is taking a breather. Try again in a moment.',
			retryAfterSeconds: 9
		});
	});
});
