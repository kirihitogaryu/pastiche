import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { resolveLibraryPaths } from './paths';
import { openLibraryDatabase } from './schema';

type FolderRow = {
	id: string;
	name: string;
	path: string;
};

export type CreateFolderInput = {
	name: string;
	parentId?: string | null;
	now?: string;
};

export function resolveDestinationFolder(
	db: Database.Database,
	destinationFolderId: string | null,
	createFolderName: string | undefined,
	now: string
) {
	if (createFolderName?.trim()) {
		return findOrCreateFolder(db, { name: createFolderName.trim(), now });
	}

	if (!destinationFolderId) return null;

	const folder = db
		.prepare('select id, name, path from folders where id = ?')
		.get(destinationFolderId) as FolderRow | undefined;
	if (!folder) throw new Error('Destination folder not found');
	touchFolder(db, folder.id, now);
	return folder;
}

export function createLibraryFolder(input: CreateFolderInput) {
	const db = awaitDb();
	try {
		return findOrCreateFolder(db, input);
	} finally {
		db.close();
	}
}

export function findOrCreateFolder(db: Database.Database, input: CreateFolderInput): FolderRow {
	const name = input.name.trim();
	if (!name) throw new Error('Folder name is required');
	const now = input.now ?? new Date().toISOString();
	const parent = input.parentId ? folderById(db, input.parentId) : null;
	const parentPath = parent?.path ?? 'library';
	const path = uniqueFolderPath(db, parentPath, name);
	const existing = db.prepare('select id, name, path from folders where path = ?').get(path) as
		| FolderRow
		| undefined;
	if (existing) {
		touchFolder(db, existing.id, now);
		return existing;
	}

	const id = `folder-${crypto.randomUUID()}`;
	db.prepare(
		`insert into folders (id, name, parent_id, path, created_at, updated_at, last_used_at)
		 values (?, ?, ?, ?, ?, ?, ?)`
	).run(id, name, parent?.id ?? null, path, now, now, now);
	createFolderDirectory(path);
	return { id, name, path };
}

function touchFolder(db: Database.Database, id: string, now: string) {
	db.prepare('update folders set updated_at = ?, last_used_at = ? where id = ?').run(now, now, id);
}

function folderById(db: Database.Database, id: string) {
	const folder = db.prepare('select id, name, path from folders where id = ?').get(id) as
		| FolderRow
		| undefined;
	if (!folder) throw new Error('Parent folder not found');
	return folder;
}

function uniqueFolderPath(db: Database.Database, parentPath: string, name: string) {
	const slug = slugifyFolderName(name);
	let path = `${parentPath}/${slug}`;
	let index = 2;
	while (db.prepare('select 1 from folders where path = ?').get(path)) {
		path = `${parentPath}/${slug}-${index}`;
		index += 1;
	}
	return path;
}

function createFolderDirectory(path: string) {
	mkdirSync(join(resolveLibraryPaths().root, path), { recursive: true });
}

function awaitDb() {
	return openLibraryDatabase();
}

export function slugifyFolderName(name: string) {
	const slug = name
		.toLowerCase()
		.trim()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'untitled';
}
