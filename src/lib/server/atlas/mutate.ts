import type Database from 'better-sqlite3';
import { normalizeAtlasSlug, normalizeKnownAtlasValue } from '$lib/atlas/normalization';
import type {
	AtlasClaimKind,
	AtlasConceptKind,
	AtlasConceptMaturity,
	AtlasConceptStatus,
	AtlasWikiEntrySummary
} from '$lib/atlas/types';
import type { AtlasBatchInput, AtlasWikiDraftInput } from '$lib/atlas/batch';
import type { AtlasTagPatch } from '$lib/atlas/agentTypes';
import { normalizeAtlasBatchInput, VISUAL_ROLE_VALUES } from '$lib/atlas/batch';
import { validateAtlasClassification } from '$lib/atlas/ontology';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { syncLegacyConceptMetadata } from './governance';
import {
	applyAtlasWikiSeed,
	readAtlasWikiEntry,
	setAtlasWikiExampleAssetIds,
	type AtlasWikiExampleAsset
} from './wiki';
import { resolveAtlasTagsWithDb } from './tagResolver';

export type AtlasConceptSearchResult = AtlasWikiEntrySummary & {
	match: 'exact' | 'alias' | 'prefix' | 'contains' | 'related';
	score: number;
	redirectTo?: string;
};

export type AtlasSimilarAsset = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	mimeType: string | null;
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
	mime_type: string | null;
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
		for (const annotation of input.annotations ?? [])
			upsertAnnotation(db, assetId, annotation, now);
		for (const suggestion of input.tagSuggestions ?? [])
			reviewMetadataTagSuggestion(db, assetId, suggestion, now);
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

export function applyAgentTagPatches(
	db: Database.Database,
	assetId: string,
	runId: string,
	patches: AtlasTagPatch[],
	suggestionIds: string[] = [],
	now = new Date().toISOString()
) {
	applyAtlasWikiSeed(db, now);
	assertAssetExists(db, assetId);
	const parsedPatches = patches.map((patch) => {
		const parsed = normalizeAtlasBatchInput(patch);
		if (parsed.errors.length) throw new Error(parsed.errors.join(' '));
		return { patch, input: parsed.input };
	});
	const provenance = `agent:${runId}`;

	const apply = db.transaction(() => {
		for (const { patch, input } of parsedPatches) {
			if (patch.newConceptDraft) {
				const draft = {
					...patch.newConceptDraft,
					exampleAssetIds: uniqueStrings([
						...(patch.newConceptDraft.exampleAssetIds ?? []),
						assetId
					]),
					status: 'needs_review' as const,
					maturity: 'draft' as const
				};
				validateWikiDraft(draft, { allowSimpleVisibleObject: true });
				const existing = conceptBySlug(db, draft.slug);
				if (!existing) writeWikiDraft(db, draft, now, 'agent');
				else if (existing.status === 'blocked' || existing.status === 'deprecated')
					throw new Error(`Atlas concept "${draft.slug}" cannot be used.`);
			}
			for (const conceptInput of input.concepts ?? []) {
				const concept = conceptBySlugOrAlias(db, conceptInput.slug);
				if (!concept)
					throw new Error(
						`Agent suggestion "${conceptInput.slug}" was not validated as an existing or reviewed new concept.`
					);
				upsertAssetConcept(
					db,
					assetId,
					{ ...conceptInput, status: 'approved', evidence: conceptInput.evidence ?? 'observed' },
					now
				);
				db.prepare(
					`update atlas_asset_concepts
					 set provenance = ?, note = ?, updated_at = ?
					 where asset_id = ? and concept_id = ?`
				).run(
					provenance,
					'Accepted from a reviewed Atlas agent suggestion.',
					now,
					assetId,
					concept.id
				);
			}
			for (const annotationInput of input.annotations ?? []) {
				for (const slug of annotationInput.concepts ?? []) {
					const concept = conceptBySlugOrAlias(db, slug);
					if (!concept) throw new Error(`Agent annotation concept "${slug}" is not established.`);
					if (concept.status === 'blocked' || concept.status === 'deprecated')
						throw new Error(`Atlas concept "${slug}" cannot be used.`);
				}
				const annotationId =
					annotationInput.id ?? agentAnnotationId(assetId, runId, annotationInput.label);
				upsertAnnotation(db, assetId, { ...annotationInput, id: annotationId }, now);
				db.prepare(
					`update atlas_annotations
					 set source = ?, note = ?, updated_at = ?
					 where id = ? and asset_id = ?`
				).run(
					provenance,
					'Accepted from a reviewed Atlas agent suggestion.',
					now,
					annotationId,
					assetId
				);
				db.prepare(
					`update atlas_annotation_concepts
					 set provenance = ?
					 where annotation_id = ?`
				).run(provenance, annotationId);
			}
		}
		const insertApplied = db.prepare(
			`insert or ignore into atlas_agent_applied_suggestions
			 (run_id, suggestion_id, asset_id, patch_json, applied_at) values (?, ?, ?, ?, ?)`
		);
		for (const [index, suggestionId] of suggestionIds.entries()) {
			insertApplied.run(runId, suggestionId, assetId, JSON.stringify(patches[index] ?? {}), now);
		}
	});
	apply();
}

