<script lang="ts">
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import BookmarkSimpleIcon from 'phosphor-svelte/lib/BookmarkSimpleIcon';
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import ExploreGrid from '$lib/components/explore/ExploreGrid.svelte';
	import ExploreInspector from '$lib/components/explore/ExploreInspector.svelte';
	import FocusedArtPreview from '$lib/components/explore/FocusedArtPreview.svelte';
	import SavedSearchesPanel from '$lib/components/explore/SavedSearchesPanel.svelte';
	import SearchBox from '$lib/components/shell/SearchBox.svelte';
	import {
		cacheGet,
		cacheLookup,
		cacheSet,
		CLIENT_OBJECT_TTL_MS,
		CLIENT_SEARCH_STALE_TTL_MS,
		CLIENT_SEARCH_TTL_MS,
		exploreObjectKey,
		exploreSearchKey
	} from '$lib/explore/client-cache';
	import { buildExploreSuggestions } from '$lib/explore/suggestions';
	import { uniqueExploreItemsById } from '$lib/explore/items';
	import {
		buildArticFilterOptions,
		emptyArticFilterOptions,
		filterArticItems,
		hasActiveArticMetadataFilters
	} from '$lib/explore/artic-filters';
	import {
		appState,
		clearExploreQueryPatch,
		clearWikimediaReferenceTokens,
		clearWikidataSubjects,
		commitExploreSearch,
		openFilter,
		removeWikidataSubject,
		setExploreSource,
		setExploreFilterOptions,
		setExploreSuggestions,
		setSearchQuery,
		setShellScrolled,
		setWebsiteSearchMode,
		setWikimediaMode,
		setWikidataMode,
		updateExploreFilter
	} from '$lib/state/app-state.svelte';
	import type {
		ExploreItem,
		ExplorePage,
		ExploreQuery,
		ExploreRelatedPage,
		SavedExploreSearch,
		SavedExploreSearchMode,
		SourceDepartment,
		SourceId,
		WebsiteSourceId,
		WikidataSearchMode
	} from '$lib/explore/types';

	const sources: Array<{
		id: SourceId;
		label: string;
		eyebrow: string;
		resultLabel?: string;
		showInSwitcher?: boolean;
	}> = [
		{ id: 'met' as const, label: 'The Met', eyebrow: 'The Met Collection' },
		{
			id: 'artic' as const,
			label: 'Art Institute of Chicago',
			eyebrow: 'Art Institute Collection'
		},
		{
			id: 'wikidata' as const,
			label: 'Wikimedia',
			eyebrow: 'Wikidata + Wikimedia Commons'
		},
		{
			id: 'danbooru' as const,
			label: 'Other website',
			resultLabel: 'Danbooru',
			eyebrow: 'Artist and tag search'
		},
		{
			id: 'deviantart' as const,
			label: 'Other website',
			resultLabel: 'DeviantArt',
			eyebrow: 'Artist galleries and tag search',
			showInSwitcher: false
		},
		{
			id: 'bluesky' as const,
			label: 'Other website',
			resultLabel: 'Bluesky',
			eyebrow: 'Artist posts and tag search',
			showInSwitcher: false
		},
		{
			id: 'furaffinity' as const,
			label: 'Other website',
			resultLabel: 'Fur Affinity',
			eyebrow: 'Artist galleries',
			showInSwitcher: false
		}
	];
	const wikimediaModes: Array<{ id: WikidataSearchMode; label: string }> = [
		{ id: 'depicts', label: 'Depicts' },
		{ id: 'main_subject', label: 'Main subject' },
		{ id: 'artist', label: 'Artist' },
		{ id: 'title', label: 'Title' },
		{ id: 'movement', label: 'Movement' },
		{ id: 'genre', label: 'Genre' }
	];

	let activeSource = $state<SourceId>(appState.exploreSourceId);
	let items = $state<ExploreItem[]>([]);
	let selectedItem = $state<ExploreItem | null>(null);
	let departments = $state<SourceDepartment[]>([]);
	let loading = $state(false);
	let loadingMore = $state(false);
	let departmentLoadingSource = $state<SourceId | null>(null);
	let departmentsLoadedForSource = $state<SourceId | null>(null);
	let error = $state<string | null>(null);
	let pageError = $state<string | null>(null);
	let refreshing = $state(false);
	let total = $state<number | null>(null);
	let nextCursor = $state<string | null>(null);
	let inspectedOnMobile = $state(false);
	let previewItem = $state<ExploreItem | null>(null);
	let loadMoreSentinel = $state<HTMLDivElement | null>(null);
	let prefetchingSearchKey = $state<string | null>(null);
	let relatedSeed = $state<ExploreItem | null>(null);
	let relatedTitle = $state<string | null>(null);
	let savedOpen = $state(false);
	let savedSearches = $state<SavedExploreSearch[]>([]);
	let savedLoading = $state(false);
	let savedError = $state<string | null>(null);
	let savingSearch = $state(false);
	let saveFeedback = $state<string | null>(null);
	let recordedSavedVisitKey = $state<string | null>(null);
	let loadedSavedScope = $state<string | null>(null);
	const pendingSearches = new Map<string, Promise<ExplorePage>>();
	const activeControllers = new Set<AbortController>();

	let activeSourceConfig = $derived(
		sources.find((source) => source.id === activeSource) ?? sources[0]
	);
	let activeSourceLabel = $derived(activeSourceConfig.resultLabel ?? activeSourceConfig.label);
	let activeSourceResultLabel = $derived(
		activeSource === 'met' ? 'Met' : activeSource === 'wikidata' ? 'Wikidata' : activeSourceLabel
	);
	let draftKeyword = $derived(appState.query.trim());
	let keyword = $derived(appState.exploreCommittedQuery.trim());
	let subjectKey = $derived(appState.wikidataSubjects.map((subject) => subject.id).join('|'));
	let referenceTokenKey = $derived(JSON.stringify(appState.wikimediaReferenceTokens));
	let queryPatchKey = $derived(JSON.stringify(appState.exploreQueryPatch ?? {}));
	let sourceFilterKey = $derived(JSON.stringify(appState.exploreFilters));
	let queryKey = $derived(
		`${activeSource}|${appState.websiteSearchMode}|${appState.wikimediaMode}|${appState.wikidataMode}|${keyword}|${subjectKey}|${referenceTokenKey}|${queryPatchKey}|${sourceFilterKey}|${relatedSeed?.id ?? ''}`
	);
	let articMetadataFiltersActive = $derived(
		hasActiveArticMetadataFilters(appState.exploreFilters.artic)
	);
	let metFiltersActive = $derived(hasActiveMetFilters(appState.exploreFilters.met));
	let wikidataFiltersActive = $derived(hasActiveWikidataFilters(appState.exploreFilters.wikidata));
	let hasSearched = $derived(
		keyword.length > 0 ||
			appState.wikidataSubjects.length > 0 ||
			appState.wikimediaReferenceTokens.length > 0 ||
			metFiltersActive ||
			articMetadataFiltersActive ||
			appState.exploreFilters.artic.publicDomainOnly ||
			wikidataFiltersActive ||
			(activeSource === 'danbooru' &&
				(appState.exploreFilters.danbooru.contentSafety !== 'blur' ||
					appState.exploreFilters.danbooru.blacklist.trim().length > 0)) ||
			(activeSource === 'deviantart' &&
				(appState.exploreFilters.deviantart.contentSafety !== 'blur' ||
					appState.exploreFilters.deviantart.dateFrom !== null ||
					appState.exploreFilters.deviantart.dateTo !== null ||
					appState.exploreFilters.deviantart.sort !== 'recent')) ||
			(activeSource === 'bluesky' && appState.exploreFilters.bluesky.contentSafety !== 'blur') ||
			(activeSource === 'furaffinity' &&
				appState.exploreFilters.furaffinity.contentSafety !== 'blur')
	);
	let visibleItems = $derived(visibleExploreItems(items));
	let currentSavedSearch = $derived(findCurrentSavedSearch());
	let resultSummary = $derived(
		resultSummaryFor({
			source: activeSource,
			visibleCount: visibleItems.length,
			loadedCount: items.length,
			total,
			filtered: activeSource === 'artic' && articMetadataFiltersActive
		})
	);
	let activeWikimediaModeLabel = $derived(
		wikimediaModes.find((mode) => mode.id === appState.wikidataMode)?.label ?? 'Depicts'
	);

	$effect(() => {
		const source = activeSource;
		void loadDepartments(source);
	});

	$effect(() => {
		const currentKey = queryKey;
		const timeout = window.setTimeout(
			() => {
				void loadSearch(currentKey);
			},
			keyword ? 240 : 0
		);

		return () => window.clearTimeout(timeout);
	});

	$effect(() => {
		const sentinel = loadMoreSentinel;
		const currentKey = queryKey;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					void loadNextPage(currentKey);
				}
			},
			{ rootMargin: '720px 0px' }
		);
		observer.observe(sentinel);

		return () => observer.disconnect();
	});

	$effect(() => {
		setExploreSuggestions(buildExploreSuggestions(draftKeyword, activeSource, items, departments));
	});

	$effect(() => {
		setExploreSource(activeSource, activeSourceLabel);
	});

	$effect(() => {
		if (!supportsSavedSearches(activeSource)) return;
		const scope = `${activeSource}:${activeSavedSearchMode()}`;
		if (loadedSavedScope === scope) return;
		loadedSavedScope = scope;
		void loadSavedSearches();
	});

	$effect(() => {
		setExploreFilterOptions({
			artic: activeSource === 'artic' ? buildArticFilterOptions(items) : emptyArticFilterOptions()
		});
	});

	$effect(() => {
		if (relatedSeed && appState.wikidataSubjects.length > 0) {
			relatedSeed = null;
			relatedTitle = null;
		}
	});

	$effect(() => {
		return () => abortActiveRequests();
	});

	$effect(() => {
		if (selectedItem && !visibleItems.some((item) => item.id === selectedItem?.id)) {
			selectedItem = null;
		}
	});

	$effect(() => {
		const matching = currentSavedSearch;
		const latest = newestKnownItem(items);
		if (
			!matching ||
			!latest ||
			normalizeSavedQuery(keyword) !== normalizeSavedQuery(matching.query)
		) {
			return;
		}
		const visitKey = `${matching.id}:${latest.id}:${latest.dateDisplay ?? ''}`;
		if (recordedSavedVisitKey === visitKey) return;
		recordedSavedVisitKey = visitKey;
		void updateSavedSearchVisit(matching, latest);
	});

	async function loadDepartments(source: SourceId) {
		if (departmentsLoadedForSource === source || departmentLoadingSource === source) return;
		departments = [];
		departmentLoadingSource = source;
		try {
			const response = await fetch(`/explore/api/departments?source=${encodeURIComponent(source)}`);
			if (!response.ok) throw new Error(`Could not load ${sourceLabelFor(source)} departments.`);
			const data = (await response.json()) as { departments: SourceDepartment[] };
			if (activeSource === source) departments = data.departments;
		} catch {
			if (activeSource === source) departments = [];
		} finally {
			if (activeSource === source) departmentsLoadedForSource = source;
			if (departmentLoadingSource === source) departmentLoadingSource = null;
		}
	}

	async function loadSearch(expectedKey: string) {
		abortActiveRequests();
		const controller = createRequestController();
		const source = activeSource;
		const query = buildQuery();
		const seed = relatedSeed;
		const cacheKey = seed
			? relatedPageKey(seed.id, undefined, 40)
			: exploreSearchKey(source, query);
		const cached = await cacheLookup<ExplorePage>(cacheKey, CLIENT_SEARCH_STALE_TTL_MS);
		if (expectedKey !== queryKey || controller.signal.aborted) {
			releaseRequestController(controller);
			return;
		}

		loading = !cached;
		refreshing = Boolean(cached?.stale);
		loadingMore = false;
		error = null;
		pageError = null;
		nextCursor = null;
		if (cached) {
			applyFirstPage(cached.value);
			if (!cached.stale) {
				releaseRequestController(controller);
				return;
			}
		} else {
			items = [];
			selectedItem = null;
			inspectedOnMobile = false;
			previewItem = null;
			total = null;
		}

		try {
			const page = seed
				? await fetchRelatedPage(seed.id, {
						forceNetwork: Boolean(cached?.stale),
						signal: controller.signal
					})
				: await fetchSearchPage(query, {
						forceNetwork: Boolean(cached?.stale),
						source,
						signal: controller.signal
					});
			if (expectedKey !== queryKey || controller.signal.aborted) return;
			applyFirstPage(page);
		} catch (searchError) {
			if (expectedKey !== queryKey || isAbortError(searchError)) return;
			if (cached) return;
			items = [];
			selectedItem = null;
			previewItem = null;
			total = null;
			error =
				searchError instanceof Error
					? searchError.message
					: `${sourceLabelFor(source)} could not be reached. Try another search in a moment.`;
		} finally {
			releaseRequestController(controller);
			if (expectedKey === queryKey) {
				loading = false;
				refreshing = false;
			}
		}
	}

	async function loadNextPage(expectedKey: string, force = false) {
		if (loading || loadingMore || !nextCursor) return;
		if (pageError && !force) return;
		const controller = createRequestController();
		const source = activeSource;
		const seed = relatedSeed;
		loadingMore = true;
		pageError = null;
		const cursor = nextCursor;
		const query = buildQuery(cursor);

		try {
			const page = seed
				? await fetchRelatedPage(seed.id, { cursor, signal: controller.signal })
				: await fetchSearchPage(query, { source, signal: controller.signal });
			if (expectedKey !== queryKey || controller.signal.aborted) return;

			const seen = new Set(items.map((item) => item.id));
			items = [...items, ...page.items.filter((item) => !seen.has(item.id))];
			total = page.total;
			nextCursor = page.nextCursor;
		} catch (searchError) {
			if (expectedKey !== queryKey || isAbortError(searchError)) return;
			pageError =
				searchError instanceof Error
					? searchError.message
					: `More ${sourceLabelFor(source)} results could not be loaded. Try again in a moment.`;
		} finally {
			releaseRequestController(controller);
			if (expectedKey === queryKey) loadingMore = false;
		}
	}

	async function fetchSearchPage(
		query: ExploreQuery,
		options: { forceNetwork?: boolean; signal?: AbortSignal; source?: SourceId } = {}
	): Promise<ExplorePage> {
		const source = options.source ?? activeSource;
		const cacheKey = exploreSearchKey(source, query);
		if (!options.forceNetwork) {
			const cached = await cacheLookup<ExplorePage>(cacheKey);
			if (cached) return cached.value;
		}

		const pending = pendingSearches.get(cacheKey);
		if (pending) return pending;

		const request = fetch('/explore/api/search', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ source, query }),
			signal: options.signal
		})
			.then(async (response) => {
				const data = (await response.json()) as ExplorePage | { error: string };
				if (!response.ok) {
					throw new Error(
						'error' in data ? data.error : `${sourceLabelFor(source)} search is unavailable.`
					);
				}
				const page = data as ExplorePage;
				await cacheSet(cacheKey, page, CLIENT_SEARCH_TTL_MS);
				return page;
			})
			.finally(() => pendingSearches.delete(cacheKey));

		pendingSearches.set(cacheKey, request);
		return request;
	}

	async function fetchRelatedPage(
		seedId: string,
		options: { cursor?: string; forceNetwork?: boolean; signal?: AbortSignal } = {}
	): Promise<ExploreRelatedPage> {
		const limit = 40;
		const cacheKey = relatedPageKey(seedId, options.cursor, limit);
		if (!options.forceNetwork) {
			const cached = await cacheLookup<ExploreRelatedPage>(cacheKey);
			if (cached) return cached.value;
		}

		const pending = pendingSearches.get(cacheKey) as Promise<ExploreRelatedPage> | undefined;
		if (pending) return pending;

		const params = new URLSearchParams({ limit: String(limit) });
		if (options.cursor) params.set('cursor', options.cursor);
		const request = fetch(
			`/explore/api/wikidata/related/${encodeURIComponent(seedId)}?${params.toString()}`,
			{ signal: options.signal }
		)
			.then(async (response) => {
				const data = (await response.json()) as ExploreRelatedPage | { error: string };
				if (!response.ok) {
					throw new Error('error' in data ? data.error : 'Related Wikidata works are unavailable.');
				}
				const page = data as ExploreRelatedPage;
				await cacheSet(cacheKey, page, CLIENT_SEARCH_TTL_MS);
				relatedTitle = page.title;
				return page;
			})
			.finally(() => pendingSearches.delete(cacheKey));

		pendingSearches.set(cacheKey, request);
		return request;
	}

	async function prefetchNextPage(expectedKey: string) {
		if (loading || loadingMore || pageError || !nextCursor) return;
		const source = activeSource;
		const query = buildQuery(nextCursor);
		const cacheKey = exploreSearchKey(source, query);
		if (prefetchingSearchKey === cacheKey || (await cacheGet<ExplorePage>(cacheKey))) return;

		prefetchingSearchKey = cacheKey;
		const controller = createRequestController();
		try {
			await fetchSearchPage(query, { source, signal: controller.signal });
		} catch {
			// Prefetching should never surface errors before the user asks for the page.
		} finally {
			releaseRequestController(controller);
			if (expectedKey === queryKey && prefetchingSearchKey === cacheKey) {
				prefetchingSearchKey = null;
			}
		}
	}

	function applyFirstPage(page: ExplorePage) {
		items = uniqueExploreItemsById(page.items);
		total = page.total;
		nextCursor = page.nextCursor;
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
	}

	function relatedPageKey(seedId: string, cursor: string | undefined, limit: number): string {
		return `explore:related:${seedId}:${cursor ?? '0'}:${limit}`;
	}

	function createRequestController(): AbortController {
		const controller = new AbortController();
		activeControllers.add(controller);
		controller.signal.addEventListener('abort', () => activeControllers.delete(controller), {
			once: true
		});
		return controller;
	}

	function releaseRequestController(controller: AbortController) {
		activeControllers.delete(controller);
	}

	function abortActiveRequests() {
		for (const controller of activeControllers) {
			controller.abort();
		}
		activeControllers.clear();
	}

	function isAbortError(error: unknown) {
		return error instanceof DOMException && error.name === 'AbortError';
	}

	function buildQuery(cursor?: string): ExploreQuery {
		const patch = appState.exploreQueryPatch ?? {};
		if (isWebsiteSource(activeSource)) {
			const contentSafety = websiteContentSafety(activeSource);
			return {
				[appState.websiteSearchMode === 'artist' ? 'artist' : 'tag']: keyword || undefined,
				contentSafety,
				blacklist:
					activeSource === 'danbooru' ? appState.exploreFilters.danbooru.blacklist : undefined,
				dateFrom:
					activeSource === 'deviantart' && appState.websiteSearchMode === 'artist'
						? (appState.exploreFilters.deviantart.dateFrom ?? undefined)
						: undefined,
				dateTo:
					activeSource === 'deviantart' && appState.websiteSearchMode === 'artist'
						? (appState.exploreFilters.deviantart.dateTo ?? undefined)
						: undefined,
				sort:
					activeSource === 'deviantart' && appState.websiteSearchMode === 'artist'
						? appState.exploreFilters.deviantart.sort
						: undefined,
				hasImageOnly: true,
				cursor,
				limit: 40
			};
		}
		if (activeSource === 'wikidata') {
			const filters = appState.exploreFilters.wikidata;
			if (appState.wikimediaMode === 'reference' && !relatedSeed) {
				return {
					wikimediaMode: 'reference',
					wikimediaReferenceTokens: appState.wikimediaReferenceTokens,
					wikimediaReferenceFilters: filters.reference,
					cursor,
					limit: 40
				};
			}
			if (relatedSeed) {
				return {
					wikimediaMode: 'art',
					wikidataMode: appState.wikidataMode,
					depicts: [],
					workType: 'painting',
					hasImageOnly: filters.hasImageOnly,
					cursor,
					limit: 40
				};
			}
			if (appState.wikidataMode === 'title') {
				return {
					wikimediaMode: 'art',
					wikidataMode: 'title',
					keyword: keyword || undefined,
					workType: 'painting',
					yearFrom: patch.yearFrom ?? filters.yearFrom ?? undefined,
					yearTo: patch.yearTo ?? filters.yearTo ?? undefined,
					hasImageOnly: filters.hasImageOnly,
					cursor,
					limit: 40
				};
			}
			return {
				wikimediaMode: 'art',
				wikidataMode: appState.wikidataMode,
				wikidataEntities: appState.wikidataSubjects,
				depicts: appState.wikidataMode === 'depicts' ? appState.wikidataSubjects : undefined,
				workType: 'painting',
				yearFrom: patch.yearFrom ?? filters.yearFrom ?? undefined,
				yearTo: patch.yearTo ?? filters.yearTo ?? undefined,
				hasImageOnly: filters.hasImageOnly,
				cursor,
				limit: 40
			};
		}
		const metFilters = appState.exploreFilters.met;
		const articFilters = appState.exploreFilters.artic;
		const sourceFilters =
			activeSource === 'met'
				? {
						publicDomainOnly: metFilters.publicDomainOnly,
						isHighlightOnly: metFilters.isHighlightOnly,
						yearFrom: metFilters.yearFrom,
						yearTo: metFilters.yearTo,
						medium: metFilters.medium,
						department: metFilters.department
					}
				: {
						publicDomainOnly: articFilters.publicDomainOnly,
						mediumCategory: articFilters.mediumCategory ?? undefined,
						objectName: articFilters.objectName ?? undefined,
						department: articFilters.department ?? undefined,
						culture: articFilters.cultureLocation ?? undefined,
						period: articFilters.movementEra ?? undefined
					};
		return {
			keyword: keyword || undefined,
			...patch,
			...sourceFilters,
			department:
				patch.department ??
				(activeSource === 'met' ? (metFilters.department ?? undefined) : undefined),
			yearFrom:
				patch.yearFrom ?? (activeSource === 'met' ? (metFilters.yearFrom ?? undefined) : undefined),
			yearTo:
				patch.yearTo ?? (activeSource === 'met' ? (metFilters.yearTo ?? undefined) : undefined),
			medium:
				patch.medium ?? (activeSource === 'met' ? (metFilters.medium ?? undefined) : undefined),
			hasImageOnly: true,
			isHighlightOnly: (activeSource === 'met' && metFilters.isHighlightOnly) || undefined,
			cursor,
			limit: 20
		};
	}

	function selectSource(source: SourceId) {
		if (activeSource === source) return;
		abortActiveRequests();
		activeSource = source;
		relatedSeed = null;
		relatedTitle = null;
		clearExploreQueryPatch();
		appState.query = '';
		appState.exploreCommittedQuery = '';
		if (source !== 'wikidata') {
			clearWikidataSubjects();
			clearWikimediaReferenceTokens();
		} else {
			appState.wikidataEntitySuggestions = [];
			appState.wikidataEntityError = null;
		}
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
		prefetchingSearchKey = null;
	}

	function selectWebsiteProvider(event: Event) {
		const source = (event.currentTarget as HTMLSelectElement).value;
		if (!isWebsiteSourceValue(source)) return;
		if (source === 'furaffinity' && appState.websiteSearchMode === 'tags') {
			setWebsiteSearchMode('artist');
		}
		selectSource(source);
	}

	function isWebsiteSource(source: SourceId): source is WebsiteSourceId {
		return isWebsiteSourceValue(source);
	}

	function isWebsiteSourceValue(source: string): source is WebsiteSourceId {
		return (
			source === 'danbooru' ||
			source === 'deviantart' ||
			source === 'bluesky' ||
			source === 'furaffinity'
		);
	}

	function supportsSavedSearches(source: SourceId) {
		return source === 'wikidata' || isWebsiteSource(source);
	}

	function activeSavedSearchMode(): SavedExploreSearchMode {
		return activeSource === 'wikidata' ? appState.wikimediaMode : appState.websiteSearchMode;
	}

	function currentSavedQuery() {
		if (activeSource !== 'wikidata') return appState.query.trim();
		if (appState.wikimediaMode === 'reference') {
			return appState.wikimediaReferenceTokens
				.map((token) => (token.kind === 'entity' ? token.label : token.value))
				.join(', ');
		}
		if (appState.wikidataMode === 'title') return appState.query.trim();
		return appState.wikidataSubjects.map((subject) => subject.label).join(', ');
	}

	function websiteContentSafety(source: WebsiteSourceId) {
		return appState.exploreFilters[source].contentSafety;
	}

	function websiteTagsAvailable(source: WebsiteSourceId) {
		return source !== 'furaffinity';
	}

	function selectWikimediaMode(mode: WikidataSearchMode) {
		if (appState.wikidataMode === mode) return;
		abortActiveRequests();
		setWikidataMode(mode);
		relatedSeed = null;
		relatedTitle = null;
		items = [];
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
		total = null;
		nextCursor = null;
		error = null;
		pageError = null;
		prefetchingSearchKey = null;
	}

	function selectWikimediaTopMode(mode: 'art' | 'reference') {
		if (appState.wikimediaMode === mode) return;
		abortActiveRequests();
		setWikimediaMode(mode);
		relatedSeed = null;
		relatedTitle = null;
		items = [];
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
		total = null;
		nextCursor = null;
		error = null;
		pageError = null;
		prefetchingSearchKey = null;
	}

	function sourceLabelFor(source: SourceId) {
		const option = sources.find((candidate) => candidate.id === source);
		if (!option) return 'Explore';
		return option.resultLabel ?? option.label;
	}

	function submitWebsiteSearch(event?: SubmitEvent) {
		event?.preventDefault();
		commitExploreSearch();
	}

	async function loadSavedSearches() {
		if (!supportsSavedSearches(activeSource)) return;
		savedLoading = true;
		savedError = null;
		try {
			const params = new URLSearchParams({
				source: activeSource,
				mode: activeSavedSearchMode()
			});
			const response = await fetch(`/explore/api/saved-searches?${params.toString()}`);
			const payload = (await response.json()) as
				| { searches: SavedExploreSearch[] }
				| { error: string };
			if (!response.ok || !('searches' in payload)) {
				throw new Error('error' in payload ? payload.error : 'Saved searches are unavailable.');
			}
			savedSearches = payload.searches;
		} catch (savedSearchError) {
			savedError =
				savedSearchError instanceof Error
					? savedSearchError.message
					: 'Saved searches are unavailable.';
		} finally {
			savedLoading = false;
		}
	}

	async function openSavedSearches() {
		savedOpen = true;
		await loadSavedSearches();
	}

	async function saveCurrentSearch() {
		if (!supportsSavedSearches(activeSource) || savingSearch) return;
		const query = currentSavedQuery();
		if (!query) return;
		savingSearch = true;
		saveFeedback = null;
		const latest =
			normalizeSavedQuery(query) === normalizeSavedQuery(keyword) ? newestKnownItem(items) : null;
		try {
			const response = await fetch('/explore/api/saved-searches', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					source: activeSource,
					mode: activeSavedSearchMode(),
					query,
					filters: savedFiltersSnapshot(),
					lastSeenItemId: latest?.id ?? null,
					lastSeenPublishedAt: latest?.dateDisplay ?? null
				})
			});
			const payload = (await response.json()) as
				| { search: SavedExploreSearch; created: boolean }
				| { error: string };
			if (!response.ok || !('search' in payload)) {
				throw new Error('error' in payload ? payload.error : 'Search could not be saved.');
			}
			savedSearches = [
				payload.search,
				...savedSearches.filter((search) => search.id !== payload.search.id)
			];
			commitExploreSearch(query);
			saveFeedback = payload.created ? 'Search saved' : 'Saved search updated';
			window.setTimeout(() => {
				saveFeedback = null;
			}, 2200);
		} catch (savedSearchError) {
			saveFeedback =
				savedSearchError instanceof Error ? savedSearchError.message : 'Search could not be saved.';
		} finally {
			savingSearch = false;
		}
	}

	function applySavedSearch(search: SavedExploreSearch) {
		if (!supportsSavedSearches(search.source)) return;
		if (activeSource !== search.source) selectSource(search.source);
		if (search.source === 'wikidata') {
			restoreWikimediaSearch(search);
		} else {
			if (search.mode !== 'artist' && search.mode !== 'tags') return;
			if (appState.websiteSearchMode !== search.mode) setWebsiteSearchMode(search.mode);
			restoreWebsiteFilters(search);
			setSearchQuery(search.query);
			commitExploreSearch(search.query);
		}
		savedOpen = false;
		void patchSavedSearch(search.id, { touchOpened: true });
	}

	async function deleteSavedSearch(search: SavedExploreSearch) {
		const response = await fetch(`/explore/api/saved-searches/${encodeURIComponent(search.id)}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			savedError = 'That saved search could not be removed.';
			return;
		}
		savedSearches = savedSearches.filter((candidate) => candidate.id !== search.id);
	}

	async function updateSavedSearchVisit(search: SavedExploreSearch, latest: ExploreItem) {
		const updated = await patchSavedSearch(search.id, {
			touchOpened: true,
			lastSeenItemId: latest.id,
			lastSeenPublishedAt: latest.dateDisplay
		});
		if (!updated) return;
		savedSearches = savedSearches.map((candidate) =>
			candidate.id === updated.id ? updated : candidate
		);
	}

	async function patchSavedSearch(
		id: string,
		patch: Record<string, unknown>
	): Promise<SavedExploreSearch | null> {
		try {
			const response = await fetch(`/explore/api/saved-searches/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!response.ok) return null;
			const payload = (await response.json()) as { search: SavedExploreSearch };
			return payload.search;
		} catch {
			return null;
		}
	}

	function websiteFiltersSnapshot(source: WebsiteSourceId) {
		if (source === 'danbooru') {
			return {
				contentSafety: appState.exploreFilters.danbooru.contentSafety,
				blacklist: appState.exploreFilters.danbooru.blacklist
			};
		}
		if (source === 'deviantart') {
			return {
				contentSafety: appState.exploreFilters.deviantart.contentSafety,
				dateFrom: appState.exploreFilters.deviantart.dateFrom,
				dateTo: appState.exploreFilters.deviantart.dateTo,
				sort: appState.exploreFilters.deviantart.sort
			};
		}
		return { contentSafety: websiteContentSafety(source) };
	}

	function savedFiltersSnapshot() {
		if (isWebsiteSource(activeSource)) return websiteFiltersSnapshot(activeSource);
		if (activeSource !== 'wikidata') return {};
		return {
			wikimediaMode: appState.wikimediaMode,
			wikidataMode: appState.wikidataMode,
			wikidataSubjects: appState.wikidataSubjects,
			wikimediaReferenceTokens: appState.wikimediaReferenceTokens,
			wikidataFilters: appState.exploreFilters.wikidata
		};
	}

	function findCurrentSavedSearch() {
		if (!supportsSavedSearches(activeSource)) return null;
		const source = activeSource;
		const filterKey = JSON.stringify(savedFiltersSnapshot());
		const query = currentSavedQuery();
		return (
			savedSearches.find(
				(search) =>
					search.source === source &&
					search.mode === activeSavedSearchMode() &&
					normalizeSavedQuery(search.query) === normalizeSavedQuery(query) &&
					JSON.stringify(search.filters) === filterKey
			) ?? null
		);
	}

	function restoreWikimediaSearch(search: SavedExploreSearch) {
		if (search.mode !== 'art' && search.mode !== 'reference') return;
		const filters = search.filters;
		const mode =
			filters.wikidataMode === 'depicts' ||
			filters.wikidataMode === 'main_subject' ||
			filters.wikidataMode === 'artist' ||
			filters.wikidataMode === 'title' ||
			filters.wikidataMode === 'movement' ||
			filters.wikidataMode === 'genre'
				? filters.wikidataMode
				: 'depicts';
		setWikimediaMode(search.mode);
		setWikidataMode(mode);
		appState.wikidataSubjects = savedSubjects(filters.wikidataSubjects);
		appState.wikimediaReferenceTokens = savedReferenceTokens(filters.wikimediaReferenceTokens);
		const storedFilters = isRecord(filters.wikidataFilters) ? filters.wikidataFilters : {};
		const reference = isRecord(storedFilters.reference) ? storedFilters.reference : {};
		updateExploreFilter('wikidata', {
			yearFrom: savedIntegerOrNull(storedFilters.yearFrom),
			yearTo: savedIntegerOrNull(storedFilters.yearTo),
			hasImageOnly:
				typeof storedFilters.hasImageOnly === 'boolean' ? storedFilters.hasImageOnly : true,
			reference: {
				...appState.exploreFilters.wikidata.reference,
				...reference
			}
		});
		const titleQuery = search.mode === 'art' && mode === 'title' ? search.query : '';
		setSearchQuery(titleQuery);
		commitExploreSearch(titleQuery);
	}

	function savedSubjects(value: unknown) {
		if (!Array.isArray(value)) return [];
		return value
			.filter(isRecord)
			.filter(
				(subject) =>
					typeof subject.id === 'string' &&
					typeof subject.label === 'string' &&
					(subject.description === null || typeof subject.description === 'string')
			)
			.map((subject) => ({
				id: subject.id as string,
				label: subject.label as string,
				description: subject.description as string | null
			}));
	}

	function savedReferenceTokens(value: unknown) {
		if (!Array.isArray(value)) return [];
		return value.filter((token): token is (typeof appState.wikimediaReferenceTokens)[number] => {
			if (!isRecord(token) || typeof token.kind !== 'string') return false;
			if (token.kind === 'text') {
				return (
					typeof token.value === 'string' && (token.match === 'boost' || token.match === 'required')
				);
			}
			return (
				token.kind === 'entity' &&
				typeof token.id === 'string' &&
				typeof token.label === 'string' &&
				(token.description === null || typeof token.description === 'string') &&
				(token.role === 'subject' || token.role === 'qualifier')
			);
		});
	}

	function savedIntegerOrNull(value: unknown) {
		return typeof value === 'number' && Number.isInteger(value) ? value : null;
	}

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function restoreWebsiteFilters(search: SavedExploreSearch) {
		const filters = search.filters;
		const contentSafety =
			filters.contentSafety === 'hide' ||
			filters.contentSafety === 'blur' ||
			filters.contentSafety === 'show'
				? filters.contentSafety
				: 'blur';
		if (search.source === 'danbooru') {
			updateExploreFilter('danbooru', {
				contentSafety,
				blacklist: typeof filters.blacklist === 'string' ? filters.blacklist : ''
			});
			return;
		}
		if (search.source === 'deviantart') {
			updateExploreFilter('deviantart', {
				contentSafety,
				dateFrom: savedDateOrNull(filters.dateFrom),
				dateTo: savedDateOrNull(filters.dateTo),
				sort: filters.sort === 'popular' ? 'popular' : 'recent'
			});
			return;
		}
		if (search.source === 'bluesky' || search.source === 'furaffinity') {
			updateExploreFilter(search.source, { contentSafety });
		}
	}

	function savedDateOrNull(value: unknown) {
		return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
	}

	function openItem(item: ExploreItem) {
		selectedItem = item;
		void hydrateSelectedItem(item.id);
		if (window.matchMedia('(max-width: 979px)').matches) {
			inspectedOnMobile = true;
		}
	}

	async function hydrateSelectedItem(itemId: string) {
		const cacheKey = exploreObjectKey(itemId);
		const cached = await cacheGet<ExploreItem>(cacheKey);
		if (cached) {
			applyHydratedItem(itemId, cached);
			return;
		}
		const controller = createRequestController();
		try {
			const response = await fetch(`/explore/api/item/${encodeURIComponent(itemId)}`, {
				signal: controller.signal
			});
			if (!response.ok || controller.signal.aborted) return;
			const freshItem = (await response.json()) as ExploreItem;
			await cacheSet(cacheKey, freshItem, CLIENT_OBJECT_TTL_MS);
			applyHydratedItem(itemId, freshItem);
		} catch (itemError) {
			if (!isAbortError(itemError)) {
				// Search records remain usable when optional detail hydration fails.
			}
		} finally {
			releaseRequestController(controller);
		}
	}

	function applyHydratedItem(itemId: string, hydratedItem: ExploreItem) {
		const previousPrimaryUrl =
			selectedItem?.id === itemId ? (selectedItem.imageUrl ?? selectedItem.thumbUrl) : null;
		if (selectedItem?.id === itemId) selectedItem = hydratedItem;
		if (previewItem?.id === itemId && previewItem.imageUrl === previousPrimaryUrl) {
			previewItem = hydratedItem;
		}
	}

	function openRelatedPage(item: ExploreItem) {
		abortActiveRequests();
		activeSource = 'wikidata';
		relatedSeed = item;
		relatedTitle = `Similar to ${item.title}`;
		clearExploreQueryPatch();
		clearWikidataSubjects();
		appState.query = '';
		appState.exploreCommittedQuery = '';
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
		prefetchingSearchKey = null;
	}

	function clearRelatedMode() {
		relatedSeed = null;
		relatedTitle = null;
		items = [];
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
	}

	async function prefetchItem(item: ExploreItem) {
		const cacheKey = exploreObjectKey(item.id);
		if (await cacheGet<ExploreItem>(cacheKey)) return;

		try {
			const response = await fetch(`/explore/api/item/${encodeURIComponent(item.id)}`);
			if (!response.ok) return;
			const freshItem = (await response.json()) as ExploreItem;
			await cacheSet(cacheKey, freshItem, CLIENT_OBJECT_TTL_MS);
		} catch {
			// Hover prefetch is opportunistic.
		}
	}

	function handleScroll(event: Event) {
		const target = event.currentTarget as HTMLElement;
		setShellScrolled(target.scrollTop > 12);
		const scrollable = target.scrollHeight - target.clientHeight;
		const progress = scrollable > 0 ? target.scrollTop / scrollable : 0;
		if (activeSource !== 'wikidata' && progress > 0.7) {
			void prefetchNextPage(queryKey);
		}
		if (target.scrollHeight - target.scrollTop - target.clientHeight < 720) {
			void loadNextPage(queryKey);
		}
	}

	function visibleExploreItems(input: ExploreItem[]) {
		const filtered =
			activeSource === 'artic' ? filterArticItems(input, appState.exploreFilters.artic) : input;
		if (activeSource !== 'deviantart' || appState.exploreFilters.deviantart.sort !== 'popular') {
			return filtered;
		}
		return [...filtered].sort((left, right) => {
			const leftStats = deviantArtStats(left);
			const rightStats = deviantArtStats(right);
			return (
				rightStats.favourites - leftStats.favourites || rightStats.comments - leftStats.comments
			);
		});
	}

	function deviantArtStats(item: ExploreItem) {
		const metadata = item.rawMetadata.deviantart;
		const record =
			typeof metadata === 'object' && metadata !== null
				? (metadata as Record<string, unknown>)
				: {};
		return {
			favourites: typeof record.favourites === 'number' ? record.favourites : 0,
			comments: typeof record.comments === 'number' ? record.comments : 0
		};
	}

	function newestKnownItem(input: ExploreItem[]) {
		return (
			[...input]
				.filter((item) => item.dateDisplay && Number.isFinite(Date.parse(item.dateDisplay)))
				.sort(
					(left, right) => Date.parse(right.dateDisplay ?? '') - Date.parse(left.dateDisplay ?? '')
				)[0] ?? null
		);
	}

	function normalizeSavedQuery(value: string) {
		return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
	}

	function hasActiveMetFilters(filters: typeof appState.exploreFilters.met) {
		return Boolean(
			filters.publicDomainOnly ||
			filters.isHighlightOnly ||
			filters.yearFrom !== null ||
			filters.yearTo !== null ||
			filters.medium ||
			filters.department
		);
	}

	function hasActiveWikidataFilters(filters: typeof appState.exploreFilters.wikidata) {
		const reference = filters.reference;
		return Boolean(
			appState.wikimediaMode !== 'art' ||
			appState.wikimediaReferenceTokens.length > 0 ||
			filters.yearFrom !== null ||
			filters.yearTo !== null ||
			!filters.hasImageOnly ||
			reference.quality !== 'valued' ||
			reference.excludeSvg === false ||
			reference.minResolution !== 'standard'
		);
	}

	function resultSummaryFor({
		source,
		visibleCount,
		loadedCount,
		total,
		filtered
	}: {
		source: SourceId;
		visibleCount: number;
		loadedCount: number;
		total: number | null;
		filtered: boolean;
	}) {
		if (source === 'artic') {
			if (filtered) {
				return `Showing ${visibleCount.toLocaleString()} of ${loadedCount.toLocaleString()} loaded results`;
			}
			return `Showing ${visibleCount.toLocaleString()} loaded results`;
		}
		if (filtered) {
			return `Showing ${visibleCount.toLocaleString()} of ${loadedCount.toLocaleString()} loaded results`;
		}
		if (total === null) return `Showing ${visibleCount.toLocaleString()} results`;
		return `Showing ${visibleCount.toLocaleString()} of ${total.toLocaleString()} matches`;
	}
