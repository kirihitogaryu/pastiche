<script lang="ts">
	import { openAtlasAsset, openAtlasWiki } from '$lib/state/app-state.svelte';
	import type { LibraryAsset } from '$lib/library/types';

	type Props = {
		assets: LibraryAsset[];
		loading?: boolean;
		error?: string | null;
	};

	let { assets, loading = false, error = null }: Props = $props();
	let recentAssets = $derived([...assets].sort(compareImportedAt));

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

<section class="atlas-home" aria-label="Atlas home">
	<header>
		<div>
			<p>Atlas</p>
			<h1>Atlas</h1>
			<span>All library assets, newest first.</span>
		</div>
		<button type="button" class="wiki-link" onclick={openAtlasWiki}>Open Atlas wiki</button>
	</header>

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
					aria-label={`Open Atlas inspect for ${asset.title}`}
					onclick={() => openAtlasAsset(asset.id)}
				>
					<span class="thumb">
						<img src={asset.record?.image.previewUrl ?? asset.imageUrl} alt="" loading="lazy" />
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
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--space-4);
		padding: var(--space-5);
		overflow: auto;
		background: var(--color-bg);
	}

	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--space-4);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-border-soft);
	}

	p,
	h1 {
		margin: 0;
	}

	p {
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		font-family: var(--font-heading);
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1;
	}

	header span,
	.empty {
		color: var(--color-muted);
	}

	.wiki-link {
		min-height: 2.1rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
		font-size: 0.78rem;
		cursor: pointer;
	}

	.wiki-link:hover,
	.wiki-link:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(17% 0.009 70);
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
