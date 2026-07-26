import { json } from '@sveltejs/kit';
import { updateAtlasWikiEntryWithResult } from '$lib/server/atlas/mutate';
import { applyAtlasWikiSeed, readAtlasWikiEntry } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { parseAtlasWikiDraft } from '$lib/atlas/wikiDraft';
import { requireTrustedLocalAccess } from '../../../localAccess';

export function GET({ params, request }: { params: { slug: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const entry = readAtlasWikiEntry(db, params.slug);
		if (!entry)
			return json({ error: 'Wiki entry not found' }, { status: 404, headers: access.headers });
		return json({ entry }, { headers: access.headers });
	} finally {
		db.close();
	}
}

export async function PATCH({ params, request }: { params: { slug: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON body is required' }, { status: 400, headers: access.headers });
	}

	const parsed = parseAtlasWikiDraft(body, {
		partial: true,
		allowIncompleteContent: true
	});
	if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers: access.headers });
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const result = updateAtlasWikiEntryWithResult(db, params.slug, parsed.value);
		if (!result)
			return json({ error: 'Wiki entry not found' }, { status: 404, headers: access.headers });
		return json(
			{ entry: result.entry, createdConceptSlugs: result.createdConceptSlugs },
			{ headers: access.headers }
		);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Wiki entry could not be updated.' },
			{ status: 400, headers: access.headers }
		);
	} finally {
		db.close();
	}
}
