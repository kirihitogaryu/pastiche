<script lang="ts">
	import AssetInspector from '$lib/components/inspector/AssetInspector.svelte';
	import FocusedAssetPreview from '$lib/components/inspector/FocusedAssetPreview.svelte';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import { appState, closeInspector } from '$lib/state/app-state.svelte';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';
	import FolderContents from './FolderContents.svelte';
	import LibraryOverview from './LibraryOverview.svelte';

	let library = $derived(libraryState.snapshot);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let previewAsset = $state<Asset | null>(null);
	let selectedAsset = $derived(
		library.assets.find((asset) => asset.id === appState.selectedAssetId) ?? null
	);
	let showInspector = $derived(appState.inspectorOpen && appState.libraryView !== 'overview');

	$effect(() => {
		let cancelled = false;
		loading = true;
		error = null;
		void loadLibrarySnapshot()
			.then((snapshot) => {
				if (cancelled) return;
				setLibrarySnapshot(snapshot);
			})
			.catch((loadError) => {
				if (cancelled) return;
				error = loadError instanceof Error ? loadError.message : 'Library could not be loaded.';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	async function deleteAsset(asset: Asset) {
		if (!window.confirm(`Delete "${asset.title}" from the library?`)) return;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
				method: 'DELETE'
			});
			if (!response.ok && response.status !== 404) {
				throw new Error('Asset could not be deleted.');
			}
			const snapshot = await loadLibrarySnapshot();
			setLibrarySnapshot(snapshot);
			closeInspector();
			error = null;
		} catch (deleteError) {
			error = deleteError instanceof Error ? deleteError.message : 'Asset could not be deleted.';
		}
	}
</script>

<div class="library-workspace">
	<div class="library-content">
		{#if appState.libraryView === 'overview'}
			<LibraryOverview {library} {loading} {error} />
		{:else if appState.libraryView === 'all'}
			<FolderContents scope="all" {library} {loading} {error} />
		{:else if appState.libraryView === 'folder'}
			<FolderContents scope="folder" {library} {loading} {error} />
		{:else if appState.libraryView === 'project'}
			<FolderContents scope="project" {library} {loading} {error} />
		{:else if appState.libraryView === 'smart'}
			<FolderContents scope="smart" {library} {loading} {error} />
		{:else}
			<LibraryOverview {library} {loading} {error} />
		{/if}
	</div>

	{#if showInspector}
		<AssetInspector
			asset={selectedAsset}
			onClose={closeInspector}
			onDelete={deleteAsset}
			onPreview={(asset) => (previewAsset = asset)}
		/>
	{/if}
</div>

{#if previewAsset}
	<FocusedAssetPreview asset={previewAsset} onClose={() => (previewAsset = null)} />
{/if}

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
