import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
	ATLAS_ONTOLOGY,
	atlasOntologyCategory,
	defaultDisplayGroupFor,
	normalizeAtlasDisplayGroup,
	validateAtlasClassification
} from '$lib/atlas/ontology';
import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import type {
	AtlasConceptDeletionImpact,
	AtlasConceptDraft,
	AtlasConceptKind,
	AtlasConceptMaturity,
	AtlasConceptRelationStatus,
	AtlasConceptRelationType,
	AtlasConceptStatus,
	AtlasConceptTombstone
} from '$lib/atlas/types';
import { openLibraryDatabase } from '$lib/server/library/schema';

const RELATION_TYPES = new Set<AtlasConceptRelationType>([
	'broader',
	'related',
	'confusable',
	'automatic_implication',
	'suggested_implication',
	'replaced_by'
]);

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
	needs_classification: number;
	created_by: string;
	seed_version: number | null;
	seed_fingerprint: string | null;
	created_at: string;
	updated_at: string;
};

type Snapshot = {
	concept: Record<string, unknown>;
	wiki: Record<string, unknown> | null;
	aliases: Array<Record<string, unknown>>;
	relations: Array<Record<string, unknown>>;
	assetAssignments: Array<Record<string, unknown>>;
	annotationAssignments: Array<Record<string, unknown>>;
	entity: Record<string, unknown> | null;
	entityProfile: Record<string, unknown> | null;
	entityAliases: Array<Record<string, unknown>>;
	entityLinks: Array<Record<string, unknown>>;
	entityAssignments: Array<Record<string, unknown>>;
};

export function migrateAtlasOntologyData(db: Database.Database, now = new Date().toISOString()) {
	const migrate = db.transaction(() => {
		normalizeStoredClassifications(db, now);
		ensureWikiRows(db, now);
		linkEntityConcepts(db, now);
		syncAllLegacyConceptMetadata(db, now);
	});
	migrate();
}

function normalizeStoredClassifications(db: Database.Database, now: string) {
	const rows = db
		.prepare(
			`select id, slug, kind, category, display_group, created_by, maturity, short_definition
			 from atlas_concepts`
		)
		.all() as Array<{
		id: string;
		slug: string;
		kind: string;
		category: string;
		display_group: string;
		created_by: string;
		maturity: string;
		short_definition: string;
	}>;
	const update = db.prepare(
		`update atlas_concepts
		 set display_group = ?, needs_classification = ?, updated_at = ?
		 where id = ?`
	);
	for (const row of rows) {
		const displayGroup = normalizeAtlasDisplayGroup(row.display_group);
		const kind = ATLAS_ONTOLOGY.kinds.find((entry) => entry.id === row.kind);
		const category = kind?.categories.find((entry) => entry.id === row.category);
		const looksLikeLegacyStub =
			row.created_by === 'user' &&
			row.kind === 'visual_tag' &&
			row.category === 'object' &&
			row.maturity === 'stub' &&
			/needs wiki|user-created tag/i.test(row.short_definition);
		const looksLikeWikiReferenceStub =
			row.created_by === 'wiki_reference' &&
			row.maturity === 'stub' &&
			/created from a saved wiki relation/i.test(row.short_definition);
		const valid = Boolean(category && ATLAS_ONTOLOGY.displayGroups.includes(displayGroup));
		const needsClassification = !valid || looksLikeLegacyStub || looksLikeWikiReferenceStub ? 1 : 0;
		const storedNeedsClassification = db
			.prepare('select needs_classification from atlas_concepts where id = ?')
			.get(row.id) as { needs_classification: number };
		if (
			displayGroup !== row.display_group ||
			storedNeedsClassification.needs_classification !== needsClassification
		) {
			update.run(displayGroup, needsClassification, now, row.id);
		}
		if (!valid || looksLikeLegacyStub || looksLikeWikiReferenceStub) {
			recordMigrationIssue(
				db,
				'needs_classification',
				row.slug,
				!valid
					? `Stored classification ${row.kind}/${row.category}/${row.display_group} is not in ontology v1.`
					: looksLikeWikiReferenceStub
						? 'Wiki-created relation stub requires human classification review.'
						: 'Legacy quick-created Object stub requires semantic classification.',
				now
			);
		}
	}
}

function ensureWikiRows(db: Database.Database, now: string) {
	db.prepare(
		`insert into atlas_wiki_entries (
			concept_id, long_description, use_when_json, do_not_use_when_json,
			aliases_json, broader_json, narrower_json, related_json, confusable_json,
			automatic_implications_json, suggested_implications_json, allowed_classifiers_json,
			examples_json, counterexamples_json, ai_guidance, citations_json, updated_at
		)
		select
			atlas_concepts.id, null, '[]', '[]', '[]', '[]', '[]', '[]', '[]',
			'[]', '[]', '[]', '[]', '[]', '', '[]', ?
		from atlas_concepts
		left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
		where atlas_wiki_entries.concept_id is null`
	).run(now);
}

function linkEntityConcepts(db: Database.Database, now: string) {
	const entities = db
		.prepare('select id, concept_id, kind, slug, label, created_at, updated_at from atlas_entities')
		.all() as Array<{
		id: string;
		concept_id: string | null;
		kind: string;
		slug: string;
		label: string;
		created_at: string;
		updated_at: string;
	}>;
	const findConcept = db.prepare('select id, kind, category from atlas_concepts where slug = ?');
	const insertConcept = db.prepare(
		`insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity, short_definition,
			needs_classification, created_by, created_at, updated_at
		) values (?, ?, ?, 'entity', ?, ?, 'needs_review', 'draft', ?, 0, 'migration', ?, ?)`
	);
	const link = db.prepare('update atlas_entities set concept_id = ? where id = ?');
	for (const entity of entities) {
		if (entity.concept_id) continue;
		const category = atlasOntologyCategory('entity', entity.kind) ? entity.kind : 'source';
		let concept = findConcept.get(entity.slug) as
			| { id: string; kind: AtlasConceptKind; category: string }
			| undefined;
		if (concept && concept.kind !== 'entity') {
			recordMigrationIssue(
				db,
				'entity_concept_conflict',
				entity.slug,
				`Entity ${entity.kind}/${entity.slug} conflicts with existing ${concept.kind}/${concept.category}.`,
				now
			);
			continue;
		}
		if (!concept) {
			const id = `atlas-concept-${randomUUID()}`;
			insertConcept.run(
				id,
				entity.slug,
				entity.label,
				category,
				defaultDisplayGroupFor('entity', category) ?? 'Identity and Source',
				`Named ${category.replace(/_/g, ' ')}: ${entity.label}.`,
				entity.created_at || now,
				entity.updated_at || now
			);
			concept = { id, kind: 'entity', category };
		}
		link.run(concept.id, entity.id);
	}
	ensureWikiRows(db, now);
}

