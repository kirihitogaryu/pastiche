import { json } from '@sveltejs/kit';
import { addProjectAssetRef } from '$lib/server/library/organization';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	const body = await readJson(request);
	if (!isRecord(body) || typeof body.asset_id !== 'string') {
		return json({ error: 'asset_id is required' }, { status: 400, headers: access.headers });
	}
	try {
		const project = addProjectAssetRef(params.id, body.asset_id);
		return json({ project }, { headers: access.headers });
	} catch (error) {
		return json({ error: errorMessage(error) }, { status: 400, headers: access.headers });
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
	return error instanceof Error ? error.message : 'Project asset reference could not be added';
}
