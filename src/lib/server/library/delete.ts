import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLibraryPaths } from './paths';
import { openLibraryDatabase } from './schema';

type DeleteAssetRow = {
	original_path: string | null;
	thumbnail_path: string | null;
};

export function deleteLibraryAsset(id: string): boolean {
	const db = openLibraryDatabase();
	const asset = db
		.prepare('select original_path, thumbnail_path from assets where id = ?')
		.get(id) as DeleteAssetRow | undefined;

	if (!asset) {
		db.close();
		return false;
	}

	const transaction = db.transaction(() => {
		db.prepare('delete from lazy_download_jobs where asset_id = ?').run(id);
		db.prepare('delete from assets where id = ?').run(id);
	});
	transaction();
	db.close();

	deleteLocalFile(asset.original_path);
	deleteLocalFile(asset.thumbnail_path);
	return true;
}

function deleteLocalFile(relativePath: string | null) {
	if (!relativePath) return;
	try {
		unlinkSync(join(resolveLibraryPaths().root, relativePath));
	} catch (error) {
		const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null;
		if (code !== 'ENOENT') throw error;
	}
}
