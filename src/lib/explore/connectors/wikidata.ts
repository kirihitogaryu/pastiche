import { normalizeMedium } from '../medium';
import { uniqueExploreItemsById } from '../items';
import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import type {
	ExploreItem,
	ExploreQuery,
	ExploreRelatedPage,
	ExploreSubject,
	SourceConnector,
	WikidataSearchMode
} from '../types';
import {
	WikimediaCircuitBreaker,
	WikimediaRequestQueue,
	requestWikimediaJson,
	wikimediaHeaders
} from '../wikimedia-request';

type WikidataFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type WikidataConnectorOptions = {
	fetch?: WikidataFetch;
	requestsPerSecond?: number;
	concurrency?: number;
	sparqlRequestsPerSecond?: number;
	sparqlConcurrency?: number;
	sparqlTimeoutMs?: number;
	actionRequestsPerSecond?: number;
	actionConcurrency?: number;
	actionTimeoutMs?: number;
	cache?: ServerCache;
};

type SparqlValue = {
	value?: unknown;
};

type WikidataBinding = Record<string, SparqlValue | undefined>;

type WikidataSparqlResponse = {
	results?: {
		bindings?: unknown;
	};
};

type CommonsImageInfoResponse = {
	query?: {
		pages?: Record<string, CommonsPage>;
	};
};

type WikidataEntitySearchResponse = {
	search?: unknown;
};

type WikidataEntitySearchResult = {
	id?: unknown;
};

type CommonsPage = {
	title?: unknown;
	imageinfo?: unknown;
};

type CommonsImageInfo = {
	url?: unknown;
	thumburl?: unknown;
	width?: unknown;
	height?: unknown;
	mime?: unknown;
	extmetadata?: unknown;
};

export type WikidataRelatedSeed = {
	qid: string;
	title: string;
	year: number | null;
	creatorIds: string[];
	movementIds: string[];
	genreIds: string[];
	collectionIds: string[];
	depictsIds: string[];
	mainSubjectIds: string[];
	materialIds: string[];
	techniqueIds: string[];
};

export type WikidataConnector = SourceConnector & {
	getRelated(id: string, options?: { limit?: number; cursor?: string }): Promise<ExploreRelatedPage>;
};

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const DEFAULT_LIMIT = 20;
const SPARQL_GET_URL_LIMIT = 7500;
const DEFAULT_SPARQL_TIMEOUT_MS = 12_000;
const DEFAULT_ACTION_TIMEOUT_MS = 8_000;
const WIKIDATA_ARTWORK_TYPES = [
	'Q3305213', // painting
	'Q860861', // sculpture
	'Q93184', // drawing
	'Q219423', // fresco
	'Q22669139', // print
	'Q179700', // statue
	'Q179232', // relief
	'Q570116', // altarpiece
	'Q1183543', // sculpture series
	'Q245117', // monument
	'Q4989906', // bust
	'Q18593264' // cycle of paintings
];
const WIKIDATA_VISUAL_ARTWORK_PATTERN = `?item wdt:P31 ?visualArtworkType.
  VALUES ?visualArtworkType { ${WIKIDATA_ARTWORK_TYPES.map((qid) => `wd:${qid}`).join(' ')} }`;

export const wikidataServerCache = new ServerCache(2000);

