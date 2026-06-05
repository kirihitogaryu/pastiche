import { json } from '@sveltejs/kit';
import { applyAtlasWikiSeed, readAtlasWikiEntries } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET() {
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		return json({ entries: readAtlasWikiEntries(db) });
	} finally {
		db.close();
	}
}