export function undoAgentTagPatches(
	db: Database.Database,
	assetId: string,
	runId: string,
	entries: Array<{ suggestionId: string; patch: AtlasTagPatch }>,
	now = new Date().toISOString()
) {
	const provenance = `agent:${runId}`;
	const undo = db.transaction(() => {
		for (const entry of entries) {
			const applied = db
				.prepare(
					`select 1 from atlas_agent_applied_suggestions
					 where run_id = ? and suggestion_id = ? and asset_id = ?`
				)
				.get(runId, entry.suggestionId, assetId);
			if (!applied) continue;
			for (const conceptInput of entry.patch.concepts ?? []) {
				const concept = conceptBySlugOrAlias(db, conceptInput.slug);
				if (!concept) continue;
				db.prepare(
					`delete from atlas_asset_concepts
					 where asset_id = ? and concept_id = ? and provenance = ?`
				).run(assetId, concept.id, provenance);
			}
			for (const annotationInput of entry.patch.annotations ?? []) {
				const annotationId =
					annotationInput.id ?? agentAnnotationId(assetId, runId, annotationInput.label);
				for (const [type, value] of Object.entries(annotationInput.classifiers ?? {})) {
					db.prepare(
						`delete from atlas_annotation_classifiers
						 where annotation_id = ? and classifier_type = ? and classifier_value = ?`
					).run(annotationId, type, value);
				}
				const remaining = db
					.prepare(
						`select count(*) as count from atlas_annotation_classifiers
						 where annotation_id = ?`
					)
					.get(annotationId) as { count: number };
				if (remaining.count === 0) {
					db.prepare(
						`delete from atlas_annotations where id = ? and asset_id = ? and source = ?`
					).run(annotationId, assetId, provenance);
				}
			}
			db.prepare(
				`delete from atlas_agent_applied_suggestions
				 where run_id = ? and suggestion_id = ? and asset_id = ?`
			).run(runId, entry.suggestionId, assetId);
		}
		db.prepare('update assets set modified_at = ? where id = ?').run(now, assetId);
	});
	undo();
}

function agentAnnotationId(assetId: string, runId: string, label: string) {
	return `atlas-agent-annotation-${assetId}-${runId}-${normalizeAtlasSlug(label)}`;
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
				assets.mime_type,
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
		.sort(
			(first, second) =>
				second.score - first.score || first.asset.title.localeCompare(second.asset.title)
		)
		.slice(0, Math.max(1, Math.min(limit, 24)));

	return scored.map(({ asset, shared, score }) => ({
		id: asset.id,
		title: asset.page_title ?? asset.title,
		thumbnailUrl: assetThumbnailUrl(asset),
		mimeType: asset.mime_type,
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
	return updateAtlasWikiEntryWithResult(db, slug, input, now)?.entry ?? null;
}

export function updateAtlasWikiEntryWithResult(
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
	// Narrower is always derived as the inverse of other concepts' broader relation.
	merged.narrower = existing.narrower;
	const createdConceptSlugs = writeWikiDraft(db, merged, now, 'user');
	const entry = readAtlasWikiEntry(db, existing.slug);
	return entry ? { entry, createdConceptSlugs } : null;
}

export function createAtlasWikiEntry(
	db: Database.Database,
	input: AtlasWikiDraftInput,
	now = new Date().toISOString(),
	options: { allowIncompleteContent?: boolean } = {}
) {
	const draft = {
		...input,
		slug: normalizeAtlasSlug(input.slug),
		shortDefinition: input.shortDefinition ?? '',
		useWhen: input.useWhen ?? [],
		doNotUseWhen: input.doNotUseWhen ?? [],
		aiGuidance: input.aiGuidance ?? '',
		status: input.status ?? 'needs_review',
		maturity: input.maturity ?? 'draft'
	};
	if (!options.allowIncompleteContent) validateWikiDraft(draft);
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
				assets.mime_type,
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
			mimeType: row.mime_type,
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
	).run(
		`atlas-entity-${crypto.randomUUID()}`,
		input.kind,
		normalized.slug,
		normalized.label,
		now,
		now
	);
	const entity = db
		.prepare('select id from atlas_entities where kind = ? and slug = ?')
		.get(input.kind, normalized.slug) as { id: string };
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
	now: string,
	provenance = 'manual'
) {
	const concept =
		conceptBySlugOrAlias(db, input.slug) ?? createUserStubConcept(db, input.slug, now);
	if (concept.status === 'blocked') throw new Error(`Atlas concept "${input.slug}" is blocked.`);
	if (concept.status === 'deprecated')
		throw new Error(`Atlas concept "${input.slug}" is deprecated.`);
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
		) values (?, ?, ?, ?, ?, ?, null, ?, ?)
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
		provenance,
		input.status ?? 'approved',
		now,
		now
	);
}

