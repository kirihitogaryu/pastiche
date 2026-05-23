<script lang="ts">
	import AssetGrid from '$lib/components/browse/AssetGrid.svelte';
	import LibrarySidebar from '$lib/components/browse/LibrarySidebar.svelte';
	import AssetInspector from '$lib/components/inspector/AssetInspector.svelte';
	import {
		closeInspector,
		enterSelection,
		openMobileInspect,
		selectAsset,
		setShellScrolled,
		toggleLibrarySidebar,
		toggleSelection,
		appState
	} from '$lib/state/app-state.svelte';
	import { exploreAssets, libraryAssets } from '$lib/data/mock-assets';
	import type { AppMode, Asset } from '$lib/types';

	type Props = {
		mode: Extract<AppMode, 'library' | 'explore'>;
	};

	let { mode }: Props = $props();

	let currentAssets = $derived(mode === 'library' ? libraryAssets : exploreAssets);
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
		<div class="scroll-area" onscroll={(event) => setShellScrolled(event.currentTarget.scrollTop > 12)}>
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

		.scroll-area {
			overflow: visible;
		}
	}
</style>
