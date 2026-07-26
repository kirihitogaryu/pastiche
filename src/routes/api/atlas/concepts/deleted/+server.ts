import { json } from '@sveltejs/kit';
import { listAtlasConceptTombstonesFromLibrary } from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../localAccess';

export function GET({ request }: { request?: Request } = {}) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	return json({ items: listAtlasConceptTombstonesFromLibrary() }, { headers: access.headers });
}
