import type { ExploreSubject, WikidataSearchMode } from './types';
import { ServerCache } from './server-cache';
import {
	WikimediaCircuitBreaker,
	WikimediaRequestQueue,
	requestWikimediaJson,
	wikimediaHeaders
} from './wikimedia-request';

type SearchOptions = {
	limit?: number;
	mode?: WikidataEntitySearchMode;
	fetch?: typeof fetch;
	timeoutMs?: number;
	cache?: ServerCache;
};

type WikidataEntitySearchResponse = {
	search?: unknown;
};

type WikidataEntityResult = {
	id?: unknown;
	label?: unknown;
	description?: unknown;
};

const WIKIDATA_ENTITY_SEARCH_URL = 'https://www.wikidata.org/w/api.php';
const ENTITY_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENTITY_TIMEOUT_MS = 6_000;
export type WikidataEntitySearchMode = Exclude<WikidataSearchMode, 'title'>;

export const wikidataEntityServerCache = new ServerCache(1000);
const entityQueue = new WikimediaRequestQueue({ concurrency: 1, requestsPerSecond: 2 });
const entityBreaker = new WikimediaCircuitBreaker({
	upstream: 'action',
	defaultCooldownSeconds: 15
});

export async function searchWikidataEntities(
	search: string,
	options: SearchOptions = {}
): Promise<ExploreSubject[]> {
	const trimmed = search.trim();
	if (trimmed.length < 2) return [];
	const limit = options.limit ?? 8;
	const mode = options.mode ?? 'depicts';
	const cache = options.cache ?? wikidataEntityServerCache;
	const cacheKey = `wikidata:entities:${mode}:${trimmed.toLowerCase()}:${limit}`;

	return cache.getOrFetch(cacheKey, ENTITY_SEARCH_TTL_MS, async () => {
		const url = buildWikidataEntitySearchUrl(trimmed, limit);
		const fetcher = options.fetch ?? fetch;
		const data = await requestWikimediaJson<WikidataEntitySearchResponse>({
			fetcher,
			queue: entityQueue,
			breaker: entityBreaker,
			upstream: 'action',
			url,
			init: { headers: wikimediaHeaders('application/json') },
			timeoutMs: options.timeoutMs ?? DEFAULT_ENTITY_TIMEOUT_MS,
			timeoutMessage: 'Wikimedia entity suggestions took too long to answer.'
		});
		const results = Array.isArray(data.search) ? data.search : [];

		return results
			.map((item) => normalizeEntityResult(item as WikidataEntityResult))
			.filter((item): item is ExploreSubject => item !== null)
			.map((entity, index) => ({
				entity,
				index,
				score: entitySearchScore(entity, trimmed, mode)
			}))
			.sort((left, right) => right.score - left.score || left.index - right.index)
			.map(({ entity }) => entity);
	});
}

export function buildWikidataEntitySearchUrl(search: string, limit: number): URL {
	const url = new URL(WIKIDATA_ENTITY_SEARCH_URL);
	url.searchParams.set('action', 'wbsearchentities');
	url.searchParams.set('search', search);
	url.searchParams.set('language', 'en');
	url.searchParams.set('type', 'item');
	url.searchParams.set('limit', String(limit));
	url.searchParams.set('format', 'json');
	url.searchParams.set('maxlag', '5');
	url.searchParams.set('origin', '*');
	return url;
}

function normalizeEntityResult(result: WikidataEntityResult): ExploreSubject | null {
	if (typeof result.id !== 'string' || !/^Q\d+$/.test(result.id)) return null;
	if (typeof result.label !== 'string' || result.label.trim().length === 0) return null;
	return {
		id: result.id,
		label: result.label.trim(),
		description: typeof result.description === 'string' ? result.description.trim() || null : null
	};
}

function entitySearchScore(
	entity: ExploreSubject,
	search: string,
	mode: WikidataEntitySearchMode
): number {
	const label = entity.label.toLowerCase();
	const description = (entity.description ?? '').toLowerCase();
	const normalizedSearch = search.toLowerCase();
	let score = 0;

	if (label === normalizedSearch) score += 24;
	if (label.startsWith(normalizedSearch)) score += 4;
	if (mode === 'artist') {
		if (/(artist|painter|sculptor|printmaker|draughtsman|photographer|person|human)/i.test(description)) {
			score += 18;
		}
		if (/(painting|art movement|genre|type of|concept|animal|plant|building|place)/i.test(description)) {
			score -= 18;
		}
	} else if (mode === 'movement') {
		if (/(art movement|movement|style|period|school)/i.test(description)) score += 18;
		if (/(person|human|film|album|song|company|organization|sport)/i.test(description)) score -= 22;
	} else if (mode === 'genre') {
		if (/(art genre|genre|type of art|painting genre|visual art)/i.test(description)) score += 18;
		if (/(person|human|film|album|song|company|organization|sport)/i.test(description)) score -= 22;
	} else {
		if (
			/(extremity|body|forelimb|arm|leg|head|face|animal|plant|object|building|place|landform|myth|legendary|creature|reptile|bird|mammal|person|human|concept|emotion)/i.test(
				description
			)
		) {
			score += 14;
		}
	}
	if (
		/(family name|surname|given name|film|album|song|video game|record label|company|organization|journal|magazine|book series|team sport|sport|offence|character in)/i.test(
			description
		)
	) {
		score -= 32;
	}

	return score;
}
