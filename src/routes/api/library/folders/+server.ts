import { json } from '@sveltejs/kit';
import { createFolder } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ request }: { request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.name !== 'string') {
		return json({ error: 'Folder name is required' }, { status: 400 });
	}
	try {
		const folder = createFolder({
			name: body.name,
			parentId: typeof body.parent_id === 'string' ? body.parent_id : null
		});
		return json({ folder, snapshot: getLibrarySnapshot() });
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
	return error instanceof Error ? error.message : 'Folder could not be created';
}
