import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import {
	approveAtlasConcept,
	approveAtlasConceptAsHuman,
	createGovernedAtlasConcept,
	deleteAtlasConcept,
	listAtlasConceptTombstones,
	mergeAtlasConcept,
	migrateAtlasOntologyData,
	readAtlasConceptDeletionImpact,
	restoreAtlasConcept
} from './governance';
import { resolveAtlasTagsWithDb } from './tagResolver';

const NOW = '2026-07-24T00:00:00.000Z';

describe('Atlas concept governance', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-governance-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('creates only explicitly classified draft concepts', () => {
		const db = openLibraryDatabase();
		try {
			expect(() =>
				createGovernedAtlasConcept(
					db,
					{
						slug: 'character_design',
						label: 'Character design',
						kind: 'visual_tag',
						category: 'appearance',
						displayGroup: 'Reference Use'
					},
					NOW
				)
			).toThrow('not valid');

			const concept = createGovernedAtlasConcept(
				db,
				{
					slug: 'character_design',
					label: 'Character design',
					kind: 'visual_tag',
					category: 'reference_use',
					displayGroup: 'Reference Use',
					shortDefinition: 'Use for images kept as character-design references.'
				},
				NOW
			);

			expect(concept).toEqual(
				expect.objectContaining({
					slug: 'character_design',
					status: 'needs_review',
					maturity: 'draft',
					category: 'reference_use',
					display_group: 'Reference Use',
					needs_classification: 0
				})
			);
		} finally {
			db.close();
		}
	});

	it('marks ambiguous legacy object stubs for classification without changing their identity', () => {
		const db = openLibraryDatabase();
		try {
			db.prepare(
				`insert into atlas_concepts (
					id, slug, label, kind, category, display_group, status, maturity,
					short_definition, created_by, created_at, updated_at
				) values (
					'legacy-character-design', 'character_design', 'Character design',
					'visual_tag', 'object', 'Objects', 'needs_review', 'stub',
					'Needs wiki. User-created tag.', 'user', ?, ?
				)`
			).run(NOW, NOW);

			migrateAtlasOntologyData(db, NOW);
			migrateAtlasOntologyData(db, NOW);

			expect(
				db
					.prepare(
						`select id, slug, category, display_group, needs_classification
						 from atlas_concepts where slug = 'character_design'`
					)
					.get()
			).toEqual({
				id: 'legacy-character-design',
				slug: 'character_design',
				category: 'object',
				display_group: 'Objects',
				needs_classification: 1
			});
			expect(
				db
					.prepare(
						`select count(*) as count from atlas_ontology_migration_issues
						 where concept_slug = 'character_design'`
					)
					.get()
			).toEqual({ count: 1 });
		} finally {
			db.close();
		}
	});

	it('requires classification, definition, and usage before approval', () => {
		const db = openLibraryDatabase();
		try {
			createGovernedAtlasConcept(
				db,
				{
					slug: 'quiet_pose',
					label: 'Quiet pose',
					kind: 'visual_tag',
					category: 'pose',
					displayGroup: 'Actions and Poses'
				},
				NOW
			);
			expect(() => approveAtlasConcept(db, 'quiet_pose', NOW)).toThrow('definition');

			db.prepare(`update atlas_concepts set short_definition = ? where slug = 'quiet_pose'`).run(
				'Use for a visibly quiet, settled pose.'
			);
			expect(() => approveAtlasConcept(db, 'quiet_pose', NOW)).toThrow('example');

			insertAsset(db, 'quiet-example');
			db.prepare(
				`insert into atlas_asset_concepts (
					id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
				) values (
					'quiet-assignment', 'quiet-example',
					(select id from atlas_concepts where slug = 'quiet_pose'),
					'observed', 'manual', 'approved', null, ?, ?
				)`
			).run(NOW, NOW);

			expect(approveAtlasConcept(db, 'quiet_pose', NOW)).toEqual(
				expect.objectContaining({ status: 'active', maturity: 'usable' })
			);
		} finally {
			db.close();
		}
	});

	it('lets a human approve a classified draft without satisfying the agent writing rubric', () => {
		const db = openLibraryDatabase();
		try {
			createGovernedAtlasConcept(
				db,
				{
					slug: 'human_reviewed_pose',
					label: 'Human reviewed pose',
					kind: 'visual_tag',
					category: 'pose',
					displayGroup: 'Actions and Poses'
				},
				NOW
			);

			expect(approveAtlasConceptAsHuman(db, 'human_reviewed_pose', NOW)).toEqual(
				expect.objectContaining({ status: 'active', maturity: 'draft' })
			);
		} finally {
			db.close();
		}
	});

	it('uses tiered deletion, blocks silent recreation, and restores surviving assignments', () => {
		const db = openLibraryDatabase();
		try {
			insertAsset(db, 'crest-example');
			createGovernedAtlasConcept(
				db,
				{
					slug: 'opal_crest',
					label: 'Opal crest',
					kind: 'visual_tag',
					category: 'anatomy',
					displayGroup: 'Anatomy and Body Features',
					shortDefinition: 'Use for a visibly opalescent crest.',
					exampleAssetId: 'crest-example'
				},
				NOW
			);
			const impact = readAtlasConceptDeletionImpact(db, 'opal_crest');
			expect(impact).toEqual(expect.objectContaining({ tier: 'guarded', assetAssignments: 1 }));
			expect(
				deleteAtlasConcept(db, 'opal_crest', {
					expectedUpdatedAt: impact!.updatedAt,
					confirmation: 'wrong'
				})
			).toEqual(expect.objectContaining({ deleted: false, reason: 'confirmation_required' }));

			expect(
				deleteAtlasConcept(db, 'opal_crest', {
					expectedUpdatedAt: impact!.updatedAt,
					confirmation: 'opal_crest'
				})
			).toEqual(expect.objectContaining({ deleted: true }));
			expect(listAtlasConceptTombstones(db)).toEqual([
				expect.objectContaining({ slug: 'opal_crest', restoreAvailable: true })
			]);
			expect(() =>
				createGovernedAtlasConcept(
					db,
					{
						slug: 'opal_crest',
						label: 'Opal crest',
						kind: 'visual_tag',
						category: 'anatomy',
						displayGroup: 'Anatomy and Body Features'
					},
					NOW
				)
			).toThrow('Restore it');
			expect(resolveAtlasTagsWithDb(db, { inputs: ['opal crest'] })[0]).toEqual(
				expect.objectContaining({
					deleted: true,
					blocked: true,
					restoreAvailable: true,
					patch: null
				})
			);

			expect(restoreAtlasConcept(db, 'opal_crest', NOW)).toEqual(
				expect.objectContaining({ slug: 'opal_crest' })
			);
			expect(
				db
					.prepare(
						`select count(*) as count from atlas_asset_concepts
						 where asset_id = 'crest-example'
							and concept_id = (select id from atlas_concepts where slug = 'opal_crest')`
					)
					.get()
			).toEqual({ count: 1 });
		} finally {
			db.close();
		}
	});

	it('merges assignments and leaves a replacement tombstone', () => {
		const db = openLibraryDatabase();
		try {
			insertAsset(db, 'dragon-example');
			for (const [slug, label] of [
				['wyrm', 'Wyrm'],
				['dragon', 'Dragon']
			]) {
				createGovernedAtlasConcept(
					db,
					{
						slug,
						label,
						kind: 'visual_tag',
						category: 'creature',
						displayGroup: 'Animals and Creatures',
						shortDefinition: `Use for ${label.toLowerCase()}s.`
					},
					NOW
				);
			}
			db.prepare(
				`insert into atlas_asset_concepts (
					id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
				) values (
					'wyrm-assignment', 'dragon-example',
					(select id from atlas_concepts where slug = 'wyrm'),
					'observed', 'manual', 'approved', null, ?, ?
				)`
			).run(NOW, NOW);

			mergeAtlasConcept(db, 'wyrm', 'dragon', NOW);

			expect(
				db
					.prepare(
						`select atlas_concepts.slug
						 from atlas_asset_concepts
						 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
						 where atlas_asset_concepts.asset_id = 'dragon-example'`
					)
					.all()
			).toEqual([{ slug: 'dragon' }]);
			expect(resolveAtlasTagsWithDb(db, { inputs: ['wyrm'] })[0]).toEqual(
				expect.objectContaining({
					expression: 'dragon',
					deleted: true,
					replacement: 'dragon',
					kind: 'corrected'
				})
			);
		} finally {
			db.close();
		}
	});
});

function insertAsset(db: ReturnType<typeof openLibraryDatabase>, id: string) {
	db.prepare(
		`insert into assets (
			id, filename, title, storage_mode, mime_type, width, height, original_path,
			thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
			source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
		) values (
			?, ?, ?, 'url_reference', 'image/png', 800, 600, null, null,
			?, ?, ?, null, 'example.com', ?, null, ?, ?, ?, '{}'
		)`
	).run(
		id,
		`${id}.png`,
		id,
		`https://example.com/${id}.png`,
		`https://example.com/${id}`,
		id,
		`hash-${id}`,
		NOW,
		NOW,
		NOW
	);
}
