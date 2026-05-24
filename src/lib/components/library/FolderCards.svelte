<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import type { LibraryFolder } from '$lib/types';

	type Props = {
		folders: LibraryFolder[];
		onOpen: (path: string[]) => void;
	};

	let { folders, onOpen }: Props = $props();
</script>

<div class="folder-cards">
	{#each folders as folder (folder.id)}
		<button type="button" onclick={() => onOpen(folder.path)}>
			<FolderIcon size={20} />
			<span>{folder.name}</span>
			<small>{folder.assetCount.toLocaleString()}</small>
		</button>
	{/each}
</div>

<style>
	.folder-cards {
		display: flex;
		gap: var(--space-3);
		overflow-x: auto;
		scrollbar-width: none;
		padding-bottom: 1px;
	}

	.folder-cards::-webkit-scrollbar {
		display: none;
	}

	button {
		flex: 0 0 9.75rem;
		min-height: 4.6rem;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.2rem var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		transform: translateY(-1px);
	}

	small {
		grid-column: 2;
		color: var(--color-muted);
	}
</style>
