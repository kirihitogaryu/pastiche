<script lang="ts">
	import { getCachedThumbUrl, revokeThumbUrl } from '$lib/explore/client-cache';
	import type { ExploreItem } from '$lib/explore/types';

	type Props = {
		item: ExploreItem;
		active?: boolean;
		priority?: 'high' | 'low' | 'auto';
		onOpen: (item: ExploreItem) => void;
		onPrefetch?: (item: ExploreItem) => void;
	};

	let { item, active = false, priority = 'auto', onOpen, onPrefetch }: Props = $props();
	let measuredRatio = $state(1);
	let displayedImage = $state('');
	let cachedBlobUrl: string | null = null;
	let hoverTimer: number | null = null;
	let ratio = $derived(Math.min(1.85, Math.max(0.58, measuredRatio)));
	let sourceImage = $derived(item.thumbUrl ?? item.imageUrl);
	let hasImage = $derived(sourceImage !== null);

	$effect(() => {
		const itemId = item.id;
		const imageUrl = sourceImage;
		let cancelled = false;
		if (!imageUrl) {
			displayedImage = '';
			return;
		}
		displayedImage = imageUrl;

		void getCachedThumbUrl(itemId, imageUrl).then((cachedUrl) => {
			if (cancelled) {
				revokeThumbUrl(cachedUrl);
				return;
			}
			if (cachedBlobUrl) revokeThumbUrl(cachedBlobUrl);
			cachedBlobUrl = cachedUrl.startsWith('blob:') ? cachedUrl : null;
			displayedImage = cachedUrl;
		});

		return () => {
			cancelled = true;
			if (cachedBlobUrl) {
				revokeThumbUrl(cachedBlobUrl);
				cachedBlobUrl = null;
			}
		};
	});

	$effect(() => {
		return () => cancelPrefetch();
	});

	function recordNaturalRatio(event: Event) {
		const image = event.currentTarget as HTMLImageElement;
		if (image.naturalWidth > 0 && image.naturalHeight > 0) {
			measuredRatio = image.naturalWidth / image.naturalHeight;
		}
	}

	function schedulePrefetch() {
		if (!onPrefetch) return;
		cancelPrefetch();
		hoverTimer = window.setTimeout(() => {
			onPrefetch?.(item);
		}, 200);
	}

	function cancelPrefetch() {
		if (!hoverTimer) return;
		window.clearTimeout(hoverTimer);
		hoverTimer = null;
	}

	function sourceLabel(source: ExploreItem['source']) {
		if (source === 'artic') return 'Art Institute';
		if (source === 'wikidata') return 'Wikidata';
		return 'The Met';
	}
</script>

<article
	class:active
	class:no-image={!hasImage}
	class="explore-card"
	style={`--asset-ratio: ${ratio}`}
>
	<button
		class="image-button"
		type="button"
		aria-label={`Inspect ${item.title}`}
		onclick={() => onOpen(item)}
		onmouseenter={schedulePrefetch}
		onmouseleave={cancelPrefetch}
		onfocus={schedulePrefetch}
		onblur={cancelPrefetch}
	>
		{#if hasImage}
			<img
				src={displayedImage}
				alt={item.title}
				loading="lazy"
				fetchpriority={priority}
				decoding="async"
				onload={recordNaturalRatio}
			/>
		{:else}
			<span class="image-placeholder" aria-hidden="true">
				<strong>{item.title}</strong>
				<small>{item.department ?? 'Wikidata metadata record'}</small>
			</span>
		{/if}
		<span class="shade"></span>
		<span class="source">{sourceLabel(item.source)}</span>
		<span class="meta">
			<strong>{item.title}</strong>
			<small
				>{item.artistRaw ?? 'Unknown artist'}{item.dateDisplay
					? ` · ${item.dateDisplay}`
					: ''}</small
			>
		</span>
	</button>
</article>

<style>
	.explore-card {
		position: relative;
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		contain: layout paint;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.explore-card.active {
		border-color: var(--color-accent);
	}

	.explore-card:hover {
		transform: translateY(-1px);
		border-color: var(--color-border-strong);
	}

	.image-button {
		width: 100%;
		height: 100%;
		min-height: 12rem;
		aspect-ratio: var(--asset-ratio);
		display: block;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
	}

	img,
	.image-placeholder,
	.shade {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	img {
		object-fit: cover;
		background: var(--color-surface-raised);
	}

	.image-placeholder {
		display: grid;
		align-content: center;
		gap: var(--space-2);
		padding: var(--space-5);
		background: linear-gradient(135deg, var(--color-surface), var(--color-surface-raised));
		color: var(--color-text);
	}

	.image-placeholder strong {
		font-family: var(--font-heading);
		font-size: 1rem;
		line-height: 1.15;
	}

	.image-placeholder small {
		color: var(--color-muted);
		line-height: 1.35;
	}

	.shade {
		background: linear-gradient(to top, oklch(0% 0 0 / 0.76), transparent 58%);
		opacity: 0;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.source,
	.meta {
		position: absolute;
		z-index: 1;
	}

	.source {
		top: var(--space-3);
		left: var(--space-3);
		max-width: calc(100% - 1.5rem);
		padding: 0.35rem 0.55rem;
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70 / 0.78);
		color: var(--color-text);
		font-size: 0.78rem;
		font-weight: 650;
	}

	.meta {
		left: var(--space-4);
		right: var(--space-4);
		bottom: var(--space-4);
		display: grid;
		gap: 0.28rem;
		opacity: 0;
		transform: translateY(0.35rem);
		transition:
			opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
		pointer-events: none;
	}

	.meta strong {
		font-family: var(--font-wordmark);
		font-size: 1.2rem;
		font-style: italic;
		font-weight: 600;
		line-height: 1.05;
	}

	.meta small {
		color: var(--color-muted);
		font-size: 0.86rem;
		line-height: 1.25;
	}

	.explore-card:hover .shade,
	.explore-card:focus-within .shade,
	.explore-card:hover .meta,
	.explore-card:focus-within .meta {
		opacity: 1;
		transform: translateY(0);
	}

	@media (hover: none) {
		.explore-card:not(.active) .meta,
		.explore-card:not(.active) .shade {
			opacity: 0;
		}
	}
</style>
