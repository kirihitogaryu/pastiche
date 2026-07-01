import { json } from '@sveltejs/kit';
import { suggestAtlasEntities } from '$lib/server/atlas/entitySuggest';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ url }: { url: URL }) {
	const kind = url.searchParams.get('kind') ?? 'artist';
	if (kind !== 'artist') {
		return json({ error: 'Unsupported entity kind' }, { status: 400 });
	}

	const db = openLibraryDatabase();
	try {
		const suggestions = suggestAtlasEntities(db, {
			kind,
			query: url.searchParams.get('q'),
			limit: Number(url.searchParams.get('limit') ?? 10)
		});
		return json({ suggestions });
	} finally {
		db.close();
	}
}
