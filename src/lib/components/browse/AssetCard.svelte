<script lang="ts">
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import { isGifMedia } from '$lib/library/media';
	import type { LibraryAsset, LibraryAssetRecord } from '$lib/library/types';
	import { replaceLibraryAsset } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type CardAsset = Asset & { record?: LibraryAssetRecord };

	type Props = {
		asset: CardAsset;
		active?: boolean;
		selected?: boolean;
		mode?: 'library' | 'explore';
		editMode?: boolean;
		onOpen: (asset: Asset) => void;
		onSelect: (asset: Asset) => void;
	};

	let {
		asset,
		active = false,
		selected = false,
		mode = 'library',
		editMode = false,
		onOpen,
		onSelect
	}: Props = $props();
	let displayRatio = $derived(Math.min(1.65, Math.max(0.72, asset.width / asset.height)));
	let imageUrl = $derived(asset.record?.image.previewUrl || asset.imageUrl || null);
	let imageFailed = $state(false);
	let actionError = $state<string | null>(null);
	let filename = $derived(asset.record?.filename ?? fallbackFilename(asset.imageUrl));
	let originalImageUrl = $derived(asset.record?.image.originalUrl ?? asset.imageUrl ?? null);
	let isGif = $derived(
		isGifMedia(
			asset.record?.image.mimeType,
			asset.record?.filename,
			asset.title,
			asset.record?.image.sourceImageUrl,
			originalImageUrl
		)
	);
	let gifPreviewActive = $state(false);

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressed = false;

	$effect(() => {
		if (asset.id || imageUrl) {
			imageFailed = false;
			gifPreviewActive = false;
		}
	});

	function startGifPreview() {
		if (
			!isGif ||
			!originalImageUrl ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}
		gifPreviewActive = true;
	}

	function stopGifPreview() {
		gifPreviewActive = false;
	}

	function startPress() {
		if (mode !== 'library') return;
		longPressed = false;
		pressTimer = setTimeout(() => {
			longPressed = true;
			onSelect(asset);
		}, 420);
	}

	function clearPress() {
		if (pressTimer) clearTimeout(pressTimer);
		pressTimer = null;
	}

	function openFromCard() {
		clearPress();
		if (longPressed) return;
		if (editMode && mode === 'library') {
			onSelect(asset);
			return;
		}
		onOpen(asset);
	}

	function activateQuickAction(event: MouseEvent) {
		if (editMode) {
			event.stopPropagation();
			onSelect(asset);
			return;
		}
		void toggleFavorite(event);
	}

	async function toggleFavorite(event: MouseEvent) {
		event.stopPropagation();
		actionError = null;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ favorite: !asset.favorite })
			});
			const body = (await response.json()) as { error?: string; asset?: LibraryAsset };
			if (!response.ok || !body.asset) {
				throw new Error(body.error ?? 'Favorite could not be updated.');
			}
			replaceLibraryAsset(body.asset);
		} catch (favoriteError) {
			actionError =
				favoriteError instanceof Error ? favoriteError.message : 'Favorite could not be updated.';
		}
	}

	function fallbackFilename(value: string) {
		const fallback = `${asset.width} × ${asset.height}`;
		if (!value) return fallback;
		try {
			const part = new URL(value, 'http://localhost').pathname.split('/').pop();
			return part ? decodeURIComponent(part) : fallback;
		} catch {
			return fallback;
		}
	}
</script>

<article
	class:active
	class:selected
	class:explore={mode === 'explore'}
	class:edit-mode={editMode}
	class="asset-card"
	style={`--asset-ratio: ${displayRatio}`}
