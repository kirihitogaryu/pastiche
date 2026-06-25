import { json } from '@sveltejs/kit';
import { createAtlasWikiEntry } from '$lib/server/atlas/mutate';
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

export async function POST({ request }: { request: Request }) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON body is required' }, { status: 400 });
	}

	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const entry = createAtlasWikiEntry(db, body as never);
		return json({ entry }, { status: 201 });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Wiki entry could not be created.' },
			{ status: 400 }
		);
	} finally {
		db.close();
	}
}
