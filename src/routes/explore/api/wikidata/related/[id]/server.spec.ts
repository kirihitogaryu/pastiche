import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExploreItem } from '$lib/explore/types';
import { WikimediaTemporaryError } from '$lib/explore/wikimedia-request';

const getRelated = vi.fn();

vi.mock('$lib/explore/connectors/wikidata', () => ({
	wikidataConnector: { getRelated }
}));

const relatedItem: ExploreItem = {
	id: 'wikidata-Q999',
	source: 'wikidata',
	detailUrl: 'https://www.wikidata.org/wiki/Q999',
	title: 'Related Portrait',
	artistRaw: 'Leonardo da Vinci',
	artistBio: null,
	artistNationality: null,
	dateDisplay: '1505',
	yearStart: 1505,
	yearEnd: 1505,
	medium: null,
	mediumCategory: null,
	objectName: 'Painting',
	department: 'Louvre Museum',
	culture: null,
	period: null,
	thumbUrl: 'https://upload.wikimedia.org/thumb/related.jpg',
	imageUrl: 'https://upload.wikimedia.org/related.jpg',
	additionalImages: [],
	isIIIF: false,
	description: null,
	tags: ['same artist'],
	isHighlight: false,
	isPublicDomain: true,
	rawMetadata: {}
};

describe('GET /explore/api/wikidata/related/[id]', () => {
	beforeEach(() => {
		getRelated.mockReset();
		vi.resetModules();
	});

	it('returns related Wikidata works for an item', async () => {
		getRelated.mockResolvedValue({
			seedId: 'wikidata-Q12418',
			title: 'Similar to Mona Lisa',
			items: [relatedItem],
			total: null,
			nextCursor: null
		});
		const { GET } = await import('./+server');

		const response = await GET({
			params: { id: 'wikidata-Q12418' },
			url: new URL('http://localhost/explore/api/wikidata/related/wikidata-Q12418?limit=4')
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=3600, stale-while-revalidate=86400'
		);
		await expect(response.json()).resolves.toMatchObject({
			seedId: 'wikidata-Q12418',
			title: 'Similar to Mona Lisa',
			items: [relatedItem],
			total: null,
			nextCursor: null
		});
		expect(getRelated).toHaveBeenCalledWith('wikidata-Q12418', { limit: 4, cursor: undefined });
	});

	it('rejects invalid item ids and limits', async () => {
		const { GET } = await import('./+server');

		const badId = await GET({
			params: { id: 'met-1' },
			url: new URL('http://localhost/explore/api/wikidata/related/met-1?limit=4')
		});
		const badLimit = await GET({
			params: { id: 'wikidata-Q12418' },
			url: new URL('http://localhost/explore/api/wikidata/related/wikidata-Q12418?limit=100')
		});

		expect(badId.status).toBe(400);
		expect(badLimit.status).toBe(400);
		expect(getRelated).not.toHaveBeenCalled();
	});

	it('returns retry-aware temporary errors for Wikimedia cooldowns', async () => {
		getRelated.mockRejectedValue(
			new WikimediaTemporaryError(
				503,
				'Wikidata is taking a breather. Try again in a moment.',
				8,
				'sparql'
			)
		);
		const { GET } = await import('./+server');

		const response = await GET({
			params: { id: 'wikidata-Q12418' },
			url: new URL('http://localhost/explore/api/wikidata/related/wikidata-Q12418?limit=4')
		});

		expect(response.status).toBe(503);
		expect(response.headers.get('retry-after')).toBe('8');
		await expect(response.json()).resolves.toEqual({
			error: 'Wikidata is taking a breather. Try again in a moment.',
			retryAfterSeconds: 8
		});
	});
});
