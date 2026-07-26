import { json } from '@sveltejs/kit';
import { isAtlasConceptKind } from '$lib/atlas/ontology';
import {
	deleteAtlasConceptFromLibrary,
	updateGovernedAtlasConceptFromLibrary
} from '$lib/server/atlas/governance';
import { requireTrustedLocalAccess } from '../../../localAccess';

export async function PATCH({ params, request }: { params: { slug: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (typeof body.kind === 'string' && !isAtlasConceptKind(body.kind)) {
			return json({ error: 'kind is invalid.' }, { status: 400, headers: access.headers });
		}
		const concept = updateGovernedAtlasConceptFromLibrary(params.slug, {
			label: typeof body.label === 'string' ? body.label : undefined,
			kind:
				typeof body.kind === 'string' && isAtlasConceptKind(body.kind) ? body.kind : undefined,
			category: typeof body.category === 'string' ? body.category : undefined,
			displayGroup: typeof body.displayGroup === 'string' ? body.displayGroup : undefined,
			shortDefinition:
				typeof body.shortDefinition === 'string' ? body.shortDefinition : undefined
		});
		if (!concept)
			return json({ error: 'Concept not found.' }, { status: 404, headers: access.headers });
		return json({ concept }, { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be updated.' },
			{ status: 400, headers: access.headers }
		);
	}
}

export async function DELETE({ params, request }: { params: { slug: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const result = deleteAtlasConceptFromLibrary(params.slug, {
			confirmed: body.confirmed === true,
			confirmation: typeof body.confirmation === 'string' ? body.confirmation : undefined,
			expectedUpdatedAt:
				typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : '',
			reason: typeof body.reason === 'string' ? body.reason : null
		});
		if (result.deleted) return json(result, { headers: access.headers });
		const status =
			result.reason === 'not_found'
				? 404
				: result.reason === 'stale'
					? 409
					: 400;
		return json({ error: result.reason, impact: result.impact }, { status, headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be deleted.' },
			{ status: 400, headers: access.headers }
		);
	}
}
