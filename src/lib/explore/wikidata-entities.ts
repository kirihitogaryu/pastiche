import type { ExploreSubject, WikidataSearchMode } from './types';
import { ServerCache } from './server-cache';
import {
	WikimediaCircuitBreaker,
	WikimediaRequestQueue,
	isWikimediaTemporaryError,
	requestWikimediaJson,
	wikimediaHeaders
} from './wikimedia-request';

type SearchOptions = {
	limit?: number;
	mode?: WikidataEntitySearchMode;
	context?: WikidataEntitySearchContext;
	fetch?: typeof fetch;
	timeoutMs?: number;
	cache?: ServerCache;
};

type WikidataEntitySearchResponse = {
	search?: unknown;
};

type WikidataSparqlResponse = {
	results?: {
		bindings?: unknown;
	};
};

type WikidataEntityResult = {
	id?: unknown;
	label?: unknown;
	description?: unknown;
};

const WIKIDATA_ENTITY_SEARCH_URL = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const ENTITY_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENTITY_TIMEOUT_MS = 6_000;
export type WikidataEntitySearchMode = Exclude<WikidataSearchMode, 'title'>;
export type WikidataEntitySearchContext = 'art' | 'reference';

export const wikidataEntityServerCache = new ServerCache(1000);
const entityQueue = new WikimediaRequestQueue({ concurrency: 1, requestsPerSecond: 2 });
const entitySparqlQueue = new WikimediaRequestQueue({ concurrency: 1, requestsPerSecond: 1 });
const entityBreaker = new WikimediaCircuitBreaker({
	upstream: 'action',
	defaultCooldownSeconds: 15
});
const entitySparqlBreaker = new WikimediaCircuitBreaker({
	upstream: 'sparql',
	defaultCooldownSeconds: 30
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
		const candidateLimit = Math.max(limit * 3, 24);
		const url = buildWikidataEntitySearchUrl(trimmed, candidateLimit);
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
		const candidates = results
			.map((item) => normalizeEntityResult(item as WikidataEntityResult))
			.filter((item): item is ExploreSubject => item !== null);
		const context = options.context ?? 'art';
		const relevantCandidates =
			context === 'reference' ? candidates : filterLexicallyRelevantCandidates(candidates, trimmed);
		if (context === 'reference') {
			return rankEntityCandidates(relevantCandidates, trimmed, mode, undefined, context)
				.slice(0, limit)
				.map(({ entity }) => entity);
		}
		let usageById: Map<string, number>;
		try {
			usageById = await fetchEntityArtworkUsage(relevantCandidates, mode, {
				fetcher,
				timeoutMs: options.timeoutMs ?? DEFAULT_ENTITY_TIMEOUT_MS
			});
		} catch (error) {
			if (isWikimediaTemporaryError(error)) {
				return rankEntityCandidates(relevantCandidates, trimmed, mode)
					.slice(0, limit)
					.map(({ entity }) => entity);
			}
			throw error;
		}

		return rankEntityCandidates(
			relevantCandidates.filter((entity) => usageById.has(entity.id)),
			trimmed,
			mode,
			usageById,
			context
		)
			.slice(0, limit)
			.map(({ entity }) => entity);
	});
}

