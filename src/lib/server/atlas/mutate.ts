import type Database from 'better-sqlite3';
import { normalizeAtlasSlug, normalizeKnownAtlasValue } from '$lib/atlas/normalization';
import type {
	AtlasAssignmentStatus,
	AtlasClaimKind,
	AtlasConceptKind,
	AtlasConceptMaturity,
	AtlasConceptStatus,
	AtlasEntityKind,
	AtlasEvidence,
	AtlasWikiEntrySummary
} from '$lib/atlas/types';
import type { AtlasBatchInput, AtlasWikiDraftInput } from '$lib/atlas/batch';
import { normalizeAtlasBatchInput, VISUAL_ROLE_VALUES } from '$lib/atlas/batch';
import { openLibraryDatabase } from '$lib/server/library/schema';
import {
	applyAtlasWikiSeed,
	readAtlasWikiEntry,
	setAtlasWikiExampleAssetIds,
	type AtlasWikiEntry,
	type AtlasWikiExampleAsset
} from './wiki';

export type AtlasConceptSearchResult = AtlasWikiEntrySummary & {
	match: 'exact' | 'alias' | 'prefix' | 'contains' | 'related';
	score: number;
	redirectTo?: string;
};

export type AtlasSimilarAsset = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	sourceUrl: string;
	subtitle: string;
	sharedConcepts: Array<{ slug: string; label: string; visualRole: string | null }>;
	score: number;
};

export type AtlasExampleCandidate = AtlasWikiExampleAsset & {
	subtitle: string;
	role: string | null;
};

type ConceptRow = {
	id: string;
	slug: string;
	label: string;
	kind: AtlasConceptKind;
	category: string;
	display_group: string;
	status: AtlasConceptStatus;
	maturity: AtlasConceptMaturity;
	short_definition: string;
	aliases_json: string | null;
	related_json: string | null;
	confusable_json: string | null;
	broader_json: string | null;
	narrower_json: string | null;
	allowed_classifiers_json: string | null;
	ai_guidance: string | null;
};

type AssetCandidateRow = {
	id: string;
	title: string;
	page_title: string | null;
	source_url: string;
	source_image_url: string | null;
	thumbnail_path: string | null;
	original_path: string | null;
	width: number;
	height: number;
	metadata_json: string | null;
};

type SimilarConceptRow = {
	asset_id: string;
	slug: string;
	label: string;
	visual_role: string | null;
};

export function applyAtlasAssetPatch(
	db: Database.Database,
	assetId: string,
	value: unknown,
	now = new Date().toISOString()
) {
	applyAtlasWikiSeed(db, now);
	const parsed = normalizeAtlasBatchInput(value);
	if (parsed.errors.length) throw new Error(parsed.errors.join(' '));
	assertAssetExists(db, assetId);
	const input = parsed.input;

	const apply = db.transaction(() => {
		if (input.identity) updateIdentity(db, assetId, input.identity, now);
		for (const entity of input.entities ?? []) upsertAssetEntity(db, assetId, entity, now);
		for (const claim of input.claims ?? []) upsertAssetClaim(db, assetId, claim, now);
		for (const concept of input.concepts ?? []) upsertAssetConcept(db, assetId, concept, now);
		for (const annotation of input.annotations ?? []) upsertAnnotation(db, assetId, annotation, now);
	});

	apply();
	return parsed;
}

export function patchAtlasAsset(assetId: string, value: unknown) {
	const db = openLibraryDatabase();
	try {
		return applyAtlasAssetPatch(db, assetId, value);
	} finally {
		db.close();
	}
}