</script>

<div class="explore-workspace">
	<section class="explore-content" aria-label={`Explore ${activeSourceLabel} collection`}>
		<div class="scroll-area" onscroll={handleScroll}>
			<div class="explore-heading">
				<h1>Explore</h1>
				<div class="source-switcher" aria-label="Explore sources">
					{#each sources as source (source.id)}
						{#if source.showInSwitcher !== false}
							<button
								class:active={activeSource === source.id ||
									(source.id === 'danbooru' && isWebsiteSource(activeSource))}
								type="button"
								aria-pressed={activeSource === source.id ||
									(source.id === 'danbooru' && isWebsiteSource(activeSource))}
								onclick={() =>
									selectSource(
										source.id === 'danbooru' && isWebsiteSource(activeSource)
											? activeSource
											: source.id
									)}
							>
								{source.label}
							</button>
						{/if}
					{/each}
				</div>
			</div>

			{#if !isWebsiteSource(activeSource) && activeSource !== 'wikidata'}
				<div class="museum-search">
					<div class="museum-query">
						<SearchBox
							mode="explore"
							label={`Search ${activeSourceLabel}`}
							placeholder="Search artwork, artists, or collections..."
						/>
					</div>
					<button class="website-filter" type="button" onclick={openFilter}>
						<FunnelIcon size={18} />
						<span>Filter</span>
					</button>
				</div>
			{/if}

			{#if isWebsiteSource(activeSource)}
				<form
					class="website-search"
					aria-label={`Search ${activeSourceLabel}`}
					onsubmit={submitWebsiteSearch}
				>
					<div class="website-mode" aria-label="Search mode">
						<button
							class:active={appState.websiteSearchMode === 'artist'}
							type="button"
							aria-pressed={appState.websiteSearchMode === 'artist'}
							onclick={() => setWebsiteSearchMode('artist')}
						>
							Artist
						</button>
						<button
							class:active={appState.websiteSearchMode === 'tags'}
							class:unavailable={!websiteTagsAvailable(activeSource)}
							type="button"
							aria-pressed={appState.websiteSearchMode === 'tags'}
							aria-disabled={!websiteTagsAvailable(activeSource)}
							disabled={!websiteTagsAvailable(activeSource)}
							title={websiteTagsAvailable(activeSource)
								? 'Search tags'
								: `${activeSourceLabel} tag search is not available yet`}
							onclick={() => setWebsiteSearchMode('tags')}
						>
							Tags
						</button>
					</div>
					<label class="website-provider">
						<span class="sr-only">Website</span>
						<select aria-label="Website" value={activeSource} onchange={selectWebsiteProvider}>
							<option value="danbooru">Danbooru</option>
							<option value="deviantart">DeviantArt</option>
							<option value="bluesky">Bluesky</option>
							<option value="furaffinity">Fur Affinity</option>
						</select>
					</label>
					<div class="website-query">
						<MagnifyingGlassIcon size={19} aria-hidden="true" />
						<input
							aria-label={appState.websiteSearchMode === 'artist'
								? `${activeSourceLabel} artist`
								: `${activeSourceLabel} tags`}
							value={appState.query}
							placeholder={appState.websiteSearchMode === 'artist'
								? 'Search an artist name or alias...'
								: `Search ${activeSourceLabel} tags...`}
							autocomplete="off"
							oninput={(event) => setSearchQuery(event.currentTarget.value)}
						/>
						<button
							class:saved={currentSavedSearch !== null}
							class="website-save"
							type="button"
							aria-label={currentSavedSearch ? 'Update saved search' : 'Save current search'}
							title={currentSavedSearch ? 'Saved' : 'Save this search'}
							disabled={appState.query.trim().length === 0 || savingSearch}
							onclick={saveCurrentSearch}
						>
							<BookmarkSimpleIcon size={18} weight={currentSavedSearch ? 'fill' : 'regular'} />
						</button>
						<button
							class="website-submit"
							type="submit"
							aria-label={`Search ${activeSourceLabel}`}
							disabled={appState.query.trim().length === 0}
						>
							<ArrowRightIcon size={17} weight="bold" />
						</button>
					</div>
					<button class="website-filter" type="button" onclick={openFilter}>
						<FunnelIcon size={18} />
						<span>Filter</span>
					</button>
					<button class="website-saved" type="button" onclick={openSavedSearches}>
						<BookmarkSimpleIcon size={18} />
						<span>Saved</span>
					</button>
				</form>
				{#if saveFeedback}
					<p class="save-feedback" role="status">{saveFeedback}</p>
				{/if}
			{/if}

			{#if activeSource === 'wikidata' && relatedSeed}
				<div class="related-context" aria-label="Current related works search">
					<div>
						<span>{relatedTitle ?? `Similar to ${relatedSeed.title}`}</span>
						<small
							>Ranked by shared subjects, creator, genre, collection, material, date, and direct
							work relations.</small
						>
					</div>
					<button type="button" onclick={clearRelatedMode}>Return to subject search</button>
				</div>
			{:else if activeSource === 'wikidata'}
				<div class:reference-mode={appState.wikimediaMode === 'reference'} class="wikimedia-search">
					<div class="website-mode" aria-label="Wikimedia search type">
						<button
							class:active={appState.wikimediaMode === 'art'}
							type="button"
							aria-pressed={appState.wikimediaMode === 'art'}
							onclick={() => selectWikimediaTopMode('art')}
						>
							Art
						</button>
						<button
							class:active={appState.wikimediaMode === 'reference'}
							type="button"
							aria-pressed={appState.wikimediaMode === 'reference'}
							onclick={() => selectWikimediaTopMode('reference')}
						>
							Reference
						</button>
					</div>
					{#if appState.wikimediaMode === 'art'}
						<label class="website-provider wikimedia-mode-select">
							<span class="sr-only">Artwork search mode</span>
							<select
								aria-label="Artwork search mode"
								value={appState.wikidataMode}
								onchange={(event) =>
									selectWikimediaMode(event.currentTarget.value as WikidataSearchMode)}
							>
								{#each wikimediaModes as mode (mode.id)}
									<option value={mode.id}>{mode.label}</option>
								{/each}
							</select>
						</label>
					{/if}
					<div class="wikimedia-query">
						<SearchBox
							mode="explore"
							label="Search Wikimedia"
							placeholder="Search Wikimedia..."
							onSave={saveCurrentSearch}
							saved={currentSavedSearch !== null}
							saving={savingSearch}
							saveDisabled={currentSavedQuery().length === 0}
						/>
					</div>
					<button class="website-filter" type="button" onclick={openFilter}>
						<FunnelIcon size={18} />
						<span>Filter</span>
					</button>
					<button class="website-saved" type="button" onclick={openSavedSearches}>
						<BookmarkSimpleIcon size={18} />
						<span>Saved</span>
					</button>
				</div>
				{#if saveFeedback}
					<p class="save-feedback" role="status">{saveFeedback}</p>
				{/if}
			{/if}

			{#if activeSource === 'wikidata' && !relatedSeed && appState.wikimediaMode === 'art'}
				{#if appState.wikidataSubjects.length > 0}
					<div class="subject-chip-row" aria-label="Selected Wikimedia entities">
						{#each appState.wikidataSubjects as subject (subject.id)}
							<button
								class="subject-chip"
								type="button"
								aria-label={`Remove ${subject.label}`}
								onclick={() => removeWikidataSubject(subject.id)}
							>
								<span>{subject.label}</span>
								<small>{subject.id}</small>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
			{#if visibleItems.length > 0}
				<p class="result-count" aria-live="polite">
					<span>{resultSummary}</span>
					{#if refreshing}
						<span class="refreshing-results">Refreshing {activeSourceResultLabel} results...</span>
					{/if}
				</p>
			{/if}

			{#if error}
				<section class="message" role="status">
					<h2>{activeSourceLabel} is taking a breather</h2>
					<p>{error}</p>
				</section>
			{:else if !loading && visibleItems.length === 0}
				<section class="message" role="status">
					<h2>No {activeSourceLabel} images found</h2>
					<p>
						{activeSource === 'wikidata'
							? relatedSeed
								? 'No related Wikidata works with images were found.'
								: appState.wikimediaMode === 'reference'
									? appState.wikimediaReferenceTokens.length > 0
										? 'No Wikimedia references matched those tokens and filters.'
										: 'Choose an entity, then add optional descriptors like female, juvenile, side view, skull, or texture.'
									: appState.wikidataSubjects.length > 0
										? `No Wikimedia artworks matched that ${activeWikimediaModeLabel.toLowerCase()}.`
										: appState.wikidataMode === 'title'
											? 'Search for an artwork title to find Wikimedia records.'
											: `Search for a ${activeWikimediaModeLabel.toLowerCase()} in the field above.`
							: isWebsiteSource(activeSource)
								? keyword.length > 0
									? `No ${activeSourceLabel} images matched "${keyword || 'these filters'}".`
									: `Search by ${appState.websiteSearchMode === 'artist' ? 'artist name' : `${activeSourceLabel} tags`} to begin.`
								: hasSearched
									? `No usable image records matched "${keyword || 'these filters'}".`
									: 'Try searching by artwork, artist, or collection.'}
					</p>
				</section>
			{:else}
				<ExploreGrid
					items={visibleItems}
					activeId={selectedItem?.id}
					{loading}
					sourceLabel={activeSourceLabel}
					contentSafety={isWebsiteSource(activeSource)
						? websiteContentSafety(activeSource)
						: 'show'}
					onOpen={openItem}
					onPrefetch={prefetchItem}
				/>
				<div bind:this={loadMoreSentinel} class="load-more" aria-live="polite">
					{#if loadingMore}
						<div class="load-status active">
							<span class="loading-dot" aria-hidden="true"></span>
							<span>Loading more {activeSourceResultLabel} results...</span>
						</div>
					{:else if pageError}
						<div class="load-status error">
							<span>{pageError}</span>
							<button type="button" onclick={() => loadNextPage(queryKey, true)}>
								Retry loading {activeSourceResultLabel} results
							</button>
						</div>
					{:else if nextCursor}
						<span class="load-note">More results available</span>
					{:else if items.length > 0}
						<span class="load-note">End of current {activeSourceResultLabel} results</span>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	{#if selectedItem}
		<ExploreInspector
			item={selectedItem}
			onClose={() => (selectedItem = null)}
			onPreview={(item) => (previewItem = item)}
			onOpenRelated={openRelatedPage}
			onOpenRelatedItem={openItem}
		/>
	{/if}

	{#if inspectedOnMobile}
		<ExploreInspector
			item={selectedItem}
			mobile
			onClose={() => (inspectedOnMobile = false)}
			onPreview={(item) => (previewItem = item)}
			onOpenRelated={openRelatedPage}
			onOpenRelatedItem={openItem}
		/>
	{/if}

	{#if previewItem}
		<FocusedArtPreview item={previewItem} onClose={() => (previewItem = null)} />
	{/if}
</div>

{#if savedOpen && supportsSavedSearches(activeSource)}
	<SavedSearchesPanel
		source={activeSource}
		mode={activeSavedSearchMode()}
		searches={savedSearches}
		loading={savedLoading}
		error={savedError}
		onClose={() => (savedOpen = false)}
		onOpen={applySavedSearch}
		onDelete={deleteSavedSearch}
	/>
{/if}

<style>
	.explore-workspace {
		height: 100%;
		display: flex;
		min-width: 0;
	}

	.explore-content {
		min-width: 0;
		flex: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.scroll-area {
		min-height: 0;
		flex: 1;
		overflow: auto;
	}

	.source-switcher,
	.website-mode {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.explore-heading {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-5) var(--space-2);
	}

	.explore-heading h1 {
		flex: 0 0 auto;
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.9rem;
		font-weight: 600;
		line-height: 1;
	}

	.source-switcher {
		min-width: 0;
		flex: 1;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-inline: contain;
		touch-action: pan-x;
	}

	.source-switcher::-webkit-scrollbar {
		display: none;
	}

	.source-switcher button,
	.website-mode button {
		flex: 0 0 auto;
		min-height: 2.2rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-muted);
		cursor: pointer;
	}

	.source-switcher button.active,
	.source-switcher button:hover,
	.source-switcher button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.website-search {
		display: grid;
		grid-template-columns: auto minmax(9rem, 13rem) minmax(16rem, 1fr) auto auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-5) var(--space-4);
	}

	.museum-search,
	.wikimedia-search {
		display: grid;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-5) var(--space-4);
	}

	.museum-search {
		grid-template-columns: minmax(16rem, 1fr) auto;
	}

	.wikimedia-search {
		grid-template-columns: auto minmax(9rem, 13rem) minmax(16rem, 1fr) auto auto;
	}

	.wikimedia-search.reference-mode {
		grid-template-columns: auto minmax(16rem, 1fr) auto auto;
	}

	.museum-query,
	.wikimedia-query {
		min-width: 0;
	}

	.museum-query :global(.search),
	.wikimedia-query :global(.search) {
		height: 2.75rem;
	}

	.website-mode {
		padding: 0.2rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		overflow: visible;
	}

	.website-mode button {
		min-height: 2.35rem;
		border-color: transparent;
		background: transparent;
	}

	.website-mode button.active,
	.website-mode button:hover,
	.website-mode button:focus-visible {
		border-color: var(--color-border);
		background: var(--color-surface-raised);
		color: var(--color-text);
	}

	.website-mode button.unavailable,
	.website-mode button:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}

	.website-provider,
	.website-query {
		min-width: 0;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	.website-provider {
		position: relative;
	}

	.website-provider select {
		width: 100%;
		min-height: 2.7rem;
		padding: 0 2.3rem 0 var(--space-3);
		border: 0;
		border-radius: inherit;
		background: var(--color-surface);
		color: var(--color-text);
		color-scheme: dark;
		font: inherit;
		cursor: pointer;
	}

	.website-query {
		gap: var(--space-2);
		padding-left: var(--space-3);
	}

	.website-query:focus-within,
	.website-provider:focus-within {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.website-query input {
		min-width: 0;
		flex: 1;
		height: 2.65rem;
		border: 0;
		background: transparent;
		color: var(--color-text);
		outline: none;
		font: inherit;
	}

	.website-submit,
	.website-save,
	.website-filter,
	.website-saved {
		height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.website-submit,
	.website-save {
		width: 2.6rem;
		flex: 0 0 auto;
	}

	.website-submit {
		margin-right: 0.18rem;
		border-color: oklch(78% 0.08 78 / 0.42);
		background: oklch(26% 0.025 75);
	}

	.website-save {
		border-color: transparent;
		background: transparent;
		color: var(--color-muted);
	}

	.website-save.saved {
		color: var(--color-accent);
	}

	.website-submit:disabled,
	.website-save:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.website-filter,
	.website-saved {
		gap: var(--space-2);
		padding: 0 var(--space-3);
	}

	.website-submit:not(:disabled):hover,
	.website-submit:not(:disabled):focus-visible,
	.website-save:not(:disabled):hover,
	.website-save:not(:disabled):focus-visible,
	.website-filter:hover,
	.website-filter:focus-visible,
	.website-saved:hover,
	.website-saved:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-raised);
	}

	.save-feedback {
		margin: calc(var(--space-3) * -1) var(--space-5) var(--space-3);
		color: var(--color-accent);
		font-size: 0.76rem;
		text-align: right;
	}

	.subject-chip-row {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		padding: 0 var(--space-5) var(--space-3);
		scrollbar-width: none;
	}

	.subject-chip-row::-webkit-scrollbar {
		display: none;
	}

	.subject-chip {
		flex: 0 0 auto;
		min-height: 2rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
		color: var(--color-text);
		cursor: pointer;
	}

	.subject-chip small {
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	.related-context {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin: 0 var(--space-5) var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.related-context div {
		min-width: 0;
		display: grid;
		gap: 0.2rem;
	}

	.related-context span {
		color: var(--color-text);
		font-weight: 650;
	}

	.related-context small {
		color: var(--color-muted);
		line-height: 1.35;
	}

	.related-context button {
		flex: 0 0 auto;
		min-height: 2.1rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
		color: var(--color-text);
		cursor: pointer;
	}

	.result-count {
		margin: 0;
		padding: 0 var(--space-5) var(--space-1);
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--color-muted);
		font-size: 0.82rem;
	}

	.refreshing-results {
		color: var(--color-dim);
	}

	.message {
		margin: var(--space-5);
		min-height: 18rem;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: var(--space-2);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		text-align: center;
	}

	.message h2,
	.message p {
		margin: 0;
	}

	.message p {
		max-width: 34rem;
		color: var(--color-muted);
		line-height: 1.5;
	}

	.load-more {
		min-height: 5rem;
		display: grid;
		place-items: center;
		padding: 0 var(--space-5) var(--space-6);
		color: var(--color-muted);
		font-size: 0.86rem;
	}

	.load-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.load-status.error {
		border-color: var(--color-border);
	}

	.load-status button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface-soft);
		color: var(--color-text);
		cursor: pointer;
	}

	.load-status button:hover,
	.load-status button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-raised);
	}

	.loading-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--color-accent);
		animation: breathe 0.9s ease-in-out infinite alternate;
	}

	.load-note {
		color: var(--color-dim);
	}

	@keyframes breathe {
		from {
			opacity: 0.42;
			transform: scale(0.72);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (max-width: 759px) {
		.explore-workspace {
			display: block;
			height: auto;
		}

		.explore-content {
			height: auto;
			min-height: 100%;
		}

		.scroll-area {
			overflow: visible;
		}

		.explore-heading {
			gap: var(--space-3);
			padding: var(--space-3) var(--space-3) var(--space-2);
		}

		.explore-heading h1 {
			font-size: 1.55rem;
		}

		.website-search {
			grid-template-columns: 1fr 1fr auto auto;
			padding: var(--space-2) var(--space-3) var(--space-3);
		}

		.website-mode {
			grid-column: 1;
		}

		.website-provider {
			grid-column: 2;
		}

		.website-query {
			grid-column: 1 / 5;
			grid-row: 2;
		}

		.website-filter {
			grid-column: 3;
			grid-row: 1;
			width: 2.75rem;
			padding: 0;
		}

		.website-saved {
			grid-column: 4;
			grid-row: 1;
			width: 2.75rem;
			padding: 0;
		}

		.museum-search {
			grid-template-columns: minmax(0, 1fr) auto;
			padding: var(--space-2) var(--space-3) var(--space-3);
		}

		.museum-query {
			grid-column: 1;
		}

		.museum-search .website-filter {
			grid-column: 2;
			grid-row: 1;
		}

		.wikimedia-search,
		.wikimedia-search.reference-mode {
			grid-template-columns: minmax(0, 1fr) auto auto;
			padding: var(--space-2) var(--space-3) var(--space-3);
		}

		.wikimedia-search .website-mode {
			grid-column: 1;
			grid-row: 1;
		}

		.wikimedia-mode-select {
			grid-column: 1 / 4;
			grid-row: 2;
		}

		.wikimedia-query {
			grid-column: 1 / 4;
			grid-row: 3;
		}

		.wikimedia-search.reference-mode .wikimedia-query {
			grid-column: 1 / 4;
			grid-row: 2;
		}

		.wikimedia-search .website-filter,
		.wikimedia-search:not(.reference-mode) .website-filter {
			grid-column: 2;
			grid-row: 1;
		}

		.wikimedia-search .website-saved,
		.wikimedia-search:not(.reference-mode) .website-saved {
			grid-column: 3;
			grid-row: 1;
		}

		.wikimedia-search.reference-mode .website-mode {
			grid-column: 1;
		}

		.website-filter span,
		.website-saved span {
			display: none;
		}

		.save-feedback {
			margin: calc(var(--space-2) * -1) var(--space-3) var(--space-3);
		}

		.subject-chip-row {
			padding: 0 var(--space-3) var(--space-3);
		}

		.related-context {
			display: grid;
			margin: 0 var(--space-3) var(--space-3);
		}

		.related-context button {
			justify-self: start;
		}

		.result-count {
			padding: 0 var(--space-3) var(--space-1);
		}
	}

	@media (min-width: 760px) and (max-width: 1050px) {
		.website-search {
			grid-template-columns: auto minmax(9rem, 1fr) auto auto;
		}

		.website-query {
			grid-column: 1 / 3;
			grid-row: 2;
		}

		.website-filter {
			grid-column: 3;
			grid-row: 1 / 3;
		}

		.website-saved {
			grid-column: 4;
			grid-row: 1 / 3;
		}

		.wikimedia-search,
		.wikimedia-search.reference-mode {
			grid-template-columns: auto minmax(9rem, 1fr) auto auto;
		}

		.wikimedia-query,
		.wikimedia-search.reference-mode .wikimedia-query {
			grid-column: 1 / 3;
			grid-row: 2;
		}

		.wikimedia-search .website-filter {
			grid-column: 3;
			grid-row: 1 / 3;
		}

		.wikimedia-search .website-saved {
			grid-column: 4;
			grid-row: 1 / 3;
		}
	}
</style>
