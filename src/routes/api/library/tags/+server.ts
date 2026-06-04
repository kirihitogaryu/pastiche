import { json } from '@sveltejs/kit';
import { createTag } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ request }: { request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body)) return json({ error: 'Tag value is required' }, { status: 400 });
	try {
		const tag = createTag({
			label: typeof body.label === 'string' ? body.label : null,
			facet: typeof body.facet === 'string' ? body.facet : null,
			value: typeof body.value === 'string' ? body.value : null
		});
		return json({ tag, snapshot: getLibrarySnapshot() });
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
	return error instanceof Error ? error.message : 'Tag could not be created';
}
