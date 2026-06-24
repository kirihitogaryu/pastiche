import type Database from 'better-sqlite3';
import { createLibraryFolder } from './folders';
import { openLibraryDatabase } from './schema';
import type { LibraryProject, LibraryTag } from './types';

type FacetRow = {
	id: string;
	name: string;
	slug: string;
};

type TagRow = {
	id: string;
	facet_id: string;
	facet_name: string;
	facet_slug: string;
	value: string;
	name: string;
	slug: string;
	asset_count: number;
};

type ProjectRow = {
	id: string;
	name: string;
	description: string | null;
	pinned: number;
	cover_asset_id: string | null;
	asset_count: number;
	folder_count: number;
	created_at: string;
	updated_at: string;
};

export type CreateTagInput = {
	facet?: string | null;
	value?: string | null;
	label?: string | null;
	now?: string;
};

export type CreateProjectInput = {
	name: string;
	description?: string | null;
	startFolderId?: string | null;
	now?: string;
};

export function createFolder(input: { name: string; parentId?: string | null }) {
	return createLibraryFolder(input);
}

export function createTag(input: CreateTagInput): LibraryTag {
	const db = openLibraryDatabase();
	try {
		return createTagInDb(db, input);
	} finally {
		db.close();
	}
}

export function createTagGroup(input: { name: string; now?: string }) {
	const db = openLibraryDatabase();
	try {
		const name = cleanString(input.name);
		if (!name) throw new Error('Tag group name is required');
		return findOrCreateFacet(db, name, input.now);
	} finally {
		db.close();
	}
}

export function attachTagToAsset(assetId: string, tagId: string) {
	const db = openLibraryDatabase();
	try {
		assertAssetExists(db, assetId);
		assertTagExists(db, tagId);
		const now = new Date().toISOString();
		db.prepare(
			`insert or ignore into asset_tags (asset_id, tag_id, created_at) values (?, ?, ?)`
		).run(assetId, tagId, now);
		return true;
	} finally {
		db.close();
	}
}

export function detachTagFromAsset(assetId: string, tagId: string) {
	const db = openLibraryDatabase();
	try {
		db.prepare('delete from asset_tags where asset_id = ? and tag_id = ?').run(assetId, tagId);
		return true;
	} finally {
		db.close();
	}
}

export function setAssetFavorite(assetId: string, favorite: boolean) {
	const db = openLibraryDatabase();
	try {
		assertAssetExists(db, assetId);
		db.prepare('update assets set favorite = ?, modified_at = ? where id = ?').run(
			favorite ? 1 : 0,
			new Date().toISOString(),
			assetId
		);
		return true;
	} finally {
		db.close();
	}
}

export function moveAssetToFolder(assetId: string, folderId: string | null) {
	const db = openLibraryDatabase();
	try {
		assertAssetExists(db, assetId);
		if (folderId !== null) assertFolderExists(db, folderId);
		db.prepare('update assets set folder_id = ?, modified_at = ? where id = ?').run(
			folderId,
			new Date().toISOString(),
			assetId
		);
		return true;
	} finally {
		db.close();
	}
}

export function acceptSourceTagSuggestion(input: {
	assetId: string;
	name: string;
	facet?: string | null;
	value?: string | null;
}) {
	const db = openLibraryDatabase();
	try {
		assertAssetExists(db, input.assetId);
		const tag = createTagInDb(db, {
			facet: input.facet ?? inferSuggestionFacet(input.name),
			value: input.value ?? input.name
		});
		const now = new Date().toISOString();
		db.prepare(
			`insert or ignore into asset_tags (asset_id, tag_id, created_at) values (?, ?, ?)`
		).run(input.assetId, tag.id, now);
		return tag;
	} finally {
		db.close();
	}
}

export function createProject(input: CreateProjectInput): LibraryProject {
	const db = openLibraryDatabase();
	const now = input.now ?? new Date().toISOString();
	try {
		const name = input.name.trim();
		if (!name) throw new Error('Project name is required');
		const id = `project-${crypto.randomUUID()}`;
		db.prepare(
			`insert into projects (id, name, description, pinned, cover_asset_id, created_at, updated_at)
			 values (?, ?, ?, 0, null, ?, ?)`
		).run(id, name, cleanString(input.description), now, now);
		if (input.startFolderId) {
			addProjectFolderRefInDb(db, id, input.startFolderId, false, now);
		}
		return projectById(db, id);
	} finally {
		db.close();
	}
}

export function addProjectAssetRef(projectId: string, assetId: string) {
	const db = openLibraryDatabase();
	try {
		assertProjectExists(db, projectId);
		assertAssetExists(db, assetId);
		const now = new Date().toISOString();
		db.prepare(
			`insert or ignore into project_asset_refs (project_id, asset_id, created_at)
			 values (?, ?, ?)`
		).run(projectId, assetId, now);
		db.prepare(
			`update projects
			 set cover_asset_id = coalesce(cover_asset_id, ?), updated_at = ?
			 where id = ?`
		).run(assetId, now, projectId);
		return projectById(db, projectId);
	} finally {
		db.close();
	}
}

export function setProjectCoverAsset(projectId: string, assetId: string) {
	const db = openLibraryDatabase();
	try {
		assertProjectExists(db, projectId);
		assertAssetExists(db, assetId);
		const now = new Date().toISOString();
		db.prepare(
			`insert or ignore into project_asset_refs (project_id, asset_id, created_at)
			 values (?, ?, ?)`
		).run(projectId, assetId, now);
		db.prepare('update projects set cover_asset_id = ?, updated_at = ? where id = ?').run(
			assetId,
			now,
			projectId
		);
		return projectById(db, projectId);
	} finally {
		db.close();
	}
}

