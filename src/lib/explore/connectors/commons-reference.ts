import { ServerCache, SERVER_OBJECT_TTL_MS, SERVER_SEARCH_TTL_MS } from '../server-cache';
import type {
	ExploreItem,
	ExplorePage,
	ExploreQuery,
	WikimediaReferenceFilters,
	WikimediaReferenceFormat,
	WikimediaReferenceQualifier,
	WikimediaReferenceSubject,
	WikimediaReferenceToken
} from '../types';
import {
	WikimediaCircuitBreaker,
	WikimediaRequestQueue,
	isWikimediaTemporaryError,
	requestWikimediaJson,
	wikimediaHeaders
} from '../wikimedia-request';

type CommonsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type CommonsReferenceOptions = {
	fetch?: CommonsFetch;
	cache?: ServerCache;
	concurrency?: number;
	requestsPerSecond?: number;
	timeoutMs?: number;
};

type CommonsSearchResponse = {
	query?: {
		search?: unknown;
	};
};

type CommonsCategoryMembersResponse = {
	query?: {
		categorymembers?: unknown;
	};
};

type CommonsImageInfoResponse = {
	query?: {
		pages?: Record<string, CommonsImagePage>;
	};
};

type CommonsImagePage = {
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

type CommonsCandidate = {
	title: string;
	lane: 'category' | 'main_subject' | 'structured' | 'title' | 'text';
	score: number;
	matchedCategory: string | null;
	matchedTokens: string[];
};

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const DEFAULT_LIMIT = 20;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_FILTERS: WikimediaReferenceFilters = {
	subjects: [],
	qualifiers: [],
	formats: [
		'photograph',
		'artwork',
		'illustration',
		'printmaking',
		'poster',
		'sculpture_object',
		'texture'
	],
	quality: 'valued',
	includeWikidataArt: true,
	includeCommonsStructured: true,
	includeCommonsCategories: true,
	includeCommonsText: true,
	excludeSvg: true,
	minResolution: 'standard'
};

type ReferenceFilterConfig = {
	label: string;
	terms: string[];
	categories: string[];
	formats?: WikimediaReferenceFormat[];
};

const SUBJECT_FILTERS: Record<WikimediaReferenceSubject, ReferenceFilterConfig> = {
	animals: {
		label: 'Animals',
		terms: ['animal', 'wildlife', 'mammal', 'bird', 'reptile'],
		categories: ['Category:Animal photographs', 'Category:Mammals', 'Category:Birds']
	},
	plants: {
		label: 'Plants',
		terms: ['plant', 'flower', 'tree', 'botanical'],
		categories: ['Category:Plants', 'Category:Botanical illustrations', 'Category:Flowers']
	},
	marine_life: {
		label: 'Marine life',
		terms: ['marine life', 'fish', 'sea animal', 'aquatic animal'],
		categories: ['Category:Marine life', 'Category:Fish', 'Category:Marine animals']
	},
	insects: {
		label: 'Insects',
		terms: ['insect', 'beetle', 'butterfly', 'macro'],
		categories: ['Category:Insects', 'Category:Butterflies', 'Category:Beetles']
	},
	landscapes: {
		label: 'Landscapes',
		terms: ['landscape', 'mountain', 'forest', 'valley'],
		categories: ['Category:Landscapes', 'Category:Mountains', 'Category:Forests']
	},
	water_sky: {
		label: 'Water & sky',
		terms: ['water', 'sky', 'cloud', 'ocean', 'river'],
		categories: ['Category:Skies', 'Category:Clouds', 'Category:Bodies of water']
	},
	architecture: {
		label: 'Architecture',
		terms: ['architecture', 'building', 'interior', 'ruin'],
		categories: ['Category:Architecture', 'Category:Buildings', 'Category:Interiors']
	},
	textures: {
		label: 'Textures',
		terms: ['texture', 'surface', 'stone texture', 'wood texture', 'fabric texture'],
		categories: ['Category:Textures', 'Category:Wood textures', 'Category:Stone surfaces'],
		formats: ['texture']
	},
	figure: {
		label: 'Figure',
		terms: ['human figure', 'full figure', 'figure study', 'academic figure'],
		categories: ['Category:Human figures', 'Category:Figure studies', 'Category:People']
	},
	faces: {
		label: 'Faces',
		terms: ['face', 'portrait', 'head', 'expression'],
		categories: ['Category:Human faces', 'Category:Portraits', 'Category:Heads']
	},
	body_parts: {
		label: 'Body parts',
		terms: ['hand', 'foot', 'body part', 'anatomy'],
		categories: ['Category:Hands', 'Category:Feet', 'Category:Anatomical illustrations']
	},
	pose_motion: {
		label: 'Pose & motion',
		terms: ['pose', 'motion', 'dancer', 'athlete', 'gesture'],
		categories: ['Category:Dancers', 'Category:Athletes', 'Category:Human positions']
	},
	drapery: {
		label: 'Drapery',
		terms: ['drapery', 'fabric folds', 'costume', 'clothing folds'],
		categories: ['Category:Drapery', 'Category:Clothing', 'Category:Costumes']
	}
};

const QUALIFIER_FILTERS: Record<WikimediaReferenceQualifier, ReferenceFilterConfig> = {
	paintings: {
		label: 'Paintings',
		terms: ['painting', 'oil painting'],
		categories: ['Category:Paintings'],
		formats: ['artwork']
	},
	drawings_sketches: {
		label: 'Drawings & sketches',
		terms: ['drawing', 'sketch'],
		categories: ['Category:Drawings', 'Category:Sketches'],
		formats: ['illustration', 'artwork']
	},
	watercolors: {
		label: 'Watercolors',
		terms: ['watercolor', 'watercolour'],
		categories: ['Category:Watercolor paintings', 'Category:Watercolours'],
		formats: ['artwork', 'illustration']
	},
	sculpture: {
		label: 'Sculpture',
		terms: ['sculpture', 'statue'],
		categories: ['Category:Sculptures', 'Category:Statues'],
		formats: ['sculpture_object', 'artwork']
	},
	ceramics_craft: {
		label: 'Ceramics & craft',
		terms: ['ceramic', 'pottery', 'craft object', 'decorative art'],
		categories: ['Category:Ceramics', 'Category:Pottery', 'Category:Decorative arts'],
		formats: ['sculpture_object', 'artwork']
	},
	baroque: {
		label: 'Baroque',
		terms: ['baroque'],
		categories: ['Category:Baroque art', 'Category:Baroque paintings'],
		formats: ['artwork']
	},
	dutch_golden_age: {
		label: 'Dutch Golden Age',
		terms: ['Dutch Golden Age', 'baroque'],
		categories: ['Category:Dutch Golden Age paintings', 'Category:Baroque paintings'],
		formats: ['artwork']
	},
	renaissance: {
		label: 'Renaissance',
		terms: ['renaissance'],
		categories: ['Category:Renaissance art', 'Category:Renaissance paintings'],
		formats: ['artwork']
	},
	romanticism: {
		label: 'Romanticism',
		terms: ['romanticism'],
		categories: ['Category:Romanticism', 'Category:Romantic paintings'],
		formats: ['artwork']
	},
	realism: {
		label: 'Realism',
		terms: ['realism'],
		categories: ['Category:Realist paintings', 'Category:Realism in art'],
		formats: ['artwork']
	},
	neoclassicism: {
		label: 'Neoclassicism',
		terms: ['neoclassicism', 'neoclassical'],
		categories: ['Category:Neoclassical paintings', 'Category:Neoclassicism'],
		formats: ['artwork']
	},
	impressionism: {
		label: 'Impressionism',
		terms: ['impressionism', 'impressionist'],
		categories: ['Category:Impressionist paintings', 'Category:Impressionism'],
		formats: ['artwork']
	},
	post_impressionism: {
		label: 'Post-Impressionism',
		terms: ['post-impressionism', 'post impressionist'],
		categories: ['Category:Post-Impressionist paintings', 'Category:Post-Impressionism'],
		formats: ['artwork']
	},
	symbolism: {
		label: 'Symbolism',
		terms: ['symbolism', 'symbolist'],
		categories: ['Category:Symbolist paintings', 'Category:Symbolism in art'],
		formats: ['artwork']
	},
	art_nouveau: {
		label: 'Art Nouveau',
		terms: ['art nouveau'],
		categories: ['Category:Art Nouveau', 'Category:Art Nouveau paintings'],
		formats: ['artwork', 'poster']
	},
	rococo: {
		label: 'Rococo',
		terms: ['rococo'],
		categories: ['Category:Rococo paintings', 'Category:Rococo'],
		formats: ['artwork']
	},
	mannerism: {
		label: 'Mannerism',
		terms: ['mannerism', 'mannerist'],
		categories: ['Category:Mannerist paintings', 'Category:Mannerism'],
		formats: ['artwork']
	},
	ukiyo_e: {
		label: 'Ukiyo-e',
		terms: ['ukiyo-e', 'ukiyo e', 'Japanese woodblock print'],
		categories: ['Category:Ukiyo-e', 'Category:Japanese woodblock prints'],
		formats: ['printmaking', 'artwork']
	},
	woodcuts: {
		label: 'Woodcuts',
		terms: ['woodcut', 'woodblock print'],
		categories: ['Category:Woodcuts', 'Category:Woodblock prints'],
		formats: ['printmaking']
	},
	engravings: {
		label: 'Engravings',
		terms: ['engraving'],
		categories: ['Category:Engravings'],
		formats: ['printmaking']
	},
	etchings: {
		label: 'Etchings',
		terms: ['etching'],
		categories: ['Category:Etchings'],
		formats: ['printmaking']
	},
	lithographs: {
		label: 'Lithographs',
		terms: ['lithograph'],
		categories: ['Category:Lithographs'],
		formats: ['printmaking']
	},
	pen_ink: {
		label: 'Pen & ink',
		terms: ['pen and ink', 'ink drawing'],
		categories: ['Category:Ink drawings'],
		formats: ['printmaking', 'illustration']
	},
	charcoal: {
		label: 'Charcoal',
		terms: ['charcoal drawing'],
		categories: ['Category:Charcoal drawings'],
		formats: ['illustration', 'artwork']
	},
	pastel: {
		label: 'Pastel',
		terms: ['pastel drawing', 'pastel'],
		categories: ['Category:Pastels'],
		formats: ['illustration', 'artwork']
	},
	botanical: {
		label: 'Botanical',
		terms: ['botanical illustration', 'plant illustration'],
		categories: ['Category:Botanical illustrations'],
		formats: ['illustration']
	},
	natural_history: {
		label: 'Natural history',
		terms: ['natural history illustration', 'zoological illustration'],
		categories: ['Category:Natural history illustrations', 'Category:Zoological illustrations'],
		formats: ['illustration']
	},
	anatomical: {
		label: 'Anatomical',
		terms: ['anatomical illustration', 'anatomy diagram'],
		categories: ['Category:Anatomical illustrations', 'Category:Anatomical diagrams'],
		formats: ['illustration', 'diagram']
	},
	book_periodical: {
		label: 'Book & periodical',
		terms: ['book illustration', 'periodical illustration', 'magazine illustration'],
		categories: ['Category:Book illustrations', 'Category:Magazine illustrations'],
		formats: ['illustration']
	},
	decorative_ornamental: {
		label: 'Decorative & ornamental',
		terms: ['ornament', 'decorative illustration', 'ornamental design'],
		categories: ['Category:Ornaments', 'Category:Decorative arts'],
		formats: ['illustration', 'artwork']
	},
	travel_tourism: {
		label: 'Travel & tourism',
		terms: ['travel poster', 'tourism poster'],
		categories: ['Category:Travel posters'],
		formats: ['poster']
	},
	advertising: {
		label: 'Advertising',
		terms: ['advertising poster', 'advertisement'],
		categories: ['Category:Advertising posters', 'Category:Advertisements'],
		formats: ['poster']
	},
	propaganda_war: {
		label: 'Propaganda & war',
		terms: ['propaganda poster', 'war poster'],
		categories: ['Category:Propaganda posters', 'Category:War posters'],
		formats: ['poster']
	},
	art_nouveau_posters: {
		label: 'Art Nouveau posters',
		terms: ['art nouveau poster'],
		categories: ['Category:Art Nouveau posters'],
		formats: ['poster', 'artwork']
	},
	documentary: {
		label: 'Documentary',
		terms: ['documentary photograph', 'documentary photography'],
		categories: ['Category:Documentary photography'],
		formats: ['photograph']
	},
	scientific_natural_history: {
		label: 'Scientific & natural history',
		terms: ['scientific photograph', 'natural history photograph'],
		categories: ['Category:Scientific photographs', 'Category:Natural history photographs'],
		formats: ['photograph']
	},
	production_publicity_stills: {
		label: 'Production & publicity stills',
		terms: ['publicity still', 'production still'],
		categories: ['Category:Publicity photographs', 'Category:Film stills'],
		formats: ['photograph']
	}
};

export function createCommonsReferenceConnector(options: CommonsReferenceOptions = {}) {
	const fetcher = options.fetch ?? fetch;
	const queue = new WikimediaRequestQueue({
		concurrency: options.concurrency ?? 2,
		requestsPerSecond: options.requestsPerSecond ?? 2
	});
	const breaker = new WikimediaCircuitBreaker({
		upstream: 'action',
		defaultCooldownSeconds: 15
	});
	const cache = options.cache ?? new ServerCache(1000);
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	async function actionJson<T>(url: URL, timeoutMessage: string): Promise<T> {
		return requestWikimediaJson<T>({
			fetcher,
			queue,
			breaker,
			upstream: 'action',
			url,
			init: { headers: wikimediaHeaders('application/json') },
			timeoutMs,
			timeoutMessage
		});
	}

	async function search(query: ExploreQuery): Promise<ExplorePage> {
		const filters = normalizeReferenceFilters(query.wikimediaReferenceFilters);
		const tokens = normalizeReferenceTokens(query);
		if (tokens.length === 0 && !hasReferenceFilterSearch(filters)) {
			return { items: [], total: 0, nextCursor: null };
		}

		const limit = clampLimit(query.limit || DEFAULT_LIMIT);
		const offset = parseCursor(query.cursor);
		const candidates = await collectCandidates(tokens, filters, limit + offset);
		const uniqueCandidates = uniqueCandidatesByTitle(candidates);
		const pageCandidates = uniqueCandidates.slice(offset, offset + limit);
		const imageInfoByTitle = await fetchImageInfo(
			pageCandidates.map((candidate) => candidate.title)
		);
		const items = pageCandidates
			.map((candidate) =>
				normalizeCandidate(candidate, imageInfoByTitle.get(candidate.title), filters)
			)
			.filter((item): item is ExploreItem => item !== null);

		return {
			items,
			total: null,
			nextCursor: uniqueCandidates.length > offset + limit ? String(offset + limit) : null
		};
	}

	async function getById(id: string): Promise<ExploreItem> {
		const title = commonsTitleFromExploreId(id);
		if (!title) throw new Error(`Invalid Commons reference id: ${id}`);
		const imageInfoByTitle = await fetchImageInfo([title]);
		const item = normalizeCandidate(
			{
				title,
				lane: 'text',
				score: 0,
				matchedCategory: null,
				matchedTokens: []
			},
			imageInfoByTitle.get(title),
			DEFAULT_FILTERS
		);
		if (!item) throw new Error(`Commons reference item not found: ${id}`);
		return item;
	}

	async function collectCandidates(
		tokens: WikimediaReferenceToken[],
		filters: WikimediaReferenceFilters,
		limit: number
	): Promise<CommonsCandidate[]> {
		const entity = primaryEntity(tokens);
		const textTokens = tokens.filter((token) => token.kind === 'text');
		const phrases = buildReferencePhrases(tokens, filters);
		const tasks: Array<Promise<CommonsCandidate[]>> = [];

		if (filters.includeCommonsCategories) {
			for (const phrase of phrases.slice(0, 4)) {
				tasks.push(searchCategories(phrase, tokens, filters, limit));
			}
			if (!entity) {
				for (const category of referenceFilterCategories(filters).slice(0, 6)) {
					tasks.push(searchCategoryMembers(category, tokens, filters, limit, 260));
				}
			}
		}
		if (filters.includeCommonsStructured && entity) {
			const structuredPhrase = [textTokens.map((token) => token.value).join(' '), entity.label]
				.filter(Boolean)
				.join(' ')
				.trim();
			tasks.push(
				searchFiles(
					`${structuredPhrase ? `${structuredPhrase} ` : ''}haswbstatement:P921=${entity.id}`,
					'main_subject',
					64,
					null,
					tokens,
					filters
				)
			);
			tasks.push(
				searchFiles(
					`${structuredPhrase ? `${structuredPhrase} ` : ''}haswbstatement:P180=${entity.id}`,
					'structured',
					64,
					null,
					tokens,
					filters
				)
			);
		}
		if (filters.includeCommonsText) {
			for (const textPhrase of phrases.slice(0, 5)) {
				if (textPhrase) {
					tasks.push(
						searchFiles(
							`intitle:"${escapeSearchPhrase(textPhrase)}"`,
							'title',
							48,
							null,
							tokens,
							filters
						)
					);
					tasks.push(searchFiles(textPhrase, 'text', 32, null, tokens, filters));
				}
			}
		}

		const settled = await Promise.all(
			tasks.map((task) =>
				task.catch((error) => {
					if (isWikimediaTemporaryError(error)) return [];
					throw error;
				})
			)
		);
		return settled
			.flat()
			.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
	}

	async function searchCategories(
		phrase: string,
		tokens: WikimediaReferenceToken[],
		filters: WikimediaReferenceFilters,
		limit: number
	): Promise<CommonsCandidate[]> {
		const data = await cache.getOrFetch(
			`commons:reference:category-search:${phrase}:${limit}`,
			SERVER_SEARCH_TTL_MS,
			() =>
				actionJson<CommonsSearchResponse>(
					buildCommonsCategorySearchUrl(phrase, 12),
					'Wikimedia category search took too long to answer.'
				)
		);
		const categories = searchTitles(data.query?.search, 'Category:')
			.filter((title) => categoryLooksRelevant(title, phrase, tokens, filters))
			.filter((title) => !isHumanCenteredReferenceText(title, filters))
			.sort(
				(left, right) =>
					categoryScore(right, phrase, tokens, filters) -
						categoryScore(left, phrase, tokens, filters) || left.localeCompare(right)
			)
			.slice(0, 3);
		const memberPages = await Promise.all(
			categories.map((category) =>
				searchCategoryMembers(category, tokens, filters, limit, 300, phrase)
			)
		);
		return memberPages.flat();
	}

	async function searchCategoryMembers(
		category: string,
		tokens: WikimediaReferenceToken[],
		filters: WikimediaReferenceFilters,
		limit: number,
		baseScore: number,
		phrase = category.replace(/^Category:/, '')
	): Promise<CommonsCandidate[]> {
		const members = await cache.getOrFetch(
			`commons:reference:category-members:${category}:${limit}`,
			SERVER_SEARCH_TTL_MS,
			() =>
				actionJson<CommonsCategoryMembersResponse>(
					buildCommonsCategoryMembersUrl(category, limit),
					'Wikimedia category members took too long to answer.'
				)
		);
		return searchTitles(members.query?.categorymembers, 'File:')
			.filter((title) => !isHumanCenteredReferenceText(`${title} ${category}`, filters))
			.map((title) => ({
				title,
				lane: 'category' as const,
				score:
					baseScore + categoryScore(category, phrase, tokens, filters) + titleScore(title, tokens),
				matchedCategory: category,
				matchedTokens: matchedReferenceLabels(tokens, filters)
			}));
	}

	async function searchFiles(
		search: string,
		lane: CommonsCandidate['lane'],
		limit: number,
		matchedCategory: string | null,
		tokens: WikimediaReferenceToken[],
		filters: WikimediaReferenceFilters
	): Promise<CommonsCandidate[]> {
		const scopedSearch = applyReferenceSearchExclusions(search, filters);
		const data = await cache.getOrFetch(
			`commons:reference:file-search:${lane}:${scopedSearch}:${limit}`,
			SERVER_SEARCH_TTL_MS,
			() =>
				actionJson<CommonsSearchResponse>(
					buildCommonsFileSearchUrl(scopedSearch, limit),
					'Wikimedia file search took too long to answer.'
				)
		);
		const baseScore =
			lane === 'main_subject' ? 560 : lane === 'structured' ? 460 : lane === 'title' ? 170 : 80;
		return searchTitles(data.query?.search, 'File:')
			.filter((title) => !isHumanCenteredReferenceText(title, filters))
			.map((title) => ({
				title,
				lane,
				score: baseScore + titleScore(title, tokens),
				matchedCategory,
				matchedTokens: matchedReferenceLabels(tokens, filters)
			}));
	}

	async function fetchImageInfo(titles: string[]): Promise<Map<string, CommonsImageInfo>> {
		const uniqueTitles = uniqueStrings(titles).slice(0, 50);
		if (uniqueTitles.length === 0) return new Map();
		const data = await cache.getOrFetch(
			`commons:reference:imageinfo:${uniqueTitles.join('|')}`,
			SERVER_OBJECT_TTL_MS,
			() =>
				actionJson<CommonsImageInfoResponse>(
					buildCommonsImageInfoUrl(uniqueTitles, 700),
					'Wikimedia image metadata took too long to answer.'
				)
		);
		const pages = Object.values(data.query?.pages ?? {});
		const entries = pages
			.map((page) => {
				const title = stringOrNull(page.title);
				const info = Array.isArray(page.imageinfo) ? (page.imageinfo[0] as CommonsImageInfo) : null;
				if (!title || !info) return null;
				return [title, info] as const;
			})
			.filter((entry): entry is readonly [string, CommonsImageInfo] => entry !== null);
		return new Map(entries);
	}

	return { search, getById };
}

export function buildCommonsFileSearchUrl(search: string, limit: number): URL {
	const url = baseCommonsUrl();
	url.searchParams.set('list', 'search');
	url.searchParams.set('srnamespace', '6');
	url.searchParams.set('srsearch', search);
	url.searchParams.set('srlimit', String(limit));
	return url;
}

export function buildCommonsCategorySearchUrl(search: string, limit: number): URL {
	const url = baseCommonsUrl();
	url.searchParams.set('list', 'search');
	url.searchParams.set('srnamespace', '14');
	url.searchParams.set('srsearch', search);
	url.searchParams.set('srlimit', String(limit));
	return url;
}

export function buildCommonsCategoryMembersUrl(category: string, limit: number): URL {
	const url = baseCommonsUrl();
	url.searchParams.set('list', 'categorymembers');
	url.searchParams.set('cmtitle', category);
	url.searchParams.set('cmtype', 'file');
	url.searchParams.set('cmlimit', String(limit));
	return url;
}

export function buildCommonsImageInfoUrl(titles: string[], width: number): URL {
	const url = baseCommonsUrl();
	url.searchParams.set('titles', titles.join('|'));
	url.searchParams.set('prop', 'imageinfo');
	url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
	url.searchParams.set('iiurlwidth', String(width));
	return url;
}

function baseCommonsUrl(): URL {
	const url = new URL(COMMONS_API_URL);
	url.searchParams.set('action', 'query');
	url.searchParams.set('format', 'json');
	url.searchParams.set('maxlag', '5');
	url.searchParams.set('origin', '*');
	return url;
}

function normalizeReferenceTokens(query: ExploreQuery): WikimediaReferenceToken[] {
	const tokens = query.wikimediaReferenceTokens ?? [];
	if (tokens.length > 0) return tokens;
	const keyword = query.keyword?.trim();
	return keyword ? [{ kind: 'text', value: keyword, match: 'boost' }] : [];
}

function normalizeReferenceFilters(
	filters: WikimediaReferenceFilters | undefined
): WikimediaReferenceFilters {
	return {
		...DEFAULT_FILTERS,
		...filters,
		subjects: filters?.subjects ?? DEFAULT_FILTERS.subjects,
		qualifiers: filters?.qualifiers ?? DEFAULT_FILTERS.qualifiers,
		formats:
			filters?.formats && filters.formats.length > 0 ? filters.formats : DEFAULT_FILTERS.formats
	};
}

function normalizeCandidate(
	candidate: CommonsCandidate,
	info: CommonsImageInfo | undefined,
	filters: WikimediaReferenceFilters
): ExploreItem | null {
	if (!info) return null;
	const width = numberOrNull(info.width);
	const height = numberOrNull(info.height);
	const mime = stringOrNull(info.mime);
	if (!width || !height || !mime) return null;
	if (filters.excludeSvg && mime === 'image/svg+xml') return null;
	if (!allowedMime(mime)) return null;
	if (Math.min(width, height) < minimumDimension(filters)) return null;
	if (!candidateMatchesFormats(candidate, filters)) return null;

	const imageUrl = stringOrNull(info.url);
	const thumbUrl = stringOrNull(info.thumburl) ?? imageUrl;
	if (!imageUrl && !thumbUrl) return null;
	const title = displayTitle(candidate.title);
	return {
		id: commonsExploreId(candidate.title),
		source: 'wikidata',
		detailUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(candidate.title).replace(/%2F/g, '/')}`,
		title,
		artistRaw: null,
		artistBio: null,
		artistNationality: null,
		dateDisplay: null,
		yearStart: null,
		yearEnd: null,
		medium: mediumFromMime(mime),
		mediumCategory: mime === 'image/jpeg' || mime === 'image/png' ? 'photograph' : 'other',
		objectName: 'Reference image',
		department: 'Wikimedia Commons',
		culture: null,
		period: null,
		thumbUrl,
		imageUrl: imageUrl ?? thumbUrl,
		additionalImages: [],
		isIIIF: false,
		description: null,
		tags: candidate.matchedTokens,
		isHighlight: false,
		isPublicDomain: commonsLicenseLooksPublicDomain(info.extmetadata),
		rawMetadata: {
			commons: info,
			wikimediaReference: {
				lane: candidate.lane,
				score: candidate.score,
				fileTitle: candidate.title,
				matchedCategory: candidate.matchedCategory,
				matchedTokens: candidate.matchedTokens
			}
		}
	};
}

function buildReferencePhrases(
	tokens: WikimediaReferenceToken[],
	filters: WikimediaReferenceFilters
): string[] {
	const entity = primaryEntity(tokens);
	const text = tokens
		.filter((token) => token.kind === 'text')
		.map((token) => token.value.trim())
		.filter(Boolean);
	const entityLabels = entity ? expandEntityLabels(entity.label) : [];
	const textVariants = expandTextTokens(text);
	const filterTerms = referenceFilterTerms(filters);
	const formatTerms = referenceFormatTerms(effectiveReferenceFormats(filters));
	const baseFilterTerms = filterTerms.length > 0 ? filterTerms : formatTerms;
	const firstFormatTerm = formatTerms[0] ?? '';
	const entityPhrases = [
		...entityLabels.flatMap((label) =>
			textVariants.map((variant) => `${label} (${variant})`.trim())
		),
		...entityLabels.flatMap((label) => textVariants.map((variant) => `${label} ${variant}`.trim())),
		...entityLabels.flatMap((label) => textVariants.map((variant) => `${variant} ${label}`.trim())),
		...entityLabels.flatMap((label) =>
			baseFilterTerms.slice(0, 6).map((term) => `${label} ${term}`.trim())
		),
		...entityLabels,
		text.join(' ')
	];
	const filterOnlyPhrases = [
		...baseFilterTerms.slice(0, 12).map((term) => `${term} ${firstFormatTerm}`.trim()),
		...baseFilterTerms.slice(0, 12)
	];
	const phrases =
		entityLabels.length > 0 ? entityPhrases : [...entityPhrases, ...filterOnlyPhrases];
	return uniqueStrings(phrases.map(cleanPhrase).filter(Boolean));
}

function hasReferenceFilterSearch(filters: WikimediaReferenceFilters): boolean {
	return filters.subjects.length > 0 || filters.qualifiers.length > 0;
}

function referenceFilterConfigs(filters: WikimediaReferenceFilters): ReferenceFilterConfig[] {
	return [
		...filters.subjects.map((subject) => SUBJECT_FILTERS[subject]).filter(Boolean),
		...filters.qualifiers.map((qualifier) => QUALIFIER_FILTERS[qualifier]).filter(Boolean)
	];
}

function referenceFilterTerms(filters: WikimediaReferenceFilters): string[] {
	return uniqueStrings(referenceFilterConfigs(filters).flatMap((config) => config.terms));
}

function referenceFilterCategories(filters: WikimediaReferenceFilters): string[] {
	return uniqueStrings(referenceFilterConfigs(filters).flatMap((config) => config.categories));
}

function referenceFilterLabels(filters: WikimediaReferenceFilters): string[] {
	return uniqueStrings(referenceFilterConfigs(filters).map((config) => config.label));
}

function matchedReferenceLabels(
	tokens: WikimediaReferenceToken[],
	filters: WikimediaReferenceFilters
): string[] {
	return uniqueStrings([...tokenLabels(tokens), ...referenceFilterLabels(filters)]);
}

function effectiveReferenceFormats(filters: WikimediaReferenceFilters): WikimediaReferenceFormat[] {
	return uniqueStrings([
		...(filters.formats.length > 0 ? filters.formats : DEFAULT_FILTERS.formats),
		...referenceFilterConfigs(filters).flatMap((config) => config.formats ?? [])
	]) as WikimediaReferenceFormat[];
}

function referenceFormatTerms(formats: WikimediaReferenceFormat[]): string[] {
	const terms: Record<WikimediaReferenceFormat, string[]> = {
		photograph: ['photograph'],
		artwork: ['artwork', 'painting'],
		illustration: ['illustration', 'drawing'],
		printmaking: ['print', 'engraving', 'woodcut'],
		poster: ['poster'],
		sculpture_object: ['sculpture', 'object'],
		texture: ['texture'],
		diagram: ['diagram']
	};
	return uniqueStrings(formats.flatMap((format) => terms[format]));
}

function applyReferenceSearchExclusions(
	search: string,
	filters: WikimediaReferenceFilters
): string {
	if (!shouldExcludeHumanDepicts(filters)) return search;
	return `${search} -haswbstatement:P180=Q5`;
}

function shouldExcludeHumanDepicts(filters: WikimediaReferenceFilters): boolean {
	const nonHumanSubjects = new Set<WikimediaReferenceSubject>([
		'animals',
		'plants',
		'marine_life',
		'insects',
		'landscapes',
		'water_sky',
		'architecture',
		'textures'
	]);
	return filters.subjects.some((subject) => nonHumanSubjects.has(subject));
}

function isHumanCenteredReferenceText(value: string, filters: WikimediaReferenceFilters): boolean {
	if (!shouldExcludeHumanDepicts(filters)) return false;
	const text = normalizeText(value);
	return /\b(photographer|photographers|people|person|persons|human|humans|man|woman|men|women|boy|girl|portrait|self portrait|clothing|camouflage clothing|ghillie suit|soldier|military personnel)\b/.test(
		text
	);
}

function expandEntityLabels(label: string): string[] {
	const labels = [label];
	const normalized = label.toLowerCase();
	if (normalized === 'lion') labels.push('Panthera leo');
	return uniqueStrings(labels);
}

function expandTextTokens(values: string[]): string[] {
	const expanded = values.flatMap((value) => {
		const normalized = value.toLowerCase();
		if (normalized === 'female') return ['female', 'lioness', 'lionesses'];
		if (normalized === 'juvenile') return ['juvenile', 'young', 'cub'];
		if (normalized === 'side view') return ['side view', 'profile', 'lateral view'];
		return [value];
	});
	return uniqueStrings(expanded.length > 0 ? expanded : ['']);
}

function primaryEntity(tokens: WikimediaReferenceToken[]) {
	const subject = tokens.find((token) => token.kind === 'entity' && token.role === 'subject');
	if (subject?.kind === 'entity') return subject;
	const entity = tokens.find((token) => token.kind === 'entity');
	return entity?.kind === 'entity' ? entity : null;
}

function categoryLooksRelevant(
	category: string,
	phrase: string,
	tokens: WikimediaReferenceToken[],
	filters: WikimediaReferenceFilters
): boolean {
	const normalizedCategory = normalizeText(category.replace(/^Category:/, ''));
	const normalizedPhrase = normalizeText(phrase);
	const labels = matchedReferenceLabels(tokens, filters).map(normalizeText);
	const filterTerms = referenceFilterTerms(filters).map(normalizeText);
	return (
		normalizedCategory.includes(normalizedPhrase) ||
		labels.some((label) => label && normalizedCategory.includes(label)) ||
		filterTerms.some((term) => term && normalizedCategory.includes(term)) ||
		(normalizedCategory.includes('panthera leo') && labels.includes('lion'))
	);
}

function categoryScore(
	category: string,
	phrase: string,
	tokens: WikimediaReferenceToken[],
	filters: WikimediaReferenceFilters
): number {
	const normalizedCategory = normalizeText(category);
	const normalizedPhrase = normalizeText(phrase);
	let score = normalizedCategory.includes(normalizedPhrase) ? 80 : 0;
	for (const token of matchedReferenceLabels(tokens, filters)) {
		if (normalizedCategory.includes(normalizeText(token))) score += 24;
	}
	for (const term of referenceFilterTerms(filters)) {
		if (normalizedCategory.includes(normalizeText(term))) score += 12;
	}
	if (normalizedCategory.includes('panthera leo') && normalizedCategory.includes('female')) {
		score += 120;
	}
	if (/\b(heraldry|coat of arms|flag|logo)\b/.test(normalizedCategory)) {
		score -= tokenLabels(tokens).some((token) => /heraldry|coat of arms|flag|logo/i.test(token))
			? 0
			: 180;
	}
	return score;
}

function titleScore(title: string, tokens: WikimediaReferenceToken[]): number {
	const normalizedTitle = normalizeText(title);
	return searchableTokenLabels(tokens).reduce(
		(score, token) => score + (normalizedTitle.includes(normalizeText(token)) ? 16 : 0),
		0
	);
}

function searchableTokenLabels(tokens: WikimediaReferenceToken[]): string[] {
	return uniqueStrings(
		tokens.flatMap((token) =>
			token.kind === 'entity' ? expandEntityLabels(token.label) : expandTextTokens([token.value])
		)
	);
}

function searchTitles(value: unknown, prefix: 'File:' | 'Category:'): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (isRecord(item) ? stringOrNull(item.title) : null))
		.filter((title): title is string => title !== null && title.startsWith(prefix));
}

function uniqueCandidatesByTitle(candidates: CommonsCandidate[]): CommonsCandidate[] {
	const byTitle = new Map<string, CommonsCandidate>();
	for (const candidate of candidates) {
		const existing = byTitle.get(candidate.title);
		if (!existing || candidate.score > existing.score) byTitle.set(candidate.title, candidate);
	}
	return [...byTitle.values()].sort(
		(left, right) => right.score - left.score || left.title.localeCompare(right.title)
	);
}

function tokenLabels(tokens: WikimediaReferenceToken[]): string[] {
	return tokens.map((token) => (token.kind === 'entity' ? token.label : token.value));
}

function commonsExploreId(title: string): string {
	return `wikidata-commons-${base64UrlEncode(title)}`;
}

export function commonsTitleFromExploreId(id: string): string | null {
	const prefix = 'wikidata-commons-';
	if (!id.startsWith(prefix)) return null;
	return base64UrlDecode(id.slice(prefix.length));
}

function base64UrlEncode(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string | null {
	try {
		return Buffer.from(value, 'base64url').toString('utf8');
	} catch {
		return null;
	}
}

function displayTitle(title: string): string {
	return title.replace(/^File:/, '').replace(/_/g, ' ');
}

function allowedMime(mime: string): boolean {
	return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/tiff';
}

function minimumDimension(filters: WikimediaReferenceFilters): number {
	return filters.minResolution === 'large' ? 1200 : 700;
}

function mediumFromMime(mime: string): string {
	if (mime === 'image/tiff') return 'Wikimedia Commons TIFF';
	if (mime === 'image/png') return 'Wikimedia Commons PNG';
	return 'Wikimedia Commons image';
}

function candidateMatchesFormats(
	candidate: CommonsCandidate,
	filters: WikimediaReferenceFilters
): boolean {
	const formats = effectiveReferenceFormats(filters);
	const text = normalizeText(`${candidate.title} ${candidate.matchedCategory ?? ''}`);
	const inferred = new Set<string>();
	if (/\b(painting|artwork|art|heraldry|coat of arms)\b/.test(text)) inferred.add('artwork');
	if (/\b(illustration|botanical|natural history|anatomical|drawing|diagram)\b/.test(text)) {
		inferred.add('illustration');
	}
	if (/\b(woodcut|engraving|etching|lithograph|print)\b/.test(text)) inferred.add('printmaking');
	if (/\bposter\b/.test(text)) inferred.add('poster');
	if (/\b(sculpture|statue|object|ceramic|artifact|artefact)\b/.test(text)) {
		inferred.add('sculpture_object');
	}
	if (/\b(texture|surface|stone|wood|fabric)\b/.test(text)) inferred.add('texture');
	if (/\b(diagram|map|chart|schema)\b/.test(text)) inferred.add('diagram');
	if (inferred.size === 0) inferred.add('photograph');
	return formats.some((format) => inferred.has(format));
}

function commonsLicenseLooksPublicDomain(extmetadata: unknown): boolean | null {
	if (!isRecord(extmetadata)) return null;
	const license = readExtMetadataValue(extmetadata.LicenseShortName);
	if (typeof license !== 'string') return null;
	return /public domain|cc0/i.test(license);
}

function readExtMetadataValue(value: unknown): unknown {
	return isRecord(value) ? value.value : null;
}

function escapeSearchPhrase(value: string): string {
	return value.replace(/"/g, ' ');
}

function cleanPhrase(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
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

function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[_()[\]"]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const value of values) {
		if (!value || seen.has(value)) continue;
		seen.add(value);
		unique.push(value);
	}
	return unique;
}

function stringOrNull(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function numberOrNull(value: unknown): number | null {
	const parsed =
		typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
