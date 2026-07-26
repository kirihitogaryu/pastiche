<script lang="ts">
	import BookOpenTextIcon from 'phosphor-svelte/lib/BookOpenTextIcon';
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import SearchBox from '$lib/components/shell/SearchBox.svelte';
	import type { AppMode } from '$lib/types';
	import {
		appState,
		openAdd,
		openAtlasWiki,
		openFilter
	} from '$lib/state/app-state.svelte';

	type Props = {
		mode: AppMode;
	};

	let { mode }: Props = $props();
	const labels: Record<AppMode, string> = {
		home: 'Home',
		library: 'Library',
		explore: 'Explore',
		atlas: 'Atlas',
		canvas: 'Canvas',
		colors: 'Colors',
		resources: 'Resources'
	};
</script>

<header class="topbar">
	<h1>{labels[mode]}</h1>
	{#if mode !== 'library'}
		<div class="search-slot">
			<SearchBox
				{mode}
				label={`Search ${labels[mode]}`}
				placeholder="Search artwork, artists, or collections..."
				showShortcut
			/>
		</div>
	{:else}
		<div class="topbar-spacer"></div>
	{/if}
	{#if mode === 'explore'}
		<button class="tool" type="button" onclick={openFilter}>
			<FunnelIcon size={20} />
			<span>Filter</span>
		</button>
	{/if}
	<button class="add" type="button" aria-label="Add to Library" onclick={openAdd}>
		<PlusIcon size={24} />
	</button>
	{#if mode === 'atlas' && appState.atlasView !== 'wiki'}
		<button class="wiki-tool" type="button" onclick={() => openAtlasWiki()}>
			<BookOpenTextIcon size={18} />
			<span>Atlas Wiki</span>
		</button>
	{/if}
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

	h1 {
		flex: 0 0 auto;
		margin: 0;
		color: var(--color-text);
		font-family: var(--font-heading);
		font-size: 1.75rem;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
	}

	.tool,
	.add {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.search-slot {
		min-width: 16rem;
		max-width: 38rem;
		flex: 1;
	}

	.topbar-spacer {
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
	.wiki-tool {
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

	.wiki-tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		border: 1px solid oklch(78% 0.08 78 / 0.45);
		border-radius: var(--radius-lg);
		background: oklch(78% 0.08 78 / 0.1);
		color: oklch(86% 0.075 78);
		font-size: 0.84rem;
		font-weight: 650;
		white-space: nowrap;
	}

	.wiki-tool:hover,
	.wiki-tool:focus-visible {
		border-color: oklch(82% 0.085 78 / 0.72);
		background: oklch(78% 0.08 78 / 0.16);
		color: oklch(91% 0.06 78);
	}

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
