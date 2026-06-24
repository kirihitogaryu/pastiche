<script lang="ts">
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import CreateOrganizationPopover from '$lib/components/library/CreateOrganizationPopover.svelte';
	import MoveAssetPopover from '$lib/components/library/MoveAssetPopover.svelte';
	import type { LibraryAssetRecord } from '$lib/library/types';
	import type { LibraryResponse } from '$lib/library/types';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type CardAsset = Asset & { record?: LibraryAssetRecord };

	type Props = {
		asset: CardAsset;
		active?: boolean;
		selected?: boolean;
		mode?: 'library' | 'explore';
		projectCover?: boolean;
		onOpen: (asset: Asset) => void;
		onSelect: (asset: Asset) => void;
		onSetProjectCover?: (asset: Asset) => void;
	};

	let {
		asset,
		active = false,
		selected = false,
		mode = 'library',
		projectCover = false,
		onOpen,
		onSelect,
		onSetProjectCover
	}: Props = $props();
	let displayRatio = $derived(Math.min(1.65, Math.max(0.72, asset.width / asset.height)));
	let imageUrl = $derived(asset.record?.image.previewUrl || asset.imageUrl || null);
	let menuOpen = $state(false);
	let tagPopoverOpen = $state(false);
	let movePopoverOpen = $state(false);
	let actionAnchor = $state<{ left: number; top: number } | null>(null);
	let imageFailed = $state(false);
	let actionError = $state<string | null>(null);

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressed = false;

	$effect(() => {
		if (asset.id || imageUrl) imageFailed = false;
	});

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
		menuOpen = false;
		onOpen(asset);
	}

	function toggleMenu(event: MouseEvent) {
		event.stopPropagation();
		actionAnchor = anchorFrom(event.currentTarget);
		menuOpen = !menuOpen;
		tagPopoverOpen = false;
		movePopoverOpen = false;
	}

	function chooseMenuAction(event: MouseEvent) {
		event.stopPropagation();
		menuOpen = false;
		onSelect(asset);
	}

	async function toggleFavorite(event: MouseEvent) {
		event.stopPropagation();
		menuOpen = false;
		actionError = null;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ favorite: !asset.favorite })
			});
			const body = (await response.json()) as { error?: string; snapshot?: LibraryResponse };
			if (!response.ok || !body.snapshot) {
				throw new Error(body.error ?? 'Favorite could not be updated.');
			}
			setLibrarySnapshot(body.snapshot);
		} catch (favoriteError) {
			actionError =
				favoriteError instanceof Error ? favoriteError.message : 'Favorite could not be updated.';
		}
	}

	function openTagPopover(event: MouseEvent) {
		event.stopPropagation();
		actionAnchor = anchorFrom(event.currentTarget);
		menuOpen = false;
		tagPopoverOpen = true;
		movePopoverOpen = false;
	}

	function openMovePopover(event: MouseEvent) {
		event.stopPropagation();
		actionAnchor = anchorFrom(event.currentTarget);
		menuOpen = false;
		movePopoverOpen = true;
		tagPopoverOpen = false;
	}

	function setProjectCover(event: MouseEvent) {
		event.stopPropagation();
		menuOpen = false;
		onSetProjectCover?.(asset);
	}

	function anchorFrom(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return null;
		const rect = target.getBoundingClientRect();
		const width = 320;
		return {
			left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
			top: rect.bottom + 8
		};
	}
</script>

<article
	class:active
	class:selected
	class:project-cover={projectCover}
	class:explore={mode === 'explore'}
	class="asset-card"
	style={`--asset-ratio: ${displayRatio}`}
