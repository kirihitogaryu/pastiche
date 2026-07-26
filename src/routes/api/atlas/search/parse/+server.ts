import { json } from '@sveltejs/kit';
import { parseAtlasSearchForApi } from '$lib/server/atlas/search';

export function GET({ url }: { url: URL }) {
	return json({ query: parseAtlasSearchForApi(url.searchParams.get('q') ?? '') });
}
