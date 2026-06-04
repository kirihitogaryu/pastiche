import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureLibraryArchive, resolveLibraryPaths } from './paths';
import { initializeLibrary, openLibraryDatabase } from './schema';
import { getLibraryStatus } from './status';
import { importLibraryItems } from './import';
import {
	addProjectFolderRef,
	attachTagToAsset,
	createFolder,
	createProject,
	createTag
} from './organization';
import { getLibrarySnapshot } from './read';

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

	it('resolves archive paths from PASTICHE_LIBRARY_DIR and creates runtime directories', async () => {
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

	it('initializes the SQLite schema idempotently', async () => {
		initializeLibrary();
		initializeLibrary();

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const tables = db
			.prepare("select name from sqlite_master where type = 'table' order by name")
			.all()
			.map((row) => (row as { name: string }).name);
		const projectColumns = db
			.prepare('pragma table_info(projects)')
			.all()
			.map((row) => (row as { name: string }).name);
		db.close();

		expect(tables).toEqual([
			'asset_import_failures',
			'asset_tags',
			'assets',
			'folders',
			'lazy_download_jobs',
			'project_asset_refs',
			'project_folder_refs',
			'projects',
			'tag_facets',
			'tags'
		]);

		expect(projectColumns).not.toContain('path');
	});

	it('creates the reserved General tag group first', () => {
		const db = openLibraryDatabase();
		const groups = db
			.prepare('select slug, name from tag_facets order by rowid')
			.all() as Array<{ slug: string; name: string }>;
		db.close();

		expect(groups[0]).toEqual({ slug: 'general', name: 'General' });
		expect(groups.map((group) => group.slug)).toContain('subject');
		expect(groups.map((group) => group.slug)).toContain('medium');
	});

	it('creates empty folder directories with collision-safe slugged paths', async () => {
		initializeLibrary();

		const first = createFolder({ name: 'Character Poses ✨' });
		const second = createFolder({ name: 'Character Poses' });

		expect(first.path).toBe('library/character-poses');
		expect(second.path).toBe('library/character-poses-2');
		expect(existsSync(join(archiveRoot, first.path))).toBe(true);
		expect(existsSync(join(archiveRoot, second.path))).toBe(true);

		const snapshot = getLibrarySnapshot();
		expect(snapshot.folders).toEqual([
			expect.objectContaining({ name: 'Character Poses ✨', assetCount: 0 }),
			expect.objectContaining({ name: 'Character Poses', assetCount: 0 })
		]);
	});

	it('creates empty grouped tags and attaches them to assets', async () => {
		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Tagged ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/tagged.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Tagged Ref',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const loose = createTag({ label: 'usage intent: lighting study' });
		const attached = createTag({ facet: 'subject', value: 'hands' });
		attachTagToAsset(result.imported[0].asset_id, attached.id);

		const snapshot = getLibrarySnapshot();
		expect(snapshot.stats.tags).toBeGreaterThanOrEqual(2);
		expect(snapshot.tagFacets.find((facet) => facet.slug === 'usage-intent')?.tagCount).toBe(1);
		expect(snapshot.assets[0].record?.organization.tags).toEqual([
			expect.objectContaining({ name: 'Subject: hands', assetCount: 1 })
		]);
		expect(loose.assetCount).toBe(0);
	});

	it('uses live direct-only project folder refs for project membership', async () => {
		const folder = createFolder({ name: 'Hands' });
		const nested = createFolder({ name: 'Fingers', parentId: folder.id });
		const direct = await importLibraryItems({
			destination_folder_id: folder.id,
			items: [referenceImport('Direct hand', 'https://example.com/direct.jpg')]
		});
		await importLibraryItems({
			destination_folder_id: nested.id,
			items: [referenceImport('Nested finger', 'https://example.com/nested.jpg')]
		});
		const project = createProject({ name: 'Hand study' });
		addProjectFolderRef(project.id, folder.id);

		const snapshot = getLibrarySnapshot();
		const directAsset = snapshot.assets.find((asset) => asset.id === direct.imported[0].asset_id);
		const nestedAsset = snapshot.assets.find((asset) => asset.title === 'Nested finger');

		expect(snapshot.projects[0]).toMatchObject({ name: 'Hand study', assetCount: 1, folderCount: 1 });
		expect(directAsset?.projects).toEqual([project.id]);
		expect(nestedAsset?.projects).toEqual([]);
	});

	it('imports downloaded image data to originals and records the asset', async () => {
		const imageData = tinyPngBase64();

		const result = await importLibraryItems({
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
			.get(result.imported[0].asset_id) as {
			original_path: string;
			thumbnail_path: string;
			storage_mode: string;
		};
		db.close();

		expect(asset.storage_mode).toBe('download');
		expect(asset.original_path).toMatch(/^originals\/.+\.jpg$/);
		expect(asset.thumbnail_path).toMatch(/^thumbnails\/.+\.webp$/);
		expect(existsSync(join(archiveRoot, asset.original_path))).toBe(true);
		expect(existsSync(join(archiveRoot, asset.thumbnail_path))).toBe(true);
	});

	it('imports URL references without writing originals', async () => {
		const result = await importLibraryItems({
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

	it('records lazy download jobs without fetching immediately', async () => {
		const result = await importLibraryItems({
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

	it('allows duplicate source hashes while marking later imports as duplicates', async () => {
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

		const first = await importLibraryItems({ destination_folder_id: null, items: [item] });
		const second = await importLibraryItems({ destination_folder_id: null, items: [item] });

		expect(first.imported[0].duplicate).toBe(false);
		expect(second.imported[0].duplicate).toBe(true);
		expect(second.imported[0].source_hash).toBe(first.imported[0].source_hash);

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const count = db.prepare('select count(*) as count from assets').get() as { count: number };
		db.close();
		expect(count.count).toBe(2);
	});

	it('returns unassigned count, recent folders, and imported source index', async () => {
		const result = await importLibraryItems({
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

function tinyPngBase64() {
	return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
}

function referenceImport(filename: string, sourceImageUrl: string) {
	return {
		filename,
		storage_mode: 'url_reference' as const,
		image_data: null,
		source_image_url: sourceImageUrl,
		mime_type: 'image/jpeg',
		natural_width: 800,
		natural_height: 600,
		source_url: sourceImageUrl.replace('/direct.jpg', '/page').replace('/nested.jpg', '/page'),
		page_title: filename,
		alt_text: null,
		captured_at: '2026-05-27T12:00:00.000Z'
	};
}
