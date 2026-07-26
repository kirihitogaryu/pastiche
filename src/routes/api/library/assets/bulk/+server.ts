import { json } from '@sveltejs/kit';
import { deleteLibraryAsset } from '$lib/server/library/delete';
import { moveAssetsToFolder } from '$lib/server/library/organization';
import { requireTrustedLocalAccess } from '../../../localAccess';

export async function PATCH({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const body = await readJson(request);
	if (
		!isRecord(body) ||
		!Array.isArray(body.asset_ids) ||
		!body.asset_ids.every((id) => typeof id === 'string') ||
		!(body.folder_id === null || typeof body.folder_id === 'string')
	) {
		return json(
			{ error: 'asset_ids and folder_id are required' },
			{ status: 400, headers: access.headers }
		);
	}
	try {
		const updated = moveAssetsToFolder(body.asset_ids, body.folder_id);
		return json({ updated }, { headers: access.headers });
	} catch (error) {
		return json({ error: errorMessage(error) }, { status: 400, headers: access.headers });
	}
}

export async function DELETE({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const body = await readJson(request);
	if (
		!isRecord(body) ||
		!Array.isArray(body.asset_ids) ||
		!body.asset_ids.every((id) => typeof id === 'string')
	) {
		return json({ error: 'asset_ids are required' }, { status: 400, headers: access.headers });
	}
	try {
		let deleted = 0;
		for (const id of [...new Set(body.asset_ids)]) {
			if (deleteLibraryAsset(id)) deleted += 1;
		}
		return json({ deleted }, { headers: access.headers });
	} catch (error) {
		return json({ error: errorMessage(error) }, { status: 500, headers: access.headers });
	}
}

async function readJson(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Assets could not be updated';
}
