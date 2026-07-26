import { openLibraryDatabase } from './schema';
import type { StatusResponse } from './types';

type CountRow = {
	count: number;
};

export function getLibraryStatus(since: string | null = null): StatusResponse {
	const db = openLibraryDatabase();
	const statusCursor = new Date().toISOString();
	const unassigned = db
		.prepare('select count(*) as count from assets where folder_id is null')
		.get() as CountRow;
	const recentFolders = db
		.prepare(
			`select id, name, last_used_at as last_used
			 from folders
			 where last_used_at is not null
			 order by last_used_at desc
			 limit 8`
		)
		.all() as StatusResponse['recent_folders'];
	const folders = db
		.prepare('select id, name, parent_id, path from folders order by path')
		.all() as StatusResponse['folders'];
	const importedSources = since
		? (db
				.prepare(
					`select source_hash, source_image_url, source_url
					 from assets
					 where imported_at > ?
					 order by imported_at desc`
				)
				.all(since) as StatusResponse['imported_sources'])
		: (db
				.prepare(
					`select source_hash, source_image_url, source_url
					 from assets
					 order by imported_at desc`
				)
				.all() as StatusResponse['imported_sources']);
	db.close();

	return {
		connected: true,
		status_cursor: statusCursor,
		unassigned_count: unassigned.count,
		recent_folders: recentFolders,
		folders,
		imported_sources: importedSources
	};
}
