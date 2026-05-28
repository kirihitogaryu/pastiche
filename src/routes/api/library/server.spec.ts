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
			stats: { assets: 1, folders: 0 },
			assets: [{ title: 'Library route ref', imageUrl: 'https://example.com/library.jpg' }],
			folders: []
		});
	});
});