export function searchAtlasConcepts(
	db: Database.Database,
	query: string,
	limit = 12
): AtlasConceptSearchResult[] {
	applyAtlasWikiSeed(db);
	const clean = query.trim();
	if (!clean) return [];
	const normalized = normalizeAtlasSlug(clean);
	const rows = db
		.prepare(
			`
			select
				atlas_concepts.id,
				atlas_concepts.slug,
				atlas_concepts.label,
				atlas_concepts.kind,
				atlas_concepts.category,
				atlas_concepts.display_group,
				atlas_concepts.status,
				atlas_concepts.maturity,
				atlas_concepts.short_definition,
				atlas_wiki_entries.aliases_json,
				atlas_wiki_entries.related_json,
				atlas_wiki_entries.confusable_json,
				atlas_wiki_entries.broader_json,
				atlas_wiki_entries.narrower_json,
				atlas_wiki_entries.allowed_classifiers_json,
				atlas_wiki_entries.ai_guidance
			from atlas_concepts
			left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
		`
		)
		.all() as ConceptRow[];

	return rows
		.map((row) => scoreConcept(row, clean, normalized))
		.filter((item): item is AtlasConceptSearchResult => Boolean(item))
		.sort((first, second) => second.score - first.score || first.label.localeCompare(second.label))
		.slice(0, Math.max(1, Math.min(limit, 30)));
}

export function searchAtlasConceptsForQuery(query: string, limit?: number) {
	const db = openLibraryDatabase();
	try {
		return searchAtlasConcepts(db, query, limit);
	} finally {
		db.close();
	}
}

export function findSimilarAtlasAssets(
	db: Database.Database,
	assetId: string,
	limit = 6
): AtlasSimilarAsset[] {
	const sourceConcepts = conceptRowsForSimilarity(db, assetId);
	if (!sourceConcepts.length) return [];
	const sourceSlugs = new Set(sourceConcepts.map((concept) => concept.slug));
	const rows = db
		.prepare(
			`
			select
				assets.id,
				assets.title,
				assets.page_title,
				assets.source_url,
				assets.source_image_url,
				assets.thumbnail_path,
				assets.original_path,
				assets.width,
				assets.height,
				assets.metadata_json
			from assets
			where assets.id != ?
		`
		)
		.all(assetId) as AssetCandidateRow[];
	const scored = rows
		.map((asset) => {
			const shared = conceptRowsForSimilarity(db, asset.id).filter((concept) =>
				sourceSlugs.has(concept.slug)
			);
			const score = shared.reduce((sum, concept) => sum + roleWeight(concept.visual_role), 0);
			return { asset, shared, score };
		})
		.filter((item) => item.score > 0)
		.sort((first, second) => second.score - first.score || first.asset.title.localeCompare(second.asset.title))
		.slice(0, Math.max(1, Math.min(limit, 24)));

	return scored.map(({ asset, shared, score }) => ({
		id: asset.id,
		title: asset.page_title ?? asset.title,
		thumbnailUrl: assetThumbnailUrl(asset),
		sourceUrl: asset.source_url,
		subtitle: assetSubtitle(asset),
		sharedConcepts: shared.slice(0, 4).map((concept) => ({
			slug: concept.slug,
			label: concept.label,
			visualRole: concept.visual_role
		})),
		score
	}));
}

export function findSimilarAtlasAssetsForAsset(assetId: string, limit?: number) {
	const db = openLibraryDatabase();
	try {
		return findSimilarAtlasAssets(db, assetId, limit);
	} finally {
		db.close();
	}
}

export function updateAtlasWikiEntry(
	db: Database.Database,
	slug: string,
	input: Partial<AtlasWikiDraftInput>,
	now = new Date().toISOString()
) {
	const existing = readAtlasWikiEntry(db, slug);
	if (!existing) return null;
	const merged: AtlasWikiDraftInput = {
		slug: existing.slug,
		label: existing.label,
		kind: existing.kind,
		category: existing.category,
		displayGroup: existing.displayGroup,
		shortDefinition: existing.shortDefinition,
		longDescription: existing.longDescription ?? '',
		useWhen: existing.useWhen,
		doNotUseWhen: existing.doNotUseWhen,
		aliases: existing.aliases,
		broader: existing.broader,
		narrower: existing.narrower,
		related: existing.related,
		confusable: existing.confusable,
		automaticImplications: existing.automaticImplications,
		suggestedImplications: existing.suggestedImplications,
		allowedClassifiers: existing.allowedClassifiers,
		exampleAssetIds: existing.exampleAssetIds,
		counterexampleAssetIds: existing.counterexampleAssetIds,
		aiGuidance: existing.aiGuidance,
		citations: existing.citations,
		status: existing.status,
		maturity: existing.maturity,
		...input
	};
	merged.slug = existing.slug;
	validateWikiDraft(merged, { allowSimpleVisibleObject: true });
	writeWikiDraft(db, merged, now, 'user');
	return readAtlasWikiEntry(db, existing.slug);
}

