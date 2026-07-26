import { json } from '@sveltejs/kit';
import { restoreAtlasConceptFromLibrary } from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export function POST({ params, request }: { params: { slug: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const concept = restoreAtlasConceptFromLibrary(params.slug);
		if (!concept)
			return json({ error: 'Deleted concept not found.' }, { status: 404, headers: access.headers });
		return json({ concept }, { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be restored.' },
			{ status: 400, headers: access.headers }
		);
	}
}
