import { deleteLibraryAsset } from '$lib/server/library/delete';
import { updateAssetOrganization } from '$lib/server/library/organization';
import { getLibraryAssetById } from '$lib/server/library/read';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../../../localAccess';

export function OPTIONS({ request }: { request?: Request } = {}) {
	return trustedLocalPreflight(request);
}

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ error: 'JSON body is required' },
			{ status: 400, headers: access.headers }
		);
	}
	if (!isRecord(body)) {
		return Response.json(
			{ error: 'JSON body is required' },
			{ status: 400, headers: access.headers }
		);
	}

	try {
		const update: { favorite?: boolean; folderId?: string | null } = {};
		if ('favorite' in body) {
			if (typeof body.favorite !== 'boolean') {
				return Response.json(
					{ error: 'favorite must be a boolean' },
					{ status: 400, headers: access.headers }
				);
			}
			update.favorite = body.favorite;
		}
		if ('folder_id' in body) {
			if (!(body.folder_id === null || typeof body.folder_id === 'string')) {
				return Response.json(
					{ error: 'folder_id must be a string or null' },
					{ status: 400, headers: access.headers }
				);
			}
			update.folderId = body.folder_id;
		}
		updateAssetOrganization(params.id, update);
		return Response.json({ asset: getLibraryAssetById(params.id) }, { headers: access.headers });
	} catch (error) {
		return Response.json({ error: errorMessage(error) }, { status: 400, headers: access.headers });
	}
}

export function DELETE({ params, request }: { params: { id: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	try {
		if (!deleteLibraryAsset(params.id)) {
			return new Response('Not found', { status: 404, headers: access.headers });
		}
		return new Response(null, { status: 204, headers: access.headers });
	} catch (error) {
		return Response.json({ error: errorMessage(error) }, { status: 500, headers: access.headers });
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Asset could not be updated';
}
