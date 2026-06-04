<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import type { LibraryResponse } from '$lib/library/types';
	import { appState, openFilter, setSearchQuery } from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';
	import { searchLibrary } from './libraryOverviewModel';

	type Props = {
		library: LibraryResponse;
		placeholder?: string;
		label?: string;
		scopeLabel?: string;
		compact?: boolean;
		onOpenFolder: (path: string[]) => void;
		onOpenProject: (id: string) => void;
		onOpenTag: (id: string) => void;
		onOpenAsset?: (asset: Asset) => void;
	};

	let {
		library,
		placeholder = 'Search images, projects, folders, tags...',
		label = 'Search library',
		scopeLabel,
		compact = false,
		onOpenFolder,
		onOpenProject,
		onOpenTag,
		onOpenAsset
	}: Props = $props();

	let focused = $state(false);
	let results = $derived(searchLibrary({ library, query: appState.query, limit: 5 }));
	let showResults = $derived(focused && appState.query.trim().length >= 2);

	function closeSoon() {
		window.setTimeout(() => {
			focused = false;
		}, 120);
	}

	function handleInput(event: Event) {
		setSearchQuery((event.currentTarget as HTMLInputElement).value);
		focused = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		commitFirstResult();
	}

	function commitFirstResult() {
		if (results.projects[0]) {
			onOpenProject(results.projects[0].id);
			focused = false;
			return;
		}
		if (results.folders[0]) {
			onOpenFolder(results.folders[0].path);
			focused = false;
			return;
		}
		if (results.tags[0]) {
			onOpenTag(results.tags[0].id);
			focused = false;
			return;
		}
		if (results.assets[0]) {
			openAsset(results.assets[0]);
			focused = false;
		}
	}

	function openAsset(asset: Asset) {
		if (onOpenAsset) {
			onOpenAsset(asset);
			return;
		}
		appState.selectedAssetId = asset.id;
		appState.inspectorOpen = true;
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
			value={appState.query}
			{placeholder}
			autocomplete="off"
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => (focused = true)}
			onblur={closeSoon}
		/>
		<button type="button" aria-label="Open filters" onclick={openFilter}>
			<SlidersHorizontalIcon size={19} />
		</button>
	</label>

	{#if showResults}
		<div class="search-results" role="listbox" aria-label="Library search results">
			{#if results.total === 0}
				<p class="empty-result">No matches for "{appState.query.trim()}".</p>
			{:else}
				{#each results.projects as project (project.id)}
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => onOpenProject(project.id)}
					>
						<StackIcon size={17} />
						<span>Project</span>
						<strong>{project.name}</strong>
						<small>{project.assetCount.toLocaleString()} assets</small>
					</button>
				{/each}
				{#each results.folders as folder (folder.id)}
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => onOpenFolder(folder.path)}
					>
						<FolderIcon size={17} />
						<span>Folder</span>
						<strong>{folder.name}</strong>
						<small>{folder.assetCount.toLocaleString()} assets</small>
					</button>
				{/each}
				{#each results.tags as tag (tag.id)}
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => onOpenTag(tag.id)}
					>
						<HashIcon size={17} />
						<span>Tag</span>
						<strong>{tag.value}</strong>
						<small>{tag.facetName}</small>
					</button>
				{/each}
				{#each results.assets as asset (asset.id)}
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => openAsset(asset)}
					>
						<ImageSquareIcon size={17} />
						<span>Image</span>
						<strong>{asset.title}</strong>
						<small>{asset.creator || asset.sourceName}</small>
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
		inset: calc(100% + var(--space-2)) 0 auto;
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
		grid-template-columns: auto 4rem minmax(0, 1fr) auto;
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

	.search-results span,
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

		.search-results button span {
			display: none;
		}
	}
</style>
