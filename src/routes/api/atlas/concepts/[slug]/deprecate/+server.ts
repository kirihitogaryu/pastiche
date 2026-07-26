import { json } from '@sveltejs/kit';
import { deprecateAtlasConceptFromLibrary } from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export async function POST({ params, request }: { params: { slug: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const concept = deprecateAtlasConceptFromLibrary(
			params.slug,
			typeof body.replacementSlug === 'string' ? body.replacementSlug : null
		);
		if (!concept)
			return json({ error: 'Concept not found.' }, { status: 404, headers: access.headers });
		return json({ concept }, { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be deprecated.' },
			{ status: 400, headers: access.headers }
		);
	}
}
