<script lang="ts">
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import type { LibraryFolder } from '$lib/types';

	type Props = {
		folders: LibraryFolder[];
		onOpen: (path: string[]) => void;
		editMode?: boolean;
		onRename?: (folder: LibraryFolder, name: string) => void;
		onDelete?: (folder: LibraryFolder) => void;
	};

	let { folders, onOpen, editMode = false, onRename, onDelete }: Props = $props();
	let editingId = $state<string | null>(null);
	let editingName = $state('');

	function beginRename(folder: LibraryFolder) {
		editingId = folder.id;
		editingName = folder.name;
	}

	function commitRename(folder: LibraryFolder) {
		const name = editingName.trim();
		if (name && name !== folder.name) onRename?.(folder, name);
		editingId = null;
	}
</script>

<div class="folder-cards">
	{#each folders as folder (folder.id)}
		<div class="folder-card">
			{#if editingId === folder.id}
				<div class="folder-open folder-edit">
					<span class="folder-icon"><FolderIcon size={18} /></span>
					<span class="folder-name">
						<input
							bind:value={editingName}
							aria-label={`Rename ${folder.name}`}
							onkeydown={(event) => {
								if (event.key === 'Enter') commitRename(folder);
								if (event.key === 'Escape') editingId = null;
							}}
						/>
						<small>
							{folder.assetCount.toLocaleString()}
							{folder.assetCount === 1 ? 'image' : 'images'}
						</small>
					</span>
				</div>
			{:else}
				<button class="folder-open" type="button" onclick={() => onOpen(folder.path)}>
					<span class="folder-icon"><FolderIcon size={18} /></span>
					<span class="folder-name">
						<strong>{folder.name}</strong>
						<small>
							{folder.assetCount.toLocaleString()}
							{folder.assetCount === 1 ? 'image' : 'images'}
							{#if folder.childFolderCount}
								· {folder.childFolderCount.toLocaleString()}
								{folder.childFolderCount === 1 ? 'folder' : 'folders'}
							{/if}
						</small>
					</span>
					{#if !editMode}<CaretRightIcon size={16} />{/if}
				</button>
			{/if}
			{#if editMode}
				<div class="folder-actions">
					{#if editingId === folder.id}
						<button
							type="button"
							aria-label="Save folder name"
							onclick={() => commitRename(folder)}
						>
							<CheckIcon size={17} />
						</button>
					{:else}
						<button
							type="button"
							aria-label={`Rename ${folder.name}`}
							onclick={() => beginRename(folder)}
						>
							<PencilSimpleIcon size={17} />
						</button>
					{/if}
					<button
						class="danger"
						type="button"
						aria-label={`Delete ${folder.name}`}
						onclick={() => onDelete?.(folder)}
					>
						<TrashIcon size={17} />
					</button>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.folder-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-2);
	}

	.folder-card {
		min-width: 0;
		display: flex;
		align-items: stretch;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		overflow: hidden;
	}

	.folder-open {
		width: 100%;
		min-width: 0;
		min-height: 3.4rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 0;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.folder-open:hover,
	.folder-open:focus-visible {
		background: var(--color-hover);
	}

	.folder-icon {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	.folder-name {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}

	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-size: 0.92rem;
		font-weight: 600;
	}

	small {
		color: var(--color-muted);
		font-size: 0.76rem;
	}

	input {
		width: 100%;
		min-width: 0;
		padding: 0.2rem 0.35rem;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
		font: inherit;
		font-size: 0.88rem;
	}

	.folder-actions {
		display: flex;
		align-items: center;
		padding-right: var(--space-2);
	}

	.folder-actions button {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.folder-actions button:hover,
	.folder-actions button:focus-visible {
		background: var(--color-hover);
		color: var(--color-text);
	}

	.folder-actions button.danger:hover,
	.folder-actions button.danger:focus-visible {
		color: #f0a4a8;
	}

	@media (max-width: 759px) {
		.folder-cards {
			grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		}
	}
</style>
