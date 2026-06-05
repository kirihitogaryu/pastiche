import type Database from 'better-sqlite3';
import type { AtlasWikiEntrySummary } from '$lib/atlas/types';
import { ATLAS_WIKI_SEED_CONCEPTS } from './wikiSeed';

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

export type AtlasWikiEntry = AtlasWikiEntrySummary & {
	longDescription: string | null;
	useWhen: string[];
	doNotUseWhen: string[];
	narrower: string[];
	automaticImplications: string[];
	suggestedImplications: string[];
	examples: string[];
	counterexamples: string[];
	citations: string[];
};

export function applyAtlasWikiSeed(db: Database.Database, now = new Date().toISOString()) {
	const insertConcept = db.prepare(`
		insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity,
			short_definition, created_by, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?)
		on conflict(slug) do update set
			label = excluded.label,
			kind = excluded.kind,
			category = excluded.category,
			display_group = excluded.display_group,
			status = excluded.status,
			maturity = excluded.maturity,
			short_definition = excluded.short_definition,
			updated_at = excluded.updated_at
	`);
	const selectConcept = db.prepare('select id from atlas_concepts where slug = ?');
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
				now,
				now
			);
			const row = selectConcept.get(concept.slug) as { id: string };
			insertWiki.run(
				row.id,
				null,
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
	});

	apply();
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

	return rows.map(mapWikiRow);
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

	return row ? mapWikiRow(row) : null;
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

function mapWikiRow(row: WikiRow): AtlasWikiEntry {
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
		aiGuidance: row.ai_guidance,
		citations: parseJsonList(row.citations_json)
	};
}

function parseJsonList(value: string): string[] {
	const parsed = JSON.parse(value) as unknown;
	return Array.isArray(parsed)
		? parsed.filter((item): item is string => typeof item === 'string')
		: [];
}
