<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
	import SearchBox from '$lib/components/shell/SearchBox.svelte';
	import type { AppMode } from '$lib/types';
	import { appState, openFilter, setMode } from '$lib/state/app-state.svelte';

	type Props = {
		mode: AppMode;
		compact?: boolean;
	};

	let { mode, compact = false }: Props = $props();
	const labels: Record<AppMode, string> = {
		home: 'Home',
		library: 'Library',
		explore: 'Explore',
		atlas: 'Atlas',
		canvas: 'Canvas',
		colors: 'Colors',
		resources: 'Resources'
	};
	let visible = $derived(mode === 'library' || mode === 'explore');
	let websiteSearchActive = $derived(
		appState.exploreSourceId === 'danbooru' ||
			appState.exploreSourceId === 'deviantart' ||
			appState.exploreSourceId === 'bluesky' ||
			appState.exploreSourceId === 'furaffinity'
	);
	let showSearch = $derived(mode === 'explore' && !websiteSearchActive);
	let showBreadcrumb = $derived(false);
	let searchLabel = $derived('Search sources');
	let searchPlaceholder = $derived('Search artworks, collections, artists...');
	let showFilter = $derived(mode === 'explore' && !websiteSearchActive);
</script>

{#if visible}
	<header class:compact={mode === 'explore' && compact} class="mobile-header">
		<div class="brand-row">
			<div class="brand-cluster">
				<button class="home-button" type="button" aria-label="Home" onclick={() => setMode('home')}>
					<HouseIcon size={17} />
				</button>
				<h1>{labels[mode]}</h1>
			</div>
			{#if showFilter}
				<div class="actions">
					<button type="button" aria-label="Filter" onclick={openFilter}
						><FunnelIcon size={19} /></button
					>
				</div>
			{/if}
		</div>
		{#if showBreadcrumb}
			<div class="crumbs" aria-label="Current location">
				<span>{appState.folderPath.join(' / ')}</span>
			</div>
		{/if}
		{#if showSearch}
			<div class="search-row">
				<button
					class="home-button compact-home"
					type="button"
					aria-label="Home"
					onclick={() => setMode('home')}
				>
					<HouseIcon size={17} />
				</button>
				<SearchBox {mode} label={searchLabel} placeholder={searchPlaceholder} />
			</div>
		{/if}
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
			border-color var(--duration-fast) var(--ease-out);
	}

	.brand-row,
	.brand-cluster,
	.crumbs,
	.search-row,
	.actions {
		display: flex;
		align-items: center;
	}

	.brand-row {
		justify-content: space-between;
	}

	.brand-cluster {
		min-width: 0;
		gap: var(--space-2);
	}

	h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.55rem;
		font-weight: 600;
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
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.home-button {
		width: 2rem;
		height: 2rem;
		background: transparent;
		color: var(--color-muted);
	}

	.home-button:focus-visible,
	.home-button:hover {
		color: var(--color-text);
		border-color: var(--color-border-strong);
	}

	.compact-home {
		display: none;
		flex: 0 0 auto;
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

	.search-row :global(.search-wrap) {
		flex: 1;
	}

	.search-row :global(.search) {
		height: 2.75rem;
		border-radius: var(--radius-xl);
		padding-inline: var(--space-3);
		gap: var(--space-2);
	}

	.mobile-header.compact {
		gap: 0;
		padding: max(0.55rem, env(safe-area-inset-top)) var(--space-3) 0.55rem;
	}

	.mobile-header.compact .brand-row,
	.mobile-header.compact .crumbs {
		display: none;
	}

	.mobile-header.compact .compact-home {
		display: grid;
	}

	.mobile-header.compact :global(.search) {
		height: 2.55rem;
	}

	@media (min-width: 760px) {
		.mobile-header {
			display: none;
		}
	}
</style>
