import { json } from '@sveltejs/kit';
import { setAtlasWikiEntryExamples, updateAtlasWikiEntry } from '$lib/server/atlas/mutate';
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

export async function PATCH({ params, request }: { params: { slug: string }; request: Request }) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON body is required' }, { status: 400 });
	}

	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		if (isRecord(body) && ('exampleAssetIds' in body || 'counterexampleAssetIds' in body)) {
			setAtlasWikiEntryExamples(db, params.slug, {
				exampleAssetIds: arrayOfStrings(body.exampleAssetIds),
				counterexampleAssetIds: arrayOfStrings(body.counterexampleAssetIds)
			});
		}
		const entry = updateAtlasWikiEntry(db, params.slug, isRecord(body) ? body : {});
		if (!entry) return json({ error: 'Wiki entry not found' }, { status: 404 });
		return json({ entry });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Wiki entry could not be updated.' },
			{ status: 400 }
		);
	} finally {
		db.close();
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOfStrings(value: unknown) {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
