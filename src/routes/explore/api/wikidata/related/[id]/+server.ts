import { json } from '@sveltejs/kit';
import { wikidataConnector } from '$lib/explore/connectors/wikidata';
import {
	WikimediaTemporaryError,
	isWikimediaTemporaryError
} from '$lib/explore/wikimedia-request';

const RELATED_CACHE_HEADERS = {
	'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
};
const MAX_RELATED_LIMIT = 40;

export async function GET({ params, url }: { params: { id: string }; url: URL }) {
	const parsed = parseRelatedParams(params.id, url);
	if ('error' in parsed) {
		return json({ error: parsed.error }, { status: 400 });
	}

	try {
		const page = await wikidataConnector.getRelated(parsed.id, {
			limit: parsed.limit,
			cursor: parsed.cursor
		});
		return json(page, { headers: RELATED_CACHE_HEADERS });
	} catch (error) {
		if (isWikimediaTemporaryError(error)) {
			return temporaryWikimediaResponse(error);
		}
		return json({ error: errorMessage(error, 'Related Wikidata works failed to load') }, { status: 502 });
	}
}

function parseRelatedParams(id: string, url: URL):
	| { id: string; limit: number; cursor?: string }
	| { error: string } {
	if (!/^wikidata-Q\d+$/.test(id)) return { error: 'Invalid Wikidata item id' };
	const limit = Number(url.searchParams.get('limit') ?? '4');
	if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RELATED_LIMIT) {
		return { error: 'Invalid related works limit' };
	}
	const cursor = url.searchParams.get('cursor') ?? undefined;
	if (cursor !== undefined && !/^\d+$/.test(cursor)) return { error: 'Invalid related works cursor' };
	return { id, limit, cursor };
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

function temporaryWikimediaResponse(error: WikimediaTemporaryError) {
	const headers: Record<string, string> = {};
	if (error.retryAfterSeconds !== null) {
		headers['retry-after'] = String(error.retryAfterSeconds);
	}
	return json(
		{
			error: error.message,
			retryAfterSeconds: error.retryAfterSeconds ?? undefined
		},
		{ status: 503, headers }
	);
}
