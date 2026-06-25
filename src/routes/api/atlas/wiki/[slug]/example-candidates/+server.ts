import { json } from '@sveltejs/kit';
import { readAtlasExampleCandidates } from '$lib/server/atlas/mutate';
import { applyAtlasWikiSeed } from '$lib/server/atlas/wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ params, url }: { params: { slug: string }; url: URL }) {
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const query = url.searchParams.get('q') ?? '';
		const limit = Number.parseInt(url.searchParams.get('limit') ?? '30', 10);
		return json({
			candidates: readAtlasExampleCandidates(db, params.slug, query, Number.isFinite(limit) ? limit : 30)
		});
	} finally {
		db.close();
	}
}
