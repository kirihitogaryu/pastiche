<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import TrayIcon from 'phosphor-svelte/lib/TrayIcon';
	import type { LibraryFolder } from '$lib/types';

	type Props = {
		folders: LibraryFolder[];
		busy?: boolean;
		onChoose: (folderId: string | null, label: string) => void;
		onCancel: () => void;
	};

	let { folders, busy = false, onChoose, onCancel }: Props = $props();
	let query = $state('');
	let folderById = $derived(new Map(folders.map((folder) => [folder.id, folder])));
	let visibleFolders = $derived(
		folders.filter((folder) => {
			const needle = query.trim().toLowerCase();
			return !needle || folderLabel(folder).toLowerCase().includes(needle);
		})
	);

	function folderLabel(folder: LibraryFolder) {
		const names = [folder.name];
		let parentId = folder.parentId;
		const seen = new Set<string>([folder.id]);
		while (parentId && !seen.has(parentId)) {
			seen.add(parentId);
			const parent = folderById.get(parentId);
			if (!parent) break;
			names.unshift(parent.name);
			parentId = parent.parentId;
		}
		return names.join(' / ');
	}
</script>

<div class="destination-picker" aria-label="Choose a Library folder">
	<label>
		<MagnifyingGlassIcon size={17} />
		<input type="search" placeholder="Search folders" bind:value={query} />
	</label>

	<div class="destinations">
		<button type="button" disabled={busy} onclick={() => onChoose(null, 'Library inbox')}>
			<TrayIcon size={18} />
			<span><strong>Library inbox</strong><small>Organize it later</small></span>
		</button>
		{#each visibleFolders as folder (folder.id)}
			<button
				type="button"
				disabled={busy}
				onclick={() => onChoose(folder.id, folderLabel(folder))}
			>
				<FolderIcon size={18} />
				<span><strong>{folder.name}</strong><small>{folderLabel(folder)}</small></span>
				<small>{folder.assetCount.toLocaleString()}</small>
			</button>
		{/each}
		{#if visibleFolders.length === 0}
			<p>No folders match “{query.trim()}”.</p>
		{/if}
	</div>

	<button class="cancel" type="button" disabled={busy} onclick={onCancel}>Cancel</button>
</div>

<style>
	.destination-picker {
		flex-basis: 100%;
		min-width: 0;
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	label {
		min-height: 2.65rem;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-muted);
		background: var(--color-bg);
	}

	input {
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
	}

	input::placeholder {
		color: var(--color-dim);
	}

	.destinations {
		max-height: min(15rem, 38vh);
		display: grid;
		overflow: auto;
	}

	.destinations button {
		width: 100%;
		min-height: 2.9rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 0;
		border-bottom: 1px solid var(--color-border-soft);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}

	.destinations button:hover,
	.destinations button:focus-visible {
		background: var(--color-hover);
	}

	.destinations span {
		min-width: 0;
		display: grid;
		gap: 0.1rem;
	}

	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-size: 0.84rem;
		font-weight: 600;
	}

	small,
	p {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	.destinations p {
		padding: var(--space-4) var(--space-3);
		text-align: center;
	}

	.cancel {
		justify-self: end;
		min-height: 2.35rem;
		padding: 0 var(--space-3);
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		cursor: pointer;
	}
</style>
