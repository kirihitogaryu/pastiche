<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import { appState } from '$lib/state/app-state.svelte';
</script>

<header class="mobile-header">
	<div class="brand-row">
		<div class="wordmark">pastiche.</div>
		<div class="actions">
			<button type="button" aria-label="Filter"><FunnelIcon size={23} /></button>
			<button type="button" aria-label="More"><DotsThreeIcon size={25} weight="bold" /></button>
		</div>
	</div>
	<div class="crumbs" aria-label="Current location">
		<FolderIcon size={20} />
		<span>{appState.folderPath.join(' / ')}</span>
	</div>
	<label class="search">
		<MagnifyingGlassIcon size={24} />
		<span class="sr-only">Search current folder</span>
		<input bind:value={appState.query} placeholder="Search artworks, tags, creators, colors..." />
		<SlidersHorizontalIcon size={24} />
	</label>
</header>

<style>
	.mobile-header {
		display: grid;
		gap: var(--space-4);
		padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) var(--space-3);
		border-bottom: 1px solid var(--color-border-soft);
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
		font-size: 2rem;
		font-style: italic;
	}

	.actions {
		gap: var(--space-2);
	}

	button {
		width: 2.85rem;
		height: 2.85rem;
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
		font-size: 0.95rem;
	}

	.search {
		height: 3.5rem;
		gap: var(--space-3);
		padding: 0 var(--space-4);
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
	}

	@media (min-width: 760px) {
		.mobile-header {
			display: none;
		}
	}
</style>
