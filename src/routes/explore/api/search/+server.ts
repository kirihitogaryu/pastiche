import { json } from '@sveltejs/kit';
import { getExploreConnector, isSourceId } from '$lib/explore/connectors';
import type { ExploreQuery, SourceId } from '$lib/explore/types';
import {
	WikimediaTemporaryError,
	isWikimediaTemporaryError
} from '$lib/explore/wikimedia-request';

const SEARCH_CACHE_HEADERS = {
	'cache-control': 'public, max-age=3600, stale-while-revalidate=86400'
};
const MAX_SEARCH_LIMIT = 100;

type ExploreSearchBody =
	| ExploreQuery
	| {
			source?: SourceId;
			query: ExploreQuery;
	  };

export async function POST({ request }: { request: Request }) {
	const body = (await readJson(request)) as ExploreSearchBody;
	const parsed = parseSearchBody(body);
	if ('error' in parsed) {
		return json({ error: parsed.error }, { status: 400 });
	}

	try {
		const page = await getExploreConnector(parsed.source).search(parsed.query);
		return json(page, { headers: SEARCH_CACHE_HEADERS });
	} catch (error) {
		if (isWikimediaTemporaryError(error)) {
			return temporaryWikimediaResponse(error);
		}
		return json({ error: errorMessage(error, 'Explore search failed') }, { status: 502 });
	}
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

function parseSearchBody(
	body: ExploreSearchBody | unknown
): { source: SourceId; query: ExploreQuery } | { error: string } {
	if (isRecord(body) && 'query' in body) {
		const source = body.source ?? 'met';
		if (typeof source !== 'string' || !isSourceId(source)) {
			return { error: 'Invalid Explore source' };
		}
		if (!isExploreQuery(body.query)) {
			return { error: 'Invalid Explore query' };
		}
		return { source, query: body.query };
	}

	if (!isExploreQuery(body)) {
		return { error: 'Invalid Explore query' };
	}
	return { source: 'met', query: body };
}

function isExploreQuery(value: unknown): value is ExploreQuery {
	if (!isRecord(value)) return false;
	if (
		typeof value.limit !== 'number' ||
		!Number.isInteger(value.limit) ||
		value.limit < 1 ||
		value.limit > MAX_SEARCH_LIMIT
	) {
		return false;
	}

	return (
		isOptionalString(value.keyword) &&
		isOptionalString(value.artist) &&
		isOptionalString(value.tag) &&
		isOptionalNumber(value.yearFrom) &&
		isOptionalNumber(value.yearTo) &&
		isOptionalString(value.medium) &&
		isOptionalString(value.department) &&
		isOptionalBoolean(value.publicDomainOnly) &&
		isOptionalBoolean(value.hasImageOnly) &&
		isOptionalBoolean(value.isHighlightOnly) &&
		isOptionalString(value.color) &&
		isOptionalDepicts(value.depicts) &&
		isOptionalWikidataMode(value.wikidataMode) &&
		isOptionalDepicts(value.wikidataEntities) &&
		isOptionalWorkType(value.workType) &&
		isOptionalString(value.cursor)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isOptionalString(value: unknown) {
	return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown) {
	return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isOptionalBoolean(value: unknown) {
	return value === undefined || typeof value === 'boolean';
}

function isOptionalWorkType(value: unknown) {
	return value === undefined || value === 'painting';
}

function isOptionalWikidataMode(value: unknown) {
	return (
		value === undefined ||
		value === 'depicts' ||
		value === 'main_subject' ||
		value === 'artist' ||
		value === 'title' ||
		value === 'movement' ||
		value === 'genre'
	);
}

function isOptionalDepicts(value: unknown) {
	if (value === undefined) return true;
	if (!Array.isArray(value)) return false;
	return value.every(
		(subject) =>
			isRecord(subject) &&
			typeof subject.id === 'string' &&
			/^Q\d+$/.test(subject.id) &&
			typeof subject.label === 'string' &&
			(subject.description === null ||
				subject.description === undefined ||
				typeof subject.description === 'string')
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
