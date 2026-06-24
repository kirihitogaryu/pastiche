import { deleteLibraryAsset } from '$lib/server/library/delete';
import { moveAssetToFolder, setAssetFavorite } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { EXTENSION_CORS_HEADERS } from '../../../cors';

export function OPTIONS() {
	return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'JSON body is required' }, { status: 400 });
	}
	if (!isRecord(body)) return Response.json({ error: 'JSON body is required' }, { status: 400 });

	try {
		if ('favorite' in body) {
			if (typeof body.favorite !== 'boolean') {
				return Response.json({ error: 'favorite must be a boolean' }, { status: 400 });
			}
			setAssetFavorite(params.id, body.favorite);
		}
		if ('folder_id' in body) {
			if (!(body.folder_id === null || typeof body.folder_id === 'string')) {
				return Response.json({ error: 'folder_id must be a string or null' }, { status: 400 });
			}
			moveAssetToFolder(params.id, body.folder_id);
		}
		return Response.json({ snapshot: getLibrarySnapshot() });
	} catch (error) {
		return Response.json({ error: errorMessage(error) }, { status: 400 });
	}
}

export function DELETE({ params }: { params: { id: string } }) {
	if (!deleteLibraryAsset(params.id)) {
		return new Response('Not found', { status: 404, headers: EXTENSION_CORS_HEADERS });
	}

	return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Asset could not be updated';
}