function upsertAnnotation(
	db: Database.Database,
	assetId: string,
	input: NonNullable<AtlasBatchInput['annotations']>[number],
	now: string,
	provenance = 'manual'
) {
	const annotationId = input.id || `atlas-annotation-${assetId}-${normalizeAtlasSlug(input.label)}`;
	if (input.action === 'remove') {
		db.prepare('delete from atlas_annotations where asset_id = ? and id = ?').run(
			assetId,
			annotationId
		);
		return;
	}
	db.prepare(
		`insert into atlas_annotations (
			id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
		) values (?, ?, ?, null, ?, null, 'approved', null, ?, ?)
		on conflict(id) do update set
			label = excluded.label,
			status = excluded.status,
			updated_at = excluded.updated_at`
	).run(annotationId, assetId, input.label, provenance, now, now);
	if (input.concepts) {
		for (const slug of input.concepts) {
			const concept = conceptBySlugOrAlias(db, slug) ?? createUserStubConcept(db, slug, now);
			if (concept.status === 'blocked' || concept.status === 'deprecated') {
				throw new Error(`Atlas concept "${slug}" cannot be used.`);
			}
			db.prepare(
				`insert into atlas_annotation_concepts (
					annotation_id, concept_id, evidence, provenance, status, created_at
				) values (?, ?, 'observed', ?, 'approved', ?)
				on conflict(annotation_id, concept_id) do update set
					evidence = excluded.evidence,
					provenance = excluded.provenance,
					status = excluded.status`
			).run(annotationId, concept.id, provenance, now);
		}
	}
	if (input.removeConcepts) {
		for (const slug of input.removeConcepts) {
			const concept = conceptBySlugOrAlias(db, slug);
			if (!concept) continue;
			db.prepare(
				'delete from atlas_annotation_concepts where annotation_id = ? and concept_id = ?'
			).run(annotationId, concept.id);
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
			).run(
				`atlas-classifier-${annotationId}-${type}-${normalizeAtlasSlug(value)}`,
				annotationId,
				type,
				value,
				now
			);
		}
	}
}

function reviewMetadataTagSuggestion(
	db: Database.Database,
	assetId: string,
	input: NonNullable<AtlasBatchInput['tagSuggestions']>[number],
	now: string
) {
	const suggestion = db
		.prepare(
			`select id, source_text, label, provenance, status
			 from atlas_tag_suggestions where id = ? and asset_id = ?`
		)
		.get(input.id, assetId) as
		| {
				id: string;
				source_text: string | null;
				label: string;
				provenance: string;
				status: string;
		  }
		| undefined;
	if (!suggestion) throw new Error('Metadata tag suggestion was not found for this asset.');
	if (input.action === 'reject') {
		db.prepare(
			`update atlas_tag_suggestions set status = 'rejected', updated_at = ?
			 where id = ? and asset_id = ?`
		).run(now, input.id, assetId);
		return;
	}

	const expression = input.expression?.trim() || suggestion.source_text || suggestion.label;
	const candidate = resolveAtlasTagsWithDb(db, {
		inputs: [expression],
		context: 'assignment'
	})[0];
	if (!candidate?.patch || candidate.patch.newConceptDraft) {
		throw new Error(
			`"${expression}" is not an assignable Atlas tag yet. Classify it or choose an established correction.`
		);
	}
	if (candidate.confidence !== 'high') {
		throw new Error(
			`"${expression}" is ambiguous. Choose one of the resolver alternatives before accepting it.`
		);
	}
	const parsed = normalizeAtlasBatchInput(candidate.patch);
	if (parsed.errors.length) throw new Error(parsed.errors.join(' '));
	const provenance = `metadata:${suggestion.provenance}`;
	for (const concept of parsed.input.concepts ?? []) {
		upsertAssetConcept(db, assetId, { ...concept, status: 'approved' }, now, provenance);
	}
	for (const annotation of parsed.input.annotations ?? []) {
		upsertAnnotation(db, assetId, annotation, now, provenance);
	}
	db.prepare(
		`update atlas_tag_suggestions set status = 'accepted', updated_at = ?
		 where id = ? and asset_id = ?`
	).run(now, input.id, assetId);
}

