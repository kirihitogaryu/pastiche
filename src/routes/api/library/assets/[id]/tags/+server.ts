import { json } from '@sveltejs/kit';
import {
	attachTagToAsset,
	createTag,
	detachTagFromAsset
} from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body)) return json({ error: 'Tag is required' }, { status: 400 });
	try {
		const tag =
			typeof body.tag_id === 'string'
				? { id: body.tag_id }
				: createTag({
						label: typeof body.label === 'string' ? body.label : null,
						facet: typeof body.facet === 'string' ? body.facet : null,
						value: typeof body.value === 'string' ? body.value : null
					});
		attachTagToAsset(params.id, tag.id);
		return json({ tag, snapshot: getLibrarySnapshot() });
	} catch (error) {
		return json({ error: errorMessage(error) }, { status: 400 });
	}
}

export async function DELETE({ params, request }: { params: { id: string }; request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.tag_id !== 'string') {
		return json({ error: 'tag_id is required' }, { status: 400 });
	}
	try {
		detachTagFromAsset(params.id, body.tag_id);
		return json({ snapshot: getLibrarySnapshot() });
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
	return error instanceof Error ? error.message : 'Asset tag could not be updated';
}