export function syncAllLegacyConceptMetadata(
	db: Database.Database,
	now = new Date().toISOString()
) {
	const rows = db
		.prepare(
			`select atlas_concepts.id, atlas_concepts.slug, atlas_concepts.status,
				atlas_wiki_entries.aliases_json, atlas_wiki_entries.broader_json,
				atlas_wiki_entries.related_json, atlas_wiki_entries.confusable_json,
				atlas_wiki_entries.automatic_implications_json,
				atlas_wiki_entries.suggested_implications_json
			 from atlas_concepts
			 join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id`
		)
		.all() as Array<{
		id: string;
		slug: string;
		status: AtlasConceptStatus;
		aliases_json: string;
		broader_json: string;
		related_json: string;
		confusable_json: string;
		automatic_implications_json: string;
		suggested_implications_json: string;
	}>;
	for (const row of rows) syncLegacyConceptMetadata(db, row.slug, now, false);
	syncAllBroaderRelationsFromWiki(db, now);
}

export function syncLegacyConceptMetadata(
	db: Database.Database,
	slugInput: string,
	now = new Date().toISOString(),
	syncBroader = true
) {
	const slug = normalizeAtlasSlug(slugInput);
	const row = db
		.prepare(
			`select atlas_concepts.id, atlas_concepts.slug, atlas_concepts.status,
				atlas_wiki_entries.aliases_json, atlas_wiki_entries.broader_json,
				atlas_wiki_entries.related_json, atlas_wiki_entries.confusable_json,
				atlas_wiki_entries.automatic_implications_json,
				atlas_wiki_entries.suggested_implications_json
			 from atlas_concepts
			 join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
			 where atlas_concepts.slug = ?`
		)
		.get(slug) as
		| {
				id: string;
				slug: string;
				status: AtlasConceptStatus;
				aliases_json: string;
				broader_json: string;
				related_json: string;
				confusable_json: string;
				automatic_implications_json: string;
				suggested_implications_json: string;
		  }
		| undefined;
	if (!row) return;

	const aliasStatus: AtlasConceptRelationStatus =
		row.status === 'active' ? 'approved' : 'suggested';
	const aliases = parseList(row.aliases_json);
	db.prepare('delete from atlas_concept_aliases where concept_id = ?').run(row.id);
	db.prepare(
		`delete from atlas_concept_relations
		 where source_concept_id = ?
			and relation_type in (
				'related', 'confusable', 'automatic_implication', 'suggested_implication'
			)`
	).run(row.id);
	for (const alias of aliases) {
		const normalizedAlias = normalizeAtlasSlug(alias);
		if (!normalizedAlias || normalizedAlias === row.slug) continue;
		const conflict = db
			.prepare(
				`select atlas_concepts.slug
				 from atlas_concept_aliases
				 join atlas_concepts on atlas_concepts.id = atlas_concept_aliases.concept_id
				 where atlas_concept_aliases.normalized_alias = ?`
			)
			.get(normalizedAlias) as { slug: string } | undefined;
		if (conflict && conflict.slug !== row.slug) {
			recordMigrationIssue(
				db,
				'duplicate_alias',
				row.slug,
				`Alias "${alias}" is already owned by ${conflict.slug}.`,
				now
			);
			continue;
		}
		db.prepare(
			`insert into atlas_concept_aliases (
				id, concept_id, alias, normalized_alias, status, created_by, created_at, updated_at
			) values (?, ?, ?, ?, ?, 'migration', ?, ?)
			on conflict(normalized_alias) do update set
				alias = excluded.alias,
				status = excluded.status,
				updated_at = excluded.updated_at`
		).run(
			`atlas-concept-alias-${randomUUID()}`,
			row.id,
			alias,
			normalizedAlias,
			aliasStatus,
			now,
			now
		);
	}

	const relationLists: Array<[AtlasConceptRelationType, string[]]> = [
		['related', parseList(row.related_json)],
		['confusable', parseList(row.confusable_json)],
		['automatic_implication', parseList(row.automatic_implications_json)],
		['suggested_implication', parseList(row.suggested_implications_json)]
	];
	for (const [type, targets] of relationLists) {
		for (const target of targets) {
			const targetSlug = normalizeAtlasSlug(target);
			const targetRow = db
				.prepare('select id, status from atlas_concepts where slug = ?')
				.get(targetSlug) as { id: string; status: AtlasConceptStatus } | undefined;
			if (!targetRow) {
				recordMigrationIssue(
					db,
					'missing_relation_target',
					row.slug,
					`${type} points to missing concept "${targetSlug}".`,
					now
				);
				continue;
			}
			if (targetRow.id === row.id) {
				recordMigrationIssue(
					db,
					'invalid_relation',
					row.slug,
					`${type} cannot point to itself.`,
					now
				);
				continue;
			}
			if (['blocked', 'deprecated', 'merged'].includes(targetRow.status)) {
				recordMigrationIssue(
					db,
					'invalid_relation_target',
					row.slug,
					`${type} points to unavailable concept "${targetSlug}".`,
					now
				);
				continue;
			}
			const status: AtlasConceptRelationStatus =
				type === 'suggested_implication' || row.status !== 'active' ? 'suggested' : 'approved';
			upsertConceptRelation(db, row.id, targetRow.id, type, status, 'migration', now);
		}
	}
	if (syncBroader) syncAllBroaderRelationsFromWiki(db, now);
}

