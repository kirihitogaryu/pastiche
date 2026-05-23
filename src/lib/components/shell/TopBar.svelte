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

	type BreadcrumbItem = {
		id: string;
		label: string;
		path?: string[];
		current?: boolean;
		ellipsis?: boolean;
	};

	let breadcrumbItems = $derived.by(() => {
		const path = appState.folderPath;
		const visible =
			path.length <= 3
				? path
				: [path[0], '...', ...path.slice(Math.max(path.length - 2, 1))];

		return visible.map((label, index): BreadcrumbItem => {
			const ellipsis = label === '...';
			const originalIndex = ellipsis
				? -1
				: path.length <= 3
					? index
					: index === 0
						? 0
						: path.length - (visible.length - index);

			return {
				id: `${label}-${index}`,
				label,
				ellipsis,
				current: !ellipsis && originalIndex === path.length - 1,
				path: ellipsis ? undefined : path.slice(0, originalIndex + 1)
			};
		});
	});

	function setBreadcrumb(path?: string[]) {
		if (!path) return;
		appState.folderPath = path;
	}
</script>

<header class="topbar">
	<a class="wordmark" href="/" aria-label="Pastiche Home">pastiche.</a>
	{#if mode === 'library'}
		<nav class="breadcrumb" aria-label="Library breadcrumb">
			{#each breadcrumbItems as crumb}
				{#if crumb.ellipsis}
					<span aria-hidden="true">...</span>
				{:else}
					<button
						class:current={crumb.current}
						type="button"
						aria-current={crumb.current ? 'page' : undefined}
						onclick={() => setBreadcrumb(crumb.path)}
					>
						{crumb.label}
					</button>
				{/if}
			{/each}
		</nav>
	{:else}
		<div class="mode-pill">{labels[mode]}</div>
	{/if}
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
		gap: var(--space-3);
		min-height: 3.75rem;
		padding: 0.55rem var(--space-5);
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.86);
	}

	.wordmark {
		color: var(--color-text);
		text-decoration: none;
		font-family: var(--font-wordmark);
		font-size: 1.55rem;
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
		padding: 0.58rem 0.85rem;
		font-weight: 600;
		font-size: 0.86rem;
	}

	.breadcrumb {
		max-width: 19rem;
		min-height: 2.55rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		overflow: hidden;
		white-space: nowrap;
	}

	.breadcrumb button,
	.breadcrumb span {
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--color-dim);
		font-size: 0.82rem;
	}

	.breadcrumb button {
		max-width: 7rem;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.breadcrumb button:hover {
		color: var(--color-muted);
	}

	.breadcrumb button.current {
		color: var(--color-accent);
		font-weight: 650;
	}

	.breadcrumb button:not(:last-child)::after,
	.breadcrumb span::after {
		content: "/";
		margin-left: 0.35rem;
		color: var(--color-dim);
		font-weight: 400;
	}

	.search {
		min-width: 16rem;
		max-width: 38rem;
		flex: 1;
		height: 2.55rem;
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
