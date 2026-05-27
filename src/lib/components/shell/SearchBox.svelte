<script lang="ts">
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import {
		addWikidataSubject,
		appState,
		commitExploreSearch,
		selectExploreSuggestion,
		setWikidataEntityError,
		setWikidataEntityLoading,
		setWikidataEntitySuggestions,
		setSearchQuery
	} from '$lib/state/app-state.svelte';
	import type { AppMode } from '$lib/types';
	import type { ExploreSubject, ExploreSuggestion, WikidataSearchMode } from '$lib/explore/types';

	type Props = {
		mode: AppMode;
		label: string;
		placeholder: string;
		showShortcut?: boolean;
	};

	let { mode, label, placeholder, showShortcut = false }: Props = $props();
	let focused = $state(false);

	let isWikidataMode = $derived(mode === 'explore' && appState.exploreSourceId === 'wikidata');
	let wikidataMode = $derived(appState.wikidataMode);
	let isWikidataEntityMode = $derived(isWikidataMode && wikidataMode !== 'title');
	let suggestions = $derived(
		mode === 'explore' && !isWikidataMode ? appState.exploreSuggestions : []
	);
	let entitySuggestions = $derived(isWikidataEntityMode ? appState.wikidataEntitySuggestions : []);
	let open = $derived(focused && suggestions.length > 0);
	let entityOpen = $derived(focused && entitySuggestions.length > 0);
	let entityStatusOpen = $derived(
		focused &&
			isWikidataEntityMode &&
			!entityOpen &&
			appState.query.trim().length >= 2 &&
			(appState.wikidataEntityLoading || appState.wikidataEntityError !== null)
	);
	let searchPlaceholder = $derived(
		isWikidataMode
			? wikidataPlaceholder(wikidataMode, appState.wikidataSubjects.length > 0)
			: placeholder
	);
	let canCommitExploreSearch = $derived(
		mode === 'explore' &&
			(!isWikidataMode || wikidataMode === 'title') &&
			appState.query.trim() !== appState.exploreCommittedQuery.trim()
	);
	let canAddWikidataSubject = $derived(isWikidataEntityMode && entitySuggestions.length > 0);

	$effect(() => {
		if (!isWikidataEntityMode) return;
		const search = appState.query.trim();
		if (search.length < 2) {
			setWikidataEntitySuggestions([]);
			setWikidataEntityLoading(false);
			setWikidataEntityError(null);
			return;
		}

		let cancelled = false;
		setWikidataEntityLoading(true);
		setWikidataEntityError(null);
		const timeout = window.setTimeout(() => {
			const params = new URLSearchParams({ search, mode: wikidataMode });
			void fetch(`/explore/api/wikidata/entities?${params.toString()}`)
				.then(async (response) => {
					const data = (await response.json()) as
						| { entities: ExploreSubject[] }
						| { error: string; retryAfterSeconds?: number };
					if (!response.ok) throw new Error('error' in data ? data.error : 'Entity search failed');
					if (!('entities' in data)) throw new Error('Entity search failed');
					if (!cancelled) {
						const selectedIds = new Set(appState.wikidataSubjects.map((subject) => subject.id));
						setWikidataEntitySuggestions(
							data.entities.filter((subject) => !selectedIds.has(subject.id))
						);
					}
				})
				.catch((error) => {
					if (!cancelled) {
						setWikidataEntitySuggestions([]);
						setWikidataEntityError(error instanceof Error ? error.message : 'Entity search failed');
					}
				})
				.finally(() => {
					if (!cancelled) setWikidataEntityLoading(false);
				});
		}, 220);

		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	});

	function handleInput(event: Event) {
		setSearchQuery((event.currentTarget as HTMLInputElement).value);
	}

	function applySuggestion(suggestion: ExploreSuggestion) {
		selectExploreSuggestion(suggestion);
		focused = false;
	}

	function applyEntity(subject: ExploreSubject) {
		addWikidataSubject(subject);
		focused = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (mode !== 'explore' || event.key !== 'Enter') return;
		event.preventDefault();
		if (isWikidataMode) {
			if (wikidataMode === 'title') {
				commitSearch();
			} else if (entitySuggestions[0]) {
				applyEntity(entitySuggestions[0]);
			}
			return;
		}
		commitSearch();
	}

	function commitSearch() {
		if (isWikidataMode) {
			if (wikidataMode === 'title') {
				commitExploreSearch();
				focused = false;
			} else if (entitySuggestions[0]) {
				applyEntity(entitySuggestions[0]);
			}
			return;
		}
		commitExploreSearch();
		focused = false;
	}

	function sourceLabel(source: ExploreSuggestion['source']) {
		if (source === 'artic') return 'Art Institute';
		if (source === 'wikidata') return 'Wikidata';
		return 'The Met';
	}

	function suggestionName(suggestion: ExploreSuggestion) {
		return `${suggestion.label} ${suggestion.kind} ${sourceLabel(suggestion.source)}`;
	}

	function entityName(subject: ExploreSubject) {
		return `${subject.label}${subject.description ? ` ${subject.description}` : ''}`;
	}

	function wikidataPlaceholder(mode: WikidataSearchMode, hasEntities: boolean) {
		if (mode === 'title') return 'Search artwork titles...';
		if (hasEntities) return 'Add another subject...';
		if (mode === 'main_subject') return 'Search main subjects...';
		if (mode === 'artist') return 'Search artists...';
		if (mode === 'movement') return 'Search movements...';
		if (mode === 'genre') return 'Search genres...';
		return 'Search depicted subjects...';
	}
