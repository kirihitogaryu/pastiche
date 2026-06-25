import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import {
	applyAtlasWikiSeed,
	readAtlasWikiEntries,
	readAtlasWikiEntry,
	setAtlasWikiExampleAssetIds
} from './wiki';

describe('Atlas wiki helpers', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-wiki-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('applies seed concepts idempotently and reads wiki entries', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');

			const serpentCount = db
				.prepare('select count(*) as count from atlas_concepts where slug = ?')
				.get('serpent') as { count: number };
			const entries = readAtlasWikiEntries(db);
			const serpent = readAtlasWikiEntry(db, 'serpent');

			expect(serpentCount.count).toBe(1);
			expect(entries.some((entry) => entry.slug === 'serpent')).toBe(true);
			expect(serpent).toMatchObject({
				slug: 'serpent',
				allowedClassifiers: expect.arrayContaining(['pose', 'state'])
			});
		} finally {
			db.close();
		}
	});

	it('resolves wiki example asset ids into thumbnail-ready asset summaries', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			db.prepare(
				`insert into assets (
					id, filename, title, storage_mode, mime_type, width, height, original_path,
					thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
					source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
				) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).run(
				'asset-example-1',
				'apollo.jpg',
				'Apollo Killing the Python',
				'url_reference',
				'image/jpeg',
				1200,
				800,
				null,
				null,
				'https://upload.wikimedia.org/apollo-python.jpg',
				'https://commons.wikimedia.org/wiki/File:Apollo_Killing_the_Python_LACMA_54.70.1i.jpg',
				'Apollo Killing the Python',
				null,
				'upload.wikimedia.org',
				'example-hash',
				null,
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z',
				null
			);
			db.prepare(
				`update atlas_wiki_entries
				 set examples_json = ?
				 where concept_id = (select id from atlas_concepts where slug = ?)`
			).run(JSON.stringify(['asset-example-1']), 'serpent');

			const serpent = readAtlasWikiEntry(db, 'serpent');

			expect(serpent?.exampleAssetIds).toEqual(['asset-example-1']);
			expect(serpent?.exampleAssets).toEqual([
				expect.objectContaining({
					id: 'asset-example-1',
					title: 'Apollo Killing the Python',
					thumbnailUrl: 'https://upload.wikimedia.org/apollo-python.jpg',
					width: 1200,
					height: 800
				})
			]);
			expect(serpent?.missingExampleAssetIds).toEqual([]);
		} finally {
			db.close();
		}
	});

	it('keeps missing wiki example asset ids as soft references for cleanup', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			db.prepare(
				`update atlas_wiki_entries
				 set examples_json = ?
				 where concept_id = (select id from atlas_concepts where slug = ?)`
			).run(JSON.stringify(['asset-deleted-1']), 'serpent');

			const serpent = readAtlasWikiEntry(db, 'serpent');

			expect(serpent?.exampleAssetIds).toEqual(['asset-deleted-1']);
			expect(serpent?.exampleAssets).toEqual([]);
			expect(serpent?.missingExampleAssetIds).toEqual(['asset-deleted-1']);
		} finally {
			db.close();
		}
	});

	it('updates ordered wiki example ids without requiring asset rows to exist', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');

			const updated = setAtlasWikiExampleAssetIds(db, 'serpent', {
				exampleAssetIds: ['asset-one', 'asset-two'],
				counterexampleAssetIds: ['asset-three'],
				updatedAt: '2026-06-05T01:00:00.000Z'
			});
			const missing = setAtlasWikiExampleAssetIds(db, 'missing', {
				exampleAssetIds: ['asset-one'],
				counterexampleAssetIds: [],
				updatedAt: '2026-06-05T01:00:00.000Z'
			});
			const serpent = readAtlasWikiEntry(db, 'serpent');

			expect(updated).toBe(true);
			expect(missing).toBe(false);
			expect(serpent?.exampleAssetIds).toEqual(['asset-one', 'asset-two']);
			expect(serpent?.counterexampleAssetIds).toEqual(['asset-three']);
			expect(serpent?.missingExampleAssetIds).toEqual(['asset-one', 'asset-two']);
			expect(serpent?.missingCounterexampleAssetIds).toEqual(['asset-three']);
		} finally {
			db.close();
		}
	});

	it('derives example assets from approved focal concept assignments', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			insertExampleAsset(db, {
				id: 'asset-focal-serpent',
				title: 'Focal Serpent',
				hash: 'focal-serpent-hash'
			});
			const serpentId = conceptId(db, 'serpent');
			const visualRoleId = conceptId(db, 'visual_role');
			db.prepare(
				`insert into atlas_asset_concepts (
					id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
				) values (?, ?, ?, 'observed', 'test', 'approved', null, ?, ?)`
			).run(
				'asset-concept-focal-serpent',
				'asset-focal-serpent',
				serpentId,
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z'
			);
			db.prepare(
				`insert into atlas_annotations (
					id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
				) values (?, ?, 'serpent_body', null, 'test', null, 'approved', null, ?, ?)`
			).run(
				'annotation-focal-serpent',
				'asset-focal-serpent',
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z'
			);
			db.prepare(
				`insert into atlas_annotation_concepts (
					annotation_id, concept_id, evidence, provenance, status, created_at
				) values (?, ?, 'observed', 'test', 'approved', ?)`
			).run('annotation-focal-serpent', serpentId, '2026-06-05T00:00:00.000Z');
			db.prepare(
				`insert into atlas_annotation_classifiers (
					id, annotation_id, classifier_type, classifier_value, evidence, status, created_at
				) values (?, ?, 'visual_role', 'focal_point', 'observed', 'approved', ?)`
			).run('classifier-focal-serpent', 'annotation-focal-serpent', '2026-06-05T00:00:00.000Z');
			db.prepare(
				`insert into atlas_annotation_concepts (
					annotation_id, concept_id, evidence, provenance, status, created_at
				) values (?, ?, 'observed', 'test', 'approved', ?)`
			).run('annotation-focal-serpent', visualRoleId, '2026-06-05T00:00:00.000Z');

			const serpent = readAtlasWikiEntry(db, 'serpent');

			expect(serpent?.exampleAssetIds).toContain('asset-focal-serpent');
			expect(serpent?.exampleAssets).toEqual([
				expect.objectContaining({
					id: 'asset-focal-serpent',
					title: 'Focal Serpent',
					visualRole: 'focal_point'
				})
			]);
		} finally {
			db.close();
		}
	});

	it('does not derive good examples from background-only visual role assignments', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			insertExampleAsset(db, {
				id: 'asset-background-castle',
				title: 'Background Castle',
				hash: 'background-castle-hash'
			});
			const castleId = conceptId(db, 'castle');
			db.prepare(
				`insert into atlas_asset_concepts (
					id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
				) values (?, ?, ?, 'observed', 'test', 'approved', null, ?, ?)`
			).run(
				'asset-concept-background-castle',
				'asset-background-castle',
				castleId,
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z'
			);
			db.prepare(
				`insert into atlas_annotations (
					id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
				) values (?, ?, 'background_castle', null, 'test', null, 'approved', null, ?, ?)`
			).run(
				'annotation-background-castle',
				'asset-background-castle',
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z'
			);
			db.prepare(
				`insert into atlas_annotation_concepts (
					annotation_id, concept_id, evidence, provenance, status, created_at
				) values (?, ?, 'observed', 'test', 'approved', ?)`
			).run('annotation-background-castle', castleId, '2026-06-05T00:00:00.000Z');
			db.prepare(
				`insert into atlas_annotation_classifiers (
					id, annotation_id, classifier_type, classifier_value, evidence, status, created_at
				) values (?, ?, 'visual_role', 'background_detail', 'observed', 'approved', ?)`
			).run(
				'classifier-background-castle',
				'annotation-background-castle',
				'2026-06-05T00:00:00.000Z'
			);

			const castle = readAtlasWikiEntry(db, 'castle');

			expect(castle?.exampleAssetIds).not.toContain('asset-background-castle');
			expect(castle?.exampleAssets).toEqual([]);
		} finally {
			db.close();
		}
	});

	it('allows supporting subjects to backfill examples when stronger examples are sparse', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			insertExampleAsset(db, {
				id: 'asset-supporting-horse',
				title: 'Supporting Horse',
				hash: 'supporting-horse-hash'
			});
			const horseId = conceptId(db, 'horse');
			db.prepare(
				`insert into atlas_asset_concepts (
					id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
				) values (?, ?, ?, 'observed', 'test', 'approved', null, ?, ?)`
			).run(
				'asset-concept-supporting-horse',
				'asset-supporting-horse',
				horseId,
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z'
			);
			db.prepare(
				`insert into atlas_annotations (
					id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
				) values (?, ?, 'supporting_horse', null, 'test', null, 'approved', null, ?, ?)`
			).run(
				'annotation-supporting-horse',
				'asset-supporting-horse',
				'2026-06-05T00:00:00.000Z',
				'2026-06-05T00:00:00.000Z'
			);
			db.prepare(
				`insert into atlas_annotation_concepts (
					annotation_id, concept_id, evidence, provenance, status, created_at
				) values (?, ?, 'observed', 'test', 'approved', ?)`
			).run('annotation-supporting-horse', horseId, '2026-06-05T00:00:00.000Z');
			db.prepare(
				`insert into atlas_annotation_classifiers (
					id, annotation_id, classifier_type, classifier_value, evidence, status, created_at
				) values (?, ?, 'visual_role', 'supporting_subject', 'observed', 'approved', ?)`
			).run(
				'classifier-supporting-horse',
				'annotation-supporting-horse',
				'2026-06-05T00:00:00.000Z'
			);

			const horse = readAtlasWikiEntry(db, 'horse');

			expect(horse?.exampleAssetIds).toContain('asset-supporting-horse');
			expect(horse?.exampleAssets).toEqual([
				expect.objectContaining({
					id: 'asset-supporting-horse',
					visualRole: 'supporting_subject'
				})
			]);
		} finally {
			db.close();
		}
	});
});

function insertExampleAsset(
	db: ReturnType<typeof openLibraryDatabase>,
	input: { id: string; title: string; hash: string }
) {
	db.prepare(
		`insert into assets (
			id, filename, title, storage_mode, mime_type, width, height, original_path,
			thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
			source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		input.id,
		`${input.id}.jpg`,
		input.title,
		'url_reference',
		'image/jpeg',
		1200,
		800,
		null,
		null,
		`https://example.test/${input.id}.jpg`,
		`https://example.test/${input.id}`,
		input.title,
		null,
		'example.test',
		input.hash,
		null,
		'2026-06-05T00:00:00.000Z',
		'2026-06-05T00:00:00.000Z',
		'2026-06-05T00:00:00.000Z',
		null
	);
}

function conceptId(db: ReturnType<typeof openLibraryDatabase>, slug: string) {
	const row = db.prepare('select id from atlas_concepts where slug = ?').get(slug) as
		| { id: string }
		| undefined;
	if (!row) throw new Error(`Missing concept ${slug}`);
	return row.id;
}
