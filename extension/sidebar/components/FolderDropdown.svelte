<script lang="ts">
	import type { RecentFolder } from '../../shared/types';

	type Props = {
		folders: RecentFolder[];
		selected: string | null; // folder id, null = Unassigned
		createName: string; // two-way: the "new folder" input value
		onselect: (id: string | null) => void;
		oncreatenamechange: (name: string) => void;
	};

	let { folders, selected, createName, onselect, oncreatenamechange }: Props = $props();

	let showCreate = $state(false);

	function pickFolder(id: string | null) {
		onselect(id);
		showCreate = false;
	}

	function toggleCreate() {
		showCreate = !showCreate;
		if (!showCreate) oncreatenamechange('');
	}
</script>

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
			{#if folders.length}
				<optgroup label="Recent">
					{#each folders as folder (folder.id)}
						<option value={folder.id}>{folder.name}</option>
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

	.label {
		font-size: 11px;
		color: #8f7765;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.dropdown-wrap {
		flex: 1;
		min-width: 0;
	}

	.select {
		width: 100%;
		background: #28231d;
		border: 1px solid rgb(255 255 255 / 14%);
		border-radius: 5px;
		color: #eee7dc;
		font-size: 12px;
		font-family: inherit;
		padding: 5px 8px;
		cursor: pointer;
		appearance: auto;
	}

	.select option,
	.select optgroup {
		background: #28231d;
		color: #eee7dc;
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
		background: #28231d;
		border: 1px solid #b67aff;
		border-radius: 5px;
		color: #eee7dc;
		font-size: 12px;
		font-family: inherit;
		padding: 5px 8px;
		outline: none;
	}

	.create-input::placeholder {
		color: #6b6258;
	}

	.cancel-btn {
		background: none;
		border: none;
		color: #6b6258;
		font-size: 12px;
		cursor: pointer;
		padding: 4px;
		line-height: 1;
	}

	.cancel-btn:hover {
		color: #aaa196;
	}
</style>
