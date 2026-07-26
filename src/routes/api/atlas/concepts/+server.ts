import { json } from '@sveltejs/kit';
import { searchAtlasConceptsForQuery } from '$lib/server/atlas/mutate';
import { createGovernedAtlasConceptFromLibrary } from '$lib/server/atlas/governance';
import { isAtlasConceptKind } from '$lib/atlas/ontology';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../../localAccess';

export function OPTIONS({ request }: { request?: Request } = {}) {
	return trustedLocalPreflight(request);
}

export function GET({ url, request }: { url: URL; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const query = url.searchParams.get('q') ?? '';
	const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
	return json(
		{ concepts: searchAtlasConceptsForQuery(query, Number.isFinite(limit) ? limit : 12) },
		{ headers: access.headers }
	);
}

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (
			typeof body.slug !== 'string' ||
			typeof body.label !== 'string' ||
			typeof body.kind !== 'string' ||
			!isAtlasConceptKind(body.kind) ||
			typeof body.category !== 'string' ||
			typeof body.displayGroup !== 'string'
		) {
			return json(
				{ error: 'slug, label, kind, category, and displayGroup are required.' },
				{ status: 400, headers: access.headers }
			);
		}
		const concept = createGovernedAtlasConceptFromLibrary({
			slug: body.slug,
			label: body.label,
			kind: body.kind,
			category: body.category,
			displayGroup: body.displayGroup,
			shortDefinition:
				typeof body.shortDefinition === 'string' ? body.shortDefinition : undefined,
			exampleAssetId: typeof body.exampleAssetId === 'string' ? body.exampleAssetId : null
		});
		return json({ concept }, { status: 201, headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Concept could not be created.' },
			{ status: 400, headers: access.headers }
		);
	}
}
