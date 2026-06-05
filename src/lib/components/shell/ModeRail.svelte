<script lang="ts">
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import CompassIcon from 'phosphor-svelte/lib/CompassIcon';
	import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import ScribbleIcon from 'phosphor-svelte/lib/ScribbleIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import type { AppMode } from '$lib/types';
	import { appModes } from '$lib/data/mock-navigation';

	type Props = {
		mode: AppMode;
		onSelect: (mode: AppMode) => void;
	};

	let { mode, onSelect }: Props = $props();

	const icons = {
		home: HouseIcon,
		library: BookOpenIcon,
		explore: CompassIcon,
		canvas: ScribbleIcon,
		colors: PaletteIcon,
		resources: FolderIcon
	};
</script>

<nav class="rail" aria-label="Primary">
	<div class="rail-main">
		{#each appModes as item}
			{@const Icon = icons[item.id]}
			<button
				class:active={mode === item.id}
				type="button"
				aria-label={item.label}
				title={item.label}
				onclick={() => onSelect(item.id)}
			>
				<Icon size={24} weight={mode === item.id ? 'fill' : 'regular'} />
			</button>
		{/each}
	</div>
</nav>

<style>
	.rail {
		display: none;
		width: var(--rail-width);
		height: 100vh;
		border-right: 1px solid var(--color-border);
		background: oklch(11% 0.008 70 / 0.96);
		padding: var(--space-4) var(--space-3);
		flex-direction: column;
		justify-content: space-between;
	}

	button {
		width: 3rem;
		height: 3rem;
		border: 1px solid transparent;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-muted);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button.active {
		background: var(--color-surface-raised);
		color: var(--color-text);
	}

	.rail-main {
		display: grid;
		gap: var(--space-3);
	}

	@media (min-width: 760px) {
		.rail {
			display: flex;
		}
	}
</style>
