import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

describe('DELETE /api/library/assets/[id]', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-delete-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('deletes downloaded asset rows and local files', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Delete me',
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
		const assetId = imported.imported[0].asset_id;
		const db = new Database(join(archiveRoot, 'workspace.sqlite'));
		const row = db
			.prepare('select original_path, thumbnail_path from assets where id = ?')
			.get(assetId) as {
			original_path: string;
			thumbnail_path: string;
		};
		db.close();
		const originalPath = join(archiveRoot, row.original_path);
		const thumbnailPath = join(archiveRoot, row.thumbnail_path);
		const { DELETE } = await import('./+server');

		const response = await DELETE({ params: { id: assetId } });
		const verifyDb = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const count = verifyDb.prepare('select count(*) as count from assets').get() as {
			count: number;
		};
		verifyDb.close();

		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(count.count).toBe(0);
		expect(existsSync(originalPath)).toBe(false);
		expect(existsSync(thumbnailPath)).toBe(false);
	});

	it('deletes URL-reference asset rows without requiring local files', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Reference only',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/image.jpg',
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
		const { DELETE } = await import('./+server');

		const response = await DELETE({ params: { id: imported.imported[0].asset_id } });

		expect(response.status).toBe(204);
	});

	it('returns 404 for missing assets', async () => {
		const { DELETE } = await import('./+server');

		const response = await DELETE({ params: { id: 'asset-missing' } });

		expect(response.status).toBe(404);
	});
});
