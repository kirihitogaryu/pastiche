import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureAtlasSchema } from '$lib/server/atlas/schema';
import { ensureLibraryArchive, resolveLibraryPaths } from './paths';

const LATEST_SCHEMA_VERSION = 3;
const initializedDatabases = new Set<string>();

export function openLibraryDatabase() {
	const paths = ensureLibraryArchive(resolveLibraryPaths());
	if (!initializedDatabases.has(paths.database)) backupBeforeMigration(paths.database);
	const db = new Database(paths.database);
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	db.pragma('journal_mode = WAL');
	db.pragma('synchronous = NORMAL');
	if (initializedDatabases.has(paths.database)) return db;

	try {
		db.exec(`
		create table if not exists schema_migrations (
			version integer primary key,
			name text not null,
			applied_at text not null
		);

		create table if not exists folders (
			id text primary key,
			name text not null,
			parent_id text references folders(id),
			path text not null unique,
			created_at text not null,
			updated_at text not null,
			last_used_at text
		);

		create table if not exists assets (
			id text primary key,
			filename text not null,
			title text not null,
			storage_mode text not null check (storage_mode in ('download', 'url_reference', 'lazy_download')),
			mime_type text,
			width integer not null,
			height integer not null,
			original_path text,
			thumbnail_path text,
			source_image_url text,
			source_url text not null,
			page_title text,
			alt_text text,
			source_domain text,
			source_hash text not null,
			folder_id text references folders(id),
			imported_at text not null,
			captured_at text not null,
			modified_at text not null,
			metadata_json text
		);

		create table if not exists asset_import_failures (
			id text primary key,
			source_hash text,
			filename text,
			error text not null,
			created_at text not null
		);

		create table if not exists import_jobs (
			id text primary key,
			response_json text,
			created_at text not null,
			updated_at text not null
		);

		create table if not exists lazy_download_jobs (
			id text primary key,
			asset_id text not null references assets(id),
			source_image_url text not null,
			status text not null check (status in ('queued', 'running', 'failed', 'complete')),
			created_at text not null,
			updated_at text not null,
			last_error text
		);

		create table if not exists tag_facets (
			id text primary key,
			name text not null,
			slug text not null unique,
			created_at text not null
		);

		create table if not exists tags (
			id text primary key,
			facet_id text not null references tag_facets(id),
			value text not null,
			name text not null,
			slug text not null unique,
			created_at text not null
		);

		create table if not exists asset_tags (
			asset_id text not null references assets(id) on delete cascade,
			tag_id text not null references tags(id) on delete cascade,
			created_at text not null,
			primary key (asset_id, tag_id)
		);

		create table if not exists projects (
			id text primary key,
			name text not null,
			description text,
			pinned integer not null default 0,
			cover_asset_id text references assets(id) on delete set null,
			created_at text not null,
			updated_at text not null
		);

		create table if not exists project_asset_refs (
			project_id text not null references projects(id) on delete cascade,
			asset_id text not null references assets(id) on delete cascade,
			created_at text not null,
			primary key (project_id, asset_id)
		);

		create table if not exists project_folder_refs (
			project_id text not null references projects(id) on delete cascade,
			folder_id text not null references folders(id) on delete cascade,
			include_subfolders integer not null default 0,
			created_at text not null,
			primary key (project_id, folder_id)
		);

		create table if not exists saved_explore_searches (
			id text primary key,
			source text not null,
			mode text not null check (mode in ('artist', 'tags', 'art', 'reference')),
			query text not null,
			normalized_query text not null,
			label text not null,
			filters_json text not null default '{}',
			created_at text not null,
			updated_at text not null,
			last_opened_at text,
			last_seen_item_id text,
			last_seen_published_at text,
			unique (source, mode, normalized_query)
		);
	`);
		ensureAtlasSchema(db);
		ensureColumn(db, 'assets', 'metadata_json', 'text');
		ensureColumn(db, 'assets', 'favorite', 'integer not null default 0');
		ensureDefaultTagFacets(db);
		applyLibraryMigrations(db);
		initializedDatabases.add(paths.database);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

export function initializeLibrary() {
	const db = openLibraryDatabase();
	db.close();
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
	const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
	if (columns.some((item) => item.name === column)) return;
	db.prepare(`alter table ${table} add column ${column} ${definition}`).run();
}

const DEFAULT_TAG_FACETS = [
	{ slug: 'general', name: 'General' },
	{ slug: 'subject', name: 'Subject' },
	{ slug: 'medium', name: 'Medium' },
	{ slug: 'style-era', name: 'Style / Era' },
	{ slug: 'source', name: 'Source' },
	{ slug: 'location', name: 'Location' },
	{ slug: 'department', name: 'Department' },
	{ slug: 'culture', name: 'Culture' },
	{ slug: 'usage-intent', name: 'Usage Intent' },
	{ slug: 'color-mood', name: 'Color Mood' }
];

function ensureDefaultTagFacets(db: Database.Database) {
	const now = new Date().toISOString();
	const insert = db.prepare(
		`insert or ignore into tag_facets (id, name, slug, created_at) values (?, ?, ?, ?)`
	);
	for (const facet of DEFAULT_TAG_FACETS) {
		insert.run(`facet-${facet.slug}`, facet.name, facet.slug, now);
	}
}

function applyLibraryMigrations(db: Database.Database) {
	const version = db.pragma('user_version', { simple: true }) as number;
	if (version >= LATEST_SCHEMA_VERSION) return;

	db.transaction(() => {
		if (version < 1) {
			db.exec(`
				create index if not exists assets_source_hash_idx on assets(source_hash);
				create index if not exists assets_folder_id_idx on assets(folder_id);
				create index if not exists assets_imported_at_idx on assets(imported_at desc);
				create index if not exists assets_favorite_idx on assets(favorite) where favorite = 1;
				create index if not exists lazy_download_jobs_status_idx on lazy_download_jobs(status);
				create index if not exists asset_import_failures_created_at_idx on asset_import_failures(created_at desc);
				create index if not exists project_asset_refs_asset_id_idx on project_asset_refs(asset_id);
				create index if not exists project_folder_refs_folder_id_idx on project_folder_refs(folder_id);
				create index if not exists asset_tags_tag_id_idx on asset_tags(tag_id);
				create index if not exists tags_facet_id_idx on tags(facet_id);
				create index if not exists import_jobs_updated_at_idx on import_jobs(updated_at);
			`);
			recordMigration(db, 1, 'operational indexes and import idempotency');
		}
			if (version < 2) {
			db.exec(`
				create table if not exists saved_explore_searches (
					id text primary key,
					source text not null,
					mode text not null check (mode in ('artist', 'tags')),
					query text not null,
					normalized_query text not null,
					label text not null,
					filters_json text not null default '{}',
					created_at text not null,
					updated_at text not null,
					last_opened_at text,
					last_seen_item_id text,
					last_seen_published_at text,
					unique (source, mode, normalized_query)
				);
				create index if not exists saved_explore_searches_scope_idx
					on saved_explore_searches(source, mode, updated_at desc);
			`);
				recordMigration(db, 2, 'saved Explore searches');
			}
			if (version < 3) {
				db.exec(`
					drop index if exists saved_explore_searches_scope_idx;
					alter table saved_explore_searches rename to saved_explore_searches_v2;
					create table saved_explore_searches (
						id text primary key,
						source text not null,
						mode text not null check (mode in ('artist', 'tags', 'art', 'reference')),
						query text not null,
						normalized_query text not null,
						label text not null,
						filters_json text not null default '{}',
						created_at text not null,
						updated_at text not null,
						last_opened_at text,
						last_seen_item_id text,
						last_seen_published_at text,
						unique (source, mode, normalized_query)
					);
					insert into saved_explore_searches (
						id, source, mode, query, normalized_query, label, filters_json,
						created_at, updated_at, last_opened_at, last_seen_item_id, last_seen_published_at
					)
					select id, source, mode, query, normalized_query, label, filters_json,
					       created_at, updated_at, last_opened_at, last_seen_item_id,
					       last_seen_published_at
					from saved_explore_searches_v2;
					drop table saved_explore_searches_v2;
					create index saved_explore_searches_scope_idx
						on saved_explore_searches(source, mode, updated_at desc);
				`);
				recordMigration(db, 3, 'Wikimedia saved Explore searches');
			}
		db.pragma(`user_version = ${LATEST_SCHEMA_VERSION}`);
	})();
}

function recordMigration(db: Database.Database, version: number, name: string) {
	db.prepare(
		'insert or ignore into schema_migrations (version, name, applied_at) values (?, ?, ?)'
	).run(version, name, new Date().toISOString());
}

function backupBeforeMigration(databasePath: string) {
	if (!existsSync(databasePath) || statSync(databasePath).size === 0) return;
	const probe = new Database(databasePath, { readonly: true, fileMustExist: true });
	let version = 0;
	try {
		version = probe.pragma('user_version', { simple: true }) as number;
	} finally {
		probe.close();
	}
	if (version >= LATEST_SCHEMA_VERSION) return;
	const backupDir = join(dirname(databasePath), 'backups');
	mkdirSync(backupDir, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	copyFileSync(
		databasePath,
		join(backupDir, `library-before-v${LATEST_SCHEMA_VERSION}-${timestamp}.sqlite`)
	);
}
