<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import SearchBox from '$lib/components/shell/SearchBox.svelte';
	import type { AppMode } from '$lib/types';
	import { openAdd, openFilter, setMode } from '$lib/state/app-state.svelte';

	type Props = {
		mode: AppMode;
	};

	let { mode }: Props = $props();

	const labels: Record<AppMode, string> = {
		home: 'Home',
		library: 'Library',
		explore: 'Explore',
		canvas: 'Canvas',
		colors: 'Colors',
		resources: 'Resources'
	};
</script>

<header class="topbar">
	<button class="wordmark" type="button" aria-label="Pastiche Home" onclick={() => setMode('home')}>
		pastiche.
	</button>
	<div class="mode-pill">{labels[mode]}</div>
	<div class="search-slot">
		<SearchBox
			{mode}
			label={`Search ${labels[mode]}`}
			placeholder="Search artwork, artists, or collections..."
			showShortcut
		/>
	</div>
	<button class="tool" type="button" onclick={openFilter}>
		<FunnelIcon size={20} />
		<span>Filter</span>
	</button>
	<button class="tool" type="button">
		<span>Sort: Newest</span>
	</button>
	<div class="view-toggle" aria-label="View options">
		<button type="button" aria-label="Grid view"><SquaresFourIcon size={20} weight="fill" /></button
		>
		<button type="button" aria-label="List view"><ListBulletsIcon size={20} /></button>
	</div>
	<button class="add" type="button" aria-label="Add to Library" onclick={openAdd}>
		<PlusIcon size={24} />
	</button>
</header>

<style>
	.topbar {
		display: none;
		align-items: center;
		gap: var(--space-3);
		min-height: 3.75rem;
		padding: 0.55rem var(--space-5);
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.86);
	}

	.wordmark {
		border: 0;
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-wordmark);
		font-size: 1.55rem;
		font-style: italic;
		white-space: nowrap;
		cursor: pointer;
	}

	.mode-pill,
	.tool,
	.view-toggle,
	.add {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.mode-pill {
		padding: 0.58rem 0.85rem;
		font-weight: 600;
		font-size: 0.86rem;
	}

	.search-slot {
		min-width: 16rem;
		max-width: 38rem;
		flex: 1;
	}

	.tool:hover,
	.tool:focus-visible,
	.add:hover,
	.add:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.tool,
	.add,
	.view-toggle button {
		height: 2.55rem;
		border: 0;
		color: var(--color-text);
		cursor: pointer;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
	}

	.view-toggle {
		display: inline-flex;
		padding: var(--space-1);
	}

	.view-toggle button,
	.add {
		width: 2.55rem;
		display: grid;
		place-items: center;
		border-radius: var(--radius-md);
		background: transparent;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.view-toggle button:hover,
	.view-toggle button:focus-visible {
		background: var(--color-hover);
	}

	.add {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	@media (min-width: 760px) {
		.topbar {
			display: flex;
		}
	}
</style>
