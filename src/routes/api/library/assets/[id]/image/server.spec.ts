import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

describe('GET /api/library/assets/[id]/image', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-image-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('serves downloaded thumbnails for known assets', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Downloaded ref',
					storage_mode: 'download',
					image_data:
						'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
					source_image_url: 'https://example.com/image.png',
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://example.com/page',
					page_title: 'Example',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});
		const { GET } = await import('./+server');

		const response = await GET({
			params: { id: imported.imported[0].asset_id },
			url: new URL('http://localhost/api/library/assets/test/image?variant=thumb&download=1')
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/webp');
		expect(response.headers.get('content-disposition')).toContain('attachment');
		expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
	});

	it('streams bookmarked originals through the same-origin download endpoint', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Remote ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://cdn.example.com/original.png',
					mime_type: 'image/png',
					natural_width: 1200,
					natural_height: 1800,
					source_url: 'https://example.com/post',
					page_title: 'Remote ref',
					alt_text: null,
					captured_at: '2026-07-25T12:00:00.000Z'
				}
			]
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(new Uint8Array([1, 2, 3]), {
						status: 200,
						headers: { 'content-type': 'image/png' }
					})
			)
		);
		const { GET } = await import('./+server');

		const response = await GET({
			params: { id: imported.imported[0].asset_id },
			url: new URL('http://localhost/api/library/assets/test/image?variant=original&download=1')
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('content-disposition')).toContain('Remote%20ref.png');
		expect((await response.arrayBuffer()).byteLength).toBe(3);
	});

	it('returns 404 for missing local files', async () => {
		const { GET } = await import('./+server');

		const response = await GET({
			params: { id: 'asset-missing' },
			url: new URL('http://localhost/api/library/assets/asset-missing/image?variant=thumb')
		});

		expect(response.status).toBe(404);
	});
});
