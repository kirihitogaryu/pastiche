import { json } from '@sveltejs/kit';
import { deleteLibraryFolder, renameLibraryFolder } from '$lib/server/library/folders';
import { requireTrustedLocalAccess } from '../../../localAccess';

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.name !== 'string') {
		return json({ error: 'Folder name is required' }, { status: 400, headers: access.headers });
	}
	try {
		return json({ folder: renameLibraryFolder(params.id, body.name) }, { headers: access.headers });
	} catch (error) {
		return json({ error: errorMessage(error) }, { status: 400, headers: access.headers });
	}
}

export function DELETE({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	try {
		const impact = deleteLibraryFolder(params.id);
		if (!impact) {
			return json({ error: 'Folder not found' }, { status: 404, headers: access.headers });
		}
		return json({ impact }, { headers: access.headers });
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
	return error instanceof Error ? error.message : 'Folder could not be updated';
}
