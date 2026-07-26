<script lang="ts">
	import ImagesSquareIcon from 'phosphor-svelte/lib/ImagesSquareIcon';
	import { getCachedThumbUrl, revokeThumbUrl } from '$lib/explore/client-cache';
	import { getExplorePreviewImageUrl } from '$lib/explore/image-url';
	import type { ExploreItem } from '$lib/explore/types';
	import { isGifMedia } from '$lib/library/media';

	type Props = {
		item: ExploreItem;
		active?: boolean;
		priority?: 'high' | 'low' | 'auto';
		blurSensitive?: boolean;
		onOpen: (item: ExploreItem) => void;
		onPrefetch?: (item: ExploreItem) => void;
	};

	let {
		item,
		active = false,
		priority = 'auto',
		blurSensitive = false,
		onOpen,
		onPrefetch
	}: Props = $props();
	let measuredRatio = $state(1);
	let displayedImage = $state('');
	let revealedSensitive = $state(false);
	let gifPreviewActive = $state(false);
	let cachedBlobUrl: string | null = null;
	let hoverTimer: number | null = null;
	let ratio = $derived(Math.min(1.85, Math.max(0.58, measuredRatio)));
	let sourceImage = $derived(item.thumbUrl ?? item.imageUrl);
	let hasImage = $derived(sourceImage !== null);
	let sensitiveHidden = $derived(blurSensitive && !revealedSensitive);
	let imageCount = $derived(item.additionalImages.length + 1);
	let isGif = $derived(
		isGifMedia(item.mimeType, item.imageUrl, item.thumbUrl, item.title, ...item.additionalImages)
	);
	let gifImageUrl = $derived(isGif ? getExplorePreviewImageUrl(item) : null);

	$effect(() => {
		void item.id;
		void blurSensitive;
		revealedSensitive = false;
		gifPreviewActive = false;
	});

	$effect(() => {
		const itemId = item.id;
		const imageUrl = sourceImage;
		let cancelled = false;
		if (!imageUrl) {
			displayedImage = '';
			return;
		}
		displayedImage = imageUrl;

		void getCachedThumbUrl(itemId, imageUrl, { populate: false }).then((cachedUrl) => {
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
		if (!onPrefetch || sensitiveHidden) return;
		cancelPrefetch();
		hoverTimer = window.setTimeout(() => {
			onPrefetch?.(item);
		}, 200);
	}

	function startInteraction() {
		schedulePrefetch();
		if (
			isGif &&
			gifImageUrl &&
			!sensitiveHidden &&
			!window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			gifPreviewActive = true;
		}
	}

	function stopInteraction() {
		cancelPrefetch();
		gifPreviewActive = false;
	}

	function cancelPrefetch() {
		if (!hoverTimer) return;
		window.clearTimeout(hoverTimer);
		hoverTimer = null;
	}

	function activateCard() {
		if (sensitiveHidden) {
			cancelPrefetch();
			revealedSensitive = true;
			return;
		}
		onOpen(item);
	}

	function sourceLabel(source: ExploreItem['source']) {
		if (source === 'artic') return 'Art Institute';
		if (source === 'wikidata') return 'Wikidata';
		if (source === 'danbooru') return 'Danbooru';
		if (source === 'deviantart') return 'DeviantArt';
		if (source === 'bluesky') return 'Bluesky';
		if (source === 'furaffinity') return 'Fur Affinity';
		return 'The Met';
	}
</script>

<article
	class:active
	class:no-image={!hasImage}
	class:blur-sensitive={sensitiveHidden}
	class="explore-card"
	style={`--asset-ratio: ${ratio}`}
>
	<button
		class="image-button"
		type="button"
		aria-label={sensitiveHidden
			? `Reveal sensitive image ${item.title}`
			: `${isGif ? 'Animated GIF. ' : ''}Inspect ${item.title}`}
		onclick={activateCard}
		onpointerenter={startInteraction}
		onpointerleave={stopInteraction}
		onfocus={startInteraction}
		onblur={stopInteraction}
	>
		{#if hasImage}
			<img
				class:static-hidden={isGif && gifPreviewActive}
				src={displayedImage}
				alt={item.title}
				loading="lazy"
				fetchpriority={priority}
				decoding="async"
				onload={recordNaturalRatio}
			/>
			{#if gifPreviewActive && gifImageUrl}
				<img class="animated-preview" src={gifImageUrl} alt="" aria-hidden="true" />
			{/if}
		{:else}
			<span class="image-placeholder" aria-hidden="true">
				<strong>{item.title}</strong>
				<small>{item.department ?? 'Wikidata metadata record'}</small>
			</span>
		{/if}
		<span class="shade"></span>
		<span class="source">{sourceLabel(item.source)}</span>
		{#if isGif || imageCount > 1}
			<span class="media-flags">
				{#if isGif}
					<span class="gif-badge" aria-hidden="true" title="Animated GIF; hover or focus to preview"
						>GIF</span
					>
				{/if}
				{#if imageCount > 1}
					<span
						class="multiple-images"
						aria-label={`${imageCount} images`}
						title={`${imageCount} images in this post`}
					>
						<ImagesSquareIcon size={16} weight="bold" />
						<span>{imageCount}</span>
					</span>
				{/if}
			</span>
		{/if}
		{#if sensitiveHidden}
			<span class="sensitive-label">Sensitive · select to reveal</span>
		{/if}
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
		transition:
			filter 180ms var(--ease-out),
			transform 180ms var(--ease-out);
	}

	.animated-preview {
		z-index: 1;
	}

	img.static-hidden {
		opacity: 0;
	}

	.blur-sensitive img {
		filter: blur(1.1rem) brightness(0.66);
		transform: scale(1.08);
	}

	.sensitive-label {
		position: absolute;
		z-index: 2;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: oklch(12% 0.008 70 / 0.9);
		color: var(--color-text);
		font-size: 0.72rem;
		font-weight: 650;
		white-space: nowrap;
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
	.media-flags,
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

	.media-flags {
		top: var(--space-3);
		right: var(--space-3);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.gif-badge,
	.multiple-images {
		min-width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0 0.45rem;
		border: 1px solid oklch(82% 0.02 78 / 0.22);
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70 / 0.82);
		color: var(--color-text);
		font-size: 0.7rem;
		font-weight: 650;
		line-height: 1;
		backdrop-filter: blur(0.35rem);
	}

	.gif-badge {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
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
