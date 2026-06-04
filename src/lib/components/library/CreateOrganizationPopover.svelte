<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import type { LibraryResponse } from '$lib/library/types';
	import { appState } from '$lib/state/app-state.svelte';

	type Kind = 'folder' | 'project' | 'tag' | 'tag-group';

	type Props = {
		kind: Kind;
		library: LibraryResponse;
		asset?: { id: string } | null;
		anchor?: { left: number; top: number } | null;
		onClose: () => void;
		onSnapshot: (snapshot: LibraryResponse) => void;
	};

	let { kind, library, asset = null, anchor = null, onClose, onSnapshot }: Props = $props();
	let name = $state('');
	let facet = $state('General');
	let startWithCurrentFolder = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let currentFolder = $derived(
		library.folders.find((folder) => folder.path.join('/') === appState.activeLibraryFolderPath.join('/')) ??
			null
	);
	let title = $derived(
		kind === 'folder'
			? 'New Folder'
			: kind === 'project'
				? 'New Project'
				: kind === 'tag-group'
					? 'New Tag Group'
					: 'New Tag'
	);
	let placeholder = $derived(
		kind === 'folder'
			? 'Character poses'
			: kind === 'project'
				? 'Comic chapter studies'
				: kind === 'tag-group'
					? 'Texture'
					: 'hands'
	);
	let Icon = $derived(kind === 'folder' ? FolderIcon : kind === 'project' ? StackIcon : HashIcon);
	let popoverStyle = $derived(
		anchor
			? `--popover-left: ${anchor.left}px; --popover-top: ${anchor.top}px;`
			: ''
	);

	async function submit() {
		if (saving) return;
		saving = true;
		error = null;
		try {
			const response = await fetch(endpoint(), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload())
			});
			const body = (await response.json()) as { error?: string; snapshot?: LibraryResponse };
			if (!response.ok || !body.snapshot) throw new Error(body.error ?? 'Could not save');
			onSnapshot(body.snapshot);
			onClose();
		} catch (saveError) {
			error = saveError instanceof Error ? saveError.message : 'Could not save';
		} finally {
			saving = false;
		}
	}

	function endpoint() {
		if (kind === 'folder') return '/api/library/folders';
		if (kind === 'project') return '/api/library/projects';
		if (kind === 'tag-group') return '/api/library/tag-groups';
		if (asset) return `/api/library/assets/${encodeURIComponent(asset.id)}/tags`;
		return '/api/library/tags';
	}

	function payload() {
		if (kind === 'folder') {
			return {
				name,
				parent_id: appState.libraryView === 'folder' ? currentFolder?.id ?? null : null
			};
		}
		if (kind === 'project') {
			return {
				name,
				start_folder_id:
					startWithCurrentFolder && appState.libraryView === 'folder' ? currentFolder?.id ?? null : null
			};
		}
		if (kind === 'tag-group') return { name };
		return name.includes(':') ? { label: name } : { facet, value: name };
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
/>

<form class="create-popover" style={popoverStyle} aria-label={title} onsubmit={(event) => { event.preventDefault(); submit(); }}>
	<header>
		<Icon size={18} />
		<strong>{title}</strong>
	</header>
	<label>
		<span>{kind === 'tag' ? 'Tag' : 'Name'}</span>
		<input bind:value={name} placeholder={placeholder} autocomplete="off" />
	</label>
	{#if kind === 'tag' && !name.includes(':')}
		<label>
			<span>Tag Group</span>
			<select bind:value={facet}>
				{#each library.tagFacets as item (item.id)}
					<option value={item.name}>{item.name}</option>
				{/each}
			</select>
		</label>
	{/if}
	{#if kind === 'project' && appState.libraryView === 'folder' && currentFolder}
		<label class="check">
			<input type="checkbox" bind:checked={startWithCurrentFolder} />
			<span>Reference {currentFolder.name}</span>
		</label>
	{/if}
	{#if error}
		<p>{error}</p>
	{/if}
	<footer>
		<button type="button" onclick={onClose}>Cancel</button>
		<button class="primary" type="submit" disabled={saving || !name.trim()}>
			{saving ? 'Saving' : 'Create'}
		</button>
	</footer>
</form>

<style>
	.create-popover {
		position: fixed;
		top: var(--popover-top, calc(var(--topbar-height) + var(--space-3)));
		left: var(--popover-left, calc(100vw - 21rem));
		z-index: calc(var(--z-toast) + 1);
		width: min(20rem, calc(100vw - var(--space-6)));
		max-height: calc(100dvh - var(--topbar-height) - var(--space-6));
		overflow: auto;
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(13% 0.008 70 / 0.98);
		box-shadow: 0 1rem 2.4rem oklch(0% 0 0 / 0.32);
	}

	header,
	footer,
	.check {
		display: flex;
		align-items: center;
	}

	header {
		gap: var(--space-2);
	}

	label {
		display: grid;
		gap: var(--space-1);
	}

	label span {
		color: var(--color-muted);
		font-size: 0.74rem;
		font-weight: 600;
	}

	input,
	select {
		min-height: 2.45rem;
		min-width: 0;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}

	.check {
		grid-template-columns: auto 1fr;
		gap: var(--space-2);
	}

	.check input {
		min-height: auto;
		width: 1rem;
		height: 1rem;
		padding: 0;
	}

	p {
		margin: 0;
		color: #f0a4a8;
		font-size: 0.78rem;
	}

	footer {
		justify-content: end;
		gap: var(--space-2);
	}

	button {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	button.primary {
		border-color: oklch(78% 0.08 78 / 0.45);
		background: oklch(28% 0.025 75);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	@media (max-width: 759px) {
		.create-popover {
			top: max(var(--space-4), env(safe-area-inset-top));
			left: var(--space-3);
			right: var(--space-3);
			width: auto;
			max-height: calc(100dvh - var(--bottom-nav-height) - var(--space-6));
		}
	}
</style>
