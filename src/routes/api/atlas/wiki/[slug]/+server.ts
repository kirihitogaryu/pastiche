import { json } from '@sveltejs/kit';
import { applyAtlasWikiSeed, readAtlasWikiEntry } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ params }: { params: { slug: string } }) {
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const entry = readAtlasWikiEntry(db, params.slug);
		if (!entry) return json({ error: 'Wiki entry not found' }, { status: 404 });
		return json({ entry });
	} finally {
		db.close();
	}
}
