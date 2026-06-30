import { json } from '@sveltejs/kit';
import { searchAtlasConceptsForQuery } from '$lib/server/atlas/mutate';
import { EXTENSION_CORS_HEADERS } from '../../cors';

export function OPTIONS() {
	return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

export function GET({ url }: { url: URL }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
	return json(
		{ concepts: searchAtlasConceptsForQuery(query, Number.isFinite(limit) ? limit : 12) },
		{ headers: EXTENSION_CORS_HEADERS }
	);
}