export function createAtlasWikiEntry(
	db: Database.Database,
	input: AtlasWikiDraftInput,
	now = new Date().toISOString()
) {
	const draft = {
		...input,
		slug: normalizeAtlasSlug(input.slug),
		status: input.status ?? 'needs_review',
		maturity: input.maturity ?? 'draft'
	};
	validateWikiDraft(draft);
	writeWikiDraft(db, draft, now, 'user');
	return readAtlasWikiEntry(db, draft.slug);
}

export function setAtlasWikiEntryExamples(
	db: Database.Database,
	slug: string,
	input: { exampleAssetIds: string[]; counterexampleAssetIds: string[] },
	now = new Date().toISOString()
) {
	return setAtlasWikiExampleAssetIds(db, slug, {
		exampleAssetIds: input.exampleAssetIds,
		counterexampleAssetIds: input.counterexampleAssetIds,
		updatedAt: now
	});
}

export function readAtlasExampleCandidates(
	db: Database.Database,
	slug: string,
	query = '',
	limit = 30
): AtlasExampleCandidate[] {
	const concept = conceptBySlug(db, slug);
	if (!concept) return [];
	const clean = query.trim().toLowerCase();
	const rows = db
		.prepare(
			`
			select distinct
				assets.id,
				assets.title,
				assets.page_title,
				assets.source_url,
				assets.source_image_url,
				assets.thumbnail_path,
				assets.original_path,
				assets.width,
				assets.height,
				assets.metadata_json
			from assets
			left join atlas_asset_concepts
				on atlas_asset_concepts.asset_id = assets.id
				and atlas_asset_concepts.concept_id = ?
				and atlas_asset_concepts.status = 'approved'
			left join atlas_annotations on atlas_annotations.asset_id = assets.id
			left join atlas_annotation_concepts
				on atlas_annotation_concepts.annotation_id = atlas_annotations.id
				and atlas_annotation_concepts.concept_id = ?
				and atlas_annotation_concepts.status = 'approved'
			where atlas_asset_concepts.concept_id is not null
				or atlas_annotation_concepts.concept_id is not null
			order by assets.title
		`
		)
		.all(concept.id, concept.id) as AssetCandidateRow[];
	return rows
		.map((row) => ({
			id: row.id,
			title: row.page_title ?? row.title,
			thumbnailUrl: assetThumbnailUrl(row),
			width: row.width,
			height: row.height,
			sourceUrl: row.source_url,
			visualRole: strongestVisualRoleForAsset(db, row.id, concept.id),
			role: strongestVisualRoleForAsset(db, row.id, concept.id),
			subtitle: assetSubtitle(row)
		}))
		.filter((candidate) => {
			if (!clean) return true;
			return `${candidate.title} ${candidate.subtitle} ${candidate.role ?? ''}`
				.toLowerCase()
				.includes(clean);
		})
		.slice(0, Math.max(1, Math.min(limit, 80)));
}

function updateIdentity(
	db: Database.Database,
	assetId: string,
	identity: NonNullable<AtlasBatchInput['identity']>,
	now: string
) {
	const row = db.prepare('select metadata_json from assets where id = ?').get(assetId) as
		| { metadata_json: string | null }
		| undefined;
	if (!row) throw new Error('Asset not found');
	const metadata = parseMetadata(row.metadata_json);
	const updates: string[] = [];
	const values: unknown[] = [];
	if (identity.title !== undefined) {
		updates.push('title = ?', 'page_title = ?');
		values.push(identity.title, identity.title);
	}
	if (identity.description !== undefined) {
		updates.push('alt_text = ?');
		values.push(identity.description);
	}
	if (identity.artist !== undefined) metadata.creator = identity.artist;
	if (identity.year !== undefined) metadata.dateDisplay = identity.year;
	if (identity.medium !== undefined) metadata.medium = identity.medium;
	if (identity.source !== undefined) metadata.sourceName = identity.source;
	if (identity.rights !== undefined) metadata.rights = identity.rights;
	updates.push('metadata_json = ?', 'modified_at = ?');
	values.push(JSON.stringify(metadata), now, assetId);
	db.prepare(`update assets set ${updates.join(', ')} where id = ?`).run(...values);

	if (identity.artist) {
		upsertAssetEntity(db, assetId, { kind: 'artist', label: identity.artist }, now);
	}
	if (identity.source) {
		upsertAssetEntity(db, assetId, { kind: 'source', label: identity.source }, now);
	}
	for (const [kind, value] of [
		['date', identity.year],
		['medium', identity.medium],
		['rights', identity.rights],
		['dimensions', identity.dimensions]
	] as Array<[AtlasClaimKind, string | undefined]>) {
		if (value) upsertAssetClaim(db, assetId, { kind, value }, now);
	}
}

