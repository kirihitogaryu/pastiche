import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
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
import { createGovernedAtlasConcept } from '$lib/server/atlas/governance';

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
		const userVersion = db.pragma('user_version', { simple: true });
		const journalMode = db.pragma('journal_mode', { simple: true });
		const assetIndexes = db
			.prepare("select name from sqlite_master where type = 'index' and tbl_name = 'assets'")
			.all()
			.map((row) => (row as { name: string }).name);
		db.close();

		expect(tables).toEqual([
			'asset_import_failures',
			'asset_tags',
			'assets',
			'atlas_agent_applied_suggestions',
			'atlas_agent_runs',
			'atlas_annotation_classifiers',
			'atlas_annotation_concepts',
			'atlas_annotations',
			'atlas_asset_concepts',
			'atlas_asset_entities',
			'atlas_claims',
			'atlas_concept_aliases',
			'atlas_concept_relations',
			'atlas_concept_tombstones',
			'atlas_concepts',
			'atlas_entities',
			'atlas_entity_aliases',
			'atlas_entity_links',
			'atlas_entity_profiles',
			'atlas_ingestion_runs',
			'atlas_ontology_migration_issues',
			'atlas_tag_suggestions',
			'atlas_wiki_entries',
			'folders',
			'import_jobs',
			'lazy_download_jobs',
			'project_asset_refs',
			'project_folder_refs',
			'projects',
			'saved_explore_searches',
			'schema_migrations',
			'tag_facets',
			'tags'
		]);

		expect(projectColumns).not.toContain('path');
		expect(userVersion).toBe(3);
		expect(journalMode).toBe('wal');
		expect(assetIndexes).toEqual(
			expect.arrayContaining(['assets_source_hash_idx', 'assets_folder_id_idx'])
		);
	});

	it('creates the reserved General tag group first', () => {
		const db = openLibraryDatabase();
		const groups = db.prepare('select slug, name from tag_facets order by rowid').all() as Array<{
			slug: string;
			name: string;
		}>;
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

	it('creates Atlas metadata records from reliable import metadata', async () => {
		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Picasso ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/picasso.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 900,
					source_url: 'https://www.metmuseum.org/art/collection/search/1',
					page_title: 'Picasso ref',
					alt_text: null,
					captured_at: '2026-06-05T12:00:00.000Z',
					metadata: {
						sourceId: 'met',
						sourceName: 'The Metropolitan Museum of Art',
						sourceType: 'museum',
						detailUrl: 'https://www.metmuseum.org/art/collection/search/1',
						creator: 'Pablo Picasso',
						dateDisplay: '1937',
						medium: 'Oil on canvas',
						objectName: 'Painting',
						department: 'Paintings',
						rights: 'Public domain image according to The Met.',
						tags: ['horse', 'mourning'],
						rawMetadata: { objectID: 1 }
					}
				}
			]
		});

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const entities = db.prepare('select kind, slug, label from atlas_entities order by kind').all();
		const claims = db.prepare('select kind, slug, value from atlas_claims order by kind').all();
		const suggestions = db
			.prepare('select slug, label, status from atlas_tag_suggestions order by slug')
			.all();
		const runs = db.prepare('select asset_id, source, source_id from atlas_ingestion_runs').all();
		db.close();

		expect(result.failed).toEqual([]);
		expect(entities).toEqual([
			{ kind: 'artist', slug: 'pablo_picasso', label: 'Pablo Picasso' },
			{ kind: 'source', slug: 'the_met', label: 'The Met' }
		]);
		expect(claims).toEqual([
			expect.objectContaining({ kind: 'date', slug: '1937', value: '1937' }),
			expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas', value: 'Oil on canvas' }),
			expect.objectContaining({ kind: 'rights', slug: 'public_domain', value: 'Public Domain' })
		]);
		expect(suggestions).toEqual([
			{ slug: 'horse', label: 'horse', status: 'suggested' },
			{ slug: 'mourning', label: 'mourning', status: 'suggested' }
		]);
		expect(runs).toEqual([
			{ asset_id: result.imported[0].asset_id, source: 'explore', source_id: 'met' }
		]);
	});

	it('exposes canonical Atlas assignments in the Library asset record', async () => {
		const db = openLibraryDatabase();
		createGovernedAtlasConcept(db, {
			slug: 'library_search_dragon',
			label: 'Library Search Dragon',
			kind: 'visual_tag',
			category: 'object',
			displayGroup: 'Objects',
			shortDefinition: 'Use when the test dragon is visible.'
		});
		db.close();
		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Atlas searchable ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/dragon.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/dragon',
					page_title: 'Atlas searchable ref',
					alt_text: null,
					captured_at: '2026-07-24T12:00:00.000Z',
					metadata: {
						acceptedConceptSlugs: ['library_search_dragon']
					}
				}
			]
		});

		const asset = getLibrarySnapshot().assets.find(
			(item) => item.id === result.imported[0].asset_id
		);
		expect(asset?.record?.organization.atlasTags).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					expression: 'library_search_dragon',
					assignmentStatus: 'approved'
				})
			])
		);
		expect(asset?.tags).toContain('library_search_dragon');
	});

	it('applies user-accepted Atlas concepts from extension import metadata', async () => {
		const setupDb = openLibraryDatabase();
		createGovernedAtlasConcept(setupDb, {
			slug: 'black_hair',
			label: 'Black hair',
			kind: 'visual_tag',
			category: 'anatomy',
			displayGroup: 'Anatomy and Body Features',
			shortDefinition: 'Use when black hair is visibly depicted.'
		});
		setupDb.close();
		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Dragon study',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/dragon.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 900,
					source_url: 'https://www.deviantart.com/example/art/dragon-study',
					page_title: 'Dragon study',
					alt_text: null,
					captured_at: '2026-06-30T12:00:00.000Z',
					metadata: {
						sourceName: 'DeviantArt',
						sourceType: 'gallery',
						detailUrl: 'https://www.deviantart.com/example/art/dragon-study',
						creator: 'ExampleArtist',
						artistProfileUrl: 'https://www.deviantart.com/exampleartist',
						artistUsername: 'ExampleArtist',
						acceptedConceptSlugs: ['dragon', 'Black Hair', 'dragon'],
						acceptedAnnotations: [
							{
								label: 'dragon',
								concepts: ['dragon'],
								classifiers: { scale_color: 'green' }
							}
						],
						tags: ['page-only-suggestion']
					}
				}
			]
		});

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const accepted = db
			.prepare(
				`
				select atlas_concepts.slug, atlas_concepts.status as concept_status,
					atlas_asset_concepts.evidence, atlas_asset_concepts.status
				from atlas_asset_concepts
				join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
				where atlas_asset_concepts.asset_id = ?
				order by atlas_concepts.slug
			`
			)
			.all(result.imported[0].asset_id);
		const suggestions = db
			.prepare('select slug, status from atlas_tag_suggestions order by slug')
			.all();
		const artistLinks = db
			.prepare(
				`
				select atlas_entities.kind, atlas_entities.slug, atlas_entities.label,
					atlas_entity_links.host, atlas_entity_links.username, atlas_entity_links.normalized_url
				from atlas_entities
				join atlas_entity_links on atlas_entity_links.entity_id = atlas_entities.id
				order by atlas_entities.slug
			`
			)
			.all();
		const classifiers = db
			.prepare(
				`select atlas_annotations.label, atlas_annotation_classifiers.classifier_type,
					atlas_annotation_classifiers.classifier_value
				 from atlas_annotation_classifiers
				 join atlas_annotations
					on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
				 where atlas_annotations.asset_id = ?`
			)
			.all(result.imported[0].asset_id);
		db.close();

		expect(result.failed).toEqual([]);
		expect(accepted).toEqual([
			{
				slug: 'black_hair',
				concept_status: 'needs_review',
				evidence: 'observed',
				status: 'approved'
			},
			{ slug: 'dragon', concept_status: 'needs_review', evidence: 'observed', status: 'approved' }
		]);
		expect(suggestions).toEqual([{ slug: 'page_only_suggestion', status: 'suggested' }]);
		expect(classifiers).toEqual([
			{ label: 'dragon', classifier_type: 'scale_color', classifier_value: 'green' }
		]);
		expect(artistLinks).toEqual([
			{
				kind: 'artist',
				slug: 'exampleartist',
				label: 'ExampleArtist',
				host: 'deviantart.com',
				username: 'exampleartist',
				normalized_url: 'https://deviantart.com/exampleartist'
			}
		]);
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

		expect(snapshot.projects[0]).toMatchObject({
			name: 'Hand study',
			assetCount: 1,
			folderCount: 1
		});
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
		expect(asset.original_path).toMatch(/^originals\/.+\.png$/);
		expect(asset.thumbnail_path).toMatch(/^thumbnails\/.+\.webp$/);
		expect(existsSync(join(archiveRoot, asset.original_path))).toBe(true);
		expect(existsSync(join(archiveRoot, asset.thumbnail_path))).toBe(true);
	});

	it('rolls back downloaded asset rows and files when Atlas ingestion fails', async () => {
		const now = '2026-07-06T12:00:00.000Z';
		const db = openLibraryDatabase();
		db.prepare(
			`insert into atlas_concepts (
				id, slug, label, kind, category, display_group, status, maturity, short_definition,
				created_by, created_at, updated_at
			) values (
				'atlas-concept-blocked-import-test',
				'blocked_import_test',
				'Blocked Import Test',
				'visual_tag',
				'object',
				'Objects',
				'blocked',
				'stub',
				'Concept used to verify import rollback.',
				'test',
				?,
				?
			)`
		).run(now, now);
		db.close();

		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Broken atlas import',
					storage_mode: 'download',
					image_data: tinyPngBase64(),
					source_image_url: 'https://example.com/broken.png',
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://example.com/broken',
					page_title: 'Broken atlas import',
					alt_text: null,
					captured_at: now,
					metadata: {
						sourceName: 'Local file',
						sourceType: 'local',
						acceptedConceptSlugs: ['blocked_import_test']
					}
				}
			]
		});

		const verifyDb = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const assetCount = verifyDb.prepare('select count(*) as count from assets').get() as {
			count: number;
		};
		const failureCount = verifyDb
			.prepare('select count(*) as count from asset_import_failures')
			.get() as { count: number };
		verifyDb.close();

		expect(result.imported).toEqual([]);
		expect(result.failed).toEqual([
			expect.objectContaining({
				index: 0,
				error: 'Atlas concept "blocked_import_test" is blocked.'
			})
		]);
		expect(assetCount.count).toBe(0);
		expect(failureCount.count).toBe(1);
		expect(readdirSync(join(archiveRoot, 'originals'))).toEqual([]);
		expect(readdirSync(join(archiveRoot, 'thumbnails'))).toEqual([]);
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

	it.each([
		{ format: 'webp', mimeType: 'image/webp', extension: 'webp' },
		{ format: 'gif', mimeType: 'image/gif', extension: 'gif' },
		{ format: 'tiff', mimeType: 'image/tiff', extension: 'tif' }
	])(
		'detects and preserves $format downloads independently of the claimed filename',
		async ({ format, mimeType, extension }) => {
			const pipeline = sharp({
				create: { width: 4, height: 3, channels: 4, background: '#c06c4c' }
			});
			const image = await (
				format === 'webp' ? pipeline.webp() : format === 'gif' ? pipeline.gif() : pipeline.tiff()
			).toBuffer();

			const result = await importLibraryItems({
				destination_folder_id: null,
				items: [
					{
						filename: `studio-reference.${extension}`,
						storage_mode: 'download',
						image_data: image.toString('base64'),
						source_image_url: null,
						mime_type: 'image/jpeg',
						natural_width: 1,
						natural_height: 1,
						source_url: `file://studio-reference.${extension}`,
						page_title: `studio-reference.${extension}`,
						alt_text: null,
						captured_at: '2026-07-22T12:00:00.000Z'
					}
				]
			});
			const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
			const row = db
				.prepare('select mime_type, width, height, original_path from assets where id = ?')
				.get(result.imported[0].asset_id) as {
				mime_type: string;
				width: number;
				height: number;
				original_path: string;
			};
			db.close();

			expect(row).toMatchObject({ mime_type: mimeType, width: 4, height: 3 });
			expect(row.original_path).toMatch(new RegExp(`\\.${extension}$`));
			expect(existsSync(join(archiveRoot, row.original_path))).toBe(true);
		}
	);

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
