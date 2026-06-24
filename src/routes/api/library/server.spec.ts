import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

describe('GET /api/library', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-library-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns real imported assets and CORS headers', async () => {
		await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Library route ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/library.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Example',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});
		const { GET } = await import('./+server');

		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		await expect(response.json()).resolves.toMatchObject({
			stats: { assets: 1, folders: 0, tags: 0 },
			assets: [
				{
					title: 'Example',
					imageUrl: 'https://example.com/library.jpg',
					record: {
						title: 'Example',
						image: { previewUrl: 'https://example.com/library.jpg' }
					}
				}
			],
			folders: []
		});
	});

	it('returns mock assets when mock fallback is forced even if a local library exists', async () => {
		vi.stubEnv('PASTICHE_MOCK_LIBRARY_FALLBACK', '1');
		await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Real local ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/real-local.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Real Local',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});
		const { GET } = await import('./+server');

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.assets.some((asset: { title: string }) => asset.title === 'Crimson Horizon')).toBe(
			true
		);
		expect(body.assets.some((asset: { title: string }) => asset.title === 'Real Local')).toBe(false);
	});
});
