<script lang="ts">
	import AssetGrid from '$lib/components/browse/AssetGrid.svelte';
	import LibrarySidebar from '$lib/components/browse/LibrarySidebar.svelte';
	import AssetInspector from '$lib/components/inspector/AssetInspector.svelte';
	import {
		closeInspector,
		enterSelection,
		openMobileInspect,
		selectAsset,
		toggleLibrarySidebar,
		toggleSelection,
		appState
	} from '$lib/state/app-state.svelte';
	import { exploreAssets, libraryAssets } from '$lib/data/mock-assets';
	import { exploreChips, exploreSources, libraryChips } from '$lib/data/mock-navigation';
	import type { AppMode, Asset } from '$lib/types';

	type Props = {
		mode: Extract<AppMode, 'library' | 'explore'>;
	};

	let { mode }: Props = $props();

	let currentAssets = $derived(mode === 'library' ? libraryAssets : exploreAssets);
	let chips = $derived(mode === 'library' ? libraryChips : exploreChips);
	let filteredAssets = $derived(
		currentAssets.filter((asset) => {
			const query = appState.query.trim().toLowerCase();
			if (!query) return true;
			return [asset.title, asset.creator, asset.sourceName, asset.medium, ...asset.tags]
				.join(' ')
				.toLowerCase()
				.includes(query);
		})
	);
	let activeAsset = $derived(
		currentAssets.find((asset) => asset.id === appState.selectedAssetId) ?? currentAssets[0] ?? null
	);

	function openAsset(asset: Asset) {
		selectAsset(asset);
		if (window.matchMedia('(max-width: 759px)').matches) {
			openMobileInspect(asset, window.scrollY);
		}
	}

	function selectOrAdd(asset: Asset) {
		if (mode === 'library') {
			if (appState.mobileState === 'selecting') toggleSelection(asset);
			else enterSelection(asset);
		} else {
			selectAsset(asset);
		}
	}

	function setPath(path: string[]) {
		appState.folderPath = path;
	}
</script>

<div class:explore={mode === 'explore'} class="browse-workspace">
	{#if mode === 'library'}
		<LibrarySidebar
			collapsed={appState.librarySidebarCollapsed}
			path={appState.folderPath}
			onPath={setPath}
			onToggle={toggleLibrarySidebar}
		/>
	{/if}

	<section class="browse-content" aria-label={`${mode} browser`}>
		{#if mode === 'explore'}
			<div class="sources" aria-label="Explore sources">
				<span>Source:</span>
				{#each exploreSources as source}
					<button class:active={source === 'All Sources'} type="button">{source}</button>
				{/each}
			</div>
		{/if}

		<div class="chips" aria-label={`${mode} filters`}>
			<span>Search by:</span>
			{#each chips as chip}
				<button class:active={chip.toLowerCase() === 'all'} type="button">{chip}</button>
			{/each}
			<button type="button">+ More</button>
		</div>

		<div class="result-row">
			<p>{filteredAssets.length.toLocaleString()} results</p>
			<span>{mode === 'library' ? appState.folderPath.join(' / ') : 'Newest references'}</span>
		</div>

		<div class="scroll-area">
			<AssetGrid
				assets={filteredAssets}
				activeId={activeAsset?.id}
				selectedIds={appState.selectedAssetIds}
				mode={mode === 'library' ? 'library' : 'explore'}
				onOpen={openAsset}
				onSelect={selectOrAdd}
			/>
		</div>
	</section>

	{#if appState.inspectorOpen}
		<AssetInspector asset={activeAsset} onClose={closeInspector} />
	{/if}
</div>

<style>
	.browse-workspace {
		height: 100%;
		display: flex;
		min-width: 0;
	}

	.browse-content {
		min-width: 0;
		flex: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.sources,
	.chips,
	.result-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding-inline: var(--space-5);
	}

	.sources {
		padding-top: var(--space-5);
	}

	.sources span,
	.chips span,
	.result-row span {
		color: var(--color-muted);
		font-size: 0.86rem;
		white-space: nowrap;
	}

	.sources button,
	.chips button {
		min-height: 2.35rem;
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		white-space: nowrap;
	}

	.sources button.active,
	.chips button.active {
		background: var(--color-selected);
	}

	.chips {
		padding-top: var(--space-4);
		padding-bottom: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chips::-webkit-scrollbar {
		display: none;
	}

	.result-row {
		justify-content: space-between;
		padding-top: var(--space-2);
		padding-bottom: var(--space-2);
	}

	.result-row p {
		margin: 0;
		color: var(--color-text);
		font-weight: 650;
	}

	.scroll-area {
		min-height: 0;
		flex: 1;
		overflow: auto;
	}

	@media (max-width: 759px) {
		.browse-workspace {
			display: block;
			height: auto;
		}

		.browse-content {
			height: auto;
			min-height: 100%;
		}

		.sources,
		.result-row {
			display: none;
		}

		.chips {
			position: sticky;
			top: 0;
			z-index: 2;
			gap: var(--space-2);
			padding: var(--space-2) var(--space-3);
			background: oklch(12% 0.008 70 / 0.92);
			backdrop-filter: blur(16px);
		}

		.chips span {
			display: none;
		}

		.chips button {
			min-height: 2rem;
			padding-inline: var(--space-3);
			font-size: 0.78rem;
		}

		.scroll-area {
			overflow: visible;
		}
	}
</style>
