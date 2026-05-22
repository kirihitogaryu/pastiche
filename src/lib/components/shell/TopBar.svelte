<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import type { AppMode } from '$lib/types';
	import { appState, openAdd } from '$lib/state/app-state.svelte';

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
	<a class="wordmark" href="/" aria-label="Pastiche Home">pastiche.</a>
	<div class="mode-pill">{labels[mode]}</div>
	<label class="search">
		<span class="sr-only">Search {labels[mode]}</span>
		<MagnifyingGlassIcon size={20} />
		<input bind:value={appState.query} placeholder="Search artwork, artists, or collections..." />
		<kbd>⌘K</kbd>
	</label>
	<button class="tool" type="button">
		<FunnelIcon size={20} />
		<span>Filter</span>
	</button>
	<button class="tool" type="button">
		<span>Sort: Newest</span>
	</button>
	<div class="view-toggle" aria-label="View options">
		<button type="button" aria-label="Grid view"><SquaresFourIcon size={20} weight="fill" /></button>
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
		gap: var(--space-4);
		min-height: var(--topbar-height);
		padding: var(--space-4) var(--space-5);
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.86);
	}

	.wordmark {
		color: var(--color-text);
		text-decoration: none;
		font-family: var(--font-wordmark);
		font-size: 1.75rem;
		font-style: italic;
		white-space: nowrap;
	}

	.mode-pill,
	.tool,
	.view-toggle,
	.add,
	.search {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
	}

	.mode-pill {
		padding: 0.7rem 1rem;
		font-weight: 600;
	}

	.search {
		min-width: 16rem;
		max-width: 38rem;
		flex: 1;
		height: 3rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--color-text);
		outline: none;
	}

	kbd {
		color: var(--color-dim);
		font-size: 0.8rem;
	}

	.tool,
	.add,
	.view-toggle button {
		height: 3rem;
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
		width: 3rem;
		display: grid;
		place-items: center;
		border-radius: var(--radius-md);
		background: transparent;
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
