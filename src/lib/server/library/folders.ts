import type Database from 'better-sqlite3';

type FolderRow = {
	id: string;
	name: string;
};

export function resolveDestinationFolder(
	db: Database.Database,
	destinationFolderId: string | null,
	createFolderName: string | undefined,
	now: string
) {
	if (createFolderName?.trim()) {
		return findOrCreateTopLevelFolder(db, createFolderName.trim(), now);
	}

	if (!destinationFolderId) return null;

	const folder = db
		.prepare('select id, name from folders where id = ?')
		.get(destinationFolderId) as FolderRow | undefined;
	if (!folder) throw new Error('Destination folder not found');
	touchFolder(db, folder.id, now);
	return folder;
}

function findOrCreateTopLevelFolder(db: Database.Database, name: string, now: string): FolderRow {
	const path = `library/${slugifyFolderName(name)}`;
	const existing = db.prepare('select id, name from folders where path = ?').get(path) as
		| FolderRow
		| undefined;
	if (existing) {
		touchFolder(db, existing.id, now);
		return existing;
	}

	const id = `folder-${crypto.randomUUID()}`;
	db.prepare(
		`insert into folders (id, name, parent_id, path, created_at, updated_at, last_used_at)
		 values (?, ?, null, ?, ?, ?, ?)`
	).run(id, name, path, now, now, now);
	return { id, name };
}

function touchFolder(db: Database.Database, id: string, now: string) {
	db.prepare('update folders set updated_at = ?, last_used_at = ? where id = ?').run(now, now, id);
}

function slugifyFolderName(name: string) {
	const slug = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'untitled';
}