function upsertAssetEntity(
	db: Database.Database,
	assetId: string,
	input: NonNullable<AtlasBatchInput['entities']>[number],
	now: string
) {
	const normalized = normalizeKnownAtlasValue(input.kind, input.label);
	if (!normalized) return;
	if (input.action === 'remove') {
		db.prepare(
			`delete from atlas_asset_entities
			 where asset_id = ?
			 and entity_id = (select id from atlas_entities where kind = ? and slug = ?)`
		).run(assetId, input.kind, normalized.slug);
		return;
	}
	db.prepare(
		`insert into atlas_entities (id, kind, slug, label, external_url, created_at, updated_at)
		 values (?, ?, ?, ?, null, ?, ?)
		 on conflict(kind, slug) do update set label = excluded.label, updated_at = excluded.updated_at`
	).run(`atlas-entity-${crypto.randomUUID()}`, input.kind, normalized.slug, normalized.label, now, now);
	const entity = db.prepare('select id from atlas_entities where kind = ? and slug = ?').get(
		input.kind,
		normalized.slug
	) as { id: string };
	db.prepare(
		`insert into atlas_asset_entities (asset_id, entity_id, evidence, provenance, status, created_at)
		 values (?, ?, 'metadata', 'manual', 'approved', ?)
		 on conflict(asset_id, entity_id) do update set
			evidence = excluded.evidence,
			provenance = excluded.provenance,
			status = excluded.status`
	).run(assetId, entity.id, now);
}

function upsertAssetClaim(
	db: Database.Database,
	assetId: string,
	input: NonNullable<AtlasBatchInput['claims']>[number],
	now: string
) {
	const normalized = normalizeKnownAtlasValue(input.kind, input.value);
	if (!normalized) return;
	if (input.action === 'remove') {
		db.prepare('delete from atlas_claims where asset_id = ? and kind = ? and slug = ?').run(
			assetId,
			input.kind,
			normalized.slug
		);
		return;
	}
	db.prepare(
		`insert into atlas_claims (
			id, asset_id, kind, slug, label, value, source_text, evidence, provenance, status, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, 'metadata', 'manual', 'approved', ?, ?)
		on conflict(asset_id, kind, slug) do update set
			label = excluded.label,
			value = excluded.value,
			source_text = excluded.source_text,
			evidence = excluded.evidence,
			provenance = excluded.provenance,
			status = excluded.status,
			updated_at = excluded.updated_at`
	).run(
		`atlas-claim-${crypto.randomUUID()}`,
		assetId,
		input.kind,
		normalized.slug,
		input.label ?? displayKind(input.kind),
		normalized.label,
		input.value,
		now,
		now
	);
}

function upsertAssetConcept(
	db: Database.Database,
	assetId: string,
	input: NonNullable<AtlasBatchInput['concepts']>[number],
	now: string
) {
	const concept = conceptBySlugOrAlias(db, input.slug) ?? createUserStubConcept(db, input.slug, now);
	if (concept.status === 'blocked') throw new Error(`Atlas concept "${input.slug}" is blocked.`);
	if (concept.status === 'deprecated') throw new Error(`Atlas concept "${input.slug}" is deprecated.`);
	if (input.action === 'remove') {
		db.prepare('delete from atlas_asset_concepts where asset_id = ? and concept_id = ?').run(
			assetId,
			concept.id
		);
		return;
	}
	db.prepare(
		`insert into atlas_asset_concepts (
			id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
		) values (?, ?, ?, ?, 'manual', ?, null, ?, ?)
		on conflict(asset_id, concept_id) do update set
			evidence = excluded.evidence,
			provenance = excluded.provenance,
			status = excluded.status,
			updated_at = excluded.updated_at`
	).run(
		`atlas-asset-concept-${assetId}-${concept.slug}`,
		assetId,
		concept.id,
		input.evidence ?? 'observed',
		input.status ?? 'approved',
		now,
		now
	);
}

