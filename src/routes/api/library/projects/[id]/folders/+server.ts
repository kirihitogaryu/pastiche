import { json } from '@sveltejs/kit';
import { addProjectFolderRef } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.folder_id !== 'string') {
		return json({ error: 'folder_id is required' }, { status: 400 });
	}
	try {
		const project = addProjectFolderRef(
			params.id,
			body.folder_id,
			body.include_subfolders === true
		);
		return json({ project, snapshot: getLibrarySnapshot() });
	} catch (error) {
		return json({ error: errorMessage(error) }, { status: 400 });
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
	return error instanceof Error ? error.message : 'Project folder reference could not be added';
}
