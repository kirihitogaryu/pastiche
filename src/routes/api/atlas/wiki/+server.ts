import { json } from '@sveltejs/kit';
import { createAtlasWikiEntry } from '$lib/server/atlas/mutate';
import { applyAtlasWikiSeed, readAtlasWikiEntries } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { parseAtlasWikiDraft } from '$lib/atlas/wikiDraft';
import { requireTrustedLocalAccess } from '../../localAccess';

export function GET({ request }: { request?: Request } = {}) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		return json({ entries: readAtlasWikiEntries(db) }, { headers: access.headers });
	} finally {
		db.close();
	}
}

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON body is required' }, { status: 400, headers: access.headers });
	}

	const parsed = parseAtlasWikiDraft(body, { allowIncompleteContent: true });
	if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers: access.headers });
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const entry = createAtlasWikiEntry(
			db,
			parsed.value as Parameters<typeof createAtlasWikiEntry>[1],
			undefined,
			{ allowIncompleteContent: true }
		);
		return json({ entry }, { status: 201, headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Wiki entry could not be created.' },
			{ status: 400, headers: access.headers }
		);
	} finally {
		db.close();
	}
}