function rankEntityCandidates(
	entities: ExploreSubject[],
	search: string,
	mode: WikidataEntitySearchMode,
	usageById = new Map<string, number>(),
	context: WikidataEntitySearchContext = 'art'
) {
	return entities
		.map((entity, index) => ({
			entity,
			index,
			score: entitySearchScore(entity, search, mode, context) + Math.min(24, usageById.get(entity.id) ?? 0)
		}))
		.sort((left, right) => right.score - left.score || left.index - right.index);
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

export function buildWikidataEntityUsageQuery(
	entities: ExploreSubject[],
	mode: WikidataEntitySearchMode
): string {
	const property = wikidataModeProperty(mode);
	const qids = entities.map((entity) => entity.id).filter(isQid);
	return `
SELECT ?entity (COUNT(DISTINCT ?item) AS ?usage)
WHERE {
  VALUES ?entity { ${qids.map((qid) => `wd:${qid}`).join(' ')} }
  ?item ${property} ?entity.
  ?item wdt:P18 ?image.
}
GROUP BY ?entity
`.trim();
}

async function fetchEntityArtworkUsage(
	entities: ExploreSubject[],
	mode: WikidataEntitySearchMode,
	options: { fetcher: typeof fetch; timeoutMs: number }
): Promise<Map<string, number>> {
	if (entities.length === 0) return new Map();
	const url = new URL(WIKIDATA_SPARQL_URL);
	url.searchParams.set('format', 'json');
	url.searchParams.set('query', buildWikidataEntityUsageQuery(entities, mode));
	const data = await requestWikimediaJson<WikidataSparqlResponse>({
		fetcher: options.fetcher,
		queue: entitySparqlQueue,
		breaker: entitySparqlBreaker,
		upstream: 'sparql',
		url,
		init: { headers: wikimediaHeaders('application/sparql-results+json') },
		timeoutMs: options.timeoutMs,
		timeoutMessage: 'Wikimedia entity suggestions took too long to verify.'
	});
	const bindings = Array.isArray(data.results?.bindings) ? data.results.bindings : [];
	return new Map(
		bindings
			.map((binding) => {
				if (!isRecord(binding)) return null;
				const entityUrl = stringValue(binding.entity);
				const qid = entityUrl?.split('/entity/')[1];
				const usage = Number(stringValue(binding.usage) ?? 1);
				if (!qid || !isQid(qid) || !Number.isFinite(usage) || usage <= 0) return null;
				return [qid, usage] as const;
			})
			.filter((entry): entry is readonly [string, number] => entry !== null)
	);
}

function wikidataModeProperty(mode: WikidataEntitySearchMode): string {
	if (mode === 'main_subject') return 'wdt:P921';
	if (mode === 'artist') return 'wdt:P170';
	if (mode === 'movement') return 'wdt:P135';
	if (mode === 'genre') return 'wdt:P136';
	return 'wdt:P180';
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

function filterLexicallyRelevantCandidates(
	candidates: ExploreSubject[],
	search: string
): ExploreSubject[] {
	const normalizedSearch = normalizeSearchText(search);
	const relevant = candidates.filter((entity) => {
		const label = normalizeSearchText(entity.label);
		return label.includes(normalizedSearch) || normalizedSearch.includes(label);
	});
	return relevant.length > 0 ? relevant : candidates;
}

function entitySearchScore(
	entity: ExploreSubject,
	search: string,
	mode: WikidataEntitySearchMode,
	context: WikidataEntitySearchContext = 'art'
): number {
	const label = entity.label.toLowerCase();
	const description = (entity.description ?? '').toLowerCase();
	const normalizedSearch = search.toLowerCase();
	let score = 0;

	if (label === normalizedSearch) score += 24;
	if (label.startsWith(normalizedSearch)) score += 4;
	if (mode === 'artist') {
		if (/(painter|sculptor|printmaker|draughtsman|visual artist|artist)/i.test(description)) {
			score += 38;
		} else if (/(photographer|designer|illustrator|person|human)/i.test(description)) {
			score += 12;
		}
		if (
			/(fictional character|character|given name|family name|surname|politician|physicist|actor|pornographic|drug lord|record label|painting|art movement|genre|type of|concept|animal|plant|building|place)/i.test(
				description
			)
		) {
			score -= 36;
		}
	} else if (mode === 'movement') {
		if (/(art movement|movement|style|period|school)/i.test(description)) score += 18;
		if (/(person|human|film|album|song|company|organization|sport)/i.test(description)) score -= 22;
	} else if (mode === 'genre') {
		if (/(art genre|genre|type of art|painting genre|visual art)/i.test(description)) score += 18;
		if (/(person|human|film|album|song|company|organization|sport)/i.test(description)) score -= 22;
	} else {
		if (
			/(extremity|body|forelimb|arm|leg|head|face|animal|plant|object|building|place|landform|myth|legendary|creature|reptile|bird|mammal|person|human|concept|emotion|taxon|species|subspecies|genus|family|snake)/i.test(
				description
			)
		) {
			score += 14;
		}
		if (context === 'reference') {
			if (/(taxon|species|subspecies|genus|family|reptile|snake|animal|mammal|bird|plant)/i.test(description)) {
				score += 28;
			}
			if (/(programming language|software|software library|computer|ship|missile|family name|given name)/i.test(description)) {
				score -= 34;
			}
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | null {
	if (!isRecord(value) || typeof value.value !== 'string') return null;
	return value.value;
}

function isQid(value: string): boolean {
	return /^Q\d+$/.test(value);
}

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/\s+/g, ' ')
		.trim();
}