</script>

<div class="search-wrap">
	<div class="search">
		<MagnifyingGlassIcon size={20} />
		<span class="sr-only">{label}</span>
		<input
			aria-label={label}
			value={appState.query}
			placeholder={searchPlaceholder}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => (focused = true)}
			onblur={() => window.setTimeout(() => (focused = false), 120)}
			aria-autocomplete={mode === 'explore' ? 'list' : undefined}
			aria-expanded={mode === 'explore' ? open || entityOpen || entityStatusOpen : undefined}
		/>
		{#if mode === 'explore'}
			<button
				class="commit-search"
				type="button"
				aria-label={isWikidataMode
					? wikidataMode === 'title'
						? 'Search Wikimedia'
						: 'Add Wikimedia entity'
					: `Search ${appState.exploreSourceLabel}`}
				disabled={isWikidataMode
					? wikidataMode === 'title'
						? !canCommitExploreSearch
						: !canAddWikidataSubject
					: !canCommitExploreSearch}
				onmousedown={(event) => event.preventDefault()}
				onclick={commitSearch}
			>
				<ArrowRightIcon size={17} weight="bold" />
			</button>
		{:else if showShortcut}
			<kbd>⌘K</kbd>
		{/if}
	</div>
	{#if entityOpen}
		<div
			class="suggestions entity-suggestions"
			role="listbox"
			aria-label="Wikimedia entity suggestions"
		>
			{#each entitySuggestions as subject (subject.id)}
				<button
					type="button"
					role="option"
					aria-selected="false"
					aria-label={entityName(subject)}
					onmousedown={(event) => event.preventDefault()}
					onclick={() => applyEntity(subject)}
				>
					<span>{subject.label}</span>
					<small>{subject.description ?? subject.id}</small>
				</button>
			{/each}
		</div>
	{:else if entityStatusOpen}
		<div class="suggestions entity-status" role="status">
			<span>
				{appState.wikidataEntityError ?? 'Checking Wikimedia entities...'}
			</span>
		</div>
	{:else if open}
		<div class="suggestions" role="listbox" aria-label="Explore search suggestions">
			{#each suggestions as suggestion (suggestion.id)}
				<button
					type="button"
					role="option"
					aria-selected="false"
					aria-label={suggestionName(suggestion)}
					onmousedown={(event) => event.preventDefault()}
					onclick={() => applySuggestion(suggestion)}
				>
					<span>{suggestion.label}</span>
					<small>{suggestion.kind} · {sourceLabel(suggestion.source)}</small>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.search-wrap {
		position: relative;
		min-width: 0;
		flex: 1;
	}

	.search {
		width: 100%;
		height: 2.55rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-muted);
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.search:focus-within {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--color-text);
		outline: none;
	}

	kbd {
		color: var(--color-dim);
		font-size: 0.8rem;
	}

	.commit-search {
		flex: 0 0 auto;
		width: 1.9rem;
		height: 1.9rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-raised);
		color: var(--color-text);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			opacity var(--duration-fast) var(--ease-out);
	}

	.commit-search:hover,
	.commit-search:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-hover);
	}

	.commit-search:disabled {
		opacity: 0.38;
		cursor: default;
	}

	.commit-search:disabled:hover {
		border-color: var(--color-border);
		background: var(--color-surface-raised);
	}

	.suggestions {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 0.45rem);
		z-index: var(--z-popover);
		display: grid;
		gap: 0.2rem;
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(14% 0.008 70 / 0.98);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.36);
	}

	.suggestions button {
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0.62rem var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}

	.suggestions button:hover,
	.suggestions button:focus-visible {
		background: var(--color-hover);
	}

	.suggestions span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.suggestions small {
		flex: 0 0 auto;
		color: var(--color-muted);
		font-size: 0.72rem;
		text-transform: capitalize;
	}

	.entity-suggestions button {
		display: grid;
		align-items: start;
		justify-content: stretch;
		gap: 0.2rem;
	}

	.entity-suggestions small {
		flex: initial;
		line-height: 1.3;
		text-transform: none;
	}

	.entity-status {
		color: var(--color-muted);
		font-size: 0.84rem;
		line-height: 1.35;
		padding: var(--space-3);
	}
</style>
