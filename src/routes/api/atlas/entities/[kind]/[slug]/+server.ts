import { json } from '@sveltejs/kit';
import type { AtlasEntityKind } from '$lib/atlas/types';
import { readAtlasEntityProfile } from '$lib/server/atlas/entityProfile';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ params }: { params: { kind: string; slug: string } }) {
	if (!isAtlasEntityKind(params.kind)) {
		return json({ error: 'Unsupported entity kind' }, { status: 400 });
	}
	const db = openLibraryDatabase();
	try {
		const entity = readAtlasEntityProfile(db, params.kind, params.slug);
		if (!entity) return json({ error: 'Entity not found' }, { status: 404 });
		return json({ entity });
	} finally {
		db.close();
	}
}

function isAtlasEntityKind(value: string): value is AtlasEntityKind {
	return (
		value === 'artist' ||
		value === 'work' ||
		value === 'character' ||
		value === 'ip' ||
		value === 'institution' ||
		value === 'source' ||
		value === 'place' ||
		value === 'species'
	);
}
