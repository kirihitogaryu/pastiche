import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLibraryPaths } from './paths';
import { openLibraryDatabase } from './schema';
import type { LibraryAsset, LibraryResponse, StorageMode } from './types';
import type { LibraryFolder } from '$lib/types';

type AssetRow = {
	id: string;
	filename: string;
	title: string;
	storage_mode: StorageMode;
	mime_type: string | null;
	width: number;
	height: number;
	original_path: string | null;
	thumbnail_path: string | null;
	source_image_url: string | null;
	source_url: string;
	page_title: string | null;
	alt_text: string | null;
	source_domain: string | null;
	folder_id: string | null;
	imported_at: string;
	captured_at: string;
};

type FolderRow = {
	id: string;
	name: string;
	parent_id: string | null;
	path: string;
	asset_count: number;
	child_count: number;
};

export function getLibrarySnapshot(): LibraryResponse {
	const db = openLibraryDatabase();
	const folders = db
		.prepare(
			`select
				folders.id,
				folders.name,
				folders.parent_id,
				folders.path,
				(select count(*) from assets where assets.folder_id = folders.id) as asset_count,
				(select count(*) from folders as children where children.parent_id = folders.id) as child_count
			from folders
			order by folders.path`
		)
		.all() as FolderRow[];
	const folderById = new Map(folders.map((folder) => [folder.id, folder]));
	const assets = db.prepare('select * from assets order by imported_at desc').all() as AssetRow[];
	db.close();

	return {
		assets: assets.map((asset) => mapAsset(asset, folderById.get(asset.folder_id ?? ''))),
		folders: folders.map(mapFolder),
		stats: {
			assets: assets.length,
			projects: 0,
			folders: folders.length
		}
	};
}

export function getAssetImageFile(id: string, variant: 'thumb' | 'original') {
	const db = openLibraryDatabase();
	const asset = db
		.prepare('select original_path, thumbnail_path, mime_type from assets where id = ?')
		.get(id) as
		| {
				original_path: string | null;
				thumbnail_path: string | null;
				mime_type: string | null;
		  }
		| undefined;
	db.close();
	if (!asset) return null;

	const relativePath =
		variant === 'thumb' ? asset.thumbnail_path || asset.original_path : asset.original_path;
	if (!relativePath) return null;

	const path = join(resolveLibraryPaths().root, relativePath);
	if (!existsSync(path)) return null;
	return {
		path,
		contentType:
			variant === 'thumb' && asset.thumbnail_path ? 'image/webp' : asset.mime_type || 'image/jpeg'
	};
}

function mapAsset(asset: AssetRow, folder: FolderRow | undefined): LibraryAsset {
	const localImageUrl = asset.thumbnail_path
		? `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=thumb`
		: asset.original_path
			? `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=original`
			: null;
	const domain = asset.source_domain || sourceDomain(asset.source_url) || 'Local Library';

	return {
		id: asset.id,
		title: asset.title || asset.filename,
		creator: '',
		year: new Date(asset.captured_at).getUTCFullYear().toString(),
		medium: '',
		sourceName: domain,
		sourceUrl: asset.source_url,
		sourceType: asset.source_image_url ? 'web' : 'local',
		imageUrl: localImageUrl ?? asset.source_image_url ?? '',
		width: asset.width,
		height: asset.height,
		tags: ['imported'],
		palette: [],
		description: asset.alt_text ?? asset.page_title ?? '',
		notes: undefined,
		favorite: false,
		saved: true,
		projects: [],
		folderPath: folder ? splitPath(folder.path) : ['library', 'unassigned'],
		storageMode: asset.storage_mode,
		sourceImageUrl: asset.source_image_url,
		importedAt: asset.imported_at,
		capturedAt: asset.captured_at
	};
}

function mapFolder(folder: FolderRow): LibraryFolder {
	return {
		id: folder.id,
		name: folder.name,
		path: splitPath(folder.path),
		assetCount: folder.asset_count,
		childFolderCount: folder.child_count,
		parentId: folder.parent_id ?? undefined
	};
}

function splitPath(path: string) {
	return path.split('/').filter(Boolean);
}

function sourceDomain(value: string) {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return null;
	}
}