function syncAllBroaderRelationsFromWiki(db: Database.Database, now: string) {
	const rows = db
		.prepare(
			`select atlas_concepts.id, atlas_concepts.slug, atlas_concepts.status,
				atlas_wiki_entries.broader_json, atlas_wiki_entries.narrower_json
			 from atlas_concepts
			 join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id`
		)
		.all() as Array<{
		id: string;
		slug: string;
		status: AtlasConceptStatus;
		broader_json: string;
		narrower_json: string;
	}>;
	const bySlug = new Map(rows.map((row) => [row.slug, row]));
	const desired = new Map<
		string,
		{ source: (typeof rows)[number]; target: (typeof rows)[number] }
	>();
	for (const row of rows) {
		for (const targetSlug of parseList(row.broader_json).map(normalizeAtlasSlug)) {
			const target = bySlug.get(targetSlug);
			if (!target || target.id === row.id) {
				recordMigrationIssue(
					db,
					target ? 'invalid_relation' : 'missing_relation_target',
					row.slug,
					target
						? 'broader cannot point to itself.'
						: `broader points to missing concept "${targetSlug}".`,
					now
				);
				continue;
			}
			if (['blocked', 'deprecated', 'merged'].includes(target.status)) {
				recordMigrationIssue(
					db,
					'invalid_relation_target',
					row.slug,
					`broader points to unavailable concept "${targetSlug}".`,
					now
				);
				continue;
			}
			desired.set(`${row.id}:${target.id}`, { source: row, target });
		}
		for (const childSlug of parseList(row.narrower_json).map(normalizeAtlasSlug)) {
			const child = bySlug.get(childSlug);
			if (!child || child.id === row.id) {
				recordMigrationIssue(
					db,
					child ? 'invalid_relation' : 'missing_relation_target',
					row.slug,
					child
						? 'narrower cannot point to itself.'
						: `narrower points to missing concept "${childSlug}".`,
					now
				);
				continue;
			}
			if (['blocked', 'deprecated', 'merged'].includes(child.status)) {
				recordMigrationIssue(
					db,
					'invalid_relation_target',
					row.slug,
					`narrower points to unavailable concept "${childSlug}".`,
					now
				);
				continue;
			}
			desired.set(`${child.id}:${row.id}`, { source: child, target: row });
		}
	}
	db.prepare(
		`delete from atlas_concept_relations
		 where relation_type = 'broader' and created_by = 'migration'`
	).run();
	for (const { source, target } of desired.values()) {
		upsertConceptRelation(
			db,
			source.id,
			target.id,
			'broader',
			source.status === 'active' ? 'approved' : 'suggested',
			'migration',
			now
		);
	}
}

export function createGovernedAtlasConcept(
	db: Database.Database,
	input: AtlasConceptDraft,
	now = new Date().toISOString()
) {
	const slug = normalizeAtlasSlug(input.slug);
	if (!slug) throw new Error('A concept slug is required.');
	if (!input.label.trim()) throw new Error('A concept label is required.');
	const tombstone = db
		.prepare('select slug from atlas_concept_tombstones where slug = ?')
		.get(slug);
	if (tombstone) throw new Error(`"${slug}" was deleted. Restore it instead of recreating it.`);
	const classification = validateAtlasClassification(input);
	if (!classification.ok) throw new Error(classification.error);
	const existing = readConceptRow(db, slug);
	if (existing) throw new Error(`Atlas concept "${slug}" already exists.`);
	const id = `atlas-concept-${randomUUID()}`;
	const definition =
		input.shortDefinition?.trim() || `Needs definition. User-created ${input.category} concept.`;
	const create = db.transaction(() => {
		db.prepare(
			`insert into atlas_concepts (
				id, slug, label, kind, category, display_group, status, maturity,
				short_definition, needs_classification, created_by, created_at, updated_at
			) values (?, ?, ?, ?, ?, ?, 'needs_review', 'draft', ?, 0, 'user', ?, ?)`
		).run(
			id,
			slug,
			input.label.trim(),
			input.kind,
			input.category,
			classification.displayGroup,
			definition,
			now,
			now
		);
		ensureWikiRows(db, now);
		if (input.exampleAssetId) {
			const asset = db.prepare('select id from assets where id = ?').get(input.exampleAssetId);
			if (!asset) throw new Error('The example asset no longer exists.');
			db.prepare(
				`insert into atlas_asset_concepts (
					id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
				) values (?, ?, ?, 'observed', 'manual', 'approved', null, ?, ?)
				on conflict(asset_id, concept_id) do nothing`
			).run(`atlas-assignment-${randomUUID()}`, input.exampleAssetId, id, now, now);
			db.prepare(
				`update atlas_wiki_entries set examples_json = ?, updated_at = ? where concept_id = ?`
			).run(JSON.stringify([input.exampleAssetId]), now, id);
		}
		linkConceptEntityIfNeeded(db, id, slug, input.label.trim(), input.kind, input.category, now);
	});
	create();
	return readConceptRow(db, slug);
}

export function updateGovernedAtlasConcept(
	db: Database.Database,
	slugInput: string,
	input: Partial<Omit<AtlasConceptDraft, 'slug' | 'exampleAssetId'>>,
	now = new Date().toISOString()
) {
	const slug = normalizeAtlasSlug(slugInput);
	const existing = readConceptRow(db, slug);
	if (!existing) return null;
	const next = {
		kind: input.kind ?? existing.kind,
		category: input.category ?? existing.category,
		displayGroup: input.displayGroup ?? existing.display_group
	};
	const classification = validateAtlasClassification(next);
	if (!classification.ok) throw new Error(classification.error);
	const update = db.transaction(() => {
		db.prepare(
			`update atlas_concepts
			 set label = ?, kind = ?, category = ?, display_group = ?, short_definition = ?,
				needs_classification = 0, created_by = 'user', updated_at = ?
			 where id = ?`
		).run(
			input.label?.trim() || existing.label,
			next.kind,
			next.category,
			classification.displayGroup,
			input.shortDefinition?.trim() || existing.short_definition,
			now,
			existing.id
		);
		migrateAssignmentsForKindChange(db, existing, next.kind, next.category, now);
	});
	update();
	return readConceptRow(db, slug);
}

export function approveAtlasConcept(
	db: Database.Database,
	slugInput: string,
	now = new Date().toISOString()
) {
	return approveAtlasConceptWithPolicy(db, slugInput, 'agent', now);
}

