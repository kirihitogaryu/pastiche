<script lang="ts">
	import AssetCard from '$lib/components/browse/AssetCard.svelte';
	import type { Asset } from '$lib/types';

	type Props = {
		assets: Asset[];
		activeId?: string | null;
		selectedIds?: string[];
		mode?: 'library' | 'explore';
		onOpen: (asset: Asset) => void;
		onSelect: (asset: Asset) => void;
	};

	let {
		assets,
		activeId = null,
		selectedIds = [],
		mode = 'library',
		onOpen,
		onSelect
	}: Props = $props();
</script>

<section class="asset-grid" aria-label={`${mode} results`}>
	{#each assets as asset (asset.id)}
		<AssetCard
			{asset}
			{mode}
			active={asset.id === activeId}
			selected={selectedIds.includes(asset.id)}
			{onOpen}
			{onSelect}
		/>
	{/each}
</section>

<style>
	.asset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		grid-auto-flow: dense;
		gap: var(--space-4);
		padding: var(--space-5);
		padding-bottom: var(--space-8);
	}

	.asset-grid :global(.asset-card:nth-child(5n + 1)) {
		grid-row: span 2;
	}

	.asset-grid :global(.asset-card:nth-child(7n + 3)) {
		grid-column: span 2;
	}

	@media (min-width: 1180px) {
		.asset-grid {
			grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
			gap: var(--space-5);
		}
	}

	@media (max-width: 759px) {
		.asset-grid {
			grid-template-columns: repeat(auto-fill, minmax(6.45rem, 1fr));
			gap: 0.45rem;
			padding: var(--space-2);
			padding-bottom: calc(var(--bottom-nav-height) + var(--space-3));
		}

		.asset-grid :global(.asset-card:nth-child(n)) {
			grid-column: auto;
			grid-row: auto;
		}

	}
</style>
