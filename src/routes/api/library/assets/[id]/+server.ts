import { deleteLibraryAsset } from '$lib/server/library/delete';
import { EXTENSION_CORS_HEADERS } from '../../../cors';

export function OPTIONS() {
	return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

export function DELETE({ params }: { params: { id: string } }) {
	if (!deleteLibraryAsset(params.id)) {
		return new Response('Not found', { status: 404, headers: EXTENSION_CORS_HEADERS });
	}

	return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}
