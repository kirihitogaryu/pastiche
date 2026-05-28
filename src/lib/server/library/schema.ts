import Database from 'better-sqlite3';
import { ensureLibraryArchive, resolveLibraryPaths } from './paths';

export function openLibraryDatabase() {
	const paths = ensureLibraryArchive(resolveLibraryPaths());
	const db = new Database(paths.database);
	db.pragma('foreign_keys = ON');
	db.exec(`
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

		create table if not exists lazy_download_jobs (
			id text primary key,
			asset_id text not null references assets(id),
			source_image_url text not null,
			status text not null check (status in ('queued', 'running', 'failed', 'complete')),
			created_at text not null,
			updated_at text not null,
			last_error text
		);
	`);
	ensureColumn(db, 'assets', 'metadata_json', 'text');
	return db;
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
