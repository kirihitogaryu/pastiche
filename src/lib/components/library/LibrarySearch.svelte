<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import type { LibraryResponse } from '$lib/library/types';
	import { appState, openFilter, setLibraryQuery } from '$lib/state/app-state.svelte';
	import { searchLibrary } from './libraryOverviewModel';

	type Props = {
		library: LibraryResponse;
		placeholder?: string;
		label?: string;
		scopeLabel?: string;
		compact?: boolean;
		showNavigationResults?: boolean;
		showFilter?: boolean;
		onOpenFolder?: (path: string[]) => void;
	};

	let {
		library,
		placeholder = 'Search folders...',
		label = 'Search library',
		scopeLabel,
		compact = false,
		showNavigationResults = true,
		showFilter = false,
		onOpenFolder
	}: Props = $props();

	let focused = $state(false);
	let results = $derived(searchLibrary({ library, query: appState.libraryQuery, limit: 5 }));
	let showResults = $derived(
		showNavigationResults && focused && appState.libraryQuery.trim().length >= 2
	);

	function closeSoon() {
		window.setTimeout(() => {
			focused = false;
		}, 120);
	}

	function handleInput(event: Event) {
		setLibraryQuery((event.currentTarget as HTMLInputElement).value);
		focused = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showNavigationResults || event.key !== 'Enter') return;
		event.preventDefault();
		commitFirstResult();
	}

	function commitFirstResult() {
		if (results.folders[0] && onOpenFolder) {
			onOpenFolder(results.folders[0].path);
			focused = false;
		}
	}
</script>

<div class="library-search-wrap" class:compact>
	<label class="library-search">
		<MagnifyingGlassIcon size={20} />
		<span class="sr-only">{label}</span>
		{#if scopeLabel}
			<span class="scope-label">{scopeLabel}</span>
		{/if}
		<input
			value={appState.libraryQuery}
			{placeholder}
			autocomplete="off"
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => (focused = true)}
			onblur={closeSoon}
		/>
		{#if showFilter}
			<button type="button" aria-label="Open filters" onclick={openFilter}>
				<SlidersHorizontalIcon size={19} />
			</button>
		{/if}
	</label>

	{#if showResults}
		<div class="search-results" role="listbox" aria-label="Library search results">
			{#if results.total === 0}
				<p class="empty-result">No matches for "{appState.libraryQuery.trim()}".</p>
			{:else}
				{#each results.folders as folder (folder.id)}
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => onOpenFolder?.(folder.path)}
					>
						<FolderIcon size={17} />
						<strong>{folder.name}</strong>
						<small>{folder.assetCount.toLocaleString()} images</small>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.library-search-wrap {
		position: relative;
		z-index: 2;
	}

	.library-search {
		min-height: 3.05rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-muted);
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.library-search:focus-within {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.scope-label {
		max-width: 7rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-dim);
		font-size: 0.78rem;
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.92rem;
	}

	.library-search > button {
		width: 2.2rem;
		height: 2.2rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.library-search > button:hover,
	.library-search > button:focus-visible {
		background: var(--color-hover);
		color: var(--color-text);
	}

	.search-results {
		position: absolute;
		inset: calc(100% - 1px) 0 auto;
		max-height: min(28rem, calc(100dvh - 12rem));
		overflow: auto;
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(13% 0.008 70 / 0.99);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.34);
	}

	.search-results button {
		min-width: 0;
		min-height: 2.75rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.search-results button:hover,
	.search-results button:focus-visible {
		background: var(--color-hover);
	}

	.search-results small,
	.empty-result {
		color: var(--color-muted);
		font-size: 0.78rem;
	}

	.search-results strong,
	.search-results small {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-result {
		margin: 0;
		padding: var(--space-3);
	}

	@media (max-width: 759px) {
		.library-search {
			min-height: 2.6rem;
			gap: var(--space-2);
			padding: 0 var(--space-2);
			border-radius: var(--radius-lg);
		}

		.scope-label {
			display: none;
		}

		.library-search > button {
			width: 2rem;
			height: 2rem;
		}

		.search-results {
			position: fixed;
			inset: auto var(--space-3) calc(var(--bottom-nav-height) + var(--space-3));
			max-height: 48dvh;
		}

		.search-results button {
			grid-template-columns: auto minmax(0, 1fr) auto;
			min-height: 2.55rem;
		}
	}
</style>
