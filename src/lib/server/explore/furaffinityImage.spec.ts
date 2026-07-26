import { describe, expect, it, vi } from 'vitest';
import { fetchFurAffinityImage } from './furaffinityImage';

describe('fetchFurAffinityImage', () => {
	it('fetches a validated image with the configured session and submission referer', async () => {
		const fetcher = vi.fn(async () => {
			return new Response(new Uint8Array([1, 2, 3]), {
				headers: { 'content-type': 'image/png' }
			});
		});

		const response = await fetchFurAffinityImage(
			'https://d.furaffinity.net/art/test/123/123.test_image.png',
			'https://www.furaffinity.net/view/42/',
			{
				fetch: fetcher,
				cookieA: 'session-a',
				cookieB: 'session-b',
				userAgent: 'Pastiche test'
			}
		);

		expect(response.headers.get('content-type')).toBe('image/png');
		expect(fetcher).toHaveBeenCalledWith(
			new URL('https://d.furaffinity.net/art/test/123/123.test_image.png'),
			expect.objectContaining({
				headers: expect.objectContaining({
					cookie: 'a=session-a; b=session-b',
					referer: 'https://www.furaffinity.net/view/42/',
					'user-agent': 'Pastiche test'
				})
			})
		);
	});

	it('rejects non-Fur Affinity hosts before fetching', async () => {
		const fetcher = vi.fn();

		await expect(
			fetchFurAffinityImage(
				'https://example.test/image.png',
				'https://www.furaffinity.net/view/42/',
				{ fetch: fetcher, cookieA: 'a', cookieB: 'b' }
			)
		).rejects.toThrow('Invalid Fur Affinity image host');
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('rejects HTML responses masquerading as an image request', async () => {
		await expect(
			fetchFurAffinityImage(
				'https://d.furaffinity.net/art/test/image.png',
				'https://www.furaffinity.net/view/42/',
				{
					fetch: async () =>
						new Response('<html>Sign in</html>', {
							headers: { 'content-type': 'text/html' }
						}),
					cookieA: 'a',
					cookieB: 'b'
				}
			)
		).rejects.toThrow('returned a page instead of an image');
	});
});
