import { beforeEach, describe, expect, it, vi } from 'vitest';

const getById = vi.fn();
const fetchFurAffinityImage = vi.fn();

vi.mock('$lib/explore/connectors/furaffinity', () => ({
	furAffinityConnector: { getById }
}));
vi.mock('$lib/server/explore/furaffinityImage', () => ({
	fetchFurAffinityImage
}));

describe('GET /explore/api/furaffinity/image/:id', () => {
	beforeEach(() => {
		getById.mockReset();
		fetchFurAffinityImage.mockReset();
		vi.resetModules();
	});

	it('resolves the submission and streams its validated image privately', async () => {
		getById.mockResolvedValue({
			imageUrl: 'https://d.furaffinity.net/art/test/image.png',
			detailUrl: 'https://www.furaffinity.net/view/42/'
		});
		fetchFurAffinityImage.mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), {
				headers: {
					'content-type': 'image/png',
					etag: '"test-etag"'
				}
			})
		);
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: '42' } });

		expect(getById).toHaveBeenCalledWith('furaffinity-42');
		expect(fetchFurAffinityImage).toHaveBeenCalledWith(
			'https://d.furaffinity.net/art/test/image.png',
			'https://www.furaffinity.net/view/42/'
		);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
		expect(response.headers.get('etag')).toBe('"test-etag"');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('rejects malformed submission ids without resolving a remote page', async () => {
		const { GET } = await import('./+server');

		await expect(GET({ params: { id: 'https://example.test' } })).rejects.toMatchObject({
			status: 400
		});
		expect(getById).not.toHaveBeenCalled();
	});
});