/**
 * Human approval is an explicit governance decision, not a request for the
 * concept to satisfy the agent-writing rubric. A human may activate a validly
 * classified draft and finish its Wiki prose later.
 */
export function approveAtlasConceptAsHuman(
	db: Database.Database,
	slugInput: string,
	now = new Date().toISOString()
) {
	return approveAtlasConceptWithPolicy(db, slugInput, 'human', now);
}

function approveAtlasConceptWithPolicy(
	db: Database.Database,
	slugInput: string,
	policy: 'human' | 'agent',
	now: string
) {
	const slug = normalizeAtlasSlug(slugInput);
	const concept = readConceptRow(db, slug);
	if (!concept) return null;
	if (['blocked', 'deprecated', 'merged'].includes(concept.status)) {
		throw new Error(`Atlas concept "${slug}" cannot be approved while it is ${concept.status}.`);
	}
	const classification = validateAtlasClassification({
		kind: concept.kind,
		category: concept.category,
		displayGroup: concept.display_group
	});
	if (!classification.ok || concept.needs_classification) {
		throw new Error('Classify this concept before approving it.');
	}
	if (policy === 'agent') {
		if (
			!concept.short_definition.trim() ||
			/needs definition|needs wiki/i.test(concept.short_definition)
		) {
			throw new Error('Add a usable short definition before approving this concept.');
		}
		const examples = db
			.prepare('select examples_json from atlas_wiki_entries where concept_id = ?')
			.get(concept.id) as { examples_json: string } | undefined;
		const usage = conceptUsageCount(db, concept.id);
		if (!parseList(examples?.examples_json).length && usage === 0) {
			throw new Error('Add at least one example or approved assignment before approval.');
		}
	}
	const maturity: AtlasConceptMaturity =
		policy === 'agent' && (concept.maturity === 'stub' || concept.maturity === 'draft')
			? 'usable'
			: concept.maturity;
	const approve = db.transaction(() => {
		db.prepare(
			`update atlas_concepts
			 set status = 'active', maturity = ?, needs_classification = 0, updated_at = ?
			 where id = ?`
		).run(maturity, now, concept.id);
		db.prepare(
			`update atlas_concept_aliases set status = 'approved', updated_at = ? where concept_id = ?`
		).run(now, concept.id);
		db.prepare(
			`update atlas_concept_relations
			 set status = 'approved', updated_at = ?
			 where source_concept_id = ? and relation_type != 'suggested_implication'`
		).run(now, concept.id);
	});
	approve();
	return readConceptRow(db, slug);
}

export function deprecateAtlasConcept(
	db: Database.Database,
	slugInput: string,
	replacementInput?: string | null,
	now = new Date().toISOString()
) {
	const slug = normalizeAtlasSlug(slugInput);
	const concept = readConceptRow(db, slug);
	if (!concept) return null;
	const replacementSlug = replacementInput ? normalizeAtlasSlug(replacementInput) : null;
	const replacement = replacementSlug ? readConceptRow(db, replacementSlug) : null;
	if (replacementSlug && !replacement) throw new Error('Replacement concept was not found.');
	if (replacement && ['blocked', 'deprecated', 'merged'].includes(replacement.status)) {
		throw new Error('Replacement concept is not assignable.');
	}
	const deprecate = db.transaction(() => {
		db.prepare(`update atlas_concepts set status = 'deprecated', updated_at = ? where id = ?`).run(
			now,
			concept.id
		);
		if (replacement) {
			upsertConceptRelation(db, concept.id, replacement.id, 'replaced_by', 'approved', 'user', now);
		}
	});
	deprecate();
	return readConceptRow(db, slug);
}

export function readAtlasConceptDeletionImpact(
	db: Database.Database,
	slugInput: string
): AtlasConceptDeletionImpact | null {
	const concept = readConceptRow(db, normalizeAtlasSlug(slugInput));
	if (!concept) return null;
	const counts = db
		.prepare(
			`select
				(select count(*) from atlas_asset_concepts where concept_id = ?) as asset_assignments,
				(select count(*) from atlas_annotation_concepts where concept_id = ?) as annotation_assignments,
				(select count(*) from atlas_asset_entities
				 join atlas_entities on atlas_entities.id = atlas_asset_entities.entity_id
				 where atlas_entities.concept_id = ?) as entity_assignments,
				(select count(*) from atlas_concept_aliases where concept_id = ?) as aliases,
				(select count(*) from atlas_concept_relations where source_concept_id = ?) as outgoing_relations,
				(select count(*) from atlas_concept_relations where target_concept_id = ?) as incoming_relations,
				(select count(*) from atlas_wiki_entries where concept_id = ?) as has_wiki`
		)
		.get(concept.id, concept.id, concept.id, concept.id, concept.id, concept.id, concept.id) as {
		asset_assignments: number;
		annotation_assignments: number;
		entity_assignments: number;
		aliases: number;
		outgoing_relations: number;
		incoming_relations: number;
		has_wiki: number;
	};
	const connected =
		counts.asset_assignments +
			counts.annotation_assignments +
			counts.entity_assignments +
			counts.aliases +
			counts.outgoing_relations +
			counts.incoming_relations >
		0;
	const simple =
		!connected &&
		!concept.seed_version &&
		concept.status === 'needs_review' &&
		(concept.maturity === 'stub' || concept.maturity === 'draft');
	return {
		slug: concept.slug,
		label: concept.label,
		status: concept.status,
		maturity: concept.maturity,
		updatedAt: concept.updated_at,
		seeded: Boolean(concept.seed_version) || concept.created_by === 'seed',
		assetAssignments: counts.asset_assignments,
		annotationAssignments: counts.annotation_assignments,
		entityAssignments: counts.entity_assignments,
		aliases: counts.aliases,
		incomingRelations: counts.incoming_relations,
		outgoingRelations: counts.outgoing_relations,
		hasWiki: Boolean(counts.has_wiki),
		tier: simple ? 'simple' : 'guarded'
	};
}

