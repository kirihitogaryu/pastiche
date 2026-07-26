import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { AtlasWikiEntrySummary } from '$lib/atlas/types';
import { resolveLibraryPaths } from '$lib/server/library/paths';
import { ATLAS_WIKI_SEED_CONCEPTS } from './wikiSeed';
import { migrateAtlasOntologyData } from './governance';

const ATLAS_WIKI_SEED_VERSION = 1;

type WikiRow = {
	id: string;
	slug: string;
	label: string;
	kind: AtlasWikiEntrySummary['kind'];
	category: string;
	display_group: string;
	status: AtlasWikiEntrySummary['status'];
	maturity: AtlasWikiEntrySummary['maturity'];
	short_definition: string;
	needs_classification: number;
	long_description: string | null;
	use_when_json: string;
	do_not_use_when_json: string;
	aliases_json: string;
	broader_json: string;
	narrower_json: string;
	related_json: string;
	confusable_json: string;
	automatic_implications_json: string;
	suggested_implications_json: string;
	allowed_classifiers_json: string;
	examples_json: string;
	counterexamples_json: string;
	ai_guidance: string;
	citations_json: string;
};

type ExampleAssetRow = {
	id: string;
	title: string;
	filename: string;
	storage_mode: string;
	width: number;
	height: number;
	original_path: string | null;
	thumbnail_path: string | null;
	mime_type: string | null;
	source_image_url: string | null;
	source_url: string;
	page_title: string | null;
};

export type AtlasWikiExampleAsset = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	mimeType: string | null;
	width: number;
	height: number;
	sourceUrl: string;
	visualRole: string | null;
};

export type AtlasWikiEntry = AtlasWikiEntrySummary & {
	longDescription: string | null;
	useWhen: string[];
	doNotUseWhen: string[];
	narrower: string[];
	automaticImplications: string[];
	suggestedImplications: string[];
	examples: string[];
	counterexamples: string[];
	exampleAssetIds: string[];
	counterexampleAssetIds: string[];
	exampleAssets: AtlasWikiExampleAsset[];
	counterexampleAssets: AtlasWikiExampleAsset[];
	missingExampleAssetIds: string[];
	missingCounterexampleAssetIds: string[];
	citations: string[];
};