function createUserStubConcept(db: Database.Database, slugInput: string, now: string): never {
	const slug = normalizeAtlasSlug(slugInput);
	void db;
	void now;
	throw new Error(
		`Atlas concept "${slug}" does not exist. Classify and create it before assigning it.`
	);
}

function scoreConcept(
	row: ConceptRow,
	clean: string,
	normalized: string
): AtlasConceptSearchResult | null {
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
	return (
		rows.sort((first, second) => roleWeight(second.role) - roleWeight(first.role))[0]?.role ?? null
	);
}

function writeWikiDraft(
	db: Database.Database,
	input: AtlasWikiDraftInput,
	now: string,
	createdBy: string
) {
	const write = db.transaction(() => {
		const slug = normalizeAtlasSlug(input.slug);
		const existing = conceptBySlug(db, slug);
		if (
			!existing &&
			db.prepare('select 1 from atlas_concept_tombstones where slug = ?').get(slug)
		) {
			throw new Error(`"${slug}" was deleted. Restore it instead of recreating it.`);
		}
		const classification = validateAtlasClassification({
			kind: input.kind,
			category: input.category,
			displayGroup: input.displayGroup
		});
		if (!classification.ok) throw new Error(classification.error);
		const normalizedInput = normalizeWikiReferenceLists(db, input);
		const createdConceptSlugs = createMissingWikiReferenceStubs(
			db,
			slug,
			normalizedInput,
			classification.displayGroup,
			now
		);
		validateWikiReferences(db, slug, normalizedInput);
		db.prepare(
			`insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity,
			short_definition, needs_classification, created_by, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
			on conflict(slug) do update set
				label = excluded.label,
				kind = excluded.kind,
				category = excluded.category,
				display_group = excluded.display_group,
				status = excluded.status,
				maturity = excluded.maturity,
				short_definition = excluded.short_definition,
				needs_classification = 0,
				updated_at = excluded.updated_at`
		).run(
			`atlas-concept-${slug}`,
			slug,
			normalizedInput.label,
			normalizedInput.kind,
			normalizedInput.category,
			classification.displayGroup,
			normalizedInput.status ?? 'needs_review',
			normalizedInput.maturity ?? 'draft',
			normalizedInput.shortDefinition,
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
			normalizedInput.longDescription ?? '',
			JSON.stringify(normalizedInput.useWhen),
			JSON.stringify(normalizedInput.doNotUseWhen),
			JSON.stringify(normalizedInput.aliases ?? []),
			JSON.stringify(normalizedInput.broader ?? []),
			JSON.stringify(normalizedInput.narrower ?? []),
			JSON.stringify(normalizedInput.related ?? []),
			JSON.stringify(normalizedInput.confusable ?? []),
			JSON.stringify(normalizedInput.automaticImplications ?? []),
			JSON.stringify(normalizedInput.suggestedImplications ?? []),
			JSON.stringify(normalizedInput.allowedClassifiers ?? []),
			JSON.stringify(normalizedInput.exampleAssetIds ?? []),
			JSON.stringify(normalizedInput.counterexampleAssetIds ?? []),
			normalizedInput.aiGuidance,
			JSON.stringify(normalizedInput.citations ?? []),
			now
		);
		syncLegacyConceptMetadata(db, slug, now);
		return createdConceptSlugs;
	});
	return write();
}

const WIKI_RELATION_KEYS = [
	'broader',
	'narrower',
	'related',
	'confusable',
	'automaticImplications',
	'suggestedImplications'
] as const;