export function deleteAtlasConcept(
	db: Database.Database,
	slugInput: string,
	input: {
		confirmed?: boolean;
		confirmation?: string;
		expectedUpdatedAt: string;
		reason?: string | null;
	},
	now = new Date().toISOString()
) {
	const slug = normalizeAtlasSlug(slugInput);
	const impact = readAtlasConceptDeletionImpact(db, slug);
	if (!impact) return { deleted: false as const, reason: 'not_found' as const };
	if (!input.expectedUpdatedAt || input.expectedUpdatedAt !== impact.updatedAt) {
		return { deleted: false as const, reason: 'stale' as const, impact };
	}
	if (impact.tier === 'simple' ? input.confirmed !== true : input.confirmation !== impact.slug) {
		return { deleted: false as const, reason: 'confirmation_required' as const, impact };
	}
	const concept = readConceptRow(db, slug);
	if (!concept) return { deleted: false as const, reason: 'not_found' as const };
	const remove = db.transaction(() => {
		const snapshot = snapshotConcept(db, concept);
		db.prepare(
			`insert into atlas_concept_tombstones (
				slug, label, replacement_slug, snapshot_json, deleted_by, reason, deleted_at
			) values (?, ?, null, ?, 'user', ?, ?)
			on conflict(slug) do update set
				label = excluded.label,
				snapshot_json = excluded.snapshot_json,
				deleted_by = excluded.deleted_by,
				reason = excluded.reason,
				deleted_at = excluded.deleted_at`
		).run(slug, concept.label, JSON.stringify(snapshot), input.reason?.trim() || null, now);
		const entity = db
			.prepare('select id from atlas_entities where concept_id = ?')
			.get(concept.id) as { id: string } | undefined;
		if (entity) db.prepare('delete from atlas_entities where id = ?').run(entity.id);
		db.prepare('delete from atlas_concepts where id = ?').run(concept.id);
	});
	remove();
	return { deleted: true as const, slug, impact };
}

export function restoreAtlasConcept(
	db: Database.Database,
	slugInput: string,
	now = new Date().toISOString()
) {
	const slug = normalizeAtlasSlug(slugInput);
	if (readConceptRow(db, slug)) throw new Error('A live concept already uses this slug.');
	const tombstone = db
		.prepare('select snapshot_json from atlas_concept_tombstones where slug = ?')
		.get(slug) as { snapshot_json: string } | undefined;
	if (!tombstone) return null;
	const snapshot = JSON.parse(tombstone.snapshot_json) as Snapshot;
	const restore = db.transaction(() => {
		insertSnapshotRow(db, 'atlas_concepts', snapshot.concept);
		if (snapshot.wiki) insertSnapshotRow(db, 'atlas_wiki_entries', snapshot.wiki);
		for (const row of snapshot.aliases) insertSnapshotRow(db, 'atlas_concept_aliases', row);
		for (const row of snapshot.assetAssignments) {
			if (rowExists(db, 'assets', String(row.asset_id))) {
				insertSnapshotRow(db, 'atlas_asset_concepts', row);
			}
		}
		for (const row of snapshot.annotationAssignments) {
			if (rowExists(db, 'atlas_annotations', String(row.annotation_id))) {
				insertSnapshotRow(db, 'atlas_annotation_concepts', row);
			}
		}
		if (snapshot.entity) {
			insertSnapshotRow(db, 'atlas_entities', snapshot.entity);
			if (snapshot.entityProfile)
				insertSnapshotRow(db, 'atlas_entity_profiles', snapshot.entityProfile);
			for (const row of snapshot.entityAliases) insertSnapshotRow(db, 'atlas_entity_aliases', row);
			for (const row of snapshot.entityLinks) insertSnapshotRow(db, 'atlas_entity_links', row);
			for (const row of snapshot.entityAssignments) {
				if (rowExists(db, 'assets', String(row.asset_id))) {
					insertSnapshotRow(db, 'atlas_asset_entities', row);
				}
			}
		}
		for (const row of snapshot.relations) {
			const sourceId = String(row.source_concept_id);
			const targetId = String(row.target_concept_id);
			if (rowExists(db, 'atlas_concepts', sourceId) && rowExists(db, 'atlas_concepts', targetId)) {
				insertSnapshotRow(db, 'atlas_concept_relations', row);
			}
		}
		db.prepare('delete from atlas_concept_tombstones where slug = ?').run(slug);
		db.prepare('update atlas_concepts set updated_at = ? where slug = ?').run(now, slug);
	});
	restore();
	return readConceptRow(db, slug);
}

export function mergeAtlasConcept(
	db: Database.Database,
	sourceInput: string,
	targetInput: string,
	now = new Date().toISOString()
) {
	const source = readConceptRow(db, normalizeAtlasSlug(sourceInput));
	const target = readConceptRow(db, normalizeAtlasSlug(targetInput));
	if (!source || !target) throw new Error('Both source and target concepts are required.');
	if (source.id === target.id) throw new Error('A concept cannot be merged into itself.');
	if (source.kind !== target.kind) {
		throw new Error('Concepts must have the same kind before they can be merged.');
	}
	if (['blocked', 'deprecated', 'merged'].includes(target.status)) {
		throw new Error('The merge target is not assignable.');
	}
	const merge = db.transaction(() => {
		const snapshot = snapshotConcept(db, source);
		moveConceptAssignments(db, source.id, target.id, now);
		moveConceptMetadata(db, source, target, now);
		moveEntityData(db, source, target, now);
		db.prepare(
			`insert into atlas_concept_tombstones (
				slug, label, replacement_slug, snapshot_json, deleted_by, reason, deleted_at
			) values (?, ?, ?, ?, 'user', 'merged', ?)
			on conflict(slug) do update set
				replacement_slug = excluded.replacement_slug,
				snapshot_json = excluded.snapshot_json,
				deleted_at = excluded.deleted_at`
		).run(source.slug, source.label, target.slug, JSON.stringify(snapshot), now);
		db.prepare('delete from atlas_concepts where id = ?').run(source.id);
	});
	merge();
	return readConceptRow(db, target.slug);
}

export function listAtlasConceptTombstones(db: Database.Database): AtlasConceptTombstone[] {
	const rows = db
		.prepare(
			`select slug, label, replacement_slug, deleted_by, reason, deleted_at
			 from atlas_concept_tombstones order by deleted_at desc`
		)
		.all() as Array<{
		slug: string;
		label: string;
		replacement_slug: string | null;
		deleted_by: string;
		reason: string | null;
		deleted_at: string;
	}>;
	return rows.map((row) => ({
		slug: row.slug,
		label: row.label,
		replacementSlug: row.replacement_slug,
		deletedAt: row.deleted_at,
		deletedBy: row.deleted_by,
		reason: row.reason,
		restoreAvailable: true
	}));
}

