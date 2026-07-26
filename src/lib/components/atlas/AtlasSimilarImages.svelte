<script lang="ts">
	import { openAtlasAsset } from '$lib/state/app-state.svelte';
	import { isGifMedia } from '$lib/library/media';

	type SimilarAsset = {
		id: string;
		title: string;
		thumbnailUrl: string | null;
		mimeType: string | null;
		sourceUrl: string;
		subtitle: string;
		score: number;
		sharedConcepts: Array<{ slug: string; label: string; visualRole: string | null }>;
	};

	type Props = {
		assetId: string;
	};

	let { assetId }: Props = $props();
	let loading = $state(false);
	let assets = $state<SimilarAsset[]>([]);
	let error = $state<string | null>(null);
	let animatedAssetId = $state<string | null>(null);

	function assetIsGif(asset: SimilarAsset) {
		return isGifMedia(asset.mimeType, asset.title, asset.thumbnailUrl);
	}

	function startPreview(asset: SimilarAsset) {
		if (!assetIsGif(asset) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		animatedAssetId = asset.id;
	}

	function stopPreview(asset: SimilarAsset) {
		if (animatedAssetId === asset.id) animatedAssetId = null;
	}

	$effect(() => {
		if (!assetId) return;
		loading = true;
		error = null;
		fetch(`/api/atlas/assets/${encodeURIComponent(assetId)}/similar?limit=6`)
			.then(async (response) => {
				const body = (await response.json()) as { assets?: SimilarAsset[]; error?: string };
				if (!response.ok) throw new Error(body.error ?? 'Similar images could not be loaded.');
				assets = body.assets ?? [];
			})
			.catch((loadError) => {
				error =
					loadError instanceof Error ? loadError.message : 'Similar images could not be loaded.';
				assets = [];
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

<section class="similar-images" aria-label="Similar Atlas images">
	<header>
		<div>
			<strong>Similar Images</strong>
			<small>Shared Atlas tags and visual-role weighting.</small>
		</div>
	</header>

	{#if loading}
		<div class="empty">Finding related assets...</div>
	{:else if error}
		<div class="empty error">{error}</div>
	{:else if assets.length === 0}
		<div class="empty">No related Atlas images yet.</div>
	{:else}
		<div class="strip">
			{#each assets as asset (asset.id)}
				<button
					type="button"
					class="similar-card"
					aria-label={`${assetIsGif(asset) ? 'Animated GIF. ' : ''}Open ${asset.title}`}
					onclick={() => openAtlasAsset(asset.id)}
					onpointerenter={() => startPreview(asset)}
					onpointerleave={() => stopPreview(asset)}
					onfocus={() => startPreview(asset)}
					onblur={() => stopPreview(asset)}
				>
					<span class="thumb">
						{#if asset.thumbnailUrl}
							<img
								class:static-hidden={assetIsGif(asset) && animatedAssetId === asset.id}
								src={asset.thumbnailUrl}
								alt=""
								loading="lazy"
							/>
							{#if assetIsGif(asset) && animatedAssetId === asset.id}
								<img
									class="animated-preview"
									src={`/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=original`}
									alt=""
									aria-hidden="true"
									onerror={() => stopPreview(asset)}
								/>
							{/if}
							{#if assetIsGif(asset)}
								<span
									class="gif-badge"
									aria-hidden="true"
									title="Animated GIF; hover or focus to preview">GIF</span
								>
							{/if}
						{/if}
					</span>
					<span class="body">
						<strong>{asset.title}</strong>
						<small>{asset.subtitle || `${asset.sharedConcepts.length} shared tag(s)`}</small>
					</span>
					<span class="tags">
						{#each asset.sharedConcepts.slice(0, 3) as concept}
							<code>{concept.slug}</code>
						{/each}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</section>

<style>
	.similar-images {
		display: grid;
		gap: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
		padding-top: var(--space-3);
	}

	header {
		display: flex;
		align-items: end;
		justify-content: space-between;
	}

	header strong {
		display: block;
		color: var(--color-text);
		font-size: 0.74rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	header small,
	.empty {
		color: var(--color-muted);
	}

	.strip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(10.5rem, 1fr);
		gap: var(--space-3);
		overflow-x: auto;
		padding-bottom: var(--space-2);
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.strip::-webkit-scrollbar {
		height: 8px;
	}

	.strip::-webkit-scrollbar-track {
		background: transparent;
	}

	.strip::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.16);
		background-clip: padding-box;
	}

	.similar-card {
		min-width: 0;
		display: grid;
		grid-template-rows: 7rem auto auto;
		gap: var(--space-2);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(11.5% 0.007 70);
		color: var(--color-text);
		padding: var(--space-2);
		text-align: left;
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.similar-card:hover,
	.similar-card:focus-visible {
		transform: translateY(-1px);
		border-color: var(--color-border-strong);
		background: oklch(14% 0.008 70);
	}

	.thumb {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: oklch(8.5% 0.007 70);
	}

	.thumb .animated-preview {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.thumb img.static-hidden {
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

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.body,
	.tags {
		min-width: 0;
		display: grid;
		gap: 0.16rem;
	}

	.body strong,
	.body small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.body small {
		color: var(--color-muted);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
	}

	code {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		padding: 0.05rem 0.25rem;
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.66rem;
	}

	.error {
		color: var(--color-danger);
	}
</style>
