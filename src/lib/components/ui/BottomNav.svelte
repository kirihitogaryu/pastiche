<script lang="ts">
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import CompassIcon from 'phosphor-svelte/lib/CompassIcon';
	import DatabaseIcon from 'phosphor-svelte/lib/DatabaseIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import ScribbleIcon from 'phosphor-svelte/lib/ScribbleIcon';
	import type { AppMode } from '$lib/types';

	type Props = {
		mode: AppMode;
		onSelect: (mode: AppMode) => void;
		onAdd: () => void;
		secondary?: boolean;
	};

	let { mode, onSelect, onAdd, secondary = false }: Props = $props();
</script>

<nav class:secondary class="bottom-nav" aria-label="Mobile primary">
	<button class:active={mode === 'library'} type="button" onclick={() => onSelect('library')}>
		<BookOpenIcon size={21} weight={mode === 'library' ? 'fill' : 'regular'} />
		<span>Library</span>
	</button>
	<button class:active={mode === 'explore'} type="button" onclick={() => onSelect('explore')}>
		<CompassIcon size={21} weight={mode === 'explore' ? 'fill' : 'regular'} />
		<span>Explore</span>
	</button>
	<button class="add" type="button" aria-label="Add to Library" onclick={onAdd}>
		<PlusIcon size={28} />
	</button>
	<button class:active={mode === 'canvas'} type="button" onclick={() => onSelect('canvas')}>
		<ScribbleIcon size={22} weight={mode === 'canvas' ? 'fill' : 'regular'} />
		<span>Canvas</span>
	</button>
	<button class:active={mode === 'atlas'} type="button" onclick={() => onSelect('atlas')}>
		<DatabaseIcon size={21} weight={mode === 'atlas' ? 'fill' : 'regular'} />
		<span>Atlas</span>
	</button>
</nav>

<style>
	.bottom-nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: var(--z-sticky);
		height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
		padding: 0.4rem var(--space-2) max(0.4rem, env(safe-area-inset-bottom));
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.35rem;
		border-top: 1px solid var(--color-border);
		background: oklch(10% 0.006 70 / 0.92);
		backdrop-filter: blur(18px);
		transition: opacity var(--duration-base) var(--ease-out);
	}

	.bottom-nav.secondary {
		opacity: 0.55;
	}

	button {
		min-width: 0;
		border: 0;
		border-radius: var(--radius-xl);
		background: transparent;
		color: var(--color-muted);
		display: grid;
		place-items: center;
		gap: 0.1rem;
		cursor: pointer;
		font-size: 0.64rem;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	button.active {
		background: var(--color-surface-raised);
		color: var(--color-text);
	}

	button:active {
		transform: translateY(1px);
	}

	button.add {
		width: 3.35rem;
		height: 3.35rem;
		align-self: center;
		justify-self: center;
		border: 1px solid var(--color-border);
		background: var(--color-surface-raised);
		color: var(--color-text);
		border-radius: 50%;
	}

	@media (min-width: 760px) {
		.bottom-nav {
			display: none;
		}
	}
</style>
