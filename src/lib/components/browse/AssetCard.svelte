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
		onOpen(asset);
	}
</script>

<article class:active class:selected class="asset-card">
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
			type="button"
			aria-label={asset.favorite ? `${asset.title} is favorited` : `Favorite ${asset.title}`}
			onclick={() => onSelect(asset)}
		>
			{#if selected}
				<CheckCircleIcon size={22} weight="fill" />
			{:else}
				<StarIcon size={20} weight={asset.favorite ? 'fill' : 'regular'} />
			{/if}
		</button>
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
		width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(8% 0.006 70 / 0.72);
		color: var(--color-text);
		cursor: pointer;
	}

	.quick-action.favorite {
		color: var(--color-accent);
	}

	@media (max-width: 759px) {
		.asset-card {
			border-radius: var(--radius-md);
		}

		.image-button {
			min-height: 7rem;
			aspect-ratio: 1 / 1.18;
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
			width: 1.9rem;
			height: 1.9rem;
			border-radius: var(--radius-sm);
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
