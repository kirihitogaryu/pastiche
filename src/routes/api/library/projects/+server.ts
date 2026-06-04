import { json } from '@sveltejs/kit';
import { createProject } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ request }: { request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.name !== 'string') {
		return json({ error: 'Project name is required' }, { status: 400 });
	}
	try {
		const project = createProject({
			name: body.name,
			description: typeof body.description === 'string' ? body.description : null,
			startFolderId: typeof body.start_folder_id === 'string' ? body.start_folder_id : null
		});
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
	return error instanceof Error ? error.message : 'Project could not be created';
}
