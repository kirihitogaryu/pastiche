import { json } from '@sveltejs/kit';
import { searchAtlasAssets } from '$lib/server/atlas/search';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ url }: { url: URL }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
	const sort = searchSort(url.searchParams.get('sort'));
	const cursor = url.searchParams.get('cursor');
	const db = openLibraryDatabase();
	try {
		return json(
			searchAtlasAssets(db, query, {
				limit: Number.isFinite(limit) ? limit : 50,
				sort,
				cursor
			})
		);
	} finally {
		db.close();
	}
}

function searchSort(value: string | null) {
	return value === 'title' || value === 'newest' ? value : 'relevance';
}