export function applyAtlasWikiSeed(db: Database.Database, now = new Date().toISOString()) {
	const insertConcept = db.prepare(`
		insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity,
			short_definition, created_by, seed_version, seed_fingerprint, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?, ?, ?)
	`);
	const selectConcept = db.prepare(`
		select
			atlas_concepts.id,
			atlas_concepts.label,
			atlas_concepts.kind,
			atlas_concepts.category,
			atlas_concepts.display_group,
			atlas_concepts.status,
			atlas_concepts.maturity,
			atlas_concepts.short_definition,
			atlas_concepts.created_by,
			atlas_concepts.seed_version,
			atlas_concepts.seed_fingerprint,
			atlas_wiki_entries.long_description,
			atlas_wiki_entries.use_when_json,
			atlas_wiki_entries.do_not_use_when_json,
			atlas_wiki_entries.aliases_json,
			atlas_wiki_entries.broader_json,
			atlas_wiki_entries.narrower_json,
			atlas_wiki_entries.related_json,
			atlas_wiki_entries.confusable_json,
			atlas_wiki_entries.automatic_implications_json,
			atlas_wiki_entries.suggested_implications_json,
			atlas_wiki_entries.allowed_classifiers_json,
			atlas_wiki_entries.examples_json,
			atlas_wiki_entries.counterexamples_json,
			atlas_wiki_entries.ai_guidance,
			atlas_wiki_entries.citations_json
		from atlas_concepts
		left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
		where atlas_concepts.slug = ?
	`);
	const selectTombstone = db.prepare('select slug from atlas_concept_tombstones where slug = ?');
	const markLegacySeed = db.prepare(`
		update atlas_concepts
		set seed_version = ?, seed_fingerprint = ?
		where id = ?
	`);
	const updateSeedConcept = db.prepare(`
		update atlas_concepts set
			label = ?, kind = ?, category = ?, display_group = ?, status = ?, maturity = ?,
			short_definition = ?, seed_version = ?, seed_fingerprint = ?, updated_at = ?
		where id = ?
	`);
	const insertWiki = db.prepare(`
		insert into atlas_wiki_entries (
			concept_id, long_description, use_when_json, do_not_use_when_json,
			aliases_json, broader_json, narrower_json, related_json, confusable_json,
			automatic_implications_json, suggested_implications_json, allowed_classifiers_json,
			examples_json, counterexamples_json, ai_guidance, citations_json, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		on conflict(concept_id) do update set
			long_description = excluded.long_description,
			use_when_json = excluded.use_when_json,
			do_not_use_when_json = excluded.do_not_use_when_json,
			aliases_json = excluded.aliases_json,
			broader_json = excluded.broader_json,
			narrower_json = excluded.narrower_json,
			related_json = excluded.related_json,
			confusable_json = excluded.confusable_json,
			automatic_implications_json = excluded.automatic_implications_json,
			suggested_implications_json = excluded.suggested_implications_json,
			allowed_classifiers_json = excluded.allowed_classifiers_json,
			examples_json = excluded.examples_json,
			counterexamples_json = excluded.counterexamples_json,
			ai_guidance = excluded.ai_guidance,
			citations_json = excluded.citations_json,
			updated_at = excluded.updated_at
	`);

	const apply = db.transaction(() => {
		for (const concept of ATLAS_WIKI_SEED_CONCEPTS) {
			if (selectTombstone.get(concept.slug)) continue;
			const fingerprint = seedConceptFingerprint(concept);
			let row = selectConcept.get(concept.slug) as SeedOwnershipRow | undefined;
			if (!row) {
				insertConcept.run(
					`atlas-concept-${concept.slug}`,
					concept.slug,
					concept.label,
					concept.kind,
					concept.category,
					concept.displayGroup,
					concept.status,
					concept.maturity,
					concept.shortDefinition,
					ATLAS_WIKI_SEED_VERSION,
					fingerprint,
					now,
					now
				);
				row = selectConcept.get(concept.slug) as SeedOwnershipRow;
				writeSeedWiki(insertWiki, row.id, concept, now);
				continue;
			}

			const currentFingerprint = storedSeedFingerprint(row);
			const unchangedLegacySeed =
				row.created_by === 'seed' && !row.seed_fingerprint && currentFingerprint === fingerprint;
			if (unchangedLegacySeed) {
				markLegacySeed.run(ATLAS_WIKI_SEED_VERSION, fingerprint, row.id);
				continue;
			}

			const untouchedSeed =
				row.created_by === 'seed' &&
				Boolean(row.seed_fingerprint) &&
				currentFingerprint === row.seed_fingerprint;
			if (!untouchedSeed) continue;
			if (row.seed_version === ATLAS_WIKI_SEED_VERSION && row.seed_fingerprint === fingerprint) {
				continue;
			}

			updateSeedConcept.run(
				concept.label,
				concept.kind,
				concept.category,
				concept.displayGroup,
				concept.status,
				concept.maturity,
				concept.shortDefinition,
				ATLAS_WIKI_SEED_VERSION,
				fingerprint,
				now,
				row.id
			);
			writeSeedWiki(insertWiki, row.id, concept, now);
		}
	});

	apply();
	migrateAtlasOntologyData(db, now);
}

type SeedOwnershipRow = {
	id: string;
	label: string;
	kind: string;
	category: string;
	display_group: string;
	status: string;
	maturity: string;
	short_definition: string;
	created_by: string;
	seed_version: number | null;
	seed_fingerprint: string | null;
	long_description: string | null;
	use_when_json: string | null;
	do_not_use_when_json: string | null;
	aliases_json: string | null;
	broader_json: string | null;
	narrower_json: string | null;
	related_json: string | null;
	confusable_json: string | null;
	automatic_implications_json: string | null;
	suggested_implications_json: string | null;
	allowed_classifiers_json: string | null;
	examples_json: string | null;
	counterexamples_json: string | null;
	ai_guidance: string | null;
	citations_json: string | null;
};

