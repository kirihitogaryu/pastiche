<script lang="ts">
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import LinkBreakIcon from 'phosphor-svelte/lib/LinkBreakIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TagIcon from 'phosphor-svelte/lib/TagIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { LibraryResponse } from '$lib/library/types';
	import {
		appState,
		openLibraryFolder,
		openLibraryOverview,
		openSmartFolder
	} from '$lib/state/app-state.svelte';
	import { setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import CreateOrganizationPopover from './CreateOrganizationPopover.svelte';
	import FolderTree from './FolderTree.svelte';
	import {
		buildFolderTree,
		buildSmartFolderItems,
		normalizeLibraryQuery,
		type FolderTreeNode
	} from './libraryOverviewModel';

	type Props = {
		library: LibraryResponse;
		drawer?: boolean;
		onClose: () => void;
	};

	let { library, drawer = false, onClose }: Props = $props();
	let query = $state('');
	let createOpen = $state(false);
	let createAnchor = $state<{ left: number; top: number } | null>(null);
	let expanded = $state(new Set<string>());
	let folderTree = $derived(buildFolderTree(library.folders));
	let activeFolder = $derived(
		appState.libraryView === 'folder'
			? (library.folders.find(
					(folder) => folder.path.join('/') === appState.activeLibraryFolderPath.join('/')
				) ?? null)
			: null
	);
	let smartFolders = $derived(buildSmartFolderItems(library.assets));
	let matchingFolders = $derived.by(() => {
		const normalized = normalizeLibraryQuery(query);
		if (!normalized) return [];
		return library.folders
			.filter((folder) =>
				[folder.name, folder.path.slice(1).join(' / ')].some((value) =>
					value.toLocaleLowerCase().includes(normalized)
				)
			)
			.sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
	});

	$effect(() => {
		if (!activeFolder) return;
		const parents = new Set(expanded);
		let changed = false;
		for (const folder of library.folders) {
			if (
				activeFolder.path.length > folder.path.length &&
				activeFolder.path.slice(0, folder.path.length).join('/') === folder.path.join('/')
			) {
				if (!parents.has(folder.id)) {
					parents.add(folder.id);
					changed = true;
				}
			}
		}
		if (changed) expanded = parents;
	});

	function toggleFolder(id: string) {
		const next = new Set(expanded);
		next.has(id) ? next.delete(id) : next.add(id);
		expanded = next;
	}

	function openFolder(folder: FolderTreeNode | (typeof library.folders)[number]) {
		openLibraryFolder(folder.path);
		if (drawer) onClose();
	}

	function openRoot() {
		openLibraryOverview();
		if (drawer) onClose();
	}

	function openSmart(id: string) {
		openSmartFolder(id);
		if (drawer) onClose();
	}

	function showCreate(event: MouseEvent) {
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			const rect = target.getBoundingClientRect();
			createAnchor = { left: Math.max(12, rect.right - 320), top: rect.bottom + 8 };
		}
		createOpen = true;
	}

	function iconForSmart(id: string) {
		if (id === 'favorites') return StarIcon;
		if (id === 'recently-added') return ClockIcon;
		if (id === 'untagged') return TagIcon;
		return LinkBreakIcon;
	}
</script>

