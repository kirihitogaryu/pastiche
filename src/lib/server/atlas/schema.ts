import type Database from 'better-sqlite3';

export function ensureAtlasSchema(db: Database.Database) {
	db.exec(`
		create table if not exists atlas_entities (
			id text primary key,
			concept_id text references atlas_concepts(id) on delete set null,
			kind text not null,
			slug text not null,
			label text not null,
			external_url text,
			created_at text not null,
			updated_at text not null,
			unique(kind, slug)
		);

		create table if not exists atlas_entity_profiles (
			entity_id text primary key references atlas_entities(id) on delete cascade,
			summary text,
			notes text,
			movements_json text not null default '[]',
			styles_json text not null default '[]',
			common_subjects_json text not null default '[]',
			historical_period text,
			media_json text not null default '[]',
			ai_guidance text,
			updated_at text not null
		);

		create table if not exists atlas_entity_aliases (
			id text primary key,
			entity_id text not null references atlas_entities(id) on delete cascade,
			alias text not null,
			normalized_alias text not null,
			source text not null,
			confidence text not null,
			created_at text not null,
			unique(entity_id, alias, source)
		);

		create table if not exists atlas_entity_links (
			id text primary key,
			entity_id text not null references atlas_entities(id) on delete cascade,
			url text not null,
			normalized_url text not null,
			host text not null,
			username text,
			source_label text,
			confidence text not null,
			first_seen_asset_id text references assets(id) on delete set null,
			last_seen_at text not null,
			created_at text not null,
			unique(entity_id, normalized_url)
		);

		create table if not exists atlas_claims (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			kind text not null,
			slug text not null,
			label text not null,
			value text not null,
			source_text text not null,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			updated_at text not null,
			unique(asset_id, kind, slug)
		);

		create table if not exists atlas_asset_entities (
			asset_id text not null references assets(id) on delete cascade,
			entity_id text not null references atlas_entities(id) on delete cascade,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			primary key (asset_id, entity_id)
		);

		create table if not exists atlas_tag_suggestions (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			slug text not null,
			label text not null,
			source_text text not null,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			updated_at text not null,
			unique(asset_id, slug)
		);

		create table if not exists atlas_ingestion_runs (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			source text not null,
			source_id text,
			proposal_json text not null,
			warnings_json text not null,
			created_at text not null
		);

		create table if not exists atlas_agent_runs (
			id text primary key,
			job text not null,
			target_type text not null,
			target_id text not null,
			status text not null,
			stage text not null,
			vision_model text,
			text_model text not null,
			policy_version text not null,
			policy_hash text not null,
			context_json text not null default '{}',
			result_json text,
			raw_response_json text,
			error text,
			usage_json text not null default '{}',
			retry_of text,
			created_at text not null,
			updated_at text not null
		);

		create table if not exists atlas_agent_applied_suggestions (
			run_id text not null references atlas_agent_runs(id) on delete cascade,
			suggestion_id text not null,
			asset_id text not null references assets(id) on delete cascade,
			patch_json text not null default '{}',
			applied_at text not null,
			primary key (run_id, suggestion_id)
		);

		create table if not exists atlas_concepts (
			id text primary key,
			slug text not null unique,
			label text not null,
			kind text not null,
			category text not null,
			display_group text not null,
			status text not null,
			maturity text not null,
			short_definition text not null,
			needs_classification integer not null default 0,
			created_by text not null,
			seed_version integer,
			seed_fingerprint text,
			created_at text not null,
			updated_at text not null
		);

		create table if not exists atlas_wiki_entries (
			concept_id text primary key references atlas_concepts(id) on delete cascade,
			long_description text,
			use_when_json text not null,
			do_not_use_when_json text not null,
			aliases_json text not null,
			broader_json text not null,
			narrower_json text not null,
			related_json text not null,
			confusable_json text not null,
			automatic_implications_json text not null,
			suggested_implications_json text not null,
			allowed_classifiers_json text not null,
			examples_json text not null,
			counterexamples_json text not null,
			ai_guidance text not null,
			citations_json text not null,
			updated_at text not null
		);

		create table if not exists atlas_asset_concepts (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			concept_id text not null references atlas_concepts(id) on delete cascade,
			evidence text not null,
			provenance text not null,
			status text not null,
			note text,
			created_at text not null,
			updated_at text not null,
			unique(asset_id, concept_id)
		);

		create table if not exists atlas_annotations (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			label text not null,
			region_json text,
			source text not null,
			confidence real,
			status text not null,
			note text,
			created_at text not null,
			updated_at text not null
		);

		create table if not exists atlas_annotation_concepts (
			annotation_id text not null references atlas_annotations(id) on delete cascade,
			concept_id text not null references atlas_concepts(id) on delete cascade,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			primary key (annotation_id, concept_id)
		);

		create table if not exists atlas_annotation_classifiers (
			id text primary key,
			annotation_id text not null references atlas_annotations(id) on delete cascade,
			classifier_type text not null,
			classifier_value text not null,
			evidence text not null,
			status text not null,
			created_at text not null,
			unique(annotation_id, classifier_type, classifier_value)
		);

		create table if not exists atlas_concept_aliases (
			id text primary key,
			concept_id text not null references atlas_concepts(id) on delete cascade,
			alias text not null,
			normalized_alias text not null,
			status text not null,
			created_by text not null,
			created_at text not null,
			updated_at text not null,
			unique(normalized_alias)
		);

		create table if not exists atlas_concept_relations (
			id text primary key,
			source_concept_id text not null references atlas_concepts(id) on delete cascade,
			target_concept_id text not null references atlas_concepts(id) on delete cascade,
			relation_type text not null,
			status text not null,
			created_by text not null,
			created_at text not null,
			updated_at text not null,
			unique(source_concept_id, target_concept_id, relation_type)
		);

		create table if not exists atlas_concept_tombstones (
			slug text primary key,
			label text not null,
			replacement_slug text,
			snapshot_json text not null,
			deleted_by text not null,
			reason text,
			deleted_at text not null
		);

		create table if not exists atlas_ontology_migration_issues (
			id text primary key,
			issue_type text not null,
			concept_slug text,
			detail text not null,
			status text not null default 'open',
			created_at text not null,
			unique(issue_type, concept_slug, detail)
		);

		create index if not exists atlas_claims_asset_status_idx on atlas_claims(asset_id, status);
		create index if not exists atlas_asset_entities_entity_status_idx on atlas_asset_entities(entity_id, status);
		create index if not exists atlas_tag_suggestions_asset_status_idx on atlas_tag_suggestions(asset_id, status);
		create index if not exists atlas_agent_runs_target_idx on atlas_agent_runs(job, target_type, target_id, status);
		create index if not exists atlas_asset_concepts_concept_status_idx on atlas_asset_concepts(concept_id, status);
		create index if not exists atlas_annotations_asset_status_idx on atlas_annotations(asset_id, status);
		create index if not exists atlas_annotation_concepts_concept_status_idx on atlas_annotation_concepts(concept_id, status);
		create index if not exists atlas_annotation_classifiers_lookup_idx on atlas_annotation_classifiers(classifier_type, classifier_value, status);
		create index if not exists atlas_entity_aliases_normalized_idx on atlas_entity_aliases(normalized_alias);
		create index if not exists atlas_entity_links_username_idx on atlas_entity_links(username);
		create index if not exists atlas_concept_aliases_concept_idx on atlas_concept_aliases(concept_id);
		create index if not exists atlas_concept_relations_source_idx on atlas_concept_relations(source_concept_id, relation_type, status);
		create index if not exists atlas_concept_relations_target_idx on atlas_concept_relations(target_concept_id, relation_type, status);
		create index if not exists atlas_ontology_issues_status_idx on atlas_ontology_migration_issues(status, issue_type);
	`);
	ensureAtlasColumn(db, 'atlas_concepts', 'seed_version', 'integer');
	ensureAtlasColumn(db, 'atlas_concepts', 'seed_fingerprint', 'text');
	ensureAtlasColumn(db, 'atlas_concepts', 'needs_classification', 'integer not null default 0');
	ensureTableColumn(db, 'atlas_entities', 'concept_id', 'text references atlas_concepts(id) on delete set null');
	db.exec('create index if not exists atlas_entities_concept_idx on atlas_entities(concept_id)');
	ensureTableColumn(
		db,
		'atlas_agent_applied_suggestions',
		'patch_json',
		"text not null default '{}'"
	);
}

function ensureAtlasColumn(
	db: Database.Database,
	table: 'atlas_concepts',
	column: string,
	definition: string
) {
	const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
	if (columns.some((item) => item.name === column)) return;
	db.prepare(`alter table ${table} add column ${column} ${definition}`).run();
}

function ensureTableColumn(
	db: Database.Database,
	table: string,
	column: string,
	definition: string
) {
	const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
	if (columns.some((item) => item.name === column)) return;
	db.prepare(`alter table ${table} add column ${column} ${definition}`).run();
}
