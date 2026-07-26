import { describe, expect, it } from 'vitest';
import { readBoundedImageResponse } from './image-response';

describe('bounded extension image responses', () => {
	it('accepts browser-decodable image MIME types including GIF and AVIF', async () => {
		for (const mimeType of ['image/gif', 'image/webp', 'image/avif', 'image/tiff']) {
			const blob = await readBoundedImageResponse(
				new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': mimeType } }),
				{ maxBytes: 16 }
			);
			expect(blob.type).toBe(mimeType);
		}
	});

	it('rejects declared and streamed responses beyond the byte limit', async () => {
		await expect(
			readBoundedImageResponse(
				new Response(new Uint8Array([1]), {
					headers: { 'content-type': 'image/png', 'content-length': '20' }
				}),
				{ maxBytes: 10 }
			)
		).rejects.toThrow('capture limit');

		await expect(
			readBoundedImageResponse(
				new Response(new Uint8Array(11), { headers: { 'content-type': 'image/png' } }),
				{ maxBytes: 10 }
			)
		).rejects.toThrow('capture limit');
	});

	it('rejects non-image response types while allowing octet-stream decoder fallbacks', async () => {
		await expect(
			readBoundedImageResponse(
				new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
			)
		).rejects.toThrow('not an image');

		const blob = await readBoundedImageResponse(
			new Response(new Uint8Array([1, 2]), {
				headers: { 'content-type': 'application/octet-stream' }
			}),
			{ fallbackMimeType: 'image/gif' }
		);
		expect(blob.type).toBe('image/gif');
	});

	it('normalizes ImageMagick-style PNG32 response labels', async () => {
		const blob = await readBoundedImageResponse(
			new Response(
				new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
				{ headers: { 'content-type': 'PNG32' } }
			)
		);

		expect(blob.type).toBe('image/png');
	});

	it('accepts image signatures when a server sends a malformed MIME header', async () => {
		const blob = await readBoundedImageResponse(
			new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
				headers: { 'content-type': 'binary/unknown' }
			})
		);

		expect(blob.type).toBe('image/jpeg');
	});

	it('does not let a filename fallback turn HTML into an image', async () => {
		await expect(
			readBoundedImageResponse(
				new Response('<html><body>Not an image</body></html>', {
					headers: { 'content-type': 'text/html' }
				}),
				{ fallbackMimeType: 'image/png' }
			)
		).rejects.toThrow('not an image');
	});
});
