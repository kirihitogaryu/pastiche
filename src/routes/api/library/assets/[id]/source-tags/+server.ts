import { json } from '@sveltejs/kit';
import { acceptSourceTagSuggestion } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
	const body = await readJson(request);
	if (!isRecord(body) || typeof body.name !== 'string') {
		return json({ error: 'Source tag name is required' }, { status: 400 });
	}
	try {
		const tag = acceptSourceTagSuggestion({
			assetId: params.id,
			name: body.name,
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
	return error instanceof Error ? error.message : 'Source tag could not be accepted';
}