function upsertAnnotation(
	db: Database.Database,
	assetId: string,
	input: NonNullable<AtlasBatchInput['annotations']>[number],
	now: string
) {
	const annotationId = input.id || `atlas-annotation-${assetId}-${normalizeAtlasSlug(input.label)}`;
	if (input.action === 'remove') {
		db.prepare('delete from atlas_annotations where asset_id = ? and id = ?').run(assetId, annotationId);
		return;
	}
	db.prepare(
		`insert into atlas_annotations (
			id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
		) values (?, ?, ?, null, 'manual', null, 'approved', null, ?, ?)
		on conflict(id) do update set
			label = excluded.label,
			status = excluded.status,
			updated_at = excluded.updated_at`
	).run(annotationId, assetId, input.label, now, now);
	if (input.concepts) {
		for (const slug of input.concepts) {
			const concept = conceptBySlugOrAlias(db, slug) ?? createUserStubConcept(db, slug, now);
			if (concept.status === 'blocked' || concept.status === 'deprecated') {
				throw new Error(`Atlas concept "${slug}" cannot be used.`);
			}
			db.prepare(
				`insert into atlas_annotation_concepts (
					annotation_id, concept_id, evidence, provenance, status, created_at
				) values (?, ?, 'observed', 'manual', 'approved', ?)
				on conflict(annotation_id, concept_id) do update set
					evidence = excluded.evidence,
					provenance = excluded.provenance,
					status = excluded.status`
			).run(annotationId, concept.id, now);
		}
	}
	if (input.removeConcepts) {
		for (const slug of input.removeConcepts) {
			const concept = conceptBySlugOrAlias(db, slug);
			if (!concept) continue;
			db.prepare('delete from atlas_annotation_concepts where annotation_id = ? and concept_id = ?').run(
				annotationId,
				concept.id
			);
		}
	}
	if (input.classifiers) {
		for (const [type, value] of Object.entries(input.classifiers)) {
			if (!value) continue;
			if (type === 'visual_role' && !VISUAL_ROLE_VALUES.includes(value as never)) {
				throw new Error(`Unsupported visual_role "${value}".`);
			}
			db.prepare(
				`insert into atlas_annotation_classifiers (
					id, annotation_id, classifier_type, classifier_value, evidence, status, created_at
				) values (?, ?, ?, ?, 'observed', 'approved', ?)
				on conflict(annotation_id, classifier_type, classifier_value) do update set
					evidence = excluded.evidence,
					status = excluded.status`
			).run(`atlas-classifier-${annotationId}-${type}-${normalizeAtlasSlug(value)}`, annotationId, type, value, now);
		}
	}
}

function createUserStubConcept(db: Database.Database, slugInput: string, now: string) {
	const slug = normalizeAtlasSlug(slugInput);
	const label = displayKind(slug);
	db.prepare(
		`insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity, short_definition,
			created_by, created_at, updated_at
		) values (?, ?, ?, 'visual_tag', 'object', 'Objects', 'needs_review', 'stub', ?, 'user', ?, ?)
		on conflict(slug) do nothing`
	).run(
		`atlas-concept-${crypto.randomUUID()}`,
		slug,
		label,
		`Needs wiki entry. User-created tag for ${label}.`,
		now,
		now
	);
	const concept = conceptBySlug(db, slug);
	if (!concept) throw new Error(`Atlas concept "${slug}" could not be created.`);
	return concept;
}

