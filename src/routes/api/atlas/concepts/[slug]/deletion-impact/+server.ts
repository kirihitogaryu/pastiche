import { json } from '@sveltejs/kit';
import { readAtlasConceptDeletionImpactFromLibrary } from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export function GET({ params, request }: { params: { slug: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const impact = readAtlasConceptDeletionImpactFromLibrary(params.slug);
	if (!impact)
		return json({ error: 'Concept not found.' }, { status: 404, headers: access.headers });
	return json({ impact }, { headers: access.headers });
}