export function createWikidataConnector(options: WikidataConnectorOptions = {}): WikidataConnector {
	const fetcher = options.fetch ?? fetch;
	const sparqlQueue = new WikimediaRequestQueue({
		concurrency: options.sparqlConcurrency ?? options.concurrency ?? 1,
		requestsPerSecond: options.sparqlRequestsPerSecond ?? options.requestsPerSecond ?? 1
	});
	const actionQueue = new WikimediaRequestQueue({
		concurrency: options.actionConcurrency ?? options.concurrency ?? 1,
		requestsPerSecond: options.actionRequestsPerSecond ?? options.requestsPerSecond ?? 2
	});
	const sparqlBreaker = new WikimediaCircuitBreaker({
		upstream: 'sparql',
		defaultCooldownSeconds: 30
	});
	const actionBreaker = new WikimediaCircuitBreaker({
		upstream: 'action',
		defaultCooldownSeconds: 15
	});
	const sparqlTimeoutMs = options.sparqlTimeoutMs ?? DEFAULT_SPARQL_TIMEOUT_MS;
	const actionTimeoutMs = options.actionTimeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
	const cache = options.cache ?? new ServerCache(2000);

	async function sparqlJson(query: string): Promise<WikidataSparqlResponse> {
		const request = buildWikidataSparqlRequest(query);
		return requestWikimediaJson<WikidataSparqlResponse>({
			fetcher,
			queue: sparqlQueue,
			breaker: sparqlBreaker,
			upstream: 'sparql',
			url: request.url,
			init: request.init,
			timeoutMs: sparqlTimeoutMs,
			timeoutMessage: 'Wikidata took too long to answer. Try a narrower subject.'
		});
	}

	async function commonsJson(url: URL): Promise<CommonsImageInfoResponse> {
		return actionJson<CommonsImageInfoResponse>(url, 'Wikimedia image metadata took too long to answer.');
	}

	async function actionJson<T>(url: URL, timeoutMessage: string): Promise<T> {
		return requestWikimediaJson<T>({
			fetcher,
			queue: actionQueue,
			breaker: actionBreaker,
			upstream: 'action',
			url,
			init: { headers: wikimediaHeaders('application/json') },
			timeoutMs: actionTimeoutMs,
			timeoutMessage
		});
	}

	async function resolveCommonsImages(items: ExploreItem[]): Promise<ExploreItem[]> {
		const filenames = uniqueStrings(
			items
				.map((item) => (item.imageUrl ? extractCommonsFilename(item.imageUrl) : null))
				.filter((filename): filename is string => filename !== null)
		);
		if (filenames.length === 0) return items;

		const response = await cache.getOrFetch(
			`commons:imageinfo:${filenames.join('|')}`,
			SERVER_OBJECT_TTL_MS,
			() => commonsJson(buildCommonsImageInfoUrl(filenames, 400))
		);
		const imageInfoByFile = parseCommonsImageInfo(response);

		return items
			.map((item) => {
				if (!item.imageUrl) return item;
				const filename = extractCommonsFilename(item.imageUrl);
				if (!filename) return item;
				const imageInfo = imageInfoByFile.get(filename);
				if (!imageInfo) return item;
				if (!commonsImageLooksLikeArtwork(item, imageInfo)) return null;
				return {
					...item,
					thumbUrl: stringOrNull(imageInfo.thumburl),
					imageUrl: stringOrNull(imageInfo.url) ?? item.imageUrl,
					isPublicDomain: commonsLicenseIsPublicDomain(imageInfo.extmetadata),
					rawMetadata: {
						...item.rawMetadata,
						commons: imageInfo
					}
				};
			})
			.filter((item): item is ExploreItem => item !== null);
	}

	async function search(query: ExploreQuery) {
		const normalizedQuery = normalizeWikidataSearchQuery(query);
		if (normalizedQuery.mode !== 'title' && normalizedQuery.entities.length === 0) {
			return { items: [], total: 0, nextCursor: null };
		}
		if (normalizedQuery.mode === 'title' && !normalizedQuery.keyword) {
			return { items: [], total: 0, nextCursor: null };
		}

		const titleCandidates =
			normalizedQuery.mode === 'title'
				? await searchWikidataTitleCandidates(normalizedQuery.keyword, query.limit)
				: null;
		if (normalizedQuery.mode === 'title' && (!titleCandidates || titleCandidates.length === 0)) {
			return { items: [], total: 0, nextCursor: null };
		}
		const sparql = titleCandidates
			? buildWikidataTitleCandidateQuery(query, titleCandidates)
			: buildWikidataSearchQuery(query);
		const response = await cache.getOrFetch(
			`wikidata:search:${hashString(sparql)}`,
			SERVER_SEARCH_TTL_MS,
			() => sparqlJson(sparql)
		);
		const bindings = Array.isArray(response.results?.bindings) ? response.results.bindings : [];
		const selectedSubjectLabels = uniqueStrings(
			normalizedQuery.entities
				.map((subject) => subject.label)
				.filter((label) => label.trim().length > 0)
		);
		const items = bindings
			.map((binding) => normalizeWikidataBinding(binding as WikidataBinding))
			.filter((item): item is ExploreItem => item !== null)
			.map((item) => ({
				...item,
				tags: item.tags.length > 0 ? item.tags : selectedSubjectLabels,
				rawMetadata: {
					...item.rawMetadata,
					wikidataMode: normalizedQuery.mode,
					selectedWikidataEntities: normalizedQuery.entities
				}
			}));
		const resolvedItems = await resolveCommonsImages(items);
		const offset = parseCursor(query.cursor);
		const limit = query.limit || DEFAULT_LIMIT;

		return {
			items: uniqueExploreItemsById(resolvedItems),
			total: null,
			nextCursor:
				titleCandidates && titleCandidates.length <= offset + limit
					? null
					: bindings.length >= limit
						? String(offset + limit)
						: null
		};
	}

	async function searchWikidataTitleCandidates(keyword: string, limit: number): Promise<string[]> {
		const trimmed = keyword.trim();
		if (trimmed.length < 2) return [];
		return cache.getOrFetch(
			`wikidata:title-candidates:${trimmed.toLowerCase()}:${limit}`,
			SERVER_OBJECT_TTL_MS,
			async () => {
				const data = await actionJson<WikidataEntitySearchResponse>(
					buildWikidataTitleSearchUrl(trimmed, Math.min(50, Math.max(limit * 2, 20))),
					'Wikidata title search took too long to answer.'
				);
				const results = Array.isArray(data.search) ? data.search : [];
				return uniqueStrings(
					results
						.map((result) => stringOrNull((result as WikidataEntitySearchResult).id))
						.filter((id): id is string => id !== null && isQid(id))
				);
			}
		);
	}

	async function getRelated(id: string, relatedOptions: { limit?: number; cursor?: string } = {}) {
		const qid = parseWikidataNativeId(id);
		if (!qid) throw new Error(`Invalid Wikidata item id: ${id}`);
		const seed = await cache.getOrFetch(`wikidata:related-seed:${qid}`, SERVER_OBJECT_TTL_MS, async () => {
			const response = await sparqlJson(buildWikidataRelatedSeedQuery(qid));
			const bindings = Array.isArray(response.results?.bindings) ? response.results.bindings : [];
			return normalizeWikidataRelatedSeed(bindings[0] as WikidataBinding, qid);
		});
		if (!seed) throw new Error(`Wikidata item not found: ${id}`);

		const limit = clampLimit(relatedOptions.limit ?? DEFAULT_LIMIT);
		const offset = parseCursor(relatedOptions.cursor);
		const sparql = buildWikidataRelatedWorksQuery(seed, { limit, cursor: relatedOptions.cursor });
		const response = await cache.getOrFetch(
			`wikidata:related:${hashString(sparql)}`,
			SERVER_SEARCH_TTL_MS,
			() => sparqlJson(sparql)
		);
		const bindings = Array.isArray(response.results?.bindings) ? response.results.bindings : [];
		const items = bindings
			.map((binding) => normalizeWikidataBinding(binding as WikidataBinding))
			.filter((item): item is ExploreItem => item !== null)
			.map((item) => {
				const reasons = pipeSeparatedStrings((item.rawMetadata.similarityReasons as string) ?? '');
				return reasons.length > 0 && item.tags.length === 0 ? { ...item, tags: reasons } : item;
			});
		const resolvedItems = await resolveCommonsImages(uniqueExploreItemsById(items));
		return {
			seedId: `wikidata-${seed.qid}`,
			title: `Similar to ${seed.title}`,
			items: resolvedItems,
			total: null,
			nextCursor: bindings.length >= limit ? String(offset + limit) : null
		};
	}

	return {
		id: 'wikidata',
		displayName: 'Wikidata',
		supportedFilters: ['depicts', 'year_range', 'has_image'],
		async getDepartments() {
			return [];
		},
		search,
		async getById(id) {
			const qid = parseWikidataNativeId(id);
			if (!qid) throw new Error(`Invalid Wikidata item id: ${id}`);
			const response = await cache.getOrFetch(`wikidata:object:${qid}`, SERVER_OBJECT_TTL_MS, () =>
				sparqlJson(buildWikidataItemQuery(qid))
			);
			const bindings = Array.isArray(response.results?.bindings) ? response.results.bindings : [];
			const item = normalizeWikidataBinding(bindings[0] as WikidataBinding);
			if (!item) throw new Error(`Wikidata item not found: ${id}`);
			return item;
		},
		getRelated
	};
}

