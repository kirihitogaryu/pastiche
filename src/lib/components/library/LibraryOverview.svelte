<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import type { LibraryResponse } from '$lib/library/types';
	import { openLibraryFolder, openSmartFolder } from '$lib/state/app-state.svelte';
	import { setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import CreateOrganizationPopover from './CreateOrganizationPopover.svelte';
	import FolderTree from './FolderTree.svelte';
	import LibrarySearch from './LibrarySearch.svelte';
	import SmartFolderList from './SmartFolderList.svelte';
	import { buildFolderTree, buildSmartFolderItems } from './libraryOverviewModel';

	type CreateKind = 'folder';

	type Props = {
		library: LibraryResponse;
		loading?: boolean;
		error?: string | null;
	};

	let { library, loading = false, error = null }: Props = $props();
	let createOpen = $state<CreateKind | null>(null);
	let createAnchor = $state<{ left: number; top: number } | null>(null);
	let expandedFolders = $state(new Set<string>(loadExpanded('pastiche.library.expandedFolders')));
	let folderTree = $derived(buildFolderTree(library.folders));
	let smartFolders = $derived(buildSmartFolderItems(library.assets));

	function openCreate(kind: CreateKind, event: MouseEvent) {
		if (createOpen === kind) {
			createOpen = null;
			createAnchor = null;
			return;
		}
		createOpen = kind;
		createAnchor = anchorFrom(event.currentTarget);
	}

	function anchorFrom(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return null;
		const rect = target.getBoundingClientRect();
		const width = 320;
		return {
			left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
			top: rect.bottom + 8
		};
	}

	function toggleFolder(id: string) {
		const next = new Set(expandedFolders);
		next.has(id) ? next.delete(id) : next.add(id);
		expandedFolders = next;
		saveExpanded('pastiche.library.expandedFolders', next);
	}

	function loadExpanded(key: string) {
		if (typeof sessionStorage === 'undefined') return [];
		try {
			return JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[];
		} catch {
			return [];
		}
	}

	function saveExpanded(key: string, values: Set<string>) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.setItem(key, JSON.stringify([...values]));
	}
</script>

<section class="library-overview" aria-labelledby="library-overview-title">
	<header class="library-toolbar">
		<div class="page-title">
			<h1 id="library-overview-title">Library</h1>
			<span class="library-counts">
				{library.stats.assets.toLocaleString()} images · {library.stats.folders} folders
			</span>
		</div>
		<button class="create-folder" type="button" onclick={(event) => openCreate('folder', event)}>
			<FolderPlusIcon size={18} />
			<span>New folder</span>
		</button>
	</header>

	{#if error}
		<p class="status-message">{error}</p>
	{:else if loading}
		<p class="status-message">Loading library...</p>
	{/if}

	<LibrarySearch {library} onOpenFolder={(path) => openLibraryFolder(path)} />

	<section class="overview-section" aria-label="Folders">
		{#if folderTree.length}
			<nav aria-label="Top-level folders">
				<FolderTree
					nodes={folderTree}
					expanded={expandedFolders}
					onToggle={toggleFolder}
					onOpen={(folder) => openLibraryFolder(folder.path)}
				/>
			</nav>
		{:else}
			<button class="empty-row" type="button" onclick={(event) => openCreate('folder', event)}>
				<FolderIcon size={18} />
				<span>Create your first folder</span>
			</button>
		{/if}
	</section>

	<SmartFolderList items={smartFolders} onOpen={openSmartFolder} />
</section>

{#if createOpen}
	<CreateOrganizationPopover
		kind={createOpen}
		{library}
		anchor={createAnchor}
		onClose={() => (createOpen = null)}
		onSnapshot={setLibrarySnapshot}
	/>
{/if}

<style>
	.library-overview {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		display: grid;
		align-content: start;
		gap: var(--space-4);
		overflow: auto;
		overscroll-behavior: contain;
		padding: var(--space-6) var(--space-5) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.library-toolbar {
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-border-soft);
	}

	.page-title {
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.page-title h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.9rem;
		font-weight: 600;
		line-height: 1;
	}

	.library-counts {
		min-width: 0;
		overflow: hidden;
		color: var(--color-muted);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.create-folder {
		min-height: 2.65rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.create-folder:hover,
	.create-folder:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.status-message {
		margin: 0;
		color: var(--color-muted);
	}

	.empty-row {
		min-width: 0;
		min-height: 3rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.empty-row:hover,
	.empty-row:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.overview-section {
		display: grid;
		gap: var(--space-3);
	}

	.empty-row {
		justify-content: flex-start;
		border-style: dashed;
		color: var(--color-muted);
	}

	@media (min-width: 1024px) {
		.library-overview {
			padding-left: var(--space-8);
			padding-right: var(--space-6);
		}
	}

	@media (max-width: 759px) {
		.library-overview {
			width: 100%;
			height: auto;
			min-height: 100%;
			margin: 0;
			overflow: visible;
			gap: var(--space-3);
			padding: var(--space-4) var(--space-3) calc(var(--bottom-nav-height) + var(--space-6));
		}

		.page-title {
			display: grid;
			gap: 0.2rem;
		}

		.page-title h1 {
			font-size: 1.55rem;
		}

		.create-folder {
			width: 2.75rem;
			height: 2.75rem;
			padding: 0;
		}

		.create-folder span {
			display: none;
		}
	}
</style>
