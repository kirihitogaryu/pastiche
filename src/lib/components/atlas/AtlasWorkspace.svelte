<script lang="ts">
	import AtlasAssetInspect from './AtlasAssetInspect.svelte';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import FocusedAssetPreview from '$lib/components/inspector/FocusedAssetPreview.svelte';
	import { appState, openAtlasAsset } from '$lib/state/app-state.svelte';
	import { libraryState } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type AtlasResponse = {
		asset: Asset;
		atlas: AtlasAssetSummary;
	};

	let atlas = $state<AtlasAssetSummary | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let previewAsset = $state<Asset | null>(null);

	let fallbackAsset = $derived(libraryState.snapshot.assets[0] ?? null);
	let activeAssetId = $derived(
		appState.activeAtlasAssetId ?? appState.selectedAssetId ?? fallbackAsset?.id ?? null
	);
	let asset = $derived(
		libraryState.snapshot.assets.find((item) => item.id === activeAssetId) ?? fallbackAsset
	);

	$effect(() => {
		if (asset && appState.activeAtlasAssetId !== asset.id) {
			openAtlasAsset(asset.id);
		}
	});

	$effect(() => {
		if (!asset) return;
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
</script>

{#if asset}
	<AtlasAssetInspect
		{asset}
		{atlas}
		{loading}
		{error}
		onPreview={(item) => (previewAsset = item)}
	/>
{:else}
	<section class="empty" aria-label="Atlas empty state">
		<p>No library assets are available yet.</p>
	</section>
{/if}

{#if previewAsset}
	<FocusedAssetPreview asset={previewAsset} onClose={() => (previewAsset = null)} />
{/if}

<style>
	.empty {
		height: 100%;
		display: grid;
		place-items: center;
		color: var(--color-muted);
	}
</style>
