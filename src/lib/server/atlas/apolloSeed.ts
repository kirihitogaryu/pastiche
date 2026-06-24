import type Database from 'better-sqlite3';
import { applyAtlasWikiSeed } from './wiki';

const APOLLO_TITLE_PATTERN = /apollo killing the python/i;
const APOLLO_FILE_PATTERN = /Apollo_Killing_the_Python_LACMA_54\.70\.1i/i;

const ASSET_CONCEPT_SLUGS = [
	'apollo_(deity)',
	'python_(mythology)',
	'serpent',
	'castle',
	'lizard',
	'tree',
	'bow',
	'arrow',
	'inscription',
	'engraving',
	'printmaking',
	'mythological_scene'
];

const ANNOTATIONS = [
	{
		label: 'apollo_figure',
		concepts: ['apollo_(deity)', 'male_figure'],
		classifiers: [
			['pose', 'standing'],
			['position', 'left'],
			['action_role', 'attacker'],
			['visual_role', 'focal_point']
		]
	},
	{
		label: 'python_body',
		concepts: ['python_(mythology)', 'serpent'],
		classifiers: [
			['pose', 'reclining'],
			['state', 'wounded'],
			['position', 'right'],
			['action_role', 'target'],
			['visual_role', 'focal_point']
		]
	},
	{
		label: 'latin_inscription',
		concepts: ['inscription'],
		classifiers: [['language', 'latin']]
	},
	{
		label: 'background_castle',
		concepts: ['castle'],
		classifiers: [
			['position', 'background'],
			['visual_role', 'background_detail']
		]
	},
	{
		label: 'background_lizard',
		concepts: ['lizard'],
		classifiers: [
			['position', 'background'],
			['visual_role', 'background_detail']
		]
	},
	{
		label: 'background_trees',
		concepts: ['tree'],
		classifiers: [
			['position', 'background'],
			['visual_role', 'background_detail']
		]
	}
] as const;

export function shouldApplyApolloPythonSeed(input: {
	title?: string | null;
	sourceUrl?: string | null;
}) {
	return Boolean(
		(input.title && APOLLO_TITLE_PATTERN.test(input.title)) ||
		(input.sourceUrl && APOLLO_FILE_PATTERN.test(input.sourceUrl))
	);
}

export function applyApolloPythonSeedForAsset(
	db: Database.Database,
	assetId: string,
	now = new Date().toISOString()
) {
	applyAtlasWikiSeed(db, now);

	const conceptIdBySlug = db.prepare('select id from atlas_concepts where slug = ?');
	const insertAssetConcept = db.prepare(`
		insert into atlas_asset_concepts (
			id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
		) values (?, ?, ?, ?, 'apollo_seed', 'approved', null, ?, ?)
		on conflict(asset_id, concept_id) do update set
			evidence = excluded.evidence,
			provenance = excluded.provenance,
			status = excluded.status,
			updated_at = excluded.updated_at
	`);
	const insertAnnotation = db.prepare(`
		insert into atlas_annotations (
			id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
		) values (?, ?, ?, null, 'apollo_seed', null, 'suggested', null, ?, ?)
		on conflict(id) do update set
			label = excluded.label,
			updated_at = excluded.updated_at
	`);
	const insertAnnotationConcept = db.prepare(`
		insert or replace into atlas_annotation_concepts (
			annotation_id, concept_id, evidence, provenance, status, created_at
		) values (?, ?, ?, 'apollo_seed', 'approved', ?)
	`);
	const insertClassifier = db.prepare(`
		insert into atlas_annotation_classifiers (
			id, annotation_id, classifier_type, classifier_value, evidence, status, created_at
		) values (?, ?, ?, ?, 'observed', 'approved', ?)
		on conflict(annotation_id, classifier_type, classifier_value) do update set
			evidence = excluded.evidence,
			status = excluded.status
	`);

	const apply = db.transaction(() => {
		for (const slug of ASSET_CONCEPT_SLUGS) {
			const conceptId = getConceptId(conceptIdBySlug, slug);
			insertAssetConcept.run(
				`atlas-asset-concept-${assetId}-${slug}`,
				assetId,
				conceptId,
				evidenceForConcept(slug),
				now,
				now
			);
		}

		for (const annotation of ANNOTATIONS) {
			const annotationId = `atlas-annotation-${assetId}-${annotation.label}`;
			insertAnnotation.run(annotationId, assetId, annotation.label, now, now);

			for (const slug of annotation.concepts) {
				insertAnnotationConcept.run(
					annotationId,
					getConceptId(conceptIdBySlug, slug),
					evidenceForConcept(slug),
					now
				);
			}

			for (const [type, value] of annotation.classifiers) {
				insertClassifier.run(
					`atlas-classifier-${assetId}-${annotation.label}-${type}-${value}`,
					annotationId,
					type,
					value,
					now
				);
			}
		}
	});

	apply();
}

function getConceptId(statement: Database.Statement, slug: string) {
	const row = statement.get(slug) as { id: string } | undefined;
	if (!row) throw new Error(`Missing Atlas concept seed: ${slug}`);
	return row.id;
}

function evidenceForConcept(slug: string) {
	if (slug === 'apollo_(deity)' || slug === 'python_(mythology)' || slug === 'mythological_scene') {
		return 'metadata';
	}
	if (slug === 'engraving' || slug === 'printmaking') return 'metadata';
	return 'observed';
}