>
	<button
		class="image-button"
		type="button"
		aria-label={`${isGif ? 'Animated GIF. ' : ''}Inspect ${asset.title}`}
		onclick={openFromCard}
		onpointerdown={startPress}
		onpointerup={clearPress}
		onpointercancel={clearPress}
		onpointerenter={startGifPreview}
		onpointerleave={() => {
			clearPress();
			stopGifPreview();
		}}
		onfocus={startGifPreview}
		onblur={stopGifPreview}
		oncontextmenu={(event) => {
			event.preventDefault();
			onSelect(asset);
		}}
	>
		{#if imageUrl && !imageFailed}
			<img
				class="still-preview"
				class:static-hidden={isGif && gifPreviewActive}
				src={imageUrl}
				alt={asset.title}
				loading="lazy"
				onerror={() => (imageFailed = true)}
			/>
			{#if isGif && gifPreviewActive && originalImageUrl}
				<img
					class="animated-preview"
					src={originalImageUrl}
					alt=""
					aria-hidden="true"
					onerror={stopGifPreview}
				/>
			{/if}
			{#if isGif}
				<span class="media-badge" aria-hidden="true" title="Animated GIF; hover or focus to preview"
					>GIF</span
				>
			{/if}
		{:else}
			<span class="image-missing">Image unavailable</span>
		{/if}
	</button>
	<div class="meta">
		<strong>{asset.title}</strong>
		<small>{filename}</small>
	</div>
	{#if mode === 'explore'}
		<button
			class="quick-action"
			type="button"
			aria-label={`Add ${asset.title} to library`}
			onclick={() => onSelect(asset)}
		>
			<PlusIcon size={20} />
		</button>
	{:else}
		<button
			class="quick-action"
			class:favorite={asset.favorite}
			class:active-selection={selected}
			type="button"
			aria-label={editMode
				? `${selected ? 'Deselect' : 'Select'} ${asset.title}`
				: asset.favorite
					? `Remove ${asset.title} from favorites`
					: `Favorite ${asset.title}`}
			onclick={activateQuickAction}
		>
			{#if selected}
				<CheckCircleIcon size={22} weight="fill" />
			{:else if editMode}
				<CheckCircleIcon size={22} />
			{:else}
				<StarIcon size={20} weight={asset.favorite ? 'fill' : 'regular'} />
			{/if}
		</button>
	{/if}
	{#if actionError}
		<p class="action-error">{actionError}</p>
	{/if}
</article>

<style>
	.asset-card {
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

	.asset-card.active {
		border-color: var(--color-accent);
	}

	.asset-card.selected {
		border-color: var(--color-text);
	}

	.asset-card:hover {
		transform: translateY(-1px);
		border-color: var(--color-border-strong);
	}

	.asset-card:hover .quick-action,
	.asset-card:focus-within .quick-action,
	.quick-action.active-selection {
		opacity: 1;
		pointer-events: auto;
	}

	.image-button {
		position: relative;
		width: 100%;
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
	.image-missing {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	img {
		object-fit: contain;
		background: oklch(7% 0.004 70);
	}

	.animated-preview {
		z-index: 1;
	}

	.still-preview.static-hidden {
		opacity: 0;
	}

	.media-badge {
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

	.image-missing {
		display: grid;
		place-items: center;
		padding: var(--space-4);
		background: var(--color-surface-raised);
		color: var(--color-muted);
		font-size: 0.82rem;
		text-align: center;
	}

	.quick-action {
		position: absolute;
		z-index: 1;
	}

	.meta {
		display: grid;
		gap: 0.18rem;
		padding: 0.65rem 0.75rem 0.75rem;
		border-top: 1px solid var(--color-border-soft);
	}

	.meta strong {
		display: -webkit-box;
		overflow: hidden;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1.2;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}

	.meta small {
		display: -webkit-box;
		overflow: hidden;
		color: var(--color-muted);
		font-size: 0.68rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.quick-action {
		top: var(--space-3);
		right: var(--space-3);
		width: 1.85rem;
		height: 1.85rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70 / 0.72);
		color: var(--color-text);
		cursor: pointer;
		line-height: 0;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.quick-action :global(svg) {
		display: block;
		width: 1rem;
		height: 1rem;
	}

	.quick-action.favorite {
		color: var(--color-accent);
	}

	.asset-card.edit-mode .quick-action {
		opacity: 1;
		pointer-events: auto;
	}

	.action-error {
		position: absolute;
		left: var(--space-2);
		right: var(--space-2);
		bottom: var(--space-2);
		z-index: 2;
		margin: 0;
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: oklch(22% 0.05 25 / 0.96);
		color: var(--color-text);
		font-size: 0.72rem;
	}

	@media (max-width: 759px) {
		.asset-card {
			border-radius: var(--radius-md);
		}

		.image-button {
			min-height: 0;
			aspect-ratio: var(--asset-ratio);
		}

		.quick-action {
			top: var(--space-2);
			right: var(--space-2);
			width: 1.65rem;
			height: 1.65rem;
		}

		.meta {
			gap: 0.15rem;
			padding: 0.55rem 0.6rem 0.65rem;
		}

		.meta strong {
			font-size: 0.82rem;
			line-height: 1;
		}

		.meta small {
			font-size: 0.62rem;
		}
	}

	@media (hover: none) {
		.quick-action {
			width: 2.75rem;
			height: 2.75rem;
			opacity: 1;
			pointer-events: auto;
		}
	}
</style>
