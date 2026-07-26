import { json } from '@sveltejs/kit';
import { approveAtlasConceptFromLibrary } from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export function POST({ params, request }: { params: { slug: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const concept = approveAtlasConceptFromLibrary(params.slug);
		if (!concept)
			return json({ error: 'Concept not found.' }, { status: 404, headers: access.headers });
		return json({ concept }, { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be approved.' },
			{ status: 400, headers: access.headers }
		);
	}
}
