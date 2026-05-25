import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExploreItem } from '$lib/explore/types';

const search = vi.fn();
const searchArtic = vi.fn();

vi.mock('$lib/explore/connectors', () => ({
	getExploreConnector: (source = 'met') =>
		source === 'artic' ? { search: searchArtic } : { search },
	isSourceId: (value: string) => value === 'met' || value === 'artic'
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
