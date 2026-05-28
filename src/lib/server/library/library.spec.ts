import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureLibraryArchive, resolveLibraryPaths } from './paths';
import { initializeLibrary } from './schema';
import { getLibraryStatus } from './status';
import { importLibraryItems } from './import';

describe('local library archive', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-library-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('resolves archive paths from PASTICHE_LIBRARY_DIR and creates runtime directories', () => {
		const paths = resolveLibraryPaths();
		expect(paths.root).toBe(archiveRoot);
		expect(paths.database).toBe(join(archiveRoot, 'workspace.sqlite'));
		expect(paths.originals).toBe(join(archiveRoot, 'originals'));

		ensureLibraryArchive(paths);

		for (const directory of [
			paths.root,
			paths.originals,
			paths.thumbnails,
			paths.imports,
			paths.lazyDownloads,
			paths.palettesCache,
			paths.exports
		]) {
			expect(statSync(directory).isDirectory()).toBe(true);
		}
	});

	it('initializes the SQLite schema idempotently', () => {
		initializeLibrary();
		initializeLibrary();

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const tables = db
			.prepare("select name from sqlite_master where type = 'table' order by name")
			.all()
			.map((row) => (row as { name: string }).name);
		db.close();

		expect(tables).toEqual(['asset_import_failures', 'assets', 'folders', 'lazy_download_jobs']);
	});

	it('imports downloaded image data to originals and records the asset', () => {
		const imageData = Buffer.from('image bytes').toString('base64');

		const result = importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Downloaded ref',
					storage_mode: 'download',
					image_data: imageData,
					source_image_url: 'https://example.com/image.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Example Page',
					alt_text: 'A useful reference',
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		expect(result.failed).toEqual([]);
		expect(result.imported).toHaveLength(1);
		expect(result.imported[0].duplicate).toBe(false);

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const asset = db
			.prepare('select * from assets where id = ?')
			.get(result.imported[0].asset_id) as { original_path: string; storage_mode: string };
		db.close();

		expect(asset.storage_mode).toBe('download');
		expect(asset.original_path).toMatch(/^originals\/.+\.jpg$/);
		expect(readFileSync(join(archiveRoot, asset.original_path), 'utf8')).toBe('image bytes');
	});

	it('imports URL references without writing originals', () => {
		const result = importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Reference ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/reference.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Example Page',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		expect(result.failed).toEqual([]);

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const asset = db
			.prepare('select original_path, source_image_url, storage_mode from assets where id = ?')
			.get(result.imported[0].asset_id) as {
			original_path: string | null;
			source_image_url: string;
			storage_mode: string;
		};
		db.close();

		expect(asset).toEqual({
			original_path: null,
			source_image_url: 'https://example.com/reference.jpg',
			storage_mode: 'url_reference'
		});
	});

	it('records lazy download jobs without fetching immediately', () => {
		const result = importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Lazy ref',
					storage_mode: 'lazy_download',
					image_data: null,
					source_image_url: 'https://example.com/lazy.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Example Page',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		expect(result.failed).toEqual([]);

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const job = db
			.prepare('select asset_id, source_image_url, status from lazy_download_jobs')
			.get() as { asset_id: string; source_image_url: string; status: string };
		db.close();

		expect(job).toEqual({
			asset_id: result.imported[0].asset_id,
			source_image_url: 'https://example.com/lazy.jpg',
			status: 'queued'
		});
	});

	it('allows duplicate source hashes while marking later imports as duplicates', () => {
		const item = {
			filename: 'Reference ref',
			storage_mode: 'url_reference' as const,
			image_data: null,
			source_image_url: 'https://example.com/reference.jpg',
			mime_type: 'image/jpeg',
			natural_width: 800,
			natural_height: 600,
			source_url: 'https://example.com/page',
			page_title: 'Example Page',
			alt_text: null,
			captured_at: '2026-05-27T12:00:00.000Z'
		};

		const first = importLibraryItems({ destination_folder_id: null, items: [item] });
		const second = importLibraryItems({ destination_folder_id: null, items: [item] });

		expect(first.imported[0].duplicate).toBe(false);
		expect(second.imported[0].duplicate).toBe(true);
		expect(second.imported[0].source_hash).toBe(first.imported[0].source_hash);

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const count = db.prepare('select count(*) as count from assets').get() as { count: number };
		db.close();
		expect(count.count).toBe(2);
	});

	it('returns unassigned count, recent folders, and imported source index', () => {
		const result = importLibraryItems({
			destination_folder_id: null,
			create_folder_name: 'Character refs',
			items: [
				{
					filename: 'Reference ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/reference.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Example Page',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const status = getLibraryStatus();

		expect(result.failed).toEqual([]);
		expect(status.connected).toBe(true);
		expect(status.unassigned_count).toBe(0);
		expect(status.recent_folders).toHaveLength(1);
		expect(status.recent_folders[0].name).toBe('Character refs');
		expect(status.imported_sources).toEqual([
			{
				source_hash: result.imported[0].source_hash,
				source_image_url: 'https://example.com/reference.jpg',
				source_url: 'https://example.com/page'
			}
		]);
	});
});
