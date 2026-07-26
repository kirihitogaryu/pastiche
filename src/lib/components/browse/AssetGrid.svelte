<script lang="ts">
	import AssetCard from '$lib/components/browse/AssetCard.svelte';
	import type { Asset } from '$lib/types';

	type Props = {
		assets: Asset[];
		activeId?: string | null;
		selectedIds?: string[];
		mode?: 'library' | 'explore';
		editMode?: boolean;
		onOpen: (asset: Asset) => void;
		onSelect: (asset: Asset) => void;
	};

	let {
		assets,
		activeId = null,
		selectedIds = [],
		mode = 'library',
		editMode = false,
		onOpen,
		onSelect
	}: Props = $props();
</script>

<section class="asset-grid" aria-label={`${mode} results`}>
	{#each assets as asset (asset.id)}
		<AssetCard
			{asset}
			{mode}
			{editMode}
			active={mode !== 'library' && asset.id === activeId}
			selected={selectedIds.includes(asset.id)}
			{onOpen}
			{onSelect}
		/>
	{/each}
</section>

<style>
	.asset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		align-items: start;
		gap: var(--space-3);
		padding: var(--space-4);
		padding-bottom: var(--space-8);
	}

	@media (min-width: 1180px) {
		.asset-grid {
			grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
			gap: var(--space-3);
		}
	}

	@media (max-width: 759px) {
		.asset-grid {
			display: block;
			columns: 9rem;
			column-gap: 0.45rem;
			padding: var(--space-2);
			padding-bottom: calc(var(--bottom-nav-height) + var(--space-3));
		}

		.asset-grid :global(.asset-card:nth-child(n)) {
			display: inline-block;
			width: 100%;
			margin: 0 0 0.45rem;
			break-inside: avoid;
			vertical-align: top;
		}
	}
</style>
