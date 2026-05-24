<script lang="ts">
	import { mockAssets } from '$lib/data/mock-assets';
	import AssetInspector from '$lib/components/inspector/AssetInspector.svelte';
	import { appState, closeInspector } from '$lib/state/app-state.svelte';
	import FolderContents from './FolderContents.svelte';
	import LibraryOverview from './LibraryOverview.svelte';

	let selectedAsset = $derived(mockAssets.find((asset) => asset.id === appState.selectedAssetId) ?? null);
	let showInspector = $derived(appState.inspectorOpen && appState.libraryView !== 'overview');
</script>

<div class="library-workspace">
	<div class="library-content">
		{#if appState.libraryView === 'overview'}
			<LibraryOverview />
		{:else if appState.libraryView === 'all'}
			<FolderContents scope="all" />
		{:else if appState.libraryView === 'folder'}
			<FolderContents scope="folder" />
		{:else}
			<LibraryOverview />
		{/if}
	</div>

	{#if showInspector}
		<AssetInspector asset={selectedAsset} onClose={closeInspector} />
	{/if}
</div>

<style>
	.library-workspace {
		width: 100%;
		height: 100%;
		min-width: 0;
		display: flex;
	}

	.library-content {
		min-width: 0;
		flex: 1;
		height: 100%;
	}

	@media (max-width: 759px) {
		.library-workspace {
			display: block;
			height: auto;
			min-height: 100%;
		}

		.library-content {
			height: auto;
			min-height: 100%;
		}
	}
</style>
