<script lang="ts">
	import ExploreCard from '$lib/components/explore/ExploreCard.svelte';
	import type { ExploreContentSafety, ExploreItem } from '$lib/explore/types';

	type Props = {
		items: ExploreItem[];
		activeId?: string | null;
		loading?: boolean;
		sourceLabel?: string;
		contentSafety?: ExploreContentSafety;
		onOpen: (item: ExploreItem) => void;
		onPrefetch?: (item: ExploreItem) => void;
	};

	let {
		items,
		activeId = null,
		loading = false,
		sourceLabel = 'Explore',
		contentSafety = 'show',
		onOpen,
		onPrefetch
	}: Props = $props();
	const skeletons = Array.from({ length: 12 }, (_, index) => index);
</script>

<section class="explore-grid" aria-label={`${sourceLabel} results`}>
	{#if loading && items.length === 0}
		{#each skeletons as skeleton (skeleton)}
			<div class="skeleton" aria-hidden="true" style={`--delay: ${skeleton * 40}ms`}></div>
		{/each}
	{:else}
		{#each items as item, index (item.id)}
			<ExploreCard
				{item}
				active={item.id === activeId}
				priority={index < 6 ? 'high' : 'auto'}
				{onOpen}
				{onPrefetch}
				blurSensitive={contentSafety === 'blur' && item.contentRating !== 'general'}
			/>
		{/each}
	{/if}
</section>

<style>
	.explore-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		grid-auto-flow: dense;
		gap: var(--space-4);
		padding: var(--space-5);
		padding-bottom: var(--space-8);
	}

	.skeleton {
		min-height: 12rem;
		aspect-ratio: 1 / 1.12;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background:
			linear-gradient(90deg, transparent, oklch(92% 0.01 75 / 0.08), transparent),
			var(--color-surface);
		background-size: 220% 100%;
		animation: pulse 1.4s ease-in-out infinite;
		animation-delay: var(--delay);
	}

	@keyframes pulse {
		from {
			background-position: 160% 0;
		}
		to {
			background-position: -80% 0;
		}
	}

	@media (min-width: 1180px) {
		.explore-grid {
			grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
			gap: var(--space-5);
		}
	}

	@media (max-width: 759px) {
		.explore-grid {
			display: block;
			columns: 9.25rem;
			column-gap: 0.45rem;
			padding: var(--space-2);
			padding-bottom: calc(var(--bottom-nav-height) + var(--space-3));
		}

		.explore-grid :global(.explore-card:nth-child(n)),
		.skeleton:nth-child(n) {
			display: inline-block;
			width: 100%;
			margin: 0 0 0.45rem;
			break-inside: avoid;
			vertical-align: top;
		}
	}
</style>
