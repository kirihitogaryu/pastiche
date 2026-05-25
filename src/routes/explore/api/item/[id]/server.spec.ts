import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExploreItem } from '$lib/explore/types';

const getById = vi.fn();
const getByIdArtic = vi.fn();

vi.mock('$lib/explore/connectors', () => ({
	getExploreConnector: () => ({ getById }),
	getExploreConnectorForItemId: (id: string) => {
		if (id.startsWith('artic-')) return { getById: getByIdArtic };
		if (id.startsWith('met-')) return { getById };
		throw new Error(`Unsupported Explore source: ${id.split('-', 1)[0]}`);
	}
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

describe('GET /explore/api/item/[id]', () => {
	beforeEach(() => {
		getById.mockReset();
		getByIdArtic.mockReset();
		vi.resetModules();
	});

	it('returns one normalized item by id', async () => {
		getById.mockResolvedValue(sampleItem);
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'met-1' } });

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=86400, stale-while-revalidate=604800'
		);
		await expect(response.json()).resolves.toEqual(sampleItem);
		expect(getById).toHaveBeenCalledWith('met-1');
	});

	it('routes namespaced Art Institute ids to the Art Institute connector', async () => {
		getByIdArtic.mockResolvedValue({ ...sampleItem, id: 'artic-27992', source: 'artic' });
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'artic-27992' } });

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ id: 'artic-27992', source: 'artic' });
		expect(getByIdArtic).toHaveBeenCalledWith('artic-27992');
		expect(getById).not.toHaveBeenCalled();
	});

	it('returns not found when the connector cannot load the item', async () => {
		getById.mockRejectedValue(new Error('missing'));
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'met-404' } });

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ error: 'Explore item not found' });
	});

	it('returns not found for unsupported item id prefixes', async () => {
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'nope-1' } });

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ error: 'Explore item not found' });
		expect(getById).not.toHaveBeenCalled();
		expect(getByIdArtic).not.toHaveBeenCalled();
	});

	it('returns a bad gateway response for transient connector failures', async () => {
		getById.mockRejectedValue(new Error('network timeout'));
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'met-500' } });

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({ error: 'Explore item failed to load' });
	});
});