function scoreConcept(row: ConceptRow, clean: string, normalized: string): AtlasConceptSearchResult | null {
	const aliases = parseJsonList(row.aliases_json);
	const label = row.label.toLowerCase();
	const slug = row.slug.toLowerCase();
	let score = 0;
	let match: AtlasConceptSearchResult['match'] = 'contains';
	if (slug === normalized || label === clean.toLowerCase()) {
		score = 1000;
		match = 'exact';
	} else if (aliases.some((alias) => normalizeAtlasSlug(alias) === normalized)) {
		score = 900;
		match = 'alias';
	} else if (slug.startsWith(normalized) || label.startsWith(clean.toLowerCase())) {
		score = 700;
		match = 'prefix';
	} else if (slug.includes(normalized) || label.includes(clean.toLowerCase())) {
		score = 500;
		match = 'contains';
	} else if (
		[
			...parseJsonList(row.related_json),
			...parseJsonList(row.confusable_json),
			...parseJsonList(row.broader_json),
			...parseJsonList(row.narrower_json)
		].some((ref) => ref.includes(normalized))
	) {
		score = 250;
		match = 'related';
	}
	if (!score) return null;
	if (row.status === 'blocked') score -= 500;
	if (row.status === 'deprecated') score -= 250;
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
		aliases,
		broader: parseJsonList(row.broader_json),
		related: parseJsonList(row.related_json),
		confusable: parseJsonList(row.confusable_json),
		allowedClassifiers: parseJsonList(row.allowed_classifiers_json),
		aiGuidance: row.ai_guidance ?? '',
		match,
		score
	};
}

function conceptRowsForSimilarity(db: Database.Database, assetId: string): SimilarConceptRow[] {
	return db
		.prepare(
			`
			select atlas_concepts.slug, atlas_concepts.label, atlas_asset_concepts.asset_id, null as visual_role
			from atlas_asset_concepts
			join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
			where atlas_asset_concepts.asset_id = ?
				and atlas_asset_concepts.status = 'approved'
			union all
			select atlas_concepts.slug, atlas_concepts.label, atlas_annotations.asset_id,
				(select classifier_value from atlas_annotation_classifiers
				 where annotation_id = atlas_annotations.id and classifier_type = 'visual_role'
				 order by classifier_value limit 1) as visual_role
			from atlas_annotation_concepts
			join atlas_annotations on atlas_annotations.id = atlas_annotation_concepts.annotation_id
			join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
			where atlas_annotations.asset_id = ?
				and atlas_annotation_concepts.status = 'approved'
		`
		)
		.all(assetId, assetId) as SimilarConceptRow[];
}

function roleWeight(role: string | null) {
	switch (role) {
		case 'focal_point':
			return 5;
		case 'supporting_subject':
			return 3;
		case 'background_detail':
		case 'setting_context':
			return 0.5;
		default:
			return 1.5;
	}
}

function strongestVisualRoleForAsset(db: Database.Database, assetId: string, conceptId: string) {
	const rows = db
		.prepare(
			`
			select atlas_annotation_classifiers.classifier_value as role
			from atlas_annotations
			join atlas_annotation_concepts
				on atlas_annotation_concepts.annotation_id = atlas_annotations.id
			join atlas_annotation_classifiers
				on atlas_annotation_classifiers.annotation_id = atlas_annotations.id
				and atlas_annotation_classifiers.classifier_type = 'visual_role'
			where atlas_annotations.asset_id = ?
				and atlas_annotation_concepts.concept_id = ?
				and atlas_annotation_concepts.status = 'approved'
		`
		)
		.all(assetId, conceptId) as Array<{ role: string }>;
	return rows.sort((first, second) => roleWeight(second.role) - roleWeight(first.role))[0]?.role ?? null;
}

