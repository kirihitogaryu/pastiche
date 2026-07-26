<script lang="ts">
	import type { DestinationFolder } from '../../shared/types';

	type Props = {
		folders: DestinationFolder[];
		selected: string | null; // folder id, null = Unassigned
		createName: string; // two-way: the "new folder" input value
		onselect: (id: string | null) => void;
		oncreatenamechange: (name: string) => void;
	};

	let { folders, selected, createName, onselect, oncreatenamechange }: Props = $props();

	let showCreate = $state(false);
	let query = $state('');
	let visibleFolders = $derived(filteredFolders(folders, query, selected));

	function filteredFolders(
		allFolders: DestinationFolder[],
		value: string,
		selectedId: string | null
	) {
		const clean = value.trim().toLowerCase();
		if (!clean) return allFolders;
		const matches = allFolders.filter((folder) =>
			`${folder.name} ${folder.path}`.toLowerCase().includes(clean)
		);
		const selectedFolder = selectedId
			? allFolders.find((folder) => folder.id === selectedId)
			: undefined;
		return selectedFolder && !matches.some((folder) => folder.id === selectedFolder.id)
			? [selectedFolder, ...matches]
			: matches;
	}

	function pickFolder(id: string | null) {
		onselect(id);
		showCreate = false;
	}

	function toggleCreate() {
		showCreate = !showCreate;
		if (!showCreate) oncreatenamechange('');
	}

	function folderLabel(folder: DestinationFolder) {
		const path = folder.path
			.split('/')
			.slice(1, -1)
			.map((part) => part.replace(/-/g, ' '));
		return path.length ? `${path.join(' / ')} / ${folder.name}` : folder.name;
	}
</script>

<div class="folder-search">
	<input type="search" placeholder="Find a folder…" bind:value={query} aria-label="Find a folder" />
</div>

<div class="folder-row">
	<span class="label">Import to</span>

	<div class="dropdown-wrap">
		<!-- Native <select> for simplicity and accessibility. -->
		<select
			class="select"
			value={selected === null ? '__unassigned__' : selected}
			onchange={(e) => {
				const val = (e.currentTarget as HTMLSelectElement).value;
				if (val === '__unassigned__') {
					pickFolder(null);
					return;
				}
				if (val === '__create__') {
					toggleCreate();
					return;
				}
				pickFolder(val);
			}}
		>
			<option value="__unassigned__">Unassigned</option>
			{#if visibleFolders.length}
				<optgroup label={query.trim() ? 'Matches' : 'Folders'}>
					{#each visibleFolders as folder (folder.id)}
						<option value={folder.id}>{folderLabel(folder)}</option>
					{/each}
				</optgroup>
			{/if}
			<option value="__create__">+ Create new folder…</option>
		</select>
	</div>
</div>

{#if showCreate}
	<div class="create-row">
		<input
			class="create-input"
			type="text"
			placeholder="New folder name"
			value={createName}
			oninput={(e) => oncreatenamechange((e.currentTarget as HTMLInputElement).value)}
			onkeydown={(e) => {
				if (e.key === 'Enter') showCreate = false;
			}}
		/>
		<button class="cancel-btn" type="button" onclick={toggleCreate} aria-label="Cancel">✕</button>
	</div>
{/if}

<style>
	.folder-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		flex-shrink: 0;
	}

	.folder-search {
		padding: 0 12px;
	}

	.folder-search input {
		width: 100%;
		min-height: 2rem;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		font-size: 12px;
		padding: 0 8px;
	}

	.folder-search input::placeholder {
		color: var(--ext-dim);
	}

	.label {
		font-size: 11px;
		color: var(--ext-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.dropdown-wrap {
		flex: 1;
		min-width: 0;
	}

	.select {
		width: 100%;
		background: var(--ext-control);
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		color: var(--ext-text);
		font-size: 12px;
		font-family: inherit;
		padding: 5px 8px;
		cursor: pointer;
		appearance: auto;
		color-scheme: dark;
	}

	.select option,
	.select optgroup {
		background: var(--ext-control);
		color: var(--ext-text);
	}

	.create-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 12px;
		flex-shrink: 0;
	}

	.create-input {
		flex: 1;
		min-width: 0;
		background: var(--ext-control);
		border: 1px solid var(--ext-accent);
		border-radius: var(--ext-radius-sm);
		color: var(--ext-text);
		font-size: 12px;
		font-family: inherit;
		padding: 5px 8px;
		outline: none;
	}

	.create-input::placeholder {
		color: var(--ext-dim);
	}

	.cancel-btn {
		background: none;
		border: none;
		color: var(--ext-dim);
		font-size: 12px;
		cursor: pointer;
		padding: 4px;
		line-height: 1;
	}

	.cancel-btn:hover {
		color: var(--ext-muted);
	}
</style>