<aside class:drawer class="library-sidebar" aria-label="Library folders">
	<header>
		<div>
			<h1>Library</h1>
			<p>{library.stats.assets.toLocaleString()} images · {library.stats.folders} folders</p>
		</div>
		<button type="button" aria-label="New folder" onclick={showCreate}>
			<FolderPlusIcon size={18} />
		</button>
		<button class="close-sidebar" type="button" aria-label="Close folder browser" onclick={onClose}>
			{#if drawer}<XIcon size={19} />{:else}<CaretLeftIcon size={19} />{/if}
		</button>
	</header>

	<label class="folder-search">
		<MagnifyingGlassIcon size={18} />
		<input
			bind:value={query}
			type="search"
			aria-label="Search folders"
			placeholder="Search folders..."
		/>
	</label>

	<nav class="sidebar-scroll" aria-label="Library navigation">
		<button
			class="root-link"
			class:active={appState.libraryView === 'overview' || appState.libraryView === 'all'}
			type="button"
			onclick={openRoot}
		>
			<ImageSquareIcon size={18} />
			<span>All images</span>
			<small>{library.stats.assets.toLocaleString()}</small>
		</button>

		<section>
			<h2>Smart views</h2>
			<div class="smart-links">
				{#each smartFolders as item (item.id)}
					{@const Icon = iconForSmart(item.id)}
					<button
						class:active={appState.libraryView === 'smart' &&
							appState.activeSmartFolderId === item.id}
						type="button"
						onclick={() => openSmart(item.id)}
					>
						<Icon size={17} />
						<span>{item.label}</span>
						<small>{item.count.toLocaleString()}</small>
					</button>
				{/each}
			</div>
		</section>

		<section>
			<div class="section-heading">
				<h2>Folders</h2>
				<button type="button" aria-label="New folder" onclick={showCreate}>
					<FolderPlusIcon size={16} />
				</button>
			</div>
			{#if query.trim()}
				<div class="folder-results">
					{#each matchingFolders as folder (folder.id)}
						<button
							class:active={activeFolder?.id === folder.id}
							type="button"
							onclick={() => openFolder(folder)}
						>
							{#if activeFolder?.id === folder.id}
								<FolderOpenIcon size={17} />
							{:else}
								<FolderIcon size={17} />
							{/if}
							<span>
								<strong>{folder.name}</strong>
								<small>{folder.path.slice(1, -1).join(' / ') || 'Library'}</small>
							</span>
						</button>
					{:else}
						<p class="empty-search">No folders match “{query.trim()}”.</p>
					{/each}
				</div>
			{:else if folderTree.length}
				<FolderTree
					nodes={folderTree}
					{expanded}
					activeId={activeFolder?.id}
					onToggle={toggleFolder}
					onOpen={openFolder}
				/>
			{:else}
				<button class="empty-folder" type="button" onclick={showCreate}>
					<FolderIcon size={17} /> Create your first folder
				</button>
			{/if}
		</section>
	</nav>
</aside>

{#if createOpen}
	<CreateOrganizationPopover
		kind="folder"
		{library}
		anchor={createAnchor}
		onClose={() => (createOpen = false)}
		onSnapshot={setLibrarySnapshot}
	/>
{/if}

<style>
	.library-sidebar {
		box-sizing: border-box;
		width: 17.5rem;
		min-width: 17.5rem;
		height: 100%;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: var(--space-3);
		border-right: 1px solid var(--color-border-soft);
		background: oklch(10.5% 0.006 70 / 0.96);
		padding: var(--space-4);
	}

	header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 2.6rem 2.6rem;
		align-items: center;
		gap: var(--space-2);
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-family: var(--font-heading);
		font-size: 1.7rem;
		font-weight: 600;
		line-height: 1;
	}

	header p {
		margin-top: 0.3rem;
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	header button,
	.section-heading button {
		width: 2.6rem;
		height: 2.6rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	header button:hover,
	header button:focus-visible,
	.section-heading button:hover,
	.section-heading button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.folder-search {
		min-height: 2.75rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-muted);
	}

	.folder-search:focus-within {
		border-color: var(--color-border-strong);
	}

	input {
		width: 100%;
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.82rem;
	}

	.sidebar-scroll {
		min-height: 0;
		overflow: auto;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		padding-right: 0.15rem;
	}

	.sidebar-scroll section {
		display: grid;
		gap: var(--space-2);
	}

	h2 {
		color: var(--color-dim);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-heading button {
		width: 2rem;
		height: 2rem;
		border: 0;
	}

	.root-link,
	.smart-links button {
		width: 100%;
		min-height: 2.55rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
	}

	.root-link:hover,
	.root-link:focus-visible,
	.root-link.active,
	.smart-links button:hover,
	.smart-links button:focus-visible,
	.smart-links button.active {
		border-color: var(--color-border);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.root-link small,
	.smart-links small {
		color: var(--color-dim);
	}

	.smart-links {
		display: grid;
	}

	.folder-results {
		display: grid;
		gap: 0.2rem;
	}

	.folder-results > button {
		width: 100%;
		min-height: 3rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.folder-results > button:hover,
	.folder-results > button:focus-visible,
	.folder-results > button.active {
		border-color: var(--color-border);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.folder-results span {
		min-width: 0;
		display: grid;
		gap: 0.1rem;
	}

	.folder-results strong,
	.folder-results small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.folder-results strong {
		font-size: 0.8rem;
		font-weight: 500;
	}

	.folder-results small,
	.empty-search {
		color: var(--color-dim);
		font-size: 0.68rem;
	}

	.empty-search {
		padding: var(--space-3);
	}

	.empty-folder {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	@media (max-width: 1023px) {
		.library-sidebar:not(.drawer) {
			display: none;
		}

		.library-sidebar.drawer {
			position: fixed;
			inset: 0 auto 0 0;
			z-index: calc(var(--z-modal) + 1);
			width: min(21rem, calc(100vw - 2rem));
			min-width: 0;
			box-shadow: 1.5rem 0 4rem oklch(0% 0 0 / 0.45);
		}
	}
</style>
