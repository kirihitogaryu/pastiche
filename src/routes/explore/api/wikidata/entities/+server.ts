import { json } from '@sveltejs/kit';
import { searchWikidataEntities } from '$lib/explore/wikidata-entities';
import { WikimediaTemporaryError, isWikimediaTemporaryError } from '$lib/explore/wikimedia-request';

const ENTITY_CACHE_HEADERS = {
	'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
};

export async function GET({ url }: { url: URL }) {
	const search = url.searchParams.get('search')?.trim() ?? '';
	const mode = url.searchParams.get('mode') ?? 'depicts';
	const context = url.searchParams.get('context');
	if (search.length < 2) {
		return json({ error: 'Search must be at least 2 characters' }, { status: 400 });
	}
	if (!isEntityMode(mode)) {
		return json({ error: 'Invalid Wikidata entity search mode' }, { status: 400 });
	}
	if (context !== null && context !== 'reference') {
		return json({ error: 'Invalid Wikidata entity search context' }, { status: 400 });
	}

	try {
		const options =
			context === 'reference'
				? ({ limit: 8, mode, context: 'reference' } as const)
				: { limit: 8, mode };
		const entities = await searchWikidataEntities(search, options);
		return json({ entities }, { headers: ENTITY_CACHE_HEADERS });
	} catch (error) {
		if (isWikimediaTemporaryError(error)) {
			return temporaryWikimediaResponse(error);
		}
		return json({ error: errorMessage(error, 'Wikidata entity search failed') }, { status: 502 });
	}
}

function isEntityMode(
	value: string
): value is 'depicts' | 'main_subject' | 'artist' | 'movement' | 'genre' {
	return (
		value === 'depicts' ||
		value === 'main_subject' ||
		value === 'artist' ||
		value === 'movement' ||
		value === 'genre'
	);
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
