<script lang="ts">
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		active?: boolean;
		selected?: boolean;
		mode?: 'library' | 'explore';
		onOpen: (asset: Asset) => void;
		onSelect: (asset: Asset) => void;
	};

	let { asset, active = false, selected = false, mode = 'library', onOpen, onSelect }: Props = $props();
	let displayRatio = $derived(Math.min(1.65, Math.max(0.72, asset.width / asset.height)));
	let menuOpen = $state(false);

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressed = false;

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
		menuOpen = !menuOpen;
	}

	function chooseMenuAction(event: MouseEvent) {
		event.stopPropagation();
		menuOpen = false;
		onSelect(asset);
	}
</script>

<article
	class:active
	class:selected
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
		<img src={asset.imageUrl} alt={asset.title} loading="lazy" />
		<span class="shade"></span>
		<span class="tag">{asset.tags[0]}</span>
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
			{:else}
				<StarIcon size={20} weight={asset.favorite ? 'fill' : 'regular'} />
			{/if}
		</button>
	{/if}
	{#if menuOpen && mode === 'library'}
		<div class="card-menu" role="menu" aria-label={`${asset.title} actions`}>
			<button type="button" role="menuitem" onclick={chooseMenuAction}>
				{asset.favorite ? 'Remove favorite' : 'Favorite'}
			</button>
			<button type="button" role="menuitem" onclick={chooseMenuAction}>Add to Canvas</button>
			<button type="button" role="menuitem" onclick={chooseMenuAction}>Tag</button>
			<button type="button" role="menuitem" onclick={chooseMenuAction}>Move</button>
		</div>
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
	.quick-action[aria-expanded='true'],
	.quick-action.active-selection {
		opacity: 1;
		pointer-events: auto;
	}

	.image-button {
		width: 100%;
		height: 100%;
		min-height: 12rem;
		aspect-ratio: 1 / 1.12;
		display: block;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
	}

	img,
	.shade {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	img {
		object-fit: cover;
	}

	.shade {
		background: linear-gradient(to top, oklch(0% 0 0 / 0.72), transparent 52%);
	}

	.tag,
	.meta,
	.quick-action {
		position: absolute;
		z-index: 1;
	}

	.tag {
		top: var(--space-3);
		left: var(--space-3);
		max-width: calc(100% - 5.5rem);
		padding: 0.35rem 0.55rem;
		border-radius: var(--radius-sm);
		background: oklch(8% 0.006 70 / 0.78);
		color: var(--color-text);
		font-size: 0.78rem;
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		left: var(--space-4);
		right: var(--space-4);
		bottom: var(--space-4);
		display: grid;
		gap: 0.28rem;
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

		.tag {
			top: var(--space-2);
			left: var(--space-2);
			max-width: calc(100% - 3.8rem);
			padding: 0.24rem 0.42rem;
			font-size: 0.62rem;
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
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.meta small {
			font-size: 0.62rem;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
