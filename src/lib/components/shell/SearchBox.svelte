<script lang="ts">
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import {
		appState,
		commitExploreSearch,
		selectExploreSuggestion,
		setSearchQuery
	} from '$lib/state/app-state.svelte';
	import type { AppMode } from '$lib/types';
	import type { ExploreSuggestion } from '$lib/explore/types';

	type Props = {
		mode: AppMode;
		label: string;
		placeholder: string;
		showShortcut?: boolean;
	};

	let { mode, label, placeholder, showShortcut = false }: Props = $props();
	let focused = $state(false);

	let suggestions = $derived(mode === 'explore' ? appState.exploreSuggestions : []);
	let open = $derived(focused && suggestions.length > 0);
	let canCommitExploreSearch = $derived(
		mode === 'explore' && appState.query.trim() !== appState.exploreCommittedQuery.trim()
	);

	function handleInput(event: Event) {
		setSearchQuery((event.currentTarget as HTMLInputElement).value);
	}

	function applySuggestion(suggestion: ExploreSuggestion) {
		selectExploreSuggestion(suggestion);
		focused = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (mode !== 'explore' || event.key !== 'Enter') return;
		event.preventDefault();
		commitSearch();
	}

	function commitSearch() {
		commitExploreSearch();
		focused = false;
	}

	function sourceLabel(source: ExploreSuggestion['source']) {
		return source === 'artic' ? 'Art Institute' : 'The Met';
	}

	function suggestionName(suggestion: ExploreSuggestion) {
		return `${suggestion.label} ${suggestion.kind} ${sourceLabel(suggestion.source)}`;
	}
</script>

<div class="search-wrap">
	<div class="search">
		<MagnifyingGlassIcon size={20} />
		<span class="sr-only">{label}</span>
		<input
			aria-label={label}
			value={appState.query}
			{placeholder}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => (focused = true)}
			onblur={() => window.setTimeout(() => (focused = false), 120)}
			aria-autocomplete={mode === 'explore' ? 'list' : undefined}
			aria-expanded={mode === 'explore' ? open : undefined}
		/>
		{#if mode === 'explore'}
			<button
				class="commit-search"
				type="button"
				aria-label={`Search ${appState.exploreSourceLabel}`}
				disabled={!canCommitExploreSearch}
				onmousedown={(event) => event.preventDefault()}
				onclick={commitSearch}
			>
				<ArrowRightIcon size={17} weight="bold" />
			</button>
		{:else if showShortcut}
			<kbd>⌘K</kbd>
		{/if}
	</div>
	{#if open}
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
</style>