function writeWikiDraft(
	db: Database.Database,
	input: AtlasWikiDraftInput,
	now: string,
	createdBy: string
) {
	const slug = normalizeAtlasSlug(input.slug);
	db.prepare(
		`insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity,
			short_definition, created_by, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		on conflict(slug) do update set
			label = excluded.label,
			kind = excluded.kind,
			category = excluded.category,
			display_group = excluded.display_group,
			status = excluded.status,
			maturity = excluded.maturity,
			short_definition = excluded.short_definition,
			updated_at = excluded.updated_at`
	).run(
		`atlas-concept-${slug}`,
		slug,
		input.label,
		input.kind,
		input.category,
		input.displayGroup,
		input.status ?? 'needs_review',
		input.maturity ?? 'draft',
		input.shortDefinition,
		createdBy,
		now,
		now
	);
	const concept = conceptBySlug(db, slug);
	if (!concept) throw new Error('Wiki concept could not be created.');
	db.prepare(
		`insert into atlas_wiki_entries (
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
			updated_at = excluded.updated_at`
	).run(
		concept.id,
		input.longDescription ?? '',
		JSON.stringify(input.useWhen),
		JSON.stringify(input.doNotUseWhen),
		JSON.stringify(input.aliases ?? []),
		JSON.stringify(input.broader ?? []),
		JSON.stringify(input.narrower ?? []),
		JSON.stringify(input.related ?? []),
		JSON.stringify(input.confusable ?? []),
		JSON.stringify(input.automaticImplications ?? []),
		JSON.stringify(input.suggestedImplications ?? []),
		JSON.stringify(input.allowedClassifiers ?? []),
		JSON.stringify(input.exampleAssetIds ?? []),
		JSON.stringify(input.counterexampleAssetIds ?? []),
		input.aiGuidance,
		JSON.stringify(input.citations ?? []),
		now
	);
}

function validateWikiDraft(
	input: AtlasWikiDraftInput,
	options: { allowSimpleVisibleObject?: boolean } = {}
) {
	const missing = [
		['slug', input.slug],
		['label', input.label],
		['kind', input.kind],
		['category', input.category],
		['displayGroup', input.displayGroup],
		['shortDefinition', input.shortDefinition],
		['aiGuidance', input.aiGuidance]
	].filter(([, value]) => !String(value ?? '').trim());
	if (missing.length) throw new Error(`Missing wiki fields: ${missing.map(([key]) => key).join(', ')}`);
	if (!input.useWhen.length) throw new Error('Wiki entries require useWhen guidance.');
	if (!input.doNotUseWhen.length) throw new Error('Wiki entries require doNotUseWhen guidance.');
	const hasRelationship =
		(input.related?.length ?? 0) +
			(input.confusable?.length ?? 0) +
			(input.broader?.length ?? 0) +
			(input.narrower?.length ?? 0) >
		0;
	const simpleVisibleObject = input.kind === 'visual_tag' && input.category === 'object';
	if (!hasRelationship && !(options.allowSimpleVisibleObject || simpleVisibleObject)) {
		throw new Error('New wiki tags require related, broader, narrower, or confusable context.');
	}
}

function conceptBySlug(db: Database.Database, slug: string) {
	return db
		.prepare('select id, slug, label, status from atlas_concepts where slug = ?')
		.get(normalizeAtlasSlug(slug)) as
		| { id: string; slug: string; label: string; status: AtlasConceptStatus }
		| undefined;
}

function conceptBySlugOrAlias(db: Database.Database, slug: string) {
	const normalized = normalizeAtlasSlug(slug);
	const direct = conceptBySlug(db, normalized);
	if (direct) return direct;
	const rows = db
		.prepare(
			`
			select atlas_concepts.id, atlas_concepts.slug, atlas_concepts.label, atlas_concepts.status,
				atlas_wiki_entries.aliases_json
			from atlas_concepts
			left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
		`
		)
		.all() as Array<{
		id: string;
		slug: string;
		label: string;
		status: AtlasConceptStatus;
		aliases_json: string | null;
	}>;
	return rows.find((row) =>
		parseJsonList(row.aliases_json).some((alias) => normalizeAtlasSlug(alias) === normalized)
	);
}

function assertAssetExists(db: Database.Database, assetId: string) {
	const row = db.prepare('select 1 from assets where id = ?').get(assetId);
	if (!row) throw new Error('Asset not found');
}

function parseMetadata(value: string | null) {
	if (!value) return {} as Record<string, unknown>;
	try {
		const parsed = JSON.parse(value) as unknown;
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function parseJsonList(value: string | null | undefined) {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
	} catch {
		return [];
	}
}

function displayKind(kind: string) {
	return kind.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function assetThumbnailUrl(asset: AssetCandidateRow) {
	if (asset.thumbnail_path) return `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=thumb`;
	if (asset.original_path) return `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=original`;
	return asset.source_image_url;
}

function assetSubtitle(asset: AssetCandidateRow) {
	const metadata = parseMetadata(asset.metadata_json);
	return [metadata.creator, metadata.dateDisplay, metadata.medium]
		.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
		.join(' · ');
}
