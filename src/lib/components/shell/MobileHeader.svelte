<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import type { AppMode } from '$lib/types';
	import { appState } from '$lib/state/app-state.svelte';

	type Props = {
		mode: AppMode;
		compact?: boolean;
	};

	let { mode, compact = false }: Props = $props();

	let visible = $derived(mode === 'library' || mode === 'explore');
	let showBreadcrumb = $derived(mode === 'library');
	let searchLabel = $derived(mode === 'explore' ? 'Search sources' : 'Search current folder');
	let searchPlaceholder = $derived(
		mode === 'explore'
			? 'Search artworks, collections, artists...'
			: 'Search artworks, tags, creators, colors...'
	);
</script>

{#if visible}
	<header class:compact class="mobile-header">
		<div class="brand-row">
			<div class="wordmark">pastiche.</div>
			<div class="actions">
				<button type="button" aria-label="Filter"><FunnelIcon size={19} /></button>
				<button type="button" aria-label="More"><DotsThreeIcon size={21} weight="bold" /></button>
			</div>
		</div>
		{#if showBreadcrumb}
			<div class="crumbs" aria-label="Current location">
				<FolderIcon size={16} />
				<span>{appState.folderPath.join(' / ')}</span>
			</div>
		{/if}
		<label class="search">
			<MagnifyingGlassIcon size={19} />
			<span class="sr-only">{searchLabel}</span>
			<input bind:value={appState.query} placeholder={searchPlaceholder} />
			<SlidersHorizontalIcon size={19} />
		</label>
	</header>
{/if}

<style>
	.mobile-header {
		display: grid;
		gap: var(--space-2);
		padding: max(var(--space-3), env(safe-area-inset-top)) var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--color-border-soft);
		transition:
			padding var(--duration-base) var(--ease-out),
			gap var(--duration-base) var(--ease-out);
	}

	.brand-row,
	.crumbs,
	.search,
	.actions {
		display: flex;
		align-items: center;
	}

	.brand-row {
		justify-content: space-between;
	}

	.wordmark {
		font-family: var(--font-wordmark);
		font-size: 1.6rem;
		font-style: italic;
		line-height: 1;
	}

	.actions {
		gap: var(--space-2);
	}

	button {
		width: 2.35rem;
		height: 2.35rem;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-text);
		display: grid;
		place-items: center;
	}

	.crumbs {
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.78rem;
		line-height: 1.2;
		overflow: hidden;
		white-space: nowrap;
	}

	.crumbs span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search {
		height: 2.75rem;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.84rem;
	}

	.mobile-header.compact {
		gap: 0;
		padding: max(0.45rem, env(safe-area-inset-top)) var(--space-3) 0.45rem;
	}

	.mobile-header.compact .brand-row,
	.mobile-header.compact .crumbs {
		display: none;
	}

	.mobile-header.compact .search {
		height: 2.45rem;
	}

	@media (min-width: 760px) {
		.mobile-header {
			display: none;
		}
	}
</style>
