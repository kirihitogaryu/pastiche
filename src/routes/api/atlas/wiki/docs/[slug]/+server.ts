import { json } from '@sveltejs/kit';
import { readAtlasWikiDoc } from '$lib/server/atlas/wikiDocs';

export function GET({ params }: { params: { slug: string } }) {
	const doc = readAtlasWikiDoc(params.slug);
	if (!doc) return json({ error: 'Wiki document not found' }, { status: 404 });
	return json({ doc });
}
