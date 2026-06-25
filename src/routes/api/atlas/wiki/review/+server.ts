import { json } from '@sveltejs/kit';
import {
	deleteReviewableAtlasConceptFromLibrary,
	readAtlasWikiReviewQueueFromLibrary
} from '$lib/server/atlas/review';

export function GET() {
	return json({ items: readAtlasWikiReviewQueueFromLibrary() });
}

export function DELETE({ url }: { url: URL }) {
	const slug = url.searchParams.get('slug');
	if (!slug) return json({ error: 'slug is required' }, { status: 400 });
	const result = deleteReviewableAtlasConceptFromLibrary(slug);
	if (!result.deleted) {
		return json(
			{ error: result.reason === 'protected' ? 'Concept is protected.' : 'Concept not found.' },
			{ status: result.reason === 'protected' ? 409 : 404 }
		);
	}
	return json({ deleted: true, slug: result.slug });
}
