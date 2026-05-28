import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from './import';
import { getLibrarySnapshot } from './read';

describe('library read service', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-read-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('maps URL-reference imports into Library assets', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Mira character ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/mira.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 1800,
					source_url: 'https://example.com/mira',
					page_title: 'Mira | Toyhouse',
					alt_text: 'Full-body reference sheet',
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const snapshot = getLibrarySnapshot();

		expect(snapshot.assets).toHaveLength(1);
		expect(snapshot.assets[0]).toMatchObject({
			id: imported.imported[0].asset_id,
			title: 'Mira character ref',
			sourceName: 'example.com',
			sourceType: 'web',
			sourceUrl: 'https://example.com/mira',
			imageUrl: 'https://example.com/mira.jpg',
			width: 1200,
			height: 1800,
			storageMode: 'url_reference',
			sourceImageUrl: 'https://example.com/mira.jpg',
			saved: true,
			folderPath: ['library', 'unassigned']
		});
		expect(snapshot.stats.assets).toBe(1);
		expect(snapshot.stats.folders).toBe(0);
	});

	it('maps top-level folders and direct folder asset paths', async () => {
		await importLibraryItems({
			destination_folder_id: null,
			create_folder_name: 'Character refs',
			items: [
				{
					filename: 'Foldered ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/foldered.jpg',
					mime_type: 'image/jpeg',
					natural_width: 900,
					natural_height: 900,
					source_url: 'https://example.com/foldered',
					page_title: null,
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const snapshot = getLibrarySnapshot();

		expect(snapshot.folders).toEqual([
			expect.objectContaining({
				name: 'Character refs',
				path: ['library', 'character-refs'],
				assetCount: 1,
				childFolderCount: 0
			})
		]);
		expect(snapshot.assets[0].folderPath).toEqual(['library', 'character-refs']);
	});
});