function writeSeedWiki(
	statement: Database.Statement,
	conceptId: string,
	concept: (typeof ATLAS_WIKI_SEED_CONCEPTS)[number],
	now: string
) {
	statement.run(
		conceptId,
		concept.longDescription,
		JSON.stringify(concept.useWhen),
		JSON.stringify(concept.doNotUseWhen),
		JSON.stringify(concept.aliases),
		JSON.stringify(concept.broader),
		JSON.stringify(concept.narrower),
		JSON.stringify(concept.related),
		JSON.stringify(concept.confusable),
		JSON.stringify(concept.automaticImplications),
		JSON.stringify(concept.suggestedImplications),
		JSON.stringify(concept.allowedClassifiers),
		JSON.stringify(concept.examples),
		JSON.stringify(concept.counterexamples),
		concept.aiGuidance,
		JSON.stringify(concept.citations),
		now
	);
}

function seedConceptFingerprint(concept: (typeof ATLAS_WIKI_SEED_CONCEPTS)[number]) {
	return hashSeedFields({
		label: concept.label,
		kind: concept.kind,
		category: concept.category,
		displayGroup: concept.displayGroup,
		status: concept.status,
		maturity: concept.maturity,
		shortDefinition: concept.shortDefinition,
		longDescription: concept.longDescription,
		useWhen: concept.useWhen,
		doNotUseWhen: concept.doNotUseWhen,
		aliases: concept.aliases,
		broader: concept.broader,
		narrower: concept.narrower,
		related: concept.related,
		confusable: concept.confusable,
		automaticImplications: concept.automaticImplications,
		suggestedImplications: concept.suggestedImplications,
		allowedClassifiers: concept.allowedClassifiers,
		examples: concept.examples,
		counterexamples: concept.counterexamples,
		aiGuidance: concept.aiGuidance,
		citations: concept.citations
	});
}

function storedSeedFingerprint(row: SeedOwnershipRow) {
	if (!row.long_description) return null;
	return hashSeedFields({
		label: row.label,
		kind: row.kind,
		category: row.category,
		displayGroup: row.display_group,
		status: row.status,
		maturity: row.maturity,
		shortDefinition: row.short_definition,
		longDescription: row.long_description,
		useWhen: parseJsonList(row.use_when_json),
		doNotUseWhen: parseJsonList(row.do_not_use_when_json),
		aliases: parseJsonList(row.aliases_json),
		broader: parseJsonList(row.broader_json),
		narrower: parseJsonList(row.narrower_json),
		related: parseJsonList(row.related_json),
		confusable: parseJsonList(row.confusable_json),
		automaticImplications: parseJsonList(row.automatic_implications_json),
		suggestedImplications: parseJsonList(row.suggested_implications_json),
		allowedClassifiers: parseJsonList(row.allowed_classifiers_json),
		examples: parseJsonList(row.examples_json),
		counterexamples: parseJsonList(row.counterexamples_json),
		aiGuidance: row.ai_guidance ?? '',
		citations: parseJsonList(row.citations_json)
	});
}

