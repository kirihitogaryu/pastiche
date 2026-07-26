<script lang="ts">
	import AtlasAssetInspect from './AtlasAssetInspect.svelte';
	import AtlasHome from './AtlasHome.svelte';
	import AtlasSearch from './AtlasSearch.svelte';
	import AtlasSearchHeader from './AtlasSearchHeader.svelte';
	import AtlasWiki from './AtlasWiki.svelte';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import FocusedAssetPreview from '$lib/components/inspector/FocusedAssetPreview.svelte';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import { appState, returnFromAtlasAsset } from '$lib/state/app-state.svelte';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type AtlasResponse = {
		asset: Asset;
		atlas: AtlasAssetSummary;
	};

	let atlas = $state<AtlasAssetSummary | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let libraryLoading = $state(false);
	let libraryLoaded = $state(false);
	let libraryError = $state<string | null>(null);
	let previewAsset = $state<Asset | null>(null);

	let asset = $derived(
		appState.activeAtlasAssetId
			? (libraryState.snapshot.assets.find((item) => item.id === appState.activeAtlasAssetId) ??
					null)
			: null
	);

	$effect(() => {
		if (libraryState.snapshot.assets.length || libraryLoaded || libraryLoading) return;
		libraryLoading = true;
		libraryError = null;
		void loadLibrarySnapshot()
			.then((snapshot) => {
				setLibrarySnapshot(snapshot);
			})
			.catch((loadError) => {
				libraryError =
					loadError instanceof Error ? loadError.message : 'Library could not be loaded.';
			})
			.finally(() => {
				libraryLoaded = true;
				libraryLoading = false;
			});
	});

	$effect(() => {
		if (appState.atlasView !== 'asset' || !asset) return;
		void loadAtlas(asset.id);
	});

	async function loadAtlas(assetId: string) {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(assetId)}/atlas`);
			const body = (await response.json()) as AtlasResponse | { error?: string };
			if (!response.ok || !('atlas' in body)) {
				throw new Error(
					'error' in body && body.error ? body.error : 'Atlas metadata could not be loaded.'
				);
			}
			atlas = body.atlas;
		} catch (loadError) {
			atlas = null;
			error =
				loadError instanceof Error ? loadError.message : 'Atlas metadata could not be loaded.';
		} finally {
			loading = false;
		}
	}

	function updateLoadedAtlas(updatedAsset: Asset, updatedAtlas: AtlasAssetSummary) {
		atlas = updatedAtlas;
		libraryState.snapshot = {
			...libraryState.snapshot,
			assets: libraryState.snapshot.assets.map((item) =>
				item.id === updatedAsset.id ? { ...item, ...updatedAsset } : item
			)
		};
	}

	async function deleteAtlasAsset(assetToDelete: Asset) {
		error = null;
		const response = await fetch(
			`/api/library/assets/${encodeURIComponent(assetToDelete.id)}`,
			{ method: 'DELETE' }
		);
		if (!response.ok && response.status !== 404) {
			const body = (await response.json().catch(() => null)) as { error?: string } | null;
			throw new Error(body?.error ?? 'The image could not be deleted.');
		}

		const snapshot = await loadLibrarySnapshot();
		setLibrarySnapshot(snapshot);
		if (previewAsset?.id === assetToDelete.id) previewAsset = null;
		atlas = null;
		returnFromAtlasAsset();
	}
</script>

<section class="atlas-workspace" aria-label="Atlas workspace">
	{#if appState.atlasView !== 'asset'}
		<AtlasSearchHeader />
	{/if}
	<div class="atlas-content">
		{#if appState.atlasView === 'home'}
			<AtlasHome
				assets={libraryState.snapshot.assets}
				loading={libraryLoading}
				error={libraryError}
			/>
		{:else if appState.atlasView === 'wiki'}
			<AtlasWiki />
		{:else if appState.atlasView === 'search'}
			<AtlasSearch />
		{:else if asset}
			<AtlasAssetInspect
				{asset}
				{atlas}
				{loading}
				{error}
				onBack={returnFromAtlasAsset}
				onPreview={(item) => (previewAsset = item)}
				onUpdated={updateLoadedAtlas}
				onDelete={deleteAtlasAsset}
			/>
		{:else if libraryLoading}
			<section class="empty" aria-label="Atlas loading state">
				<p>Loading library assets...</p>
			</section>
		{:else}
			<section class="empty" aria-label="Atlas empty state">
				<p>{libraryError ?? 'No library assets are available yet.'}</p>
			</section>
		{/if}
	</div>
</section>

{#if previewAsset}
	<FocusedAssetPreview asset={previewAsset} onClose={() => (previewAsset = null)} />
{/if}

<style>
	.atlas-workspace {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--color-bg);
	}

	.atlas-content {
		min-height: 0;
		overflow: hidden;
	}

	.empty {
		height: 100%;
		display: grid;
		place-items: center;
		color: var(--color-muted);
	}
</style>
