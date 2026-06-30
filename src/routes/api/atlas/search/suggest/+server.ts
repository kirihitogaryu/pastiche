import { json } from '@sveltejs/kit';
import { suggestAtlasSearch } from '$lib/server/atlas/search';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ url }: { url: URL }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = Number.parseInt(url.searchParams.get('limit') ?? '10', 10);
	const db = openLibraryDatabase();
	try {
		return json(suggestAtlasSearch(db, query, { limit: Number.isFinite(limit) ? limit : 10 }));
	} finally {
		db.close();
	}
}