function hashSeedFields(value: Record<string, unknown>) {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function readAtlasWikiEntries(db: Database.Database): AtlasWikiEntry[] {
	const rows = db
		.prepare(
			`
			select ${wikiSelectColumns()}
			from atlas_concepts
			join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
			order by atlas_concepts.display_group, atlas_concepts.label
		`
		)
		.all() as WikiRow[];

	return rows.map((row) => mapWikiRow(row, db));
}

export function readAtlasWikiEntry(db: Database.Database, slug: string): AtlasWikiEntry | null {
	const row = db
		.prepare(
			`
			select ${wikiSelectColumns()}
			from atlas_concepts
			join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
			where atlas_concepts.slug = ?
		`
		)
		.get(slug) as WikiRow | undefined;

	return row ? mapWikiRow(row, db) : null;
}

export function setAtlasWikiExampleAssetIds(
	db: Database.Database,
	slug: string,
	input: {
		exampleAssetIds: string[];
		counterexampleAssetIds: string[];
		updatedAt: string;
	}
) {
	const result = db
		.prepare(
			`
			update atlas_wiki_entries
			set
				examples_json = ?,
				counterexamples_json = ?,
				updated_at = ?
			where concept_id = (select id from atlas_concepts where slug = ?)
		`
		)
		.run(
			JSON.stringify(normalizeAssetIds(input.exampleAssetIds)),
			JSON.stringify(normalizeAssetIds(input.counterexampleAssetIds)),
			input.updatedAt,
			slug
		);

	return result.changes > 0;
}

function wikiSelectColumns() {
	return `
		atlas_concepts.id,
		atlas_concepts.slug,
		atlas_concepts.label,
		atlas_concepts.kind,
		atlas_concepts.category,
		atlas_concepts.display_group,
		atlas_concepts.status,
		atlas_concepts.maturity,
		atlas_concepts.short_definition,
		atlas_concepts.needs_classification,
		atlas_wiki_entries.long_description,
		atlas_wiki_entries.use_when_json,
		atlas_wiki_entries.do_not_use_when_json,
		atlas_wiki_entries.aliases_json,
		atlas_wiki_entries.broader_json,
		atlas_wiki_entries.narrower_json,
		atlas_wiki_entries.related_json,
		atlas_wiki_entries.confusable_json,
		atlas_wiki_entries.automatic_implications_json,
		atlas_wiki_entries.suggested_implications_json,
		atlas_wiki_entries.allowed_classifiers_json,
		atlas_wiki_entries.examples_json,
		atlas_wiki_entries.counterexamples_json,
		atlas_wiki_entries.ai_guidance,
		atlas_wiki_entries.citations_json
	`;
}

function mapWikiRow(row: WikiRow, db: Database.Database): AtlasWikiEntry {
	const manualExampleAssetIds = parseJsonList(row.examples_json);
	const counterexampleAssetIds = parseJsonList(row.counterexamples_json);
	const derivedExamples = deriveExampleAssets(db, row.id);
	const roleByAssetId = new Map(derivedExamples.map((example) => [example.id, example.visualRole]));
	const derivedExampleAssetIds = derivedExamples.map((example) => example.id);
	const exampleAssetIds = normalizeAssetIds([...manualExampleAssetIds, ...derivedExampleAssetIds]);
	const examples = resolveExampleAssets(db, exampleAssetIds, roleByAssetId);
	const counterexamples = resolveExampleAssets(db, counterexampleAssetIds);
	const metadata = relationalMetadata(db, row.id);

	return {
		id: row.id,
		slug: row.slug,
		label: row.label,
		kind: row.kind,
		category: row.category,
		displayGroup: row.display_group,
		status: row.status,
		maturity: row.maturity,
		shortDefinition: row.short_definition,
		needsClassification: Boolean(row.needs_classification),
		longDescription: row.long_description,
		useWhen: parseJsonList(row.use_when_json),
		doNotUseWhen: parseJsonList(row.do_not_use_when_json),
		aliases: metadata.aliases,
		broader: metadata.broader,
		narrower: metadata.narrower,
		related: metadata.related,
		confusable: metadata.confusable,
		automaticImplications: metadata.automaticImplications,
		suggestedImplications: metadata.suggestedImplications,
		allowedClassifiers: parseJsonList(row.allowed_classifiers_json),
		examples: exampleAssetIds,
		counterexamples: counterexampleAssetIds,
		exampleAssetIds,
		counterexampleAssetIds,
		exampleAssets: examples.assets,
		counterexampleAssets: counterexamples.assets,
		missingExampleAssetIds: examples.missingAssetIds,
		missingCounterexampleAssetIds: counterexamples.missingAssetIds,
		aiGuidance: row.ai_guidance,
		citations: parseJsonList(row.citations_json)
	};
}

function relationalMetadata(db: Database.Database, conceptId: string) {
	const aliases = (
		db
			.prepare(
				`select alias from atlas_concept_aliases
				 where concept_id = ? and status != 'rejected'
				 order by alias`
			)
			.all(conceptId) as Array<{ alias: string }>
	).map((row) => row.alias);
	const outgoing = db
		.prepare(
			`select atlas_concept_relations.relation_type, atlas_concepts.slug
			 from atlas_concept_relations
			 join atlas_concepts on atlas_concepts.id = atlas_concept_relations.target_concept_id
			 where atlas_concept_relations.source_concept_id = ?
				and atlas_concept_relations.status != 'rejected'
			 order by atlas_concepts.slug`
		)
		.all(conceptId) as Array<{ relation_type: string; slug: string }>;
	const narrower = (
		db
			.prepare(
				`select atlas_concepts.slug
				 from atlas_concept_relations
				 join atlas_concepts on atlas_concepts.id = atlas_concept_relations.source_concept_id
				 where atlas_concept_relations.target_concept_id = ?
					and atlas_concept_relations.relation_type = 'broader'
					and atlas_concept_relations.status != 'rejected'
				 order by atlas_concepts.slug`
			)
			.all(conceptId) as Array<{ slug: string }>
	).map((row) => row.slug);
	const slugs = (type: string) =>
		outgoing.filter((row) => row.relation_type === type).map((row) => row.slug);
	return {
		aliases,
		broader: slugs('broader'),
		narrower,
		related: slugs('related'),
		confusable: slugs('confusable'),
		automaticImplications: slugs('automatic_implication'),
		suggestedImplications: slugs('suggested_implication')
	};
}

function resolveExampleAssets(
	db: Database.Database,
	assetIds: string[],
	visualRoleByAssetId = new Map<string, string | null>()
) {
	const assets: AtlasWikiExampleAsset[] = [];
	const missingAssetIds: string[] = [];
	const select = db.prepare(`
		select
			id,
			title,
			filename,
			storage_mode,
			width,
			height,
			original_path,
			thumbnail_path,
			mime_type,
			source_image_url,
			source_url,
			page_title
		from assets
		where id = ?
	`);

	for (const assetId of assetIds) {
		const row = select.get(assetId) as ExampleAssetRow | undefined;
		if (!row) {
			missingAssetIds.push(assetId);
			continue;
		}
		assets.push(mapExampleAsset(row, visualRoleByAssetId.get(assetId) ?? null));
	}

	return { assets, missingAssetIds };
}

function deriveExampleAssets(db: Database.Database, conceptId: string) {
	const rows = db
		.prepare(
			`
			select distinct
				assets.id,
				assets.imported_at,
				(
					select atlas_annotation_classifiers.classifier_value
					from atlas_annotations
					join atlas_annotation_concepts
						on atlas_annotation_concepts.annotation_id = atlas_annotations.id
					join atlas_annotation_classifiers
						on atlas_annotation_classifiers.annotation_id = atlas_annotations.id
					where atlas_annotations.asset_id = assets.id
						and atlas_annotation_concepts.concept_id = ?
						and atlas_annotation_classifiers.classifier_type = 'visual_role'
						and atlas_annotation_classifiers.classifier_value not in (
							'background_detail',
							'setting_context'
						)
					order by
						case atlas_annotation_classifiers.classifier_value
							when 'focal_point' then 1
							when 'supporting_subject' then 2
							else 3
						end
					limit 1
				) as visual_role
			from assets
			where exists (
				select 1
				from atlas_asset_concepts
				where atlas_asset_concepts.asset_id = assets.id
					and atlas_asset_concepts.concept_id = ?
					and atlas_asset_concepts.status = 'approved'
			)
			and (
				not exists (
					select 1
					from atlas_annotations
					join atlas_annotation_concepts
						on atlas_annotation_concepts.annotation_id = atlas_annotations.id
					where atlas_annotations.asset_id = assets.id
						and atlas_annotation_concepts.concept_id = ?
				)
				or exists (
					select 1
					from atlas_annotations
					join atlas_annotation_concepts
						on atlas_annotation_concepts.annotation_id = atlas_annotations.id
					where atlas_annotations.asset_id = assets.id
						and atlas_annotation_concepts.concept_id = ?
						and atlas_annotation_concepts.status = 'approved'
						and not exists (
							select 1
							from atlas_annotation_classifiers
							where atlas_annotation_classifiers.annotation_id = atlas_annotations.id
								and atlas_annotation_classifiers.classifier_type = 'visual_role'
								and atlas_annotation_classifiers.classifier_value in (
									'background_detail',
									'setting_context'
								)
						)
				)
			)
			union
			select distinct
				assets.id,
				assets.imported_at,
				(
					select atlas_annotation_classifiers.classifier_value
					from atlas_annotation_classifiers
					where atlas_annotation_classifiers.annotation_id = atlas_annotations.id
						and atlas_annotation_classifiers.classifier_type = 'visual_role'
						and atlas_annotation_classifiers.classifier_value not in (
							'background_detail',
							'setting_context'
						)
					order by
						case atlas_annotation_classifiers.classifier_value
							when 'focal_point' then 1
							when 'supporting_subject' then 2
							else 3
						end
					limit 1
				) as visual_role
			from assets
			join atlas_annotations on atlas_annotations.asset_id = assets.id
			join atlas_annotation_concepts
				on atlas_annotation_concepts.annotation_id = atlas_annotations.id
			where atlas_annotation_concepts.concept_id = ?
				and atlas_annotation_concepts.status = 'approved'
				and not exists (
					select 1
					from atlas_annotation_classifiers
					where atlas_annotation_classifiers.annotation_id = atlas_annotations.id
						and atlas_annotation_classifiers.classifier_type = 'visual_role'
						and atlas_annotation_classifiers.classifier_value in (
							'background_detail',
							'setting_context'
						)
				)
			order by imported_at desc
			limit 12
		`
		)
		.all(conceptId, conceptId, conceptId, conceptId, conceptId) as Array<{
		id: string;
		visual_role: string | null;
	}>;

	return rows.map((row) => ({ id: row.id, visualRole: row.visual_role }));
}

function mapExampleAsset(row: ExampleAssetRow, visualRole: string | null): AtlasWikiExampleAsset {
	return {
		id: row.id,
		title: row.page_title?.trim() || row.title?.trim() || row.filename,
		thumbnailUrl: exampleThumbnailUrl(row),
		mimeType: row.mime_type,
		width: row.width,
		height: row.height,
		sourceUrl: row.source_url,
		visualRole
	};
}

function exampleThumbnailUrl(row: ExampleAssetRow) {
	if (row.thumbnail_path && localFileAvailable(row.thumbnail_path)) {
		return imageApiUrl(row.id, 'thumb');
	}
	if (row.original_path && localFileAvailable(row.original_path)) {
		return imageApiUrl(row.id, 'original');
	}
	if (row.storage_mode === 'url_reference' || row.storage_mode === 'lazy_download') {
		return row.source_image_url;
	}
	return null;
}

function localFileAvailable(relativePath: string) {
	return existsSync(join(resolveLibraryPaths().root, relativePath));
}

function imageApiUrl(id: string, variant: 'thumb' | 'original') {
	return `/api/library/assets/${encodeURIComponent(id)}/image?variant=${variant}`;
}

function parseJsonList(value: string | null): string[] {
	if (!value) return [];
	const parsed = JSON.parse(value) as unknown;
	return Array.isArray(parsed)
		? parsed.filter((item): item is string => typeof item === 'string')
		: [];
}

function normalizeAssetIds(values: string[]) {
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		normalized.push(trimmed);
	}
	return normalized;
}
