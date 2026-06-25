import { json } from '@sveltejs/kit';
import { searchAtlasConceptsForQuery } from '$lib/server/atlas/mutate';

export function GET({ url }: { url: URL }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
	return json({ concepts: searchAtlasConceptsForQuery(query, Number.isFinite(limit) ? limit : 12) });
}
