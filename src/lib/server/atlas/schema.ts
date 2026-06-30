import type Database from 'better-sqlite3';

export function ensureAtlasSchema(db: Database.Database) {
	db.exec(`
		create table if not exists atlas_entities (
			id text primary key,
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
			unique(entity_id, normalized_alias, source)
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
			created_by text not null,
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
	`);
}