export function readAtlasOntologyMigrationIssues(db: Database.Database) {
	return db
		.prepare(
			`select id, issue_type as issueType, concept_slug as conceptSlug, detail, status,
				created_at as createdAt
			 from atlas_ontology_migration_issues
			 where status = 'open'
			 order by issue_type, concept_slug`
		)
		.all();
}

export function tombstoneForSlug(db: Database.Database, slugInput: string) {
	return db
		.prepare(
			`select slug, label, replacement_slug, deleted_at
			 from atlas_concept_tombstones where slug = ?`
		)
		.get(normalizeAtlasSlug(slugInput)) as
		| { slug: string; label: string; replacement_slug: string | null; deleted_at: string }
		| undefined;
}

export function createGovernedAtlasConceptFromLibrary(input: AtlasConceptDraft) {
	return withLibrary((db) => createGovernedAtlasConcept(db, input));
}

export function updateGovernedAtlasConceptFromLibrary(
	slug: string,
	input: Partial<Omit<AtlasConceptDraft, 'slug' | 'exampleAssetId'>>
) {
	return withLibrary((db) => updateGovernedAtlasConcept(db, slug, input));
}

export function approveAtlasConceptFromLibrary(slug: string) {
	return withLibrary((db) => approveAtlasConceptAsHuman(db, slug));
}

export function deprecateAtlasConceptFromLibrary(slug: string, replacement?: string | null) {
	return withLibrary((db) => deprecateAtlasConcept(db, slug, replacement));
}

export function mergeAtlasConceptFromLibrary(slug: string, target: string) {
	return withLibrary((db) => mergeAtlasConcept(db, slug, target));
}

export function readAtlasConceptDeletionImpactFromLibrary(slug: string) {
	return withLibrary((db) => readAtlasConceptDeletionImpact(db, slug));
}

export function deleteAtlasConceptFromLibrary(
	slug: string,
	input: Parameters<typeof deleteAtlasConcept>[2]
) {
	return withLibrary((db) => deleteAtlasConcept(db, slug, input));
}

export function restoreAtlasConceptFromLibrary(slug: string) {
	return withLibrary((db) => restoreAtlasConcept(db, slug));
}

export function listAtlasConceptTombstonesFromLibrary() {
	return withLibrary((db) => listAtlasConceptTombstones(db));
}

function readConceptRow(db: Database.Database, slug: string) {
	return db.prepare('select * from atlas_concepts where slug = ?').get(slug) as
		| ConceptRow
		| undefined;
}

function conceptUsageCount(db: Database.Database, conceptId: string) {
	const row = db
		.prepare(
			`select
				(select count(*) from atlas_asset_concepts where concept_id = ?) +
				(select count(*) from atlas_annotation_concepts where concept_id = ?) as count`
		)
		.get(conceptId, conceptId) as { count: number };
	return row.count;
}

function linkConceptEntityIfNeeded(
	db: Database.Database,
	conceptId: string,
	slug: string,
	label: string,
	kind: AtlasConceptKind,
	category: string,
	now: string
) {
	if (kind !== 'entity') return;
	const linked = db.prepare('select id from atlas_entities where concept_id = ?').get(conceptId) as
		| { id: string }
		| undefined;
	if (linked) {
		db.prepare(
			`update atlas_entities
			 set kind = ?, slug = ?, label = ?, updated_at = ?
			 where id = ?`
		).run(category, slug, label, now, linked.id);
		return;
	}
	db.prepare(
		`insert into atlas_entities (id, concept_id, kind, slug, label, external_url, created_at, updated_at)
		 values (?, ?, ?, ?, ?, null, ?, ?)
		 on conflict(kind, slug) do update set
			concept_id = excluded.concept_id,
			label = excluded.label,
			updated_at = excluded.updated_at`
	).run(`atlas-entity-${randomUUID()}`, conceptId, category, slug, label, now, now);
}

function migrateAssignmentsForKindChange(
	db: Database.Database,
	existing: ConceptRow,
	nextKind: AtlasConceptKind,
	nextCategory: string,
	now: string
) {
	if (existing.kind === nextKind) {
		if (nextKind === 'entity') {
			linkConceptEntityIfNeeded(
				db,
				existing.id,
				existing.slug,
				existing.label,
				nextKind,
				nextCategory,
				now
			);
		}
		return;
	}
	if (existing.kind === 'entity' && nextKind !== 'entity') {
		const entity = db
			.prepare('select id from atlas_entities where concept_id = ?')
			.get(existing.id) as { id: string } | undefined;
		if (entity) {
			const assignments = db
				.prepare('select * from atlas_asset_entities where entity_id = ?')
				.all(entity.id) as Array<Record<string, unknown>>;
			for (const assignment of assignments) {
				db.prepare(
					`insert into atlas_asset_concepts (
						id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
					) values (?, ?, ?, ?, ?, ?, null, ?, ?)
					on conflict(asset_id, concept_id) do nothing`
				).run(
					`atlas-assignment-${randomUUID()}`,
					assignment.asset_id,
					existing.id,
					assignment.evidence,
					assignment.provenance,
					assignment.status,
					assignment.created_at,
					now
				);
			}
			db.prepare('delete from atlas_entities where id = ?').run(entity.id);
		}
	}
	if (nextKind === 'entity') {
		linkConceptEntityIfNeeded(
			db,
			existing.id,
			existing.slug,
			existing.label,
			nextKind,
			nextCategory,
			now
		);
		const entity = db
			.prepare('select id from atlas_entities where concept_id = ?')
			.get(existing.id) as { id: string };
		const assignments = db
			.prepare('select * from atlas_asset_concepts where concept_id = ?')
			.all(existing.id) as Array<Record<string, unknown>>;
		for (const assignment of assignments) {
			db.prepare(
				`insert into atlas_asset_entities (
					asset_id, entity_id, evidence, provenance, status, created_at
				) values (?, ?, ?, ?, ?, ?)
				on conflict(asset_id, entity_id) do update set
					evidence = excluded.evidence,
					provenance = excluded.provenance,
					status = excluded.status`
			).run(
				assignment.asset_id,
				entity.id,
				assignment.evidence,
				assignment.provenance,
				assignment.status,
				assignment.created_at
			);
		}
		db.prepare('delete from atlas_asset_concepts where concept_id = ?').run(existing.id);
	}
}

