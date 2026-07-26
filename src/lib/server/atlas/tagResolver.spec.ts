import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed } from './wiki';
import { buildAtlasVocabularyNeighborhood, resolveAtlasTagsWithDb } from './tagResolver';

const NOW = '2026-07-24T00:00:00.000Z';

describe('Atlas tag resolver', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-resolver-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('rewrites readable classifier phrases only through an allowed subject classifier', () => {
		const db = openLibraryDatabase();
		try {
			seedConcept(db, 'scales', {
				allowedClassifiers: ['scale_color']
			});
			seedConcept(db, 'scale_color', { category: 'classifier' });

			const [candidate] = resolveAtlasTagsWithDb(db, {
				inputs: ['green scales'],
				context: 'assignment'
			});

			expect(candidate).toEqual(
				expect.objectContaining({
					expression: 'scales.scale_color:green',
					kind: 'corrected',
					confidence: 'high'
				})
			);
			expect(candidate?.patch?.annotations).toEqual([
				{
					label: 'scales',
					concepts: ['scales'],
					classifiers: { scale_color: 'green' }
				}
			]);
		} finally {
			db.close();
		}
	});

	it('lets an exact concept win over a possible decomposition', () => {
		const db = openLibraryDatabase();
		try {
			seedConcept(db, 'golden_hour');
			seedConcept(db, 'hour', { allowedClassifiers: ['color'] });

			const [candidate] = resolveAtlasTagsWithDb(db, {
				inputs: ['golden hour'],
				context: 'assignment'
			});

			expect(candidate).toEqual(
				expect.objectContaining({
					expression: 'golden_hour',
					kind: 'existing',
					confidence: 'high'
				})
			);
		} finally {
			db.close();
		}
	});

	it('keeps a color phrase ambiguous when multiple subject color fields are valid', () => {
		const db = openLibraryDatabase();
		try {
			seedConcept(db, 'dragon', {
				allowedClassifiers: ['body_color', 'scale_color']
			});

			const [candidate] = resolveAtlasTagsWithDb(db, {
				inputs: ['red dragon'],
				context: 'assignment'
			});

			expect(candidate).toEqual(
				expect.objectContaining({
					kind: 'uncertain',
					confidence: 'medium'
				})
			);
			expect(candidate?.alternatives).toHaveLength(1);
		} finally {
			db.close();
		}
	});

	it('canonicalizes aliases, redirects deprecated concepts, permits new concepts, and rejects blocked ones', () => {
		const db = openLibraryDatabase();
		try {
			seedConcept(db, 'dragon', { aliases: ['wyrm'] });
			seedConcept(db, 'old_dragon', { status: 'deprecated' });
			db.prepare(
				`insert into atlas_concept_relations (
					id, source_concept_id, target_concept_id, relation_type, status,
					created_by, created_at, updated_at
				) values (
					'test-replacement',
					(select id from atlas_concepts where slug = 'old_dragon'),
					(select id from atlas_concepts where slug = 'dragon'),
					'replaced_by', 'approved', 'test', ?, ?
				)`
			).run(NOW, NOW);
			seedConcept(db, 'forbidden_tag', { status: 'blocked' });

			const [alias, deprecated, novel, blocked] = resolveAtlasTagsWithDb(db, {
				inputs: ['wyrm', 'old dragon', 'novel useful form', 'forbidden tag'],
				context: 'assignment'
			});

			expect(alias).toEqual(expect.objectContaining({ expression: 'dragon', kind: 'corrected' }));
			expect(deprecated).toEqual(
				expect.objectContaining({ expression: 'dragon', kind: 'corrected' })
			);
			expect(novel).toEqual(
				expect.objectContaining({
					expression: 'novel_useful_form',
					kind: 'new',
					confidence: 'medium'
				})
			);
			expect(novel).toEqual(
				expect.objectContaining({
					patch: null,
					needsClassification: true,
					established: false,
					searchable: false
				})
			);
			expect(blocked).toEqual(
				expect.objectContaining({ blocked: true, patch: null, confidence: 'low' })
			);
		} finally {
			db.close();
		}
	});

	it('builds a deterministic, one-hop neighborhood within concept and character bounds', () => {
		const db = openLibraryDatabase();
		try {
			seedConcept(db, 'dragon', {
				related: ['scales', 'wing', 'fire'],
				allowedClassifiers: ['scale_color']
			});
			seedConcept(db, 'scales');
			seedConcept(db, 'wing');
			seedConcept(db, 'fire');
			seedConcept(db, 'unrelated_archive_term');

			const first = buildAtlasVocabularyNeighborhood(db, ['dragon'], {
				maxConcepts: 3,
				maxCharacters: 2_000
			});
			const second = buildAtlasVocabularyNeighborhood(db, ['dragon'], {
				maxConcepts: 3,
				maxCharacters: 2_000
			});

			expect(second).toEqual(first);
			expect(first.concepts.length).toBeLessThanOrEqual(3);
			expect(first.characters).toBeLessThanOrEqual(2_000);
			expect(first.concepts[0]?.slug).toBe('dragon');
			expect(first.concepts.some((concept) => concept.slug === 'unrelated_archive_term')).toBe(
				false
			);
			expect(first.concepts[0]?.allowedClassifiers).toContain('scale_color');
			expect(first.truncated).toBe(true);
		} finally {
			db.close();
		}
	});
});

function seedConcept(
	db: ReturnType<typeof openLibraryDatabase>,
	slug: string,
	options: {
		status?: 'active' | 'deprecated' | 'blocked';
		category?: string;
		aliases?: string[];
		related?: string[];
		automaticImplications?: string[];
		allowedClassifiers?: string[];
	} = {}
) {
	applyAtlasWikiSeed(db, NOW);
	const id = `concept-test-${slug}`;
	db.prepare(
		`insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity, short_definition,
			created_by, created_at, updated_at
		) values (?, ?, ?, 'visual_tag', ?, 'Objects', ?, 'reviewed', ?, 'test', ?, ?)
		on conflict(slug) do update set
			status = excluded.status,
			maturity = excluded.maturity,
			short_definition = excluded.short_definition,
			updated_at = excluded.updated_at`
	).run(
		id,
		slug,
		slug.replaceAll('_', ' '),
		options.category ?? 'object',
		options.status ?? 'active',
		`Use for ${slug.replaceAll('_', ' ')}.`,
		NOW,
		NOW
	);
	db.prepare(
		`insert into atlas_wiki_entries (
			concept_id, long_description, use_when_json, do_not_use_when_json, aliases_json,
			broader_json, narrower_json, related_json, confusable_json, automatic_implications_json,
			suggested_implications_json, allowed_classifiers_json, examples_json, counterexamples_json,
			ai_guidance, citations_json, updated_at
		) values (
			(select id from atlas_concepts where slug = ?), '', '[]', '[]', ?, '[]', '[]', ?,
			'[]', ?, '[]', ?, '[]', '[]', '', '[]', ?
		)
		on conflict(concept_id) do update set
			aliases_json = excluded.aliases_json,
			related_json = excluded.related_json,
			automatic_implications_json = excluded.automatic_implications_json,
			allowed_classifiers_json = excluded.allowed_classifiers_json,
			updated_at = excluded.updated_at`
	).run(
		slug,
		JSON.stringify(options.aliases ?? []),
		JSON.stringify(options.related ?? []),
		JSON.stringify(options.automaticImplications ?? []),
		JSON.stringify(options.allowedClassifiers ?? []),
		NOW
	);
}