>
	<button
		class="image-button"
		type="button"
		aria-label={`Inspect ${asset.title}`}
		onclick={openFromCard}
		onpointerdown={startPress}
		onpointerup={clearPress}
		onpointercancel={clearPress}
		onpointerleave={clearPress}
		oncontextmenu={(event) => {
			event.preventDefault();
			onSelect(asset);
		}}
	>
		{#if imageUrl && !imageFailed}
			<img src={imageUrl} alt={asset.title} loading="lazy" onerror={() => (imageFailed = true)} />
		{:else}
			<span class="image-missing">Image unavailable</span>
		{/if}
		<span class="shade"></span>
		<span class="meta">
			<strong>{asset.title}</strong>
			<small>{asset.creator} · {asset.year}</small>
		</span>
	</button>
	{#if mode === 'explore'}
		<button class="quick-action" type="button" aria-label={`Add ${asset.title} to library`} onclick={() => onSelect(asset)}>
			<PlusIcon size={20} />
		</button>
	{:else}
		<button
			class="quick-action"
			class:favorite={asset.favorite}
			class:active-selection={selected}
			type="button"
			aria-label={`${asset.title} actions`}
			aria-expanded={menuOpen}
			onclick={toggleMenu}
		>
			{#if selected}
				<CheckCircleIcon size={22} weight="fill" />
			{:else if projectCover}
				<ImageSquareIcon size={20} weight="fill" />
			{:else}
				<StarIcon size={20} weight={asset.favorite ? 'fill' : 'regular'} />
			{/if}
		</button>
	{/if}
	{#if menuOpen && mode === 'library'}
		<div class="card-menu" role="menu" aria-label={`${asset.title} actions`}>
			{#if onSetProjectCover}
				<button type="button" role="menuitem" onclick={setProjectCover}>
					{projectCover ? 'Project Cover' : 'Set Project Cover'}
				</button>
			{/if}
			<button type="button" role="menuitem" onclick={toggleFavorite}>
				{asset.favorite ? 'Remove favorite' : 'Favorite'}
			</button>
			<button type="button" role="menuitem" onclick={chooseMenuAction}>Add to Canvas</button>
			<button type="button" role="menuitem" onclick={openTagPopover}>Tag</button>
			<button type="button" role="menuitem" onclick={openMovePopover}>Move</button>
		</div>
	{/if}
	{#if actionError}
		<p class="action-error">{actionError}</p>
	{/if}
	{#if tagPopoverOpen && mode === 'library'}
		<CreateOrganizationPopover
			kind="tag"
			library={libraryState.snapshot}
			{asset}
			anchor={actionAnchor}
			onClose={() => (tagPopoverOpen = false)}
			onSnapshot={setLibrarySnapshot}
		/>
	{/if}
	{#if movePopoverOpen && mode === 'library'}
		<MoveAssetPopover
			{asset}
			library={libraryState.snapshot}
			anchor={actionAnchor}
			onClose={() => (movePopoverOpen = false)}
		/>
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

	.asset-card.project-cover {
		border-color: var(--color-accent);
	}

	.asset-card:hover {
		transform: translateY(-1px);
		border-color: var(--color-border-strong);
	}

	.asset-card:hover .quick-action,
	.asset-card:focus-within .quick-action,
	.quick-action[aria-expanded='true'],
	.quick-action.active-selection {
		opacity: 1;
		pointer-events: auto;
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
	.shade,
	.image-missing {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	img {
		object-fit: cover;
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

	.shade {
		background: linear-gradient(to top, oklch(0% 0 0 / 0.76), transparent 58%);
		opacity: 0;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.meta,
	.quick-action {
		position: absolute;
		z-index: 1;
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
		display: -webkit-box;
		overflow: hidden;
		font-family: var(--font-wordmark);
		font-size: 1.2rem;
		font-style: italic;
		font-weight: 600;
		line-height: 1.05;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.meta small {
		display: -webkit-box;
		overflow: hidden;
		color: var(--color-muted);
		font-size: 0.86rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.asset-card:hover .shade,
	.asset-card:focus-within .shade,
	.asset-card:hover .meta,
	.asset-card:focus-within .meta {
		opacity: 1;
		transform: translateY(0);
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

	.asset-card.project-cover .quick-action {
		color: var(--color-accent);
		opacity: 1;
		pointer-events: auto;
	}

	.card-menu {
		position: absolute;
		top: calc(var(--space-3) + 2.1rem);
		right: var(--space-3);
		z-index: 3;
		width: min(10.5rem, calc(100% - var(--space-6)));
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(13% 0.008 70 / 0.96);
		box-shadow: 0 1rem 2.4rem oklch(0% 0 0 / 0.28);
		animation: menu-in var(--duration-fast) var(--ease-out);
	}

	.card-menu button {
		width: 100%;
		min-height: 2.1rem;
		padding: 0 var(--space-3);
		border: 0;
		border-bottom: 1px solid var(--color-border-soft);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		font-size: 0.76rem;
		text-align: left;
	}

	.card-menu button:last-child {
		border-bottom: 0;
	}

	.card-menu button:hover,
	.card-menu button:focus-visible {
		background: var(--color-hover);
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

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-0.3rem);
		}
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

		.card-menu {
			top: calc(var(--space-2) + 1.9rem);
			right: var(--space-2);
		}

		.meta {
			left: var(--space-2);
			right: var(--space-2);
			bottom: var(--space-2);
			gap: 0.15rem;
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
		.asset-card:not(.active) .meta,
		.asset-card:not(.active) .shade {
			opacity: 0;
			transform: translateY(0.35rem);
		}
	}
</style>