function normalizeWikiReferenceLists(
	db: Database.Database,
	input: AtlasWikiDraftInput
): AtlasWikiDraftInput {
	const normalized = { ...input };
	for (const key of WIKI_RELATION_KEYS) {
		normalized[key] = uniqueStrings(
			(input[key] ?? []).map((raw) => {
				const slug = normalizeAtlasSlug(raw);
				if (!slug) throw new Error(`Wiki relation "${raw}" is not a valid Atlas tag.`);
				return conceptBySlugOrAlias(db, slug)?.slug ?? slug;
			})
		);
	}
	return normalized;
}

function createMissingWikiReferenceStubs(
	db: Database.Database,
	sourceSlug: string,
	input: AtlasWikiDraftInput,
	displayGroup: string,
	now: string
) {
	const created: string[] = [];
	const targets = uniqueStrings(WIKI_RELATION_KEYS.flatMap((key) => input[key] ?? []));
	for (const target of targets) {
		if (target === sourceSlug) throw new Error('A Wiki concept cannot relate to itself.');
		if (conceptBySlug(db, target)) continue;
		if (db.prepare('select 1 from atlas_concept_tombstones where slug = ?').get(target)) {
			throw new Error(`"${target}" was deleted. Restore it instead of recreating it.`);
		}

		const conceptId = `atlas-concept-${target}`;
		db.prepare(
			`insert into atlas_concepts (
				id, slug, label, kind, category, display_group, status, maturity,
				short_definition, needs_classification, created_by, created_at, updated_at
			) values (?, ?, ?, ?, ?, ?, 'needs_review', 'stub', ?, 1, 'wiki_reference', ?, ?)`
		).run(
			conceptId,
			target,
			displayKind(target),
			input.kind,
			input.category,
			displayGroup,
			'Needs definition. Created from a saved Wiki relation.',
			now,
			now
		);
		db.prepare(
			`insert into atlas_wiki_entries (
				concept_id, long_description, use_when_json, do_not_use_when_json,
				aliases_json, broader_json, narrower_json, related_json, confusable_json,
				automatic_implications_json, suggested_implications_json, allowed_classifiers_json,
				examples_json, counterexamples_json, ai_guidance, citations_json, updated_at
			) values (?, '', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]',
				'[]', '[]', '', '[]', ?)`
		).run(conceptId, now);
		created.push(target);
	}
	return created;
}

function validateWikiReferences(
	db: Database.Database,
	sourceSlug: string,
	input: AtlasWikiDraftInput
) {
	const relations = [
		...(input.broader ?? []),
		...(input.narrower ?? []),
		...(input.related ?? []),
		...(input.confusable ?? []),
		...(input.automaticImplications ?? []),
		...(input.suggestedImplications ?? [])
	];
	for (const raw of relations) {
		const target = normalizeAtlasSlug(raw);
		if (target === sourceSlug) throw new Error('A Wiki concept cannot relate to itself.');
		const concept = db.prepare('select status from atlas_concepts where slug = ?').get(target) as
			| { status: AtlasConceptStatus }
			| undefined;
		if (!concept) {
			throw new Error(`Related Atlas concept "${target}" does not exist.`);
		}
		if (['blocked', 'deprecated', 'merged'].includes(concept.status)) {
			throw new Error(`Related Atlas concept "${target}" is not available.`);
		}
	}
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
	if (missing.length)
		throw new Error(`Missing wiki fields: ${missing.map(([key]) => key).join(', ')}`);
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
	return db
		.prepare(
			`select atlas_concepts.id, atlas_concepts.slug, atlas_concepts.label, atlas_concepts.status
			 from atlas_concept_aliases
			 join atlas_concepts on atlas_concepts.id = atlas_concept_aliases.concept_id
			 where atlas_concept_aliases.normalized_alias = ?
				and atlas_concept_aliases.status = 'approved'
				and atlas_concepts.status = 'active'`
		)
		.get(normalized) as
		| { id: string; slug: string; label: string; status: AtlasConceptStatus }
		| undefined;
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
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === 'string')
			: [];
	} catch {
		return [];
	}
}

function uniqueStrings(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}

function displayKind(kind: string) {
	return kind.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function assetThumbnailUrl(asset: AssetCandidateRow) {
	if (asset.thumbnail_path)
		return `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=thumb`;
	if (asset.original_path)
		return `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=original`;
	return asset.source_image_url;
}

function assetSubtitle(asset: AssetCandidateRow) {
	const metadata = parseMetadata(asset.metadata_json);
	return [metadata.creator, metadata.dateDisplay, metadata.medium]
		.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
		.join(' · ');
}
