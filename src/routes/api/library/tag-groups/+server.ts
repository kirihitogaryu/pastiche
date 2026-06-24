import { json } from '@sveltejs/kit';
import { createTagGroup } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ request }: { request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.name !== 'string') {
		return json({ error: 'Tag group name is required' }, { status: 400 });
	}

	try {
		const tagGroup = createTagGroup({ name: body.name });
		return json({ tagGroup, snapshot: getLibrarySnapshot() }, { status: 201 });
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
	return error instanceof Error ? error.message : 'Tag group could not be created';
}
