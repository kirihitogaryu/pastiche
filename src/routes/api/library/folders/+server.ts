import { json } from '@sveltejs/kit';
import { createFolder } from '$lib/server/library/organization';
import { requireTrustedLocalAccess } from '../../localAccess';

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	const body = await readJson(request);
	if (!isRecord(body) || typeof body.name !== 'string') {
		return json({ error: 'Folder name is required' }, { status: 400, headers: access.headers });
	}
	try {
		const folder = createFolder({
			name: body.name,
			parentId: typeof body.parent_id === 'string' ? body.parent_id : null
		});
		return json({ folder }, { status: 201, headers: access.headers });
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
	return error instanceof Error ? error.message : 'Folder could not be created';
}