function upsertConceptRelation(
	db: Database.Database,
	sourceId: string,
	targetId: string,
	type: AtlasConceptRelationType,
	status: AtlasConceptRelationStatus,
	createdBy: string,
	now: string
) {
	if (!RELATION_TYPES.has(type)) throw new Error(`Unsupported relation type "${type}".`);
	if (sourceId === targetId) throw new Error('A concept cannot relate to itself.');
	if (
		(type === 'broader' || type === 'automatic_implication' || type === 'replaced_by') &&
		relationWouldCycle(db, sourceId, targetId, type)
	) {
		throw new Error(`${type.replace(/_/g, ' ')} would create a cycle.`);
	}
	db.prepare(
		`insert into atlas_concept_relations (
			id, source_concept_id, target_concept_id, relation_type, status,
			created_by, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?)
		on conflict(source_concept_id, target_concept_id, relation_type) do update set
			status = excluded.status,
			updated_at = excluded.updated_at`
	).run(`atlas-relation-${randomUUID()}`, sourceId, targetId, type, status, createdBy, now, now);
}

function relationWouldCycle(
	db: Database.Database,
	sourceId: string,
	targetId: string,
	type: AtlasConceptRelationType
) {
	const rows = db
		.prepare(
			`with recursive descendants(id) as (
				select target_concept_id
				from atlas_concept_relations
				where source_concept_id = ? and relation_type = ? and status != 'rejected'
				union
				select relations.target_concept_id
				from atlas_concept_relations relations
				join descendants on descendants.id = relations.source_concept_id
				where relations.relation_type = ? and relations.status != 'rejected'
			)
			select id from descendants where id = ? limit 1`
		)
		.get(targetId, type, type, sourceId);
	return Boolean(rows);
}

function snapshotConcept(db: Database.Database, concept: ConceptRow): Snapshot {
	const entity = db.prepare('select * from atlas_entities where concept_id = ?').get(concept.id) as
		| Record<string, unknown>
		| undefined;
	const entityId = entity ? String(entity.id) : null;
	return {
		concept: concept as unknown as Record<string, unknown>,
		wiki:
			(db.prepare('select * from atlas_wiki_entries where concept_id = ?').get(concept.id) as
				| Record<string, unknown>
				| undefined) ?? null,
		aliases: db
			.prepare('select * from atlas_concept_aliases where concept_id = ?')
			.all(concept.id) as Array<Record<string, unknown>>,
		relations: db
			.prepare(
				`select * from atlas_concept_relations
				 where source_concept_id = ? or target_concept_id = ?`
			)
			.all(concept.id, concept.id) as Array<Record<string, unknown>>,
		assetAssignments: db
			.prepare('select * from atlas_asset_concepts where concept_id = ?')
			.all(concept.id) as Array<Record<string, unknown>>,
		annotationAssignments: db
			.prepare('select * from atlas_annotation_concepts where concept_id = ?')
			.all(concept.id) as Array<Record<string, unknown>>,
		entity: entity ?? null,
		entityProfile: entityId
			? ((db.prepare('select * from atlas_entity_profiles where entity_id = ?').get(entityId) as
					| Record<string, unknown>
					| undefined) ?? null)
			: null,
		entityAliases: entityId
			? (db
					.prepare('select * from atlas_entity_aliases where entity_id = ?')
					.all(entityId) as Array<Record<string, unknown>>)
			: [],
		entityLinks: entityId
			? (db.prepare('select * from atlas_entity_links where entity_id = ?').all(entityId) as Array<
					Record<string, unknown>
				>)
			: [],
		entityAssignments: entityId
			? (db
					.prepare('select * from atlas_asset_entities where entity_id = ?')
					.all(entityId) as Array<Record<string, unknown>>)
			: []
	};
}

function moveConceptAssignments(
	db: Database.Database,
	sourceId: string,
	targetId: string,
	now: string
) {
	const assetRows = db
		.prepare('select * from atlas_asset_concepts where concept_id = ?')
		.all(sourceId) as Array<Record<string, unknown>>;
	for (const row of assetRows) {
		db.prepare(
			`insert into atlas_asset_concepts (
				id, asset_id, concept_id, evidence, provenance, status, note, created_at, updated_at
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
			on conflict(asset_id, concept_id) do update set
				status = case
					when excluded.status = 'approved' then 'approved'
					else atlas_asset_concepts.status
				end,
				updated_at = excluded.updated_at`
		).run(
			`atlas-assignment-${randomUUID()}`,
			row.asset_id,
			targetId,
			row.evidence,
			row.provenance,
			row.status,
			row.note,
			row.created_at,
			now
		);
	}
	const annotationRows = db
		.prepare('select * from atlas_annotation_concepts where concept_id = ?')
		.all(sourceId) as Array<Record<string, unknown>>;
	for (const row of annotationRows) {
		db.prepare(
			`insert into atlas_annotation_concepts (
				annotation_id, concept_id, evidence, provenance, status, created_at
			) values (?, ?, ?, ?, ?, ?)
			on conflict(annotation_id, concept_id) do update set
				status = case
					when excluded.status = 'approved' then 'approved'
					else atlas_annotation_concepts.status
				end`
		).run(row.annotation_id, targetId, row.evidence, row.provenance, row.status, row.created_at);
	}
}

