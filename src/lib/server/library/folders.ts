import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { resolveLibraryPaths } from './paths';
import { openLibraryDatabase } from './schema';

type FolderRow = {
	id: string;
	name: string;
	path: string;
	parent_id?: string | null;
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

export function renameLibraryFolder(id: string, nameInput: string) {
	const db = awaitDb();
	try {
		const name = nameInput.trim();
		if (!name) throw new Error('Folder name is required');
		const folder = db
			.prepare('select id, name, parent_id, path from folders where id = ?')
			.get(id) as FolderRow | undefined;
		if (!folder) throw new Error('Folder not found');
		const parent = folder.parent_id ? folderById(db, folder.parent_id) : null;
		const nextPath = uniqueFolderPath(db, parent?.path ?? 'library', name, id);
		const now = new Date().toISOString();
		const previousPath = folder.path;
		const rename = db.transaction(() => {
			db.prepare('update folders set name = ?, path = ?, updated_at = ? where id = ?').run(
				name,
				nextPath,
				now,
				id
			);
			db.prepare(
				`update folders
				 set path = ? || substr(path, ?), updated_at = ?
				 where path like ? and id <> ?`
			).run(nextPath, previousPath.length + 1, now, `${escapeLike(previousPath)}/%`, id);
		});
		rename();
		createFolderDirectory(nextPath);
		return { id, name, path: nextPath };
	} finally {
		db.close();
	}
}

export function deleteLibraryFolder(id: string) {
	const db = awaitDb();
	try {
		const folder = db
			.prepare('select id, name, parent_id, path from folders where id = ?')
			.get(id) as FolderRow | undefined;
		if (!folder) return null;
		const parent = folder.parent_id ? folderById(db, folder.parent_id) : null;
		const now = new Date().toISOString();
		const impact = {
			id: folder.id,
			name: folder.name,
			parentId: parent?.id ?? null,
			assetCount: (
				db.prepare('select count(*) as count from assets where folder_id = ?').get(id) as {
					count: number;
				}
			).count,
			childFolderCount: (
				db.prepare('select count(*) as count from folders where parent_id = ?').get(id) as {
					count: number;
				}
			).count
		};

		const remove = db.transaction(() => {
			db.prepare('update assets set folder_id = ?, modified_at = ? where folder_id = ?').run(
				parent?.id ?? null,
				now,
				id
			);
			const children = db
				.prepare('select id, name, parent_id, path from folders where parent_id = ? order by path')
				.all(id) as FolderRow[];
			for (const child of children) {
				const nextPath = uniqueFolderPath(db, parent?.path ?? 'library', child.name, child.id);
				const previousPath = child.path;
				db.prepare('update folders set parent_id = ?, path = ?, updated_at = ? where id = ?').run(
					parent?.id ?? null,
					nextPath,
					now,
					child.id
				);
				db.prepare(
					`update folders
					 set path = ? || substr(path, ?), updated_at = ?
					 where path like ? and id <> ?`
				).run(nextPath, previousPath.length + 1, now, `${escapeLike(previousPath)}/%`, child.id);
				createFolderDirectory(nextPath);
			}
			db.prepare('delete from folders where id = ?').run(id);
		});
		remove();
		return impact;
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
	const create = db.transaction(() => {
		db.prepare(
			`insert into folders (id, name, parent_id, path, created_at, updated_at, last_used_at)
			 values (?, ?, ?, ?, ?, ?, ?)`
		).run(id, name, parent?.id ?? null, path, now, now, now);
		// Keep the row and its filesystem directory in the same logical operation.
		// A mkdir failure aborts and rolls back the SQLite transaction.
		createFolderDirectory(path);
		return { id, name, path };
	});
	return create();
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

function uniqueFolderPath(
	db: Database.Database,
	parentPath: string,
	name: string,
	excludeId?: string
) {
	const slug = slugifyFolderName(name);
	let path = `${parentPath}/${slug}`;
	let index = 2;
	while (
		db
			.prepare(
				excludeId
					? 'select 1 from folders where path = ? and id <> ?'
					: 'select 1 from folders where path = ?'
			)
			.get(...(excludeId ? [path, excludeId] : [path]))
	) {
		path = `${parentPath}/${slug}-${index}`;
		index += 1;
	}
	return path;
}

function escapeLike(value: string) {
	return value.replace(/[\\%_]/g, '\\$&');
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