export const wikidataConnector = createWikidataConnector({ cache: wikidataServerCache });

export function buildWikidataSparqlRequest(query: string): {
	url: URL;
	init: RequestInit;
} {
	const getUrl = new URL(WIKIDATA_SPARQL_URL);
	getUrl.searchParams.set('query', query);
	getUrl.searchParams.set('format', 'json');
	if (getUrl.toString().length <= SPARQL_GET_URL_LIMIT) {
		return {
			url: getUrl,
			init: {
				method: 'GET',
				headers: wikimediaHeaders('application/sparql-results+json')
			}
		};
	}

	return {
		url: new URL(WIKIDATA_SPARQL_URL),
		init: {
			method: 'POST',
			headers: wikimediaHeaders('application/sparql-results+json', {
				'content-type': 'application/x-www-form-urlencoded'
			}),
			body: new URLSearchParams({ query }).toString()
		}
	};
}

export function buildWikidataDepictsQuery(query: ExploreQuery): string {
	return buildWikidataSearchQuery({ ...query, wikidataMode: 'depicts' });
}

export function buildWikidataSearchQuery(query: ExploreQuery): string {
	const normalizedQuery = normalizeWikidataSearchQuery(query);
	if (normalizedQuery.mode === 'title') {
		return buildWikidataTitleQuery(query, normalizedQuery.keyword);
	}
	return buildWikidataEntityModeQuery(query, normalizedQuery.mode, normalizedQuery.entities);
}

