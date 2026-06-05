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
	`);
}
