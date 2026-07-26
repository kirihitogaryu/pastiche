import { json } from '@sveltejs/kit';
import { mergeAtlasConceptFromLibrary } from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export async function POST({ params, request }: { params: { slug: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (typeof body.targetSlug !== 'string') {
			return json({ error: 'targetSlug is required.' }, { status: 400, headers: access.headers });
		}
		const concept = mergeAtlasConceptFromLibrary(params.slug, body.targetSlug);
		return json({ concept, merged: params.slug }, { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be merged.' },
			{ status: 400, headers: access.headers }
		);
	}
}
