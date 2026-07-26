import { json } from '@sveltejs/kit';
import { suggestAtlasEntities } from '$lib/server/atlas/entitySuggest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../../../localAccess';

export function OPTIONS({ request }: { request?: Request } = {}) {
	return trustedLocalPreflight(request);
}

export function GET({ url, request }: { url: URL; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const kind = url.searchParams.get('kind') ?? 'artist';
	if (kind !== 'artist') {
		return json({ error: 'Unsupported entity kind' }, { status: 400, headers: access.headers });
	}

	const db = openLibraryDatabase();
	try {
		const suggestions = suggestAtlasEntities(db, {
			kind,
			query: url.searchParams.get('q'),
			limit: Number(url.searchParams.get('limit') ?? 10)
		});
		return json({ suggestions }, { headers: access.headers });
	} finally {
		db.close();
	}
}
