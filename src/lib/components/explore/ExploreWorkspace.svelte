<script lang="ts">
	import ExploreGrid from '$lib/components/explore/ExploreGrid.svelte';
	import ExploreInspector from '$lib/components/explore/ExploreInspector.svelte';
	import FocusedArtPreview from '$lib/components/explore/FocusedArtPreview.svelte';
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
	import {
		appState,
		clearExploreQueryPatch,
		setExploreSourceLabel,
		setExploreSuggestions,
		setShellScrolled
	} from '$lib/state/app-state.svelte';
	import type {
		ExploreItem,
		ExplorePage,
		ExploreQuery,
		SourceDepartment,
		SourceId
	} from '$lib/explore/types';

	const sources = [
		{ id: 'met' as const, label: 'The Met', eyebrow: 'The Met Collection' },
		{
			id: 'artic' as const,
			label: 'Art Institute of Chicago',
			eyebrow: 'Art Institute Collection'
		}
	];

	let activeSource = $state<SourceId>('met');
	let items = $state<ExploreItem[]>([]);
	let selectedItem = $state<ExploreItem | null>(null);
	let departments = $state<SourceDepartment[]>([]);
	let activeDepartment = $state<string | null>(null);
	let highlightOnly = $state(false);
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
	const pendingSearches = new Map<string, Promise<ExplorePage>>();
	const activeControllers = new Set<AbortController>();

	let activeSourceConfig = $derived(
		sources.find((source) => source.id === activeSource) ?? sources[0]
	);
	let activeSourceLabel = $derived(activeSourceConfig.label);
	let activeSourceResultLabel = $derived(activeSource === 'met' ? 'Met' : activeSourceLabel);
	let draftKeyword = $derived(appState.query.trim());
	let keyword = $derived(appState.exploreCommittedQuery.trim());
	let queryPatchKey = $derived(JSON.stringify(appState.exploreQueryPatch ?? {}));
	let queryKey = $derived(
		`${activeSource}|${keyword}|${activeDepartment ?? ''}|${highlightOnly ? 'highlights' : 'all'}|${queryPatchKey}`
	);
	let hasSearched = $derived(keyword.length > 0 || activeDepartment !== null || highlightOnly);
	let resultSummary = $derived(
		total === null
			? `Showing ${items.length.toLocaleString()} results`
			: `Showing ${items.length.toLocaleString()} of ${total.toLocaleString()} matches`
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
		setExploreSourceLabel(activeSourceLabel);
	});

	$effect(() => {
		return () => abortActiveRequests();
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
		const cacheKey = exploreSearchKey(source, query);
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
			const page = await fetchSearchPage(query, {
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
		loadingMore = true;
		pageError = null;
		const cursor = nextCursor;
		const query = buildQuery(cursor);

		try {
			const page = await fetchSearchPage(query, { source, signal: controller.signal });
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
		items = page.items;
		total = page.total;
		nextCursor = page.nextCursor;
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
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
		return {
			keyword: keyword || undefined,
			...patch,
			department: patch.department ?? activeDepartment ?? undefined,
			hasImageOnly: true,
			isHighlightOnly: highlightOnly || undefined,
			cursor,
			limit: 20
		};
	}

	function selectAllResults() {
		clearExploreQueryPatch();
		activeDepartment = null;
		highlightOnly = false;
	}

	function selectSource(source: SourceId) {
		if (activeSource === source) return;
		abortActiveRequests();
		activeSource = source;
		clearExploreQueryPatch();
		activeDepartment = null;
		highlightOnly = false;
		selectedItem = null;
		inspectedOnMobile = false;
		previewItem = null;
		prefetchingSearchKey = null;
	}

	function toggleHighlights() {
		clearExploreQueryPatch();
		activeDepartment = null;
		highlightOnly = !highlightOnly;
	}

	function selectDepartment(id: string) {
		clearExploreQueryPatch();
		activeDepartment = id;
		highlightOnly = false;
	}

	function sourceLabelFor(source: SourceId) {
		return sources.find((option) => option.id === source)?.label ?? 'Explore';
	}

	function openItem(item: ExploreItem) {
		selectedItem = item;
		void cacheSet(exploreObjectKey(item.id), item, CLIENT_OBJECT_TTL_MS);
		if (window.matchMedia('(max-width: 979px)').matches) {
			inspectedOnMobile = true;
		}
	}

	async function prefetchItem(item: ExploreItem) {
		const cacheKey = exploreObjectKey(item.id);
		if (await cacheGet<ExploreItem>(cacheKey)) return;
		void cacheSet(cacheKey, item, CLIENT_OBJECT_TTL_MS);

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
		if (progress > 0.7) {
			void prefetchNextPage(queryKey);
		}
		if (target.scrollHeight - target.scrollTop - target.clientHeight < 720) {
			void loadNextPage(queryKey);
		}
	}
</script>

<div class="explore-workspace">
	<section class="explore-content" aria-label={`Explore ${activeSourceLabel} collection`}>
		<div class="scroll-area" onscroll={handleScroll}>
			<header class="source-header">
				<div>
					<p>{activeSourceConfig.eyebrow}</p>
					<h1>Explore public-domain museum references</h1>
				</div>
				<span>{total === null ? activeSourceLabel : `${total.toLocaleString()} matches`}</span>
			</header>

			<div class="source-switcher" aria-label="Explore sources">
				{#each sources as source (source.id)}
					<button
						class:active={activeSource === source.id}
						type="button"
						aria-pressed={activeSource === source.id}
						onclick={() => selectSource(source.id)}
					>
						{source.label}
					</button>
				{/each}
			</div>

			<div class="department-strip" aria-label={`${activeSourceLabel} departments`}>
				<button
					class:active={!highlightOnly && activeDepartment === null}
					type="button"
					onclick={selectAllResults}
				>
					All {activeSourceLabel} images
				</button>
				<button
					class:active={highlightOnly}
					type="button"
					aria-pressed={highlightOnly}
					onclick={toggleHighlights}
				>
					Highlights
				</button>
				{#each departments.slice(0, 8) as department (department.id)}
					<button
						class:active={!highlightOnly && activeDepartment === department.id}
						type="button"
						onclick={() => selectDepartment(department.id)}
					>
						{department.label}
					</button>
				{/each}
			</div>
			{#if items.length > 0}
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
			{:else if !loading && items.length === 0}
				<section class="message" role="status">
					<h2>No {activeSourceLabel} images found</h2>
					<p>
						{hasSearched
							? `No usable image records matched "${keyword || 'this department'}".`
							: 'Try searching by artwork, artist, or collection.'}
					</p>
				</section>
			{:else}
				<ExploreGrid
					{items}
					activeId={selectedItem?.id}
					{loading}
					sourceLabel={activeSourceLabel}
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
		/>
	{/if}

	{#if inspectedOnMobile}
		<ExploreInspector
			item={selectedItem}
			mobile
			onClose={() => (inspectedOnMobile = false)}
			onPreview={(item) => (previewItem = item)}
		/>
	{/if}

	{#if previewItem}
		<FocusedArtPreview item={previewItem} onClose={() => (previewItem = null)} />
	{/if}
</div>

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

	.source-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-5) var(--space-3);
	}

	.source-header p,
	.source-header h1 {
		margin: 0;
	}

	.source-header p {
		color: var(--color-accent);
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.source-header h1 {
		margin-top: var(--space-1);
		font-family: var(--font-heading);
		font-size: clamp(1.35rem, 2.5vw, 2.15rem);
		font-weight: 600;
		line-height: 1.08;
	}

	.source-header span {
		color: var(--color-muted);
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.source-switcher,
	.department-strip {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.source-switcher {
		padding: 0 var(--space-5) var(--space-2);
	}

	.department-strip {
		padding: 0 var(--space-5) var(--space-2);
	}

	.source-switcher::-webkit-scrollbar,
	.department-strip::-webkit-scrollbar {
		display: none;
	}

	.source-switcher button,
	.department-strip button {
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
	.source-switcher button:focus-visible,
	.department-strip button.active,
	.department-strip button:hover,
	.department-strip button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
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

		.source-header {
			align-items: start;
			padding: var(--space-3) var(--space-3) var(--space-2);
		}

		.source-header span {
			display: none;
		}

		.source-switcher,
		.department-strip {
			padding: 0 var(--space-3) var(--space-2);
		}

		.result-count {
			padding: 0 var(--space-3) var(--space-1);
		}
	}
</style>
