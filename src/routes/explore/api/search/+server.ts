import { json } from '@sveltejs/kit';
import { getExploreConnector, isSourceId } from '$lib/explore/connectors';
import type { ExploreQuery, SourceId } from '$lib/explore/types';

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

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}