function moveConceptMetadata(
	db: Database.Database,
	source: ConceptRow,
	target: ConceptRow,
	now: string
) {
	const aliases = db
		.prepare(
			'select alias, normalized_alias, status from atlas_concept_aliases where concept_id = ?'
		)
		.all(source.id) as Array<{ alias: string; normalized_alias: string; status: string }>;
	aliases.push({ alias: source.label, normalized_alias: source.slug, status: 'approved' });
	for (const alias of aliases) {
		db.prepare(
			`insert into atlas_concept_aliases (
				id, concept_id, alias, normalized_alias, status, created_by, created_at, updated_at
			) values (?, ?, ?, ?, ?, 'user', ?, ?)
			on conflict(normalized_alias) do update set
				concept_id = excluded.concept_id,
				alias = excluded.alias,
				status = excluded.status,
				updated_at = excluded.updated_at`
		).run(
			`atlas-concept-alias-${randomUUID()}`,
			target.id,
			alias.alias,
			alias.normalized_alias,
			alias.status,
			now,
			now
		);
	}
	const relations = db
		.prepare(
			`select source_concept_id, target_concept_id, relation_type, status, created_by
			 from atlas_concept_relations
			 where source_concept_id = ? or target_concept_id = ?`
		)
		.all(source.id, source.id) as Array<{
		source_concept_id: string;
		target_concept_id: string;
		relation_type: AtlasConceptRelationType;
		status: AtlasConceptRelationStatus;
		created_by: string;
	}>;
	for (const relation of relations) {
		const sourceId =
			relation.source_concept_id === source.id ? target.id : relation.source_concept_id;
		const targetId =
			relation.target_concept_id === source.id ? target.id : relation.target_concept_id;
		if (sourceId === targetId) continue;
		upsertConceptRelation(
			db,
			sourceId,
			targetId,
			relation.relation_type,
			relation.status,
			relation.created_by,
			now
		);
	}
}

function moveEntityData(
	db: Database.Database,
	source: ConceptRow,
	target: ConceptRow,
	now: string
) {
	if (source.kind !== 'entity') return;
	const sourceEntity = db
		.prepare('select * from atlas_entities where concept_id = ?')
		.get(source.id) as Record<string, unknown> | undefined;
	if (!sourceEntity) return;
	linkConceptEntityIfNeeded(
		db,
		target.id,
		target.slug,
		target.label,
		target.kind,
		target.category,
		now
	);
	const targetEntity = db
		.prepare('select * from atlas_entities where concept_id = ?')
		.get(target.id) as Record<string, unknown> | undefined;
	if (!targetEntity) throw new Error('The target entity profile could not be prepared.');
	const sourceEntityId = String(sourceEntity.id);
	const targetEntityId = String(targetEntity.id);

	const assignments = db
		.prepare('select * from atlas_asset_entities where entity_id = ?')
		.all(sourceEntityId) as Array<Record<string, unknown>>;
	for (const assignment of assignments) {
		db.prepare(
			`insert into atlas_asset_entities (
				asset_id, entity_id, evidence, provenance, status, created_at
			) values (?, ?, ?, ?, ?, ?)
			on conflict(asset_id, entity_id) do update set
				status = case
					when excluded.status = 'approved' then 'approved'
					else atlas_asset_entities.status
				end`
		).run(
			assignment.asset_id,
			targetEntityId,
			assignment.evidence,
			assignment.provenance,
			assignment.status,
			assignment.created_at
		);
	}

	const aliases = db
		.prepare('select * from atlas_entity_aliases where entity_id = ?')
		.all(sourceEntityId) as Array<Record<string, unknown>>;
	for (const alias of aliases) {
		db.prepare(
			`insert or ignore into atlas_entity_aliases (
				id, entity_id, alias, normalized_alias, source, confidence, created_at
			) values (?, ?, ?, ?, ?, ?, ?)`
		).run(
			`atlas-entity-alias-${randomUUID()}`,
			targetEntityId,
			alias.alias,
			alias.normalized_alias,
			alias.source,
			alias.confidence,
			alias.created_at
		);
	}

	const links = db
		.prepare('select * from atlas_entity_links where entity_id = ?')
		.all(sourceEntityId) as Array<Record<string, unknown>>;
	for (const link of links) {
		db.prepare(
			`insert into atlas_entity_links (
				id, entity_id, url, normalized_url, host, username, source_label, confidence,
				first_seen_asset_id, last_seen_at, created_at
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			on conflict(entity_id, normalized_url) do update set
				last_seen_at = excluded.last_seen_at`
		).run(
			`atlas-entity-link-${randomUUID()}`,
			targetEntityId,
			link.url,
			link.normalized_url,
			link.host,
			link.username,
			link.source_label,
			link.confidence,
			link.first_seen_asset_id,
			link.last_seen_at,
			link.created_at
		);
	}

	const sourceProfile = db
		.prepare('select * from atlas_entity_profiles where entity_id = ?')
		.get(sourceEntityId) as Record<string, unknown> | undefined;
	const targetProfile = db
		.prepare('select * from atlas_entity_profiles where entity_id = ?')
		.get(targetEntityId) as Record<string, unknown> | undefined;
	if (sourceProfile && !targetProfile) {
		const movedProfile = { ...sourceProfile, entity_id: targetEntityId, updated_at: now };
		insertSnapshotRow(db, 'atlas_entity_profiles', movedProfile);
	}
	db.prepare('delete from atlas_entities where id = ?').run(sourceEntityId);
}

function insertSnapshotRow(db: Database.Database, table: string, row: Record<string, unknown>) {
	const columns = Object.keys(row);
	if (!columns.length) return;
	const quoted = columns.map((column) => `"${column.replace(/"/g, '""')}"`).join(', ');
	const placeholders = columns.map(() => '?').join(', ');
	db.prepare(`insert or ignore into "${table}" (${quoted}) values (${placeholders})`).run(
		...columns.map((column) => row[column])
	);
}

function rowExists(db: Database.Database, table: string, id: string) {
	return Boolean(db.prepare(`select 1 from "${table}" where id = ?`).get(id));
}

function recordMigrationIssue(
	db: Database.Database,
	type: string,
	slug: string | null,
	detail: string,
	now: string
) {
	db.prepare(
		`insert or ignore into atlas_ontology_migration_issues (
			id, issue_type, concept_slug, detail, status, created_at
		) values (?, ?, ?, ?, 'open', ?)`
	).run(`atlas-ontology-issue-${randomUUID()}`, type, slug, detail, now);
}

function parseList(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((entry): entry is string => typeof entry === 'string')
			: [];
	} catch {
		return [];
	}
}

function withLibrary<T>(run: (db: Database.Database) => T): T {
	const db = openLibraryDatabase();
	try {
		return run(db);
	} finally {
		db.close();
	}
}
