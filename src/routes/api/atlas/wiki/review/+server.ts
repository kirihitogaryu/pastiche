import { json } from '@sveltejs/kit';
import {
	deleteReviewableAtlasConceptFromLibrary,
	readAtlasWikiReviewQueueFromLibrary
} from '$lib/server/atlas/review';
import { requireTrustedLocalAccess } from '../../../localAccess';

export function GET(
	{ url, request }: { url: URL; request?: Request } = {
		url: new URL('http://localhost/api/atlas/wiki/review')
	}
) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const requested = url.searchParams.get('filter');
	const filter =
		requested === 'needs_classification' || requested === 'needs_review' || requested === 'unused'
			? requested
			: 'all';
	return json({ items: readAtlasWikiReviewQueueFromLibrary(filter) }, { headers: access.headers });
}

export function DELETE({ url, request }: { url: URL; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	const slug = url.searchParams.get('slug');
	if (!slug) return json({ error: 'slug is required' }, { status: 400, headers: access.headers });
	const result = deleteReviewableAtlasConceptFromLibrary(slug);
	if (!result.deleted) {
		return json(
			{ error: result.reason === 'protected' ? 'Concept is protected.' : 'Concept not found.' },
			{ status: result.reason === 'protected' ? 409 : 404, headers: access.headers }
		);
	}
	return json({ deleted: true, slug }, { headers: access.headers });
}
