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
			<button type="button" aria-label="Filter"><FunnelIcon size={19} /></button>
			<button type="button" aria-label="More"><DotsThreeIcon size={21} weight="bold" /></button>
		</div>
	</div>
	<div class="crumbs" aria-label="Current location">
		<FolderIcon size={16} />
		<span>{appState.folderPath.join(' / ')}</span>
	</div>
	<label class="search">
		<MagnifyingGlassIcon size={19} />
		<span class="sr-only">Search current folder</span>
		<input bind:value={appState.query} placeholder="Search artworks, tags, creators, colors..." />
		<SlidersHorizontalIcon size={19} />
	</label>
</header>

<style>
	.mobile-header {
		display: grid;
		gap: var(--space-2);
		padding: max(var(--space-3), env(safe-area-inset-top)) var(--space-3) var(--space-2);
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

	@media (min-width: 760px) {
		.mobile-header {
			display: none;
		}
	}
</style>
