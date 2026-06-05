<script lang="ts">
	import AtlasAiMetadataSection from './AtlasAiMetadataSection.svelte';
	import AtlasImageStage from './AtlasImageStage.svelte';
	import AtlasMetadataPanel from './AtlasMetadataPanel.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		loading?: boolean;
		error?: string | null;
		onBack?: () => void;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, atlas, loading = false, error = null, onBack, onPreview }: Props = $props();
	let subtitle = $derived([asset.creator, asset.year, asset.medium].filter(Boolean).join(' · '));

	function openSource() {
		if (!asset.sourceUrl) return;
		window.open(asset.sourceUrl, '_blank', 'noreferrer');
	}
</script>

<section class="atlas-inspect" aria-label={`Atlas inspect ${asset.title}`}>
	<header class="top">
		<div class="title-zone">
			{#if onBack}
				<button class="back" type="button" onclick={onBack}>
					<ArrowLeftIcon size={16} />
					Back to Atlas
				</button>
			{/if}
			<div class="asset-title">
				<h1>{asset.title}</h1>
				{#if subtitle}
					<span>{subtitle}</span>
				{/if}
			</div>
		</div>
		<div class="actions">
			<span class="position">1 of 1</span>
			<button class="icon" type="button" aria-label="Previous asset" disabled>
				<CaretLeftIcon size={18} />
			</button>
			<button class="icon" type="button" aria-label="Next asset" disabled>
				<CaretRightIcon size={18} />
			</button>
			<button type="button" disabled={!asset.sourceUrl} onclick={openSource}>
				<ArrowSquareOutIcon size={17} />
				Open source
			</button>
			<button type="button" disabled={loading}>Edit metadata</button>
			<button type="button">Add to project</button>
			<button class="icon" type="button" aria-label="More Atlas actions" disabled>
				<DotsThreeIcon size={20} />
			</button>
		</div>
	</header>

	<div class="body">
		<AtlasMetadataPanel {asset} {atlas} />
		<div class="main-scroll">
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
		grid-template-rows: 3.6rem minmax(0, 1fr);
		background: var(--color-bg);
	}

	.top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		border-bottom: 1px solid var(--color-border);
		background: oklch(10% 0.007 70 / 0.96);
	}

	h1 {
		margin: 0;
	}

	.title-zone {
		min-width: 0;
		height: 100%;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
	}

	.asset-title {
		min-width: 0;
	}

	h1 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1rem;
		font-weight: 760;
		letter-spacing: 0;
	}

	.asset-title span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
		font-size: 0.76rem;
	}

	.actions {
		display: flex;
		min-width: 0;
		height: 100%;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		overflow: hidden;
	}

	button {
		border: 1px solid var(--color-border);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(18% 0.01 70);
	}

	button:active {
		transform: translateY(1px);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
		transform: none;
	}

	.actions button,
	.back {
		min-height: 2rem;
		border-radius: var(--radius-md);
	}

	.actions button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-3);
		white-space: nowrap;
		font-size: 0.78rem;
	}

	.actions .icon {
		width: 2rem;
		padding: 0;
		justify-content: center;
	}

	.position {
		margin-right: var(--space-2);
		color: var(--color-dim);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border-color: transparent;
		background: transparent;
		color: var(--color-muted);
		padding: 0 var(--space-2);
		white-space: nowrap;
	}

	.body {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr);
	}

	.main-scroll {
		min-height: 0;
		padding: var(--space-3) var(--space-4) var(--space-6);
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.main-scroll > :global(*) + :global(*) {
		margin-top: var(--space-3);
	}

	.main-scroll::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.main-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.main-scroll::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.16);
		background-clip: padding-box;
	}

	.main-scroll::-webkit-scrollbar-thumb:hover {
		background: oklch(72% 0.012 75 / 0.28);
		background-clip: padding-box;
	}

	.error {
		color: var(--color-danger);
	}

	@media (max-width: 980px) {
		.atlas-inspect {
			grid-template-rows: auto minmax(0, 1fr);
		}

		.top {
			grid-template-columns: 1fr;
			gap: var(--space-2);
			padding: var(--space-3);
		}

		.title-zone,
		.actions {
			height: auto;
			padding: 0;
			border-right: 0;
		}

		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