export function buildWikidataTitleSearchUrl(search: string, limit: number): URL {
	const url = new URL(WIKIDATA_API_URL);
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

function buildWikidataEntityModeQuery(
	query: ExploreQuery,
	mode: Exclude<WikidataSearchMode, 'title'>,
	entities: ExploreSubject[]
): string {
	const limit = clampLimit(query.limit || DEFAULT_LIMIT);
	const offset = parseCursor(query.cursor);
	const property = wikidataModeProperty(mode);
	const entityTriples = entities
		.map((subject) => subject.id)
		.filter(isQid)
		.map((qid) => `  ?item ${property} wd:${qid}.`)
		.join('\n');
	const yearFilters = [
		Number.isInteger(query.yearFrom) ? `  FILTER(?year >= ${query.yearFrom})` : null,
		Number.isInteger(query.yearTo) ? `  FILTER(?year <= ${query.yearTo})` : null
	]
		.filter((line): line is string => line !== null)
		.join('\n');
	const imageFilter = query.hasImageOnly !== false ? '  FILTER(BOUND(?image))' : '';
	const imagePattern =
		query.hasImageOnly !== false
			? '  ?item wdt:P18 ?image.'
			: '  OPTIONAL { ?item wdt:P18 ?image. }';

	return `
SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?inception ?collectionLabel ?image
WHERE {
${entityTriples}
  ${WIKIDATA_VISUAL_ARTWORK_PATTERN}
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P571 ?inception. BIND(YEAR(?inception) AS ?year) }
  OPTIONAL { ?item wdt:P195 ?collection. }
${imagePattern}
${yearFilters}
${imageFilter}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

function buildWikidataTitleQuery(query: ExploreQuery, keyword: string): string {
	const limit = clampLimit(query.limit || DEFAULT_LIMIT);
	const offset = parseCursor(query.cursor);
	const escapedKeyword = sparqlString(keyword.toLowerCase());
	const yearFilters = [
		Number.isInteger(query.yearFrom) ? `  FILTER(?year >= ${query.yearFrom})` : null,
		Number.isInteger(query.yearTo) ? `  FILTER(?year <= ${query.yearTo})` : null
	]
		.filter((line): line is string => line !== null)
		.join('\n');
	const imageFilter = query.hasImageOnly !== false ? '  FILTER(BOUND(?image))' : '';
	const imagePattern =
		query.hasImageOnly !== false
			? '  ?item wdt:P18 ?image.'
			: '  OPTIONAL { ?item wdt:P18 ?image. }';

	return `
SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?inception ?collectionLabel ?image
WHERE {
  ?item rdfs:label ?itemLabel.
  ${WIKIDATA_VISUAL_ARTWORK_PATTERN}
  FILTER(LANG(?itemLabel) = "en")
  FILTER(CONTAINS(LCASE(STR(?itemLabel)), "${escapedKeyword}"))
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P571 ?inception. BIND(YEAR(?inception) AS ?year) }
  OPTIONAL { ?item wdt:P195 ?collection. }
${imagePattern}
${yearFilters}
${imageFilter}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

export function buildWikidataTitleCandidateQuery(query: ExploreQuery, qids: string[]): string {
	const limit = clampLimit(query.limit || DEFAULT_LIMIT);
	const offset = parseCursor(query.cursor);
	const values = qids.slice(offset, offset + limit).filter(isQid);
	const yearFilters = [
		Number.isInteger(query.yearFrom) ? `  FILTER(?year >= ${query.yearFrom})` : null,
		Number.isInteger(query.yearTo) ? `  FILTER(?year <= ${query.yearTo})` : null
	]
		.filter((line): line is string => line !== null)
		.join('\n');
	const imageFilter = query.hasImageOnly !== false ? '  FILTER(BOUND(?image))' : '';
	const imagePattern =
		query.hasImageOnly !== false
			? '  ?item wdt:P18 ?image.'
			: '  OPTIONAL { ?item wdt:P18 ?image. }';

	return `
SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?inception ?collectionLabel ?image
WHERE {
  VALUES ?item { ${values.map((qid) => `wd:${qid}`).join(' ')} }
  ${WIKIDATA_VISUAL_ARTWORK_PATTERN}
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P571 ?inception. BIND(YEAR(?inception) AS ?year) }
  OPTIONAL { ?item wdt:P195 ?collection. }
${imagePattern}
${yearFilters}
${imageFilter}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${limit}
`.trim();
}

function normalizeWikidataSearchQuery(query: ExploreQuery): {
	mode: WikidataSearchMode;
	entities: ExploreSubject[];
	keyword: string;
} {
	const mode = query.wikidataMode ?? 'depicts';
	const entities = query.wikidataEntities ?? query.depicts ?? [];
	return {
		mode,
		entities,
		keyword: (query.keyword ?? '').trim()
	};
}

function wikidataModeProperty(mode: Exclude<WikidataSearchMode, 'title'>): string {
	if (mode === 'main_subject') return 'wdt:P921';
	if (mode === 'artist') return 'wdt:P170';
	if (mode === 'movement') return 'wdt:P135';
	if (mode === 'genre') return 'wdt:P136';
	return 'wdt:P180';
}

function buildWikidataItemQuery(qid: string): string {
	return `
SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?inception ?collectionLabel ?image
  (GROUP_CONCAT(DISTINCT ?depictsLabel; SEPARATOR="|") AS ?allDepicts)
WHERE {
  BIND(wd:${qid} AS ?item)
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P195 ?collection. }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL {
    ?item wdt:P180 ?depicts.
    ?depicts rdfs:label ?depictsLabel.
    FILTER(LANG(?depictsLabel) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel ?creatorLabel ?inception ?collectionLabel ?image
LIMIT 1
`.trim();
}

export function buildWikidataRelatedSeedQuery(qid: string): string {
	return `
SELECT ?item ?itemLabel ?inception
  (GROUP_CONCAT(DISTINCT ?creator; SEPARATOR="|") AS ?creatorIds)
  (GROUP_CONCAT(DISTINCT ?movement; SEPARATOR="|") AS ?movementIds)
  (GROUP_CONCAT(DISTINCT ?genre; SEPARATOR="|") AS ?genreIds)
  (GROUP_CONCAT(DISTINCT ?collection; SEPARATOR="|") AS ?collectionIds)
  (GROUP_CONCAT(DISTINCT ?depicts; SEPARATOR="|") AS ?depictsIds)
  (GROUP_CONCAT(DISTINCT ?mainSubject; SEPARATOR="|") AS ?mainSubjectIds)
  (GROUP_CONCAT(DISTINCT ?material; SEPARATOR="|") AS ?materialIds)
  (GROUP_CONCAT(DISTINCT ?technique; SEPARATOR="|") AS ?techniqueIds)
WHERE {
  BIND(wd:${qid} AS ?item)
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P135 ?movement. }
  OPTIONAL { ?item wdt:P136 ?genre. }
  OPTIONAL { ?item wdt:P195 ?collection. }
  OPTIONAL { ?item wdt:P180 ?depicts. }
  OPTIONAL { ?item wdt:P921 ?mainSubject. }
  OPTIONAL { ?item wdt:P186 ?material. }
  OPTIONAL { ?item wdt:P2079 ?technique. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel ?inception
LIMIT 1
`.trim();
}

export function buildWikidataRelatedWorksQuery(
	seed: WikidataRelatedSeed,
	options: { limit?: number; cursor?: string } = {}
): string {
	const limit = clampLimit(options.limit ?? DEFAULT_LIMIT);
	const offset = parseCursor(options.cursor);
	const branches = [
		...directRelationBranches(seed.qid),
		...valuesBranches(seed.creatorIds, 'creator', 'wdt:P170', 30, 'same artist'),
		...valuesBranches(seed.mainSubjectIds, 'mainSubject', 'wdt:P921', 24, 'same main subject'),
		...valuesBranches(seed.depictsIds, 'depicts', 'wdt:P180', 16, 'overlapping subject'),
		...valuesBranches(seed.movementIds, 'movement', 'wdt:P135', 16, 'same movement'),
		...valuesBranches(seed.genreIds, 'genre', 'wdt:P136', 14, 'same genre'),
		...valuesBranches(seed.collectionIds, 'collection', 'wdt:P195', 10, 'same collection'),
		...valuesBranches(seed.materialIds, 'material', 'wdt:P186', 7, 'shared material'),
		...valuesBranches(seed.techniqueIds, 'technique', 'wdt:P2079', 7, 'shared technique')
	];
	const union = branches.join('\n  UNION\n');

	return `
SELECT ?item ?itemLabel
  (SAMPLE(?creatorLabel) AS ?creatorLabel)
  (SAMPLE(?inceptionValue) AS ?inception)
  (SAMPLE(?collectionLabel) AS ?collectionLabel)
  (SAMPLE(?imageValue) AS ?image)
  (GROUP_CONCAT(DISTINCT ?reason; SEPARATOR="|") AS ?similarityReasons)
  (SUM(?score) AS ?similarityScore)
WHERE {
  hint:Query hint:optimizer "None".
  {
${union}
  }
  ${WIKIDATA_VISUAL_ARTWORK_PATTERN}
  ?item wdt:P18 ?imageValue.
  FILTER(?item != wd:${seed.qid})
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P571 ?inceptionValue. }
  OPTIONAL { ?item wdt:P195 ?collection. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY DESC(?similarityScore) ?itemLabel
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

export function normalizeWikidataBinding(binding: WikidataBinding): ExploreItem | null {
	const itemUrl = stringOrNull(binding.item?.value);
	const qid = itemUrl?.split('/entity/')[1];
	if (!qid || !isQid(qid)) return null;

	const inception = stringOrNull(binding.inception?.value);
	const year = parseWikidataYear(inception);
	const imageUrl = stringOrNull(binding.image?.value);
	const medium = null;

	return {
		id: `wikidata-${qid}`,
		source: 'wikidata',
		detailUrl: `https://www.wikidata.org/wiki/${qid}`,
		title: stringOrNull(binding.itemLabel?.value) ?? qid,
		artistRaw: stringOrNull(binding.creatorLabel?.value),
		artistBio: null,
		artistNationality: null,
		dateDisplay: year === null ? null : String(year),
		yearStart: year,
		yearEnd: year,
		medium,
		mediumCategory: normalizeMedium(medium),
		objectName: 'Painting',
		department: stringOrNull(binding.collectionLabel?.value),
		culture: null,
		period: null,
		thumbUrl: null,
		imageUrl,
		additionalImages: [],
		isIIIF: false,
		description: null,
		tags: pipeSeparatedStrings(binding.allDepicts?.value),
		isHighlight: false,
		isPublicDomain: null,
		rawMetadata: {
			qid,
			wikidataUrl: itemUrl,
			commonsFilePath: imageUrl,
			similarityReasons: stringOrNull(binding.similarityReasons?.value),
			similarityScore: numberOrNull(binding.similarityScore?.value)
		}
	};
}

function normalizeWikidataRelatedSeed(
	binding: WikidataBinding | undefined,
	fallbackQid: string
): WikidataRelatedSeed | null {
	if (!binding) return null;
	const itemUrl = stringOrNull(binding.item?.value);
	const qid = itemUrl?.split('/entity/')[1] ?? fallbackQid;
	if (!isQid(qid)) return null;
	return {
		qid,
		title: stringOrNull(binding.itemLabel?.value) ?? qid,
		year: parseWikidataYear(stringOrNull(binding.inception?.value)),
		creatorIds: entityIdsFromGroup(binding.creatorIds?.value),
		movementIds: entityIdsFromGroup(binding.movementIds?.value),
		genreIds: entityIdsFromGroup(binding.genreIds?.value),
		collectionIds: entityIdsFromGroup(binding.collectionIds?.value),
		depictsIds: entityIdsFromGroup(binding.depictsIds?.value),
		mainSubjectIds: entityIdsFromGroup(binding.mainSubjectIds?.value),
		materialIds: entityIdsFromGroup(binding.materialIds?.value),
		techniqueIds: entityIdsFromGroup(binding.techniqueIds?.value)
	};
}

function directRelationBranches(qid: string): string[] {
	return [
		graphBranch(`wd:${qid} wdt:P144 ?item. BIND(100 AS ?score) BIND("source work" AS ?reason)`),
		graphBranch(`?item wdt:P144 wd:${qid}. BIND(100 AS ?score) BIND("based on this work" AS ?reason)`),
		graphBranch(`wd:${qid} wdt:P4969 ?item. BIND(100 AS ?score) BIND("derivative work" AS ?reason)`),
		graphBranch(`?item wdt:P4969 wd:${qid}. BIND(100 AS ?score) BIND("related derivative" AS ?reason)`),
		graphBranch(`wd:${qid} wdt:P1639 ?item. BIND(95 AS ?score) BIND("pendant work" AS ?reason)`),
		graphBranch(`?item wdt:P1639 wd:${qid}. BIND(95 AS ?score) BIND("pendant work" AS ?reason)`),
		graphBranch(`wd:${qid} wdt:P6606 ?item. BIND(95 AS ?score) BIND("study or design" AS ?reason)`),
		graphBranch(`?item wdt:P6606 wd:${qid}. BIND(95 AS ?score) BIND("study or design" AS ?reason)`),
		graphBranch(`wd:${qid} wdt:P179 ?series. ?item wdt:P179 ?series. BIND(80 AS ?score) BIND("same series" AS ?reason)`),
		graphBranch(`wd:${qid} wdt:P180 ?item. BIND(75 AS ?score) BIND("depicted in this work" AS ?reason)`),
		graphBranch(`?item wdt:P180 wd:${qid}. BIND(75 AS ?score) BIND("depicts this work" AS ?reason)`)
	];
}

function valuesBranches(
	qids: string[],
	variable: string,
	property: string,
	score: number,
	reason: string
): string[] {
	if (qids.length === 0) return [];
	const values = qids.slice(0, 10);
	return [
		graphBranch(
			`VALUES ?${variable} { ${values.map((qid) => `wd:${qid}`).join(' ')} }\n      ?item ${property} ?${variable}.\n      BIND(${score} AS ?score) BIND("${reason}" AS ?reason)`
		)
	];
}

function graphBranch(pattern: string): string {
	return `  {
    SELECT DISTINCT ?item ?score ?reason WHERE {
      hint:Query hint:optimizer "None".
      ${pattern}
      ${WIKIDATA_VISUAL_ARTWORK_PATTERN}
      ?item wdt:P18 ?candidateImage.
    }
    LIMIT 80
  }`;
}

function entityIdsFromGroup(value: unknown): string[] {
	const raw = pipeSeparatedStrings(value);
	return uniqueStrings(
		raw
			.map((item) => item.split('/entity/')[1] ?? item)
			.filter(isQid)
	);
}

function numberOrNull(value: unknown): number | null {
	const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isFinite(parsed) ? parsed : null;
}

export function extractCommonsFilename(value: string): string | null {
	const marker = '/Special:FilePath/';
	const markerIndex = value.indexOf(marker);
	if (markerIndex === -1) return null;
	const raw = value.slice(markerIndex + marker.length);
	if (!raw) return null;
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

export function buildCommonsImageInfoUrl(filenames: string[], width: number): URL {
	const url = new URL(COMMONS_API_URL);
	url.searchParams.set('action', 'query');
	url.searchParams.set('titles', filenames.map((filename) => `File:${filename}`).join('|'));
	url.searchParams.set('prop', 'imageinfo');
	url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
	url.searchParams.set('iiurlwidth', String(width));
	url.searchParams.set('format', 'json');
	url.searchParams.set('maxlag', '5');
	url.searchParams.set('origin', '*');
	return url;
}

export function parseWikidataNativeId(id: string): string | null {
	const raw = id.startsWith('wikidata-') ? id.slice(9) : id;
	return isQid(raw) ? raw : null;
}

function parseCommonsImageInfo(response: CommonsImageInfoResponse): Map<string, CommonsImageInfo> {
	const pages = Object.values(response.query?.pages ?? {});
	const entries = pages
		.map((page) => {
			const title = stringOrNull(page.title);
			const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
			if (!title || !isRecord(imageInfo)) return null;
			const filename = title.startsWith('File:') ? title.slice(5) : title;
			return [filename, imageInfo as CommonsImageInfo] as const;
		})
		.filter((entry): entry is readonly [string, CommonsImageInfo] => entry !== null);
	return new Map(entries);
}

function commonsLicenseIsPublicDomain(extmetadata: unknown): boolean | null {
	if (!isRecord(extmetadata)) return null;
	const license = stringOrNull(readExtMetadataValue(extmetadata.LicenseShortName));
	if (!license) return null;
	return /public domain|cc0/i.test(license);
}

function commonsImageLooksLikeArtwork(item: ExploreItem, imageInfo: CommonsImageInfo): boolean {
	const metadata = imageInfo.extmetadata;
	if (!isRecord(metadata)) return true;
	if (!commonsArtistMatchesSelectedArtist(item, metadata)) return false;
	const text = [
		item.title,
		readExtMetadataValue(metadata.ObjectName),
		readExtMetadataValue(metadata.ImageDescription),
		readExtMetadataValue(metadata.Categories),
		readExtMetadataValue(metadata.Artist),
		readExtMetadataValue(metadata.Credit)
	]
		.map((value) => (typeof value === 'string' ? stripHtml(value).toLowerCase() : ''))
		.join(' | ');
	if (!text.trim()) return true;

	const positiveArtworkSignal =
		/\b(painting|paintings|portrait paintings|landscape painting|oil on canvas|watercolor|watercolour|tempera|fresco|drawing|print|engraving|lithograph|artwork|work of art)\b/i.test(
			text
		);
	const photoOrContextSignal =
		/\b(museum interiors?|art exhibitions?|gallery|galleries|visitors?|flickr images?|photographs?|taken with|mountains in|landscapes? in|streets? in|buildings? in|interiors? of)\b/i.test(
			text
		);
	const artworkInContextSignal =
		/\b(mural|public art|street art|sculpture|statue|installation)\b/i.test(text);

	if (artworkInContextSignal) return true;
	if (positiveArtworkSignal && !photoOrContextSignal) return true;
	if (photoOrContextSignal) return false;
	return true;
}

function commonsArtistMatchesSelectedArtist(
	item: ExploreItem,
	metadata: Record<string, unknown>
): boolean {
	if (item.rawMetadata.wikidataMode !== 'artist') return true;
	const selected = Array.isArray(item.rawMetadata.selectedWikidataEntities)
		? item.rawMetadata.selectedWikidataEntities
		: [];
	const selectedLabels = selected
		.map((entity) => (isRecord(entity) ? stringOrNull(entity.label) : null))
		.filter((label): label is string => label !== null)
		.map((label) => label.toLowerCase());
	if (selectedLabels.length === 0) return true;
	const descriptiveText = [
		item.title,
		readExtMetadataValue(metadata.ObjectName),
		readExtMetadataValue(metadata.ImageDescription),
		readExtMetadataValue(metadata.Categories),
		readExtMetadataValue(metadata.Credit)
	]
		.map((value) => (typeof value === 'string' ? stripHtml(value).toLowerCase() : ''))
		.join(' | ');
	if (selectedLabels.some((label) => descriptiveText.includes(label))) return true;
	const commonsArtist = stringOrNull(readExtMetadataValue(metadata.Artist));
	if (!commonsArtist) return true;
	const normalizedArtist = stripHtml(commonsArtist).toLowerCase();
	return selectedLabels.some(
		(label) => normalizedArtist.includes(label) || label.includes(normalizedArtist)
	);
}

function readExtMetadataValue(value: unknown): unknown {
	return isRecord(value) ? value.value : null;
}

function stripHtml(value: string): string {
	return value.replace(/<[^>]*>/g, ' ');
}

function parseWikidataYear(value: string | null): number | null {
	if (!value) return null;
	const match = /^(-?\d+)/.exec(value);
	if (!match) return null;
	const year = Number(match[1]);
	return Number.isFinite(year) ? year : null;
}

function parseCursor(cursor: string | undefined): number {
	if (!cursor) return 0;
	const parsed = Number(cursor);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function clampLimit(limit: number): number {
	if (!Number.isInteger(limit)) return DEFAULT_LIMIT;
	return Math.min(100, Math.max(1, limit));
}

function stringOrNull(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function pipeSeparatedStrings(value: unknown): string[] {
	const raw = stringOrNull(value);
	if (!raw) return [];
	return uniqueStrings(
		raw
			.split('|')
			.map((item) => item.trim())
			.filter((item) => item.length > 0)
	);
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		unique.push(value);
	}
	return unique;
}

function isQid(value: string): boolean {
	return /^Q\d+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function sparqlString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hashString(value: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}