export function addProjectFolderRef(
	projectId: string,
	folderId: string,
	includeSubfolders = false
) {
	const db = openLibraryDatabase();
	try {
		assertProjectExists(db, projectId);
		const now = new Date().toISOString();
		addProjectFolderRefInDb(db, projectId, folderId, includeSubfolders, now);
		return projectById(db, projectId);
	} finally {
		db.close();
	}
}

export function createTagInDb(db: Database.Database, input: CreateTagInput): LibraryTag {
	const parsed = parseTagInput(input);
	const facet = findOrCreateFacet(db, parsed.facet, input.now);
	const value = parsed.value;
	const slug = `${facet.slug}-${slugify(value)}`;
	const existing = tagBySlug(db, slug);
	if (existing) return mapTag(existing);

	const now = input.now ?? new Date().toISOString();
	const id = `tag-${crypto.randomUUID()}`;
	db.prepare(
		`insert into tags (id, facet_id, value, name, slug, created_at)
		 values (?, ?, ?, ?, ?, ?)`
	).run(id, facet.id, value, `${facet.name}: ${value}`, slug, now);
	return mapTag(tagBySlug(db, slug)!);
}

export function parseTagInput(input: CreateTagInput) {
	const label = cleanString(input.label);
	const explicitFacet = cleanString(input.facet);
	const explicitValue = cleanString(input.value);
	if (explicitFacet && explicitValue) return { facet: explicitFacet, value: explicitValue };
	if (label?.includes(':')) {
		const [facet, ...rest] = label.split(':');
		const value = rest.join(':').trim();
		if (facet.trim() && value) return { facet: facet.trim(), value };
	}
	if (explicitValue) return { facet: explicitFacet ?? 'General', value: explicitValue };
	if (label) return { facet: explicitFacet ?? 'General', value: label };
	throw new Error('Tag value is required');
}

export function inferSuggestionFacet(name: string) {
	const normalized = slugify(name);
	if (normalized.includes('oil') || normalized.includes('paint') || normalized.includes('print')) {
		return 'medium';
	}
	if (normalized.includes('met') || normalized.includes('art-institute') || normalized.includes('wikidata')) {
		return 'source';
	}
	return 'subject';
}

function findOrCreateFacet(db: Database.Database, name: string, nowInput?: string): FacetRow {
	const slug = slugify(name);
	if (!slug) throw new Error('Tag group name is required');
	const existing = db.prepare('select id, name, slug from tag_facets where slug = ?').get(slug) as
		| FacetRow
		| undefined;
	if (existing) return existing;

	const now = nowInput ?? new Date().toISOString();
	const id = `facet-${slug}`;
	db.prepare('insert into tag_facets (id, name, slug, created_at) values (?, ?, ?, ?)').run(
		id,
		name.trim(),
		slug,
		now
	);
	return { id, name: name.trim(), slug };
}

function tagBySlug(db: Database.Database, slug: string) {
	return db
		.prepare(
			`select
				tags.id,
				tags.facet_id,
				tag_facets.name as facet_name,
				tag_facets.slug as facet_slug,
				tags.value,
				tags.name,
				tags.slug,
				(select count(*) from asset_tags where asset_tags.tag_id = tags.id) as asset_count
			 from tags
			 join tag_facets on tag_facets.id = tags.facet_id
			 where tags.slug = ?`
		)
		.get(slug) as TagRow | undefined;
}

function assertAssetExists(db: Database.Database, id: string) {
	if (!db.prepare('select 1 from assets where id = ?').get(id)) throw new Error('Asset not found');
}

function assertTagExists(db: Database.Database, id: string) {
	if (!db.prepare('select 1 from tags where id = ?').get(id)) throw new Error('Tag not found');
}

function assertProjectExists(db: Database.Database, id: string) {
	if (!db.prepare('select 1 from projects where id = ?').get(id)) throw new Error('Project not found');
}

function assertFolderExists(db: Database.Database, id: string) {
	if (!db.prepare('select 1 from folders where id = ?').get(id)) throw new Error('Folder not found');
}

function addProjectFolderRefInDb(
	db: Database.Database,
	projectId: string,
	folderId: string,
	includeSubfolders: boolean,
	now: string
) {
	if (!db.prepare('select 1 from folders where id = ?').get(folderId)) {
		throw new Error('Folder not found');
	}
	db.prepare(
		`insert or ignore into project_folder_refs (
			project_id, folder_id, include_subfolders, created_at
		) values (?, ?, ?, ?)`
	).run(projectId, folderId, includeSubfolders ? 1 : 0, now);
}

function projectById(db: Database.Database, id: string): LibraryProject {
	const project = db
		.prepare(
			`select
				projects.id,
				projects.name,
				projects.description,
				projects.pinned,
				projects.cover_asset_id,
				(select count(*) from project_asset_refs where project_asset_refs.project_id = projects.id)
					as asset_count,
				(select count(*) from project_folder_refs where project_folder_refs.project_id = projects.id)
					as folder_count,
				projects.created_at,
				projects.updated_at
			 from projects
			 where projects.id = ?`
		)
		.get(id) as ProjectRow | undefined;
	if (!project) throw new Error('Project not found');
	return mapProject(project);
}

function mapProject(row: ProjectRow): LibraryProject {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		pinned: Boolean(row.pinned),
		coverAssetId: row.cover_asset_id,
		coverPreviewUrl: null,
		assetCount: row.asset_count,
		folderCount: row.folder_count,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapTag(row: TagRow): LibraryTag {
	return {
		id: row.id,
		facetId: row.facet_id,
		facetName: row.facet_name,
		facetSlug: row.facet_slug,
		value: row.value,
		name: row.name,
		slug: row.slug,
		assetCount: row.asset_count
	};
}

function cleanString(value: string | null | undefined) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
