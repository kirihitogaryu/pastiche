<script lang="ts">
	import AtlasAiMetadataSection from './AtlasAiMetadataSection.svelte';
	import AtlasImageStage from './AtlasImageStage.svelte';
	import AtlasMetadataPanel from './AtlasMetadataPanel.svelte';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		loading?: boolean;
		error?: string | null;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, atlas, loading = false, error = null, onPreview }: Props = $props();
	let subtitle = $derived([asset.creator, asset.year, asset.medium].filter(Boolean).join(' / '));
</script>

<section class="atlas-inspect" aria-label={`Atlas inspect ${asset.title}`}>
	<header class="top">
		<div>
			<p>Atlas Inspect</p>
			<h1>{asset.title}</h1>
			{#if subtitle}
				<span>{subtitle}</span>
			{/if}
		</div>
		<div class="actions">
			<button type="button" disabled={loading}>Edit metadata</button>
			<button type="button">Add to project</button>
		</div>
	</header>

	<div class="body">
		<AtlasMetadataPanel {asset} {atlas} />
		<div class="main">
			{#if error}
				<p class="error">{error}</p>
			{/if}
			<AtlasImageStage {asset} {onPreview} />
			<AtlasAiMetadataSection />
		</div>
	</div>
</section>

<style>
	.atlas-inspect {
		height: 100%;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--color-bg);
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
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
		font-size: 1.25rem;
	}

	span {
		color: var(--color-muted);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}

	.actions button {
		min-height: 2.35rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
	}

	.body {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr);
	}

	.main {
		min-height: 0;
		display: grid;
		grid-template-rows: minmax(22rem, 1fr) auto;
		gap: var(--space-3);
		padding: var(--space-3);
		overflow: auto;
	}

	.error {
		color: var(--color-danger);
	}

	@media (max-width: 900px) {
		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
