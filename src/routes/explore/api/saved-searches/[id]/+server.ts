import { json } from '@sveltejs/kit';
import {
	deleteSavedExploreSearch,
	updateSavedExploreSearch
} from '$lib/server/explore/savedSearches';
import { requireTrustedLocalAccess } from '../../../../api/localAccess';

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const body = await readJson(request);
	if (!isRecord(body)) {
		return json({ error: 'Invalid saved-search update' }, { status: 400, headers: access.headers });
	}
	try {
		const search = updateSavedExploreSearch(params.id, {
			label: typeof body.label === 'string' ? body.label : undefined,
			touchOpened: body.touchOpened === true,
			lastSeenItemId:
				body.lastSeenItemId === null || typeof body.lastSeenItemId === 'string'
					? body.lastSeenItemId
					: undefined,
			lastSeenPublishedAt:
				body.lastSeenPublishedAt === null || typeof body.lastSeenPublishedAt === 'string'
					? body.lastSeenPublishedAt
					: undefined
		});
		if (!search) {
			return json({ error: 'Saved search not found' }, { status: 404, headers: access.headers });
		}
		return json({ search }, { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Saved search could not be updated' },
			{ status: 400, headers: access.headers }
		);
	}
}

export function DELETE({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	if (!deleteSavedExploreSearch(params.id)) {
		return json({ error: 'Saved search not found' }, { status: 404, headers: access.headers });
	}
	return new Response(null, { status: 204, headers: access.headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}
