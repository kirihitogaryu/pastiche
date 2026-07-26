<script lang="ts">
	import { openAtlasAsset, updateMobileNavFromScroll } from '$lib/state/app-state.svelte';
	import { isGifMedia } from '$lib/library/media';
	import type { LibraryAsset } from '$lib/library/types';

	type Props = {
		assets: LibraryAsset[];
		loading?: boolean;
		error?: string | null;
	};

	let { assets, loading = false, error = null }: Props = $props();
	let recentAssets = $derived([...assets].sort(compareImportedAt));
	let animatedAssetId = $state<string | null>(null);

	function assetIsGif(asset: LibraryAsset) {
		return isGifMedia(
			asset.record?.image.mimeType,
			asset.record?.filename,
			asset.title,
			asset.record?.image.originalUrl,
			asset.record?.image.sourceImageUrl
		);
	}

	function startAssetPreview(asset: LibraryAsset) {
		if (!assetIsGif(asset) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		animatedAssetId = asset.id;
	}

	function stopAssetPreview(asset: LibraryAsset) {
		if (animatedAssetId === asset.id) animatedAssetId = null;
	}

	function compareImportedAt(first: LibraryAsset, second: LibraryAsset) {
		return (
			dateValue(second.importedAt ?? second.capturedAt) -
			dateValue(first.importedAt ?? first.capturedAt)
		);
	}

	function dateValue(value: string | null | undefined) {
		const time = value ? Date.parse(value) : 0;
		return Number.isFinite(time) ? time : 0;
	}
</script>

<section
	class="atlas-home"
	aria-label="Atlas home"
	onscroll={(event) => updateMobileNavFromScroll(event.currentTarget.scrollTop, 'atlas-home')}
>
	<h1 class="sr-only">Atlas</h1>
	{#if loading}
		<div class="empty">Loading library assets...</div>
	{:else if error}
		<div class="empty">{error}</div>
	{:else if recentAssets.length === 0}
		<div class="empty">No library assets are available yet.</div>
	{:else}
		<div class="asset-grid" aria-label="Atlas assets">
			{#each recentAssets as asset (asset.id)}
				<button
					type="button"
					class="asset-card"
					aria-label={`${assetIsGif(asset) ? 'Animated GIF. ' : ''}Open Atlas inspect for ${asset.title}`}
					onclick={() => openAtlasAsset(asset.id)}
					onpointerenter={() => startAssetPreview(asset)}
					onpointerleave={() => stopAssetPreview(asset)}
					onfocus={() => startAssetPreview(asset)}
					onblur={() => stopAssetPreview(asset)}
				>
					<span class="thumb">
						<img
							class:static-hidden={assetIsGif(asset) && animatedAssetId === asset.id}
							src={asset.record?.image.previewUrl ?? asset.imageUrl}
							alt=""
							loading="lazy"
						/>
						{#if assetIsGif(asset) && animatedAssetId === asset.id}
							<img
								class="animated-preview"
								src={asset.record?.image.originalUrl ?? asset.imageUrl}
								alt=""
								aria-hidden="true"
								onerror={() => stopAssetPreview(asset)}
							/>
						{/if}
						{#if assetIsGif(asset)}
							<span
								class="gif-badge"
								aria-hidden="true"
								title="Animated GIF; hover or focus to preview">GIF</span
							>
						{/if}
					</span>
					<span class="body">
						<strong>{asset.title}</strong>
						<small>{[asset.creator, asset.year, asset.medium].filter(Boolean).join(' / ')}</small>
					</span>
					<span class="meta">{asset.record?.source.label ?? asset.sourceName}</span>
				</button>
			{/each}
		</div>
	{/if}
</section>

<style>
	.atlas-home {
		height: 100%;
		padding: var(--space-5);
		overflow: auto;
		background: var(--color-bg);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.empty {
		color: var(--color-muted);
	}

	.asset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--space-3);
		align-content: start;
	}

	.asset-card {
		min-width: 0;
		display: grid;
		grid-template-rows: 12rem auto auto;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}

	.asset-card:hover,
	.asset-card:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-raised);
	}

	.thumb {
		position: relative;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70);
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.animated-preview {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	img.static-hidden {
		opacity: 0;
	}

	.gif-badge {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-2);
		z-index: 2;
		min-width: 2.2rem;
		min-height: 1.55rem;
		display: inline-grid;
		place-items: center;
		padding: 0 0.45rem;
		border: 1px solid oklch(82% 0.012 75 / 0.26);
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70 / 0.86);
		color: var(--color-text);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.body {
		min-width: 0;
		display: grid;
		gap: var(--space-1);
	}

	strong,
	small,
	.meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small,
	.meta {
		color: var(--color-muted);
	}

	.meta {
		font-size: 0.74rem;
	}

	.empty {
		display: grid;
		place-items: center;
	}
</style>
