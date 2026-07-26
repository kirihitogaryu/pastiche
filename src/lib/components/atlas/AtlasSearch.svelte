<script lang="ts">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import GridFourIcon from 'phosphor-svelte/lib/GridFourIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import AtlasMobileContext from './AtlasMobileContext.svelte';
	import { isGifMedia } from '$lib/library/media';
	import {
		appState,
		openAtlasAsset,
		openAtlasSearch,
		openAtlasWiki,
		rememberAtlasSearchScroll,
		setMobileNavHidden
	} from '$lib/state/app-state.svelte';
	import type {
		AtlasSearchResponse,
		AtlasSearchEntityResult,
		AtlasSearchResult,
		AtlasSearchWikiPreview,
		AtlasSidebarItem,
		AtlasSidebarSection
	} from '$lib/atlas/searchTypes';

	type ViewMode = 'grid' | 'list';
	type SearchSort = 'relevance' | 'title' | 'newest';
	type PageSize = '25' | '50' | '100';
	type RoleFilter = 'all' | 'focal' | 'exclude_supporting' | 'exclude_background';

	const ROLE_FILTER_QUERY: Record<RoleFilter, string> = {
		all: '',
		focal: 'role:focal',
		exclude_supporting: 'exclude_role:supporting',
		exclude_background: 'exclude_role:background,setting'
	};

	let response = $state<AtlasSearchResponse | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let continuationError = $state<string | null>(null);
	let viewMode = $state<ViewMode>('grid');
	let pageSize = $state<PageSize>('50');
	let sort = $state<SearchSort>('relevance');
	let roleFilter = $state<RoleFilter>('all');
	let sidebarOpen = $state(true);
	let wikiPreviewOpen = $state(true);
	let openSections = $state<Record<string, boolean>>({});
	let expandedMiniLists = $state<Record<string, boolean>>({});
	let imageErrors = $state<Record<string, boolean>>({});
	let animatedResultId = $state<string | null>(null);
	let loadSentinel = $state<HTMLDivElement | null>(null);
	let mainScrollElement = $state<HTMLElement | null>(null);
	let restoredScroll = $state(false);
	let lastScrollTop = 0;
	let scrollIntent = 0;

	let activeQuery = $derived(appState.atlasSearchQuery.trim());
	let results = $derived(response?.results ?? []);
	let entityResults = $derived(response?.entityResults ?? []);
	let hasQuery = $derived(activeQuery.length > 0);
	let wikiPreview = $derived(response?.wikiPreview ?? null);
	let showWikiPreview = $derived(Boolean(wikiPreview));
	let nextCursor = $derived(response?.page.nextCursor ?? null);

	function resultIsGif(
		result: Pick<AtlasSearchResult, 'id' | 'title' | 'thumbnailUrl' | 'mimeType'>
	) {
		return isGifMedia(result.mimeType, result.title, result.thumbnailUrl);
	}

	function resultOriginalUrl(result: Pick<AtlasSearchResult, 'id'>) {
		return `/api/library/assets/${encodeURIComponent(result.id)}/image?variant=original`;
	}

	function startResultPreview(
		result: Pick<AtlasSearchResult, 'id' | 'title' | 'thumbnailUrl' | 'mimeType'>
	) {
		if (!resultIsGif(result) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		animatedResultId = result.id;
	}

	function stopResultPreview(result: Pick<AtlasSearchResult, 'id'>) {
		if (animatedResultId === result.id) animatedResultId = null;
	}

	$effect(() => {
		const query = appState.atlasSearchQuery.trim();
		if (!query) {
			response = null;
			loading = false;
			error = null;
			return;
		}
		setMobileNavHidden(false);
		lastScrollTop = 0;
		scrollIntent = 0;
		restoredScroll = false;

		let cancelled = false;
		const controller = new AbortController();
		loading = true;
		loadingMore = false;
		error = null;
		continuationError = null;
		const params = new URLSearchParams({ q: query, limit: pageSize, sort });
		void fetch(`/api/atlas/search?${params.toString()}`, { signal: controller.signal })
			.then(async (searchResponse) => {
				const body = (await searchResponse.json()) as AtlasSearchResponse | { error?: string };
				if (!searchResponse.ok || !('results' in body)) {
					throw new Error('error' in body && body.error ? body.error : 'Atlas search failed.');
				}
				if (!cancelled) {
					response = body;
					window.requestAnimationFrame(() => restoreSearchScroll(query));
				}
			})
			.catch((searchError) => {
				if (cancelled || searchError instanceof DOMException) return;
				error = searchError instanceof Error ? searchError.message : 'Atlas search failed.';
				response = null;
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
			controller.abort();
		};
	});

	function restoreSearchScroll(query: string) {
		if (restoredScroll || !mainScrollElement) return;
		restoredScroll = true;
		if (appState.atlasSearchScrollQuery !== query) return;
		mainScrollElement.scrollTop = appState.atlasSearchScrollTop;
	}

	function handleMainScroll(event: Event & { currentTarget: HTMLElement }) {
		const scrollTop = event.currentTarget.scrollTop;
		const delta = scrollTop - lastScrollTop;

		if (scrollTop <= 24) {
			scrollIntent = 0;
			setMobileNavHidden(false);
		} else if (Math.abs(delta) >= 1) {
			if (Math.sign(delta) !== Math.sign(scrollIntent)) scrollIntent = 0;
			scrollIntent += delta;
			if (scrollIntent > 18 && scrollTop > 64) {
				setMobileNavHidden(true);
				scrollIntent = 0;
			} else if (scrollIntent < -12) {
				setMobileNavHidden(false);
				scrollIntent = 0;
			}
		}

		lastScrollTop = scrollTop;
	}

	$effect(() => {
		const sentinel = loadSentinel;
		const cursor = nextCursor;
		if (!sentinel || !cursor || typeof IntersectionObserver === 'undefined') return;
		const root = sentinel.closest('.main-scroll');
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
			},
			{ root, rootMargin: '700px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	async function loadNextPage() {
		const cursor = response?.page.nextCursor;
		if (!cursor || loading || loadingMore) return;
		loadingMore = true;
		continuationError = null;
		const params = new URLSearchParams({
			q: activeQuery,
			limit: pageSize,
			sort,
			cursor
		});
		try {
			const searchResponse = await fetch(`/api/atlas/search?${params.toString()}`);
			const body = (await searchResponse.json()) as AtlasSearchResponse | { error?: string };
			if (!searchResponse.ok || !('results' in body)) {
				throw new Error(
					'error' in body && body.error ? body.error : 'More Atlas results could not be loaded.'
				);
			}
			const known = new Set(response?.results.map((result) => result.id) ?? []);
			response = {
				...body,
				results: [
					...(response?.results ?? []),
					...body.results.filter((result) => !known.has(result.id))
				]
			};
		} catch (loadError) {
			continuationError =
				loadError instanceof Error ? loadError.message : 'More Atlas results could not be loaded.';
		} finally {
			loadingMore = false;
		}
	}

	function applySidebarItem(item: AtlasSidebarItem) {
		openAtlasSearch(item.query ?? item.slug ?? item.value);
	}

	function applyRoleFilter(value: RoleFilter) {
		roleFilter = value;
		const base = removeRoleClauses(activeQuery);
		const roleClause = ROLE_FILTER_QUERY[value];
		openAtlasSearch([base, roleClause].filter(Boolean).join(' '));
	}

	function removeRoleClauses(query: string) {
		return query
			.split(/\s+/)
			.filter((part) => part && !part.startsWith('role:') && !part.startsWith('exclude_role:'))
			.join(' ');
	}

	function sectionOpen(section: AtlasSidebarSection, index: number) {
		return openSections[section.title] ?? (index < 2 || section.kind === 'classifiers');
	}

	function sectionTone(item: AtlasSidebarItem) {
		if (item.tone === 'classifier') return 'classifier';
		if (item.tone === 'warning' || item.intent === 'context') return 'context';
		return 'visual';
	}

	function resultSubtitle(result: AtlasSearchResult) {
		return result.subtitle || result.sourceUrl;
	}

	function resultAspect(result: AtlasSearchResult) {
		if (!result.width || !result.height) return '4 / 3';
		return `${result.width} / ${result.height}`;
	}

	function inspectResult(result: AtlasSearchResult) {
		rememberAtlasSearchScroll(activeQuery, mainScrollElement?.scrollTop ?? 0);
		openAtlasAsset(result.id);
	}

	function entitySubtitle(entity: AtlasSearchEntityResult) {
		const link = entity.links[0];
		const account = link
			? [link.host, link.username ? `@${link.username}` : null].filter(Boolean).join(' ')
			: '';
		const count = `${entity.workCount.toLocaleString()} ${entity.workCount === 1 ? 'work' : 'works'}`;
		return [count, account].filter(Boolean).join(' · ');
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}

	function displayQueryLabel(value: string) {
		return displayLabel(value)
			.replace(/[()]/g, '')
			.replace(/[.:,+]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function titleLabel(value: string) {
		return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function wikiSummary(preview: AtlasSearchWikiPreview) {
		return preview.useWhen[0] || preview.shortDefinition;
	}

	function miniValues(values: string[], key: string, limit: number) {
		return expandedMiniLists[key] ? values : values.slice(0, limit);
	}

	function toggleMiniList(key: string) {
		expandedMiniLists = { ...expandedMiniLists, [key]: !expandedMiniLists[key] };
	}
</script>

<section
	class="atlas-search"
	class:sidebar-collapsed={!sidebarOpen}
	aria-label="Atlas search browser"
>
	<aside class="facet-panel" aria-label="Atlas related tags">
		<div class="facet-head">
			<span>Tag Map</span>
			<button
				type="button"
				aria-label={sidebarOpen ? 'Collapse tag sidebar' : 'Expand tag sidebar'}
				onclick={() => (sidebarOpen = !sidebarOpen)}
			>
				{#if sidebarOpen}
					<CaretLeftIcon size={17} />
				{:else}
					<CaretRightIcon size={17} />
				{/if}
			</button>
		</div>
		{#if sidebarOpen}
			<div class="facet-scroll">
				{#if response?.sidebar.length}
					{#each response.sidebar as section, index (section.title)}
						<details
							class="facet-section"
							open={sectionOpen(section, index)}
							ontoggle={(event) => (openSections[section.title] = event.currentTarget.open)}
						>
							<summary>
								<span>{section.title}</span>
								<CaretDownIcon class="chev" size={14} />
							</summary>

							{#if section.kind === 'classifiers' && section.classifierGroups?.length}
								<div class="classifier-list">
									{#each section.classifierGroups as group, groupIndex (group.value)}
										<details
											class="classifier-group"
											open={groupIndex < 2 && group.values.length > 0}
										>
											<summary>
												<span>{displayLabel(group.value)}</span>
												<CaretDownIcon class="chev" size={13} />
											</summary>
											{#if group.values.length}
												<div class="classifier-values">
													{#each group.values as value (value.value)}
														<button type="button" onclick={() => openAtlasSearch(value.query)}>
															<strong>{displayLabel(value.value)}</strong>
															{#if value.count !== null}
																<span>{value.count.toLocaleString()}</span>
															{/if}
														</button>
													{/each}
												</div>
											{:else}
												<span class="empty-classifier">No values indexed yet.</span>
											{/if}
										</details>
									{/each}
								</div>
							{:else}
								<div class="facet-tokens">
									{#each section.items as item (`${section.title}-${item.value}-${item.query}`)}
										<button
											type="button"
											class={sectionTone(item)}
											onclick={() => applySidebarItem(item)}
										>
											<span>{item.label}</span>
											{#if item.count !== null}
												<small>{item.count.toLocaleString()}</small>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</details>
					{/each}
				{:else}
					<div class="panel-empty">
						<p>Run a tag search to map classifiers, specialist tags, and refinements.</p>
					</div>
				{/if}
			</div>
		{/if}
	</aside>

	<main
		bind:this={mainScrollElement}
		class="main-scroll"
		aria-label="Atlas search results"
		aria-busy={loading || loadingMore}
		onscroll={handleMainScroll}
	>
		{#if error}
			<div class="empty">{error}</div>
		{:else if !hasQuery}
			<div class="empty">Search Atlas tags, classifiers, entities, and visual roles.</div>
		{:else}
			{#if showWikiPreview && wikiPreview}
				{@const implicationKey = `${wikiPreview.slug}:implications`}
				{@const implicationLimit = 4}
				{@const classifierKey = `${wikiPreview.slug}:allowed-classifiers`}
				{@const classifierLimit = 8}
				<details
					class="wiki-preview"
					open={wikiPreviewOpen}
					ontoggle={(event) => (wikiPreviewOpen = event.currentTarget.open)}
				>
					<summary>
						<span class="label">Wiki Preview</span>
						<span class="hint"
							>{titleLabel(wikiPreview.kind)} wiki preview <CaretDownIcon size={14} /></span
						>
					</summary>
					<div class="preview-body">
						<section
							class="preview-block identity-block"
							class:no-example={!wikiPreview.exampleAsset?.thumbnailUrl}
						>
							{#if wikiPreview.exampleAsset?.thumbnailUrl}
								<button
									type="button"
									class="example-thumb"
									aria-label={`${resultIsGif(wikiPreview.exampleAsset) ? 'Animated GIF. ' : ''}Open ${wikiPreview.exampleAsset.title}`}
									onclick={() => openAtlasAsset(wikiPreview.exampleAsset?.id ?? '')}
									onpointerenter={() => startResultPreview(wikiPreview.exampleAsset!)}
									onpointerleave={() => stopResultPreview(wikiPreview.exampleAsset!)}
									onfocus={() => startResultPreview(wikiPreview.exampleAsset!)}
									onblur={() => stopResultPreview(wikiPreview.exampleAsset!)}
								>
									<img
										class:static-hidden={resultIsGif(wikiPreview.exampleAsset) &&
											animatedResultId === wikiPreview.exampleAsset.id}
										src={wikiPreview.exampleAsset.thumbnailUrl}
										alt=""
									/>
									{#if resultIsGif(wikiPreview.exampleAsset) && animatedResultId === wikiPreview.exampleAsset.id}
										<img
											class="animated-preview"
											src={resultOriginalUrl(wikiPreview.exampleAsset)}
											alt=""
											aria-hidden="true"
											onerror={() => stopResultPreview(wikiPreview.exampleAsset!)}
										/>
									{/if}
									{#if resultIsGif(wikiPreview.exampleAsset)}
										<span
											class="gif-badge"
											aria-hidden="true"
											title="Animated GIF; hover or focus to preview">GIF</span
										>
									{/if}
								</button>
							{/if}
							<div>
								<div class="concept-title">
									<h1>{wikiPreview.label}</h1>
									<span aria-hidden="true">☆</span>
								</div>
								<p class="concept-type">
									{titleLabel(wikiPreview.kind)} · {titleLabel(wikiPreview.category)} · {titleLabel(
										wikiPreview.maturity
									)}
								</p>
								<p class="preview-copy">{wikiSummary(wikiPreview)}</p>
								<button
									type="button"
									class="preview-link"
									onclick={() => openAtlasWiki(wikiPreview.openWikiQuery)}
								>
									Open full wiki →
								</button>
							</div>
						</section>

						<section class="preview-block">
							<h2>Implications</h2>
							<div class="mini-list">
								{#each miniValues(wikiPreview.automaticImplications, implicationKey, implicationLimit) as implication (implication)}
									<span class="mini-chip visual">{implication}</span>
								{/each}
								{#if wikiPreview.automaticImplications.length > implicationLimit}
									<button
										type="button"
										class="mini-chip more"
										aria-expanded={expandedMiniLists[implicationKey] ? 'true' : 'false'}
										aria-label={expandedMiniLists[implicationKey]
											? 'Show fewer implications'
											: `Show ${wikiPreview.automaticImplications.length - implicationLimit} more implications`}
										onclick={() => toggleMiniList(implicationKey)}
									>
										{expandedMiniLists[implicationKey]
											? 'less'
											: `+${wikiPreview.automaticImplications.length - implicationLimit}`}
									</button>
								{/if}
								{#if wikiPreview.automaticImplications.length === 0}
									<span class="mini-muted">No automatic implications yet.</span>
								{/if}
							</div>
						</section>

						<section class="preview-block">
							<h2>Allowed Classifiers</h2>
							<div class="mini-list">
								{#each miniValues(wikiPreview.allowedClassifiers, classifierKey, classifierLimit) as classifier (classifier)}
									<button
										type="button"
										class="mini-chip classifier"
										onclick={() => openAtlasSearch(`${wikiPreview.slug}.${classifier}:`)}
									>
										{classifier}
									</button>
								{/each}
								{#if wikiPreview.allowedClassifiers.length > classifierLimit}
									<button
										type="button"
										class="mini-chip more classifier"
										aria-expanded={expandedMiniLists[classifierKey] ? 'true' : 'false'}
										aria-label={expandedMiniLists[classifierKey]
											? 'Show fewer classifiers'
											: `Show ${wikiPreview.allowedClassifiers.length - classifierLimit} more classifiers`}
										onclick={() => toggleMiniList(classifierKey)}
									>
										{expandedMiniLists[classifierKey]
											? 'less'
											: `+${wikiPreview.allowedClassifiers.length - classifierLimit}`}
									</button>
								{/if}
								{#if wikiPreview.allowedClassifiers.length === 0}
									<span class="mini-muted">No classifiers assigned.</span>
								{/if}
							</div>
						</section>
					</div>
				</details>
			{:else if response?.context.mode === 'multi_clause'}
				<div class="query-context">
					<strong>{response.query.clauses.length} clauses combined</strong>
					<span>Wiki preview is hidden for combined searches.</span>
				</div>
			{/if}

			{#if entityResults.length}
				<section class="entity-results" aria-label="Artist search matches">
					<div class="entity-results-head">
						<span>Artists</span>
						<small>{entityResults.length.toLocaleString()} matched</small>
					</div>
					<div class="entity-row">
						{#each entityResults as entity (`${entity.kind}-${entity.slug}`)}
							<button
								type="button"
								class="entity-card"
								onclick={() => openAtlasWiki(`artist:${entity.slug}`)}
							>
								<span class="entity-thumbs" aria-hidden="true">
									{#each entity.thumbnailUrls.slice(0, 3) as thumbnailUrl (thumbnailUrl)}
										<img src={thumbnailUrl} alt="" loading="lazy" />
									{/each}
									{#if entity.thumbnailUrls.length === 0}
										<span>{entity.label}</span>
									{/if}
								</span>
								<span class="entity-copy">
									<strong>{entity.label}</strong>
									<small>{entitySubtitle(entity)}</small>
								</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<section class="result-toolbar" aria-label="Atlas result controls">
				<div class="result-count">
					{#if loading}
						Searching...
					{:else}
						<strong>
							{(
								response?.page.total ??
								response?.page.totalEstimate ??
								results.length
							).toLocaleString()}
							results
						</strong>
						<span class="result-query">
							for {displayQueryLabel(response?.query.canonical || activeQuery)}
						</span>
					{/if}
				</div>

				<div class="toolbar-actions">
					<label class="sort-filter">
						<span>Sort:</span>
						<select
							value={sort}
							aria-label="Sort Atlas results"
							onchange={(event) => (sort = event.currentTarget.value as SearchSort)}
						>
							<option value="relevance">Relevance</option>
							<option value="newest">Newest</option>
							<option value="title">Title</option>
						</select>
					</label>
					<label class="page-size">
						<span>Show:</span>
						<select
							value={pageSize}
							aria-label="Atlas results per page"
							onchange={(event) => (pageSize = event.currentTarget.value as PageSize)}
						>
							<option value="25">25</option>
							<option value="50">50</option>
							<option value="100">100</option>
						</select>
					</label>
					<button
						type="button"
						class:active={viewMode === 'grid'}
						aria-label="Grid view"
						onclick={() => (viewMode = 'grid')}
					>
						<GridFourIcon size={17} />
					</button>
					<button
						type="button"
						class:active={viewMode === 'list'}
						aria-label="List view"
						onclick={() => (viewMode = 'list')}
					>
						<ListBulletsIcon size={17} />
					</button>
					<label class="role-filter">
						<span>Role:</span>
						<select
							value={roleFilter}
							aria-label="Filter by visual role"
							onchange={(event) => applyRoleFilter(event.currentTarget.value as RoleFilter)}
						>
							<option value="all">All</option>
							<option value="focal">Focal only</option>
							<option value="exclude_supporting">Exclude supporting</option>
							<option value="exclude_background">Exclude background</option>
						</select>
					</label>
				</div>
			</section>

			{#if loading && results.length === 0}
				<div class="result-grid skeleton" aria-label="Loading Atlas results">
					{#each Array.from({ length: 8 }, (_, index) => index) as index (index)}
						<div class="result-card" aria-hidden="true">
							<span class="thumb"></span>
							<span class="identity"><strong>Loading</strong><small>Atlas result</small></span>
						</div>
					{/each}
				</div>
			{:else if results.length === 0}
				<div class="empty">No Atlas results matched this query.</div>
			{:else}
				<div class:list-view={viewMode === 'list'} class="result-grid">
					{#each results as result (result.id)}
						<button
							type="button"
							class="result-card"
							style={`--asset-aspect: ${resultAspect(result)}`}
							aria-label={`${resultIsGif(result) ? 'Animated GIF. ' : ''}Inspect ${result.title}`}
							onclick={() => inspectResult(result)}
							onpointerenter={() => startResultPreview(result)}
							onpointerleave={() => stopResultPreview(result)}
							onfocus={() => startResultPreview(result)}
							onblur={() => stopResultPreview(result)}
						>
							<span class="thumb">
								{#if result.thumbnailUrl && !imageErrors[result.id]}
									<img
										class:static-hidden={resultIsGif(result) && animatedResultId === result.id}
										src={result.thumbnailUrl}
										alt=""
										loading="lazy"
										onerror={() => (imageErrors[result.id] = true)}
									/>
									{#if resultIsGif(result) && animatedResultId === result.id}
										<img
											class="animated-preview"
											src={resultOriginalUrl(result)}
											alt=""
											aria-hidden="true"
											onerror={() => stopResultPreview(result)}
										/>
									{/if}
									{#if resultIsGif(result)}
										<span
											class="gif-badge"
											aria-hidden="true"
											title="Animated GIF; hover or focus to preview">GIF</span
										>
									{/if}
								{:else}
									<span class="thumb-empty">{result.title}</span>
								{/if}
							</span>
							<span class="identity">
								<strong>{result.title}</strong>
								<small>{resultSubtitle(result)}</small>
							</span>
							<span class="match">
								<small>{result.primaryExplanation}</small>
								<small>{Math.round(result.score)} relevance</small>
							</span>
						</button>
					{/each}
				</div>
				<div class="continuation" bind:this={loadSentinel} aria-live="polite">
					{#if continuationError}
						<span>{continuationError}</span>
						<button type="button" onclick={loadNextPage}>Try again</button>
					{:else if loadingMore}
						<span>Loading more references…</span>
					{:else if nextCursor}
						<button type="button" onclick={loadNextPage}>Load more</button>
					{:else}
						<span
							>All {(response?.page.total ?? results.length).toLocaleString()} results loaded</span
						>
					{/if}
				</div>
			{/if}
		{/if}
	</main>
</section>

<AtlasMobileContext {response} />

<style>
	.atlas-search {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-columns: clamp(18rem, 24vw, 23rem) minmax(0, 1fr);
		background: var(--color-bg);
		overflow: hidden;
		transition: grid-template-columns 180ms ease;
	}

	.atlas-search.sidebar-collapsed {
		grid-template-columns: 3.5rem minmax(0, 1fr);
	}

	.facet-panel {
		min-width: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		border-right: 1px solid var(--color-border-soft);
		background: oklch(10.5% 0.006 70 / 0.92);
		overflow: hidden;
	}

	.facet-head {
		min-height: 2.95rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		border-bottom: 1px solid var(--color-border-soft);
		padding: 0 0.75rem;
	}

	.facet-head span {
		overflow: hidden;
		color: var(--color-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.sidebar-collapsed .facet-head {
		justify-content: center;
		padding: 0;
	}

	.sidebar-collapsed .facet-head span {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.facet-head button {
		width: 2.15rem;
		height: 2.15rem;
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: oklch(14.5% 0.007 70 / 0.78);
		color: var(--color-muted);
		padding: 0;
		cursor: pointer;
	}

	.facet-head button:hover,
	.facet-head button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.facet-scroll,
	.main-scroll {
		height: 100%;
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: oklch(35% 0.006 70) transparent;
	}

	.facet-scroll {
		padding: 0.75rem 1rem 1.75rem 0.8rem;
		scrollbar-gutter: stable;
	}

	.facet-scroll::-webkit-scrollbar,
	.main-scroll::-webkit-scrollbar {
		width: 6px;
	}

	.facet-scroll::-webkit-scrollbar-track,
	.main-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.facet-scroll::-webkit-scrollbar-thumb,
	.main-scroll::-webkit-scrollbar-thumb {
		border-radius: 999px;
		background: oklch(30% 0.006 70);
	}

	.facet-section {
		border-bottom: 1px solid var(--color-border-soft);
		padding: 0.55rem 0;
	}

	.facet-section > summary,
	.classifier-group > summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: 6px;
		color: var(--color-muted);
		font-size: 0.71rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.facet-section > summary {
		min-height: 1.85rem;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		color: var(--color-text);
	}

	.chev {
		color: var(--color-dim);
		transition: transform 180ms ease;
	}

	.facet-tokens {
		display: flex;
		flex-wrap: wrap;
		gap: 0.42rem;
		padding-top: 0.45rem;
	}

	.facet-tokens button {
		min-height: 1.95rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 7px;
		background: oklch(15% 0.007 70 / 0.7);
		color: var(--color-muted);
		font-size: 0.86rem;
		padding: 0 0.55rem;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			transform 150ms ease;
	}

	.facet-tokens button:hover,
	.facet-tokens button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		transform: translateY(-1px);
	}

	.facet-tokens .visual span {
		color: oklch(78% 0.075 250);
	}

	.facet-tokens .classifier span,
	.classifier-group summary span,
	.classifier-values strong {
		color: oklch(76% 0.065 126);
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
	}

	.facet-tokens .context span {
		color: oklch(80% 0.09 58);
	}

	.facet-tokens small,
	.classifier-values span,
	.panel-empty,
	.mini-muted {
		color: var(--color-dim);
	}

	.classifier-list {
		display: grid;
		gap: 0.5rem;
		padding-top: 0.45rem;
	}

	.classifier-group {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: oklch(14.5% 0.007 70 / 0.74);
	}

	.classifier-group > summary {
		min-height: 2.15rem;
		padding: 0 0.65rem;
		letter-spacing: 0;
		text-transform: none;
		font-size: 0.82rem;
	}

	.classifier-values {
		display: grid;
		gap: 0.18rem;
		border-top: 1px solid var(--color-border-soft);
		padding: 0.45rem 0.5rem 0.55rem 1.1rem;
	}

	.classifier-values button {
		min-width: 0;
		min-height: 1.55rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.82rem;
		padding: 0.1rem 0.25rem;
		text-align: left;
		cursor: pointer;
	}

	.classifier-values button:hover,
	.classifier-values button:focus-visible {
		background: var(--color-surface-soft);
	}

	.empty-classifier {
		display: block;
		border-top: 1px solid var(--color-border-soft);
		padding: 0.5rem 0.65rem;
		color: var(--color-dim);
		font-size: 0.78rem;
	}

	.main-scroll {
		padding: 0.95rem 1.15rem 1.9rem;
	}

	.wiki-preview,
	.query-context {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(14% 0.007 70 / 0.82);
	}

	.wiki-preview {
		margin-bottom: 1rem;
	}

	.entity-results {
		display: grid;
		gap: 0.55rem;
		margin-bottom: 1rem;
	}

	.entity-results-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		color: var(--color-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.entity-results-head small {
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: none;
	}

	.entity-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.55rem;
	}

	.entity-card {
		min-width: 0;
		display: grid;
		grid-template-columns: 4.2rem minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: oklch(13.2% 0.007 70 / 0.86);
		color: var(--color-text);
		padding: 0.55rem;
		text-align: left;
		cursor: pointer;
	}

	.entity-card:hover,
	.entity-card:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.entity-thumbs {
		overflow: hidden;
		width: 4.2rem;
		aspect-ratio: 1;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		border: 1px solid var(--color-border-soft);
		border-radius: 8px;
		background: oklch(8.8% 0.006 70);
	}

	.entity-thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.entity-thumbs img:first-child:nth-last-child(1),
	.entity-thumbs span {
		grid-column: 1 / -1;
		grid-row: 1 / -1;
	}

	.entity-thumbs span {
		display: grid;
		place-items: center;
		color: var(--color-dim);
		font-size: 0.68rem;
		font-weight: 800;
		padding: 0.35rem;
		text-align: center;
	}

	.entity-copy {
		min-width: 0;
		display: grid;
		gap: 0.2rem;
	}

	.entity-copy strong,
	.entity-copy small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-copy strong {
		color: var(--color-text);
		font-size: 0.96rem;
	}

	.entity-copy small {
		color: var(--color-muted);
		font-size: 0.78rem;
	}

	.wiki-preview > summary {
		min-height: 2.4rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--color-border-soft);
		list-style: none;
		padding: 0 0.95rem;
		cursor: pointer;
	}

	.wiki-preview:not([open]) > summary {
		border-bottom: 0;
	}

	.label,
	.preview-block h2 {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.hint {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--color-dim);
		font-size: 0.82rem;
	}

	.preview-body {
		display: grid;
		grid-template-columns: minmax(22rem, 1.45fr) minmax(12rem, 0.8fr) minmax(14rem, 1fr);
		animation: reveal 180ms ease both;
	}

	@keyframes reveal {
		from {
			opacity: 0.72;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.preview-block {
		min-width: 0;
		padding: 1rem 1.1rem;
		border-right: 1px solid var(--color-border-soft);
	}

	.preview-block:last-child {
		border-right: 0;
	}

	.identity-block {
		display: grid;
		grid-template-columns: 6.6rem minmax(0, 1fr);
		gap: 1rem;
	}

	.identity-block.no-example {
		grid-template-columns: 1fr;
	}

	.example-thumb {
		position: relative;
		overflow: hidden;
		align-self: start;
		aspect-ratio: 1;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: oklch(9% 0.006 70);
		padding: 0;
		cursor: pointer;
	}

	.example-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.example-thumb .animated-preview {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.concept-title {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}

	.concept-title h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2rem;
		font-weight: 500;
		line-height: 1;
	}

	.concept-title span,
	.preview-link {
		color: var(--color-accent-strong);
	}

	.concept-type {
		margin: 0.55rem 0 0.8rem;
		color: var(--color-muted);
		font-size: 0.82rem;
	}

	.preview-copy {
		max-width: 65ch;
		margin: 0;
		color: var(--color-text);
		line-height: 1.55;
	}

	.preview-link {
		display: inline-flex;
		margin-top: 0.85rem;
		border: 0;
		background: transparent;
		padding: 0;
		cursor: pointer;
	}

	.preview-link:hover,
	.preview-link:focus-visible {
		color: var(--color-text);
	}

	.mini-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.75rem;
	}

	.mini-chip {
		min-height: 1.8rem;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: 7px;
		background: oklch(15% 0.007 70 / 0.72);
		color: oklch(78% 0.075 250);
		padding: 0 0.55rem;
	}

	button.mini-chip {
		cursor: pointer;
	}

	button.mini-chip:hover,
	button.mini-chip:focus-visible {
		background: var(--color-surface-soft);
		border-color: var(--color-border-strong);
	}

	.mini-chip.classifier {
		color: oklch(76% 0.065 126);
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
		font-size: 0.78rem;
	}

	.mini-chip.more {
		color: var(--color-muted);
		font-size: 0.76rem;
		letter-spacing: 0.01em;
	}

	.mini-chip.more:hover,
	.mini-chip.more:focus-visible {
		color: var(--color-text);
	}

	.query-context {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 0.8rem 0.95rem;
		color: var(--color-muted);
	}

	.query-context strong {
		color: var(--color-text);
	}

	.result-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.45rem 0.4rem 0.8rem;
	}

	.result-count {
		color: var(--color-text);
		font-size: 0.98rem;
	}

	.result-count strong {
		font-weight: 500;
	}

	.result-count span {
		color: var(--color-muted);
	}

	.toolbar-actions {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.toolbar-actions label,
	.toolbar-actions button {
		height: 2.35rem;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(14.5% 0.007 70 / 0.78);
		color: var(--color-muted);
		padding: 0 0.75rem;
	}

	.toolbar-actions button {
		width: 2.35rem;
		justify-content: center;
		padding: 0;
		cursor: pointer;
	}

	.toolbar-actions button.active {
		border-color: oklch(78% 0.08 78 / 0.55);
		background: oklch(78% 0.08 78 / 0.1);
		color: var(--color-text);
		box-shadow: inset 0 0 0 1px oklch(78% 0.08 78 / 0.2);
	}

	.toolbar-actions label span {
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.toolbar-actions select {
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		color-scheme: dark;
	}

	.toolbar-actions option {
		background: oklch(14% 0.007 70);
		color: var(--color-text);
	}

	.role-filter {
		min-width: 12rem;
	}

	.result-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 0.85rem;
	}

	.result-grid.list-view {
		grid-template-columns: 1fr;
	}

	.result-card {
		min-width: 0;
		overflow: hidden;
		display: grid;
		grid-template-rows: 11.5rem auto auto;
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: oklch(14% 0.007 70 / 0.82);
		color: var(--color-text);
		padding: 0;
		text-align: left;
		cursor: pointer;
		transition:
			transform 160ms ease,
			border-color 160ms ease,
			background 160ms ease;
	}

	.continuation {
		min-height: 5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		color: var(--color-muted);
		font-size: 0.8rem;
		text-align: center;
	}

	.continuation button {
		min-height: 2.75rem;
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: var(--color-surface);
		color: var(--color-text);
		padding: 0 0.9rem;
		cursor: pointer;
	}

	.continuation button:hover,
	.continuation button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.result-card:hover,
	.result-card:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		transform: translateY(-2px);
	}

	.list-view .result-card {
		grid-template-columns: 8.25rem minmax(0, 1fr) minmax(11rem, 18rem);
		grid-template-rows: auto;
		align-items: center;
	}

	.thumb {
		position: relative;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: oklch(9% 0.006 70);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.9) contrast(1.02);
	}

	.thumb .animated-preview {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.thumb img.static-hidden,
	.example-thumb img.static-hidden {
		opacity: 0;
	}

	.gif-badge {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-2);
		z-index: 2;
		min-width: 2.2rem;
		min-height: 1.55rem;
		display: inline-grid;
		place-items: center;
		padding: 0 0.45rem;
		border: 1px solid oklch(82% 0.012 75 / 0.26);
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70 / 0.86);
		color: var(--color-text);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.thumb-empty {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		background:
			linear-gradient(135deg, oklch(18% 0.009 70), oklch(11% 0.007 70)),
			repeating-linear-gradient(135deg, oklch(25% 0.01 70 / 0.26) 0 1px, transparent 1px 9px);
		color: var(--color-muted);
		font-size: 0.82rem;
		line-height: 1.25;
		padding: 1rem;
		text-align: center;
	}

	.identity,
	.match {
		min-width: 0;
		display: grid;
		gap: 0.25rem;
		padding: 0.65rem 0.75rem 0;
	}

	.match {
		border-top: 1px solid var(--color-border-soft);
		margin: 0.65rem 0.75rem 0;
		padding: 0.55rem 0 0.7rem;
	}

	.identity strong,
	.identity small,
	.match small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.identity strong {
		font-size: 0.95rem;
		font-weight: 650;
	}

	.identity small,
	.match small {
		color: var(--color-muted);
	}

	.list-view .identity,
	.list-view .match {
		padding: 0.65rem 0.75rem;
		margin: 0;
		border-top: 0;
	}

	.skeleton .result-card {
		opacity: 0.72;
		pointer-events: none;
	}

	.skeleton .thumb,
	.skeleton strong,
	.skeleton small {
		color: transparent;
		background: linear-gradient(
			90deg,
			oklch(18% 0.008 70),
			oklch(24% 0.01 70),
			oklch(18% 0.008 70)
		);
		background-size: 200% 100%;
		animation: shimmer 1200ms linear infinite;
		border-radius: 6px;
	}

	@keyframes shimmer {
		to {
			background-position: -200% 0;
		}
	}

	.empty {
		min-height: 18rem;
		display: grid;
		place-content: center;
		gap: 0.8rem;
		color: var(--color-muted);
	}

	@media (max-width: 1180px) {
		.preview-body {
			grid-template-columns: 1fr 1fr;
		}

		.preview-block:nth-child(2) {
			border-right: 0;
		}

		.preview-block:last-child {
			border-top: 1px solid var(--color-border-soft);
		}
	}

	@media (max-width: 1023px), (pointer: coarse) and (max-width: 1366px) {
		.atlas-search {
			grid-template-columns: 1fr;
		}

		.atlas-search.sidebar-collapsed {
			grid-template-columns: 1fr;
		}

		.facet-panel {
			display: none;
		}

		.main-scroll {
			overflow: auto;
			padding-bottom: calc(var(--bottom-nav-height, 0px) + 1.25rem);
		}

		.wiki-preview,
		.query-context {
			display: none;
		}

		.result-toolbar {
			align-items: center;
			gap: 0.55rem;
		}

		.toolbar-actions {
			min-width: 0;
			flex: 0 0 auto;
			gap: 0.4rem;
		}

		.toolbar-actions .page-size,
		.toolbar-actions > button {
			display: none;
		}

		.toolbar-actions label {
			min-width: 0;
			height: 2.75rem;
			padding-inline: 0.6rem;
		}

		.toolbar-actions select {
			min-width: 0;
			width: auto;
			max-width: 7.5rem;
		}

		.result-grid:not(.list-view) {
			display: block;
			column-count: 3;
			column-gap: 0.65rem;
		}

		.result-grid:not(.list-view) .result-card {
			width: 100%;
			break-inside: avoid;
			grid-template-rows: auto auto;
			margin-bottom: 0.65rem;
		}

		.result-grid:not(.list-view) .thumb {
			aspect-ratio: var(--asset-aspect, 4 / 3);
		}

		.result-grid:not(.list-view) .match {
			display: none;
		}

		.result-grid:not(.list-view) .identity {
			padding: 0.55rem 0.65rem 0.65rem;
		}

		.result-grid:not(.list-view) .identity strong {
			font-size: 0.86rem;
		}
	}

	@media (max-width: 680px) {
		.main-scroll {
			padding: 0.45rem 0.65rem calc(var(--bottom-nav-height, 0px) + 1rem);
		}

		.entity-results {
			display: none;
		}

		.result-grid:not(.list-view) {
			column-count: 2;
			column-gap: 0.5rem;
		}

		.result-grid:not(.list-view) .result-card {
			margin-bottom: 0.5rem;
			border-radius: 8px;
		}

		.result-grid:not(.list-view) .identity small {
			display: none;
		}

		.result-toolbar {
			gap: 0.45rem;
			margin-inline: 0.15rem;
		}

		.result-count {
			min-width: max-content;
			flex: 1;
			font-size: 0.86rem;
		}

		.result-query {
			display: none;
		}

		.toolbar-actions label {
			gap: 0.3rem;
			padding-inline: 0.5rem;
		}

		.toolbar-actions label span {
			font-size: 0.62rem;
		}

		.role-filter {
			min-width: 0;
		}

		.preview-body,
		.identity-block,
		.list-view .result-card {
			grid-template-columns: 1fr;
		}

		.preview-block {
			border-right: 0;
			border-top: 1px solid var(--color-border-soft);
		}

		.preview-block:first-child {
			border-top: 0;
		}

		.example-thumb {
			width: min(10rem, 100%);
		}
	}

	@media (min-width: 681px) and (max-width: 1023px) {
		.result-grid:not(.list-view) {
			column-count: 3;
		}
	}

	@media (min-width: 1024px) and (pointer: coarse) and (max-width: 1366px) {
		.result-grid:not(.list-view) {
			column-count: 4;
		}
	}

	@media (min-width: 760px) and (max-width: 1023px),
		(pointer: coarse) and (min-width: 760px) and (max-width: 1366px) {
		.main-scroll {
			padding-bottom: 1.25rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			transition-duration: 1ms !important;
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
		}
	}
</style>
