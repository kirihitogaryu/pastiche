import { json } from '@sveltejs/kit';
import { isSourceId } from '$lib/explore/connectors';
import { listSavedExploreSearches, saveExploreSearch } from '$lib/server/explore/savedSearches';
import { requireTrustedLocalAccess } from '../../../api/localAccess';

export function GET({ request, url }: { request: Request; url: URL }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const source = url.searchParams.get('source');
	const mode = url.searchParams.get('mode');
	if (source && !isSavedSearchSource(source)) {
		return json({ error: 'Invalid saved-search source' }, { status: 400, headers: access.headers });
	}
	if (mode && !isMode(mode)) {
		return json({ error: 'Invalid saved-search mode' }, { status: 400, headers: access.headers });
	}
	return json(
		{
			searches: listSavedExploreSearches({
				source: source && isSourceId(source) ? source : undefined,
				mode: mode && isMode(mode) ? mode : undefined
			})
		},
		{ headers: access.headers }
	);
}

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const body = await readJson(request);
	if (
		!isRecord(body) ||
		typeof body.source !== 'string' ||
		!isSavedSearchSource(body.source) ||
		!isMode(body.mode) ||
		typeof body.query !== 'string' ||
		(body.filters !== undefined && !isRecord(body.filters))
	) {
		return json({ error: 'Invalid saved search' }, { status: 400, headers: access.headers });
	}
	try {
		const result = saveExploreSearch({
			source: body.source,
			mode: body.mode,
			query: body.query,
			label: typeof body.label === 'string' ? body.label : null,
			filters: isRecord(body.filters) ? body.filters : {},
			lastSeenItemId: typeof body.lastSeenItemId === 'string' ? body.lastSeenItemId : null,
			lastSeenPublishedAt:
				typeof body.lastSeenPublishedAt === 'string' ? body.lastSeenPublishedAt : null
		});
		return json(result, { status: result.created ? 201 : 200, headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Search could not be saved' },
			{ status: 400, headers: access.headers }
		);
	}
}

function isSavedSearchSource(
	value: string
): value is 'wikidata' | 'danbooru' | 'deviantart' | 'bluesky' | 'furaffinity' {
	return (
		value === 'wikidata' ||
		value === 'danbooru' ||
		value === 'deviantart' ||
		value === 'bluesky' ||
		value === 'furaffinity'
	);
}

function isMode(value: unknown): value is 'artist' | 'tags' | 'art' | 'reference' {
	return value === 'artist' || value === 'tags' || value === 'art' || value === 'reference';
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
