<script lang="ts">
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import { appState, openFilter } from '$lib/state/app-state.svelte';

	type Props = {
		placeholder?: string;
		label?: string;
	};

	let {
		placeholder = 'Search images, projects, folders, tags...',
		label = 'Search library'
	}: Props = $props();
</script>

<label class="library-search">
	<MagnifyingGlassIcon size={20} />
	<span class="sr-only">{label}</span>
	<input bind:value={appState.query} {placeholder} />
	<button type="button" aria-label="Open filters" onclick={openFilter}>
		<SlidersHorizontalIcon size={19} />
	</button>
</label>

<style>
	.library-search {
		min-height: 3.05rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-muted);
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.library-search:focus-within {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.92rem;
	}

	button {
		width: 2.2rem;
		height: 2.2rem;
		border: 0;
		border-radius: var(--radius-md);
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
	button:focus-visible {
		background: var(--color-hover);
		color: var(--color-text);
	}
</style>
