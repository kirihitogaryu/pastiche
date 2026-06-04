<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import type { LibraryResponse } from '$lib/library/types';
	import { openLibraryFolder, openProjectLibrary, openSmartFolder } from '$lib/state/app-state.svelte';
	import { setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import CreateOrganizationPopover from './CreateOrganizationPopover.svelte';
	import FolderTree from './FolderTree.svelte';
	import LibrarySearch from './LibrarySearch.svelte';
	import ProjectCardGrid from './ProjectCardGrid.svelte';
	import SmartFolderList from './SmartFolderList.svelte';
	import TagGroupList from './TagGroupList.svelte';
	import { buildFolderTree, buildSmartFolderItems, sortHubTagGroups } from './libraryOverviewModel';

	type CreateKind = 'folder' | 'project' | 'tag' | 'tag-group';

	type Props = {
		library: LibraryResponse;
		loading?: boolean;
		error?: string | null;
	};

	let { library, loading = false, error = null }: Props = $props();
	let createOpen = $state<CreateKind | null>(null);
	let createAnchor = $state<{ left: number; top: number } | null>(null);
	let expandedFolders = $state(new Set<string>(loadExpanded('pastiche.library.expandedFolders')));
	let expandedTagGroups = $state(new Set<string>(['general']));
	let folderTree = $derived(buildFolderTree(library.folders));
	let tagGroups = $derived(sortHubTagGroups(library.tagFacets));
	let smartFolders = $derived(buildSmartFolderItems(library.assets));
	let hubProjects = $derived(
		library.projects.filter((project) => project.pinned || library.projects.length <= 4)
	);

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

	function toggleTagGroup(slug: string) {
		const next = new Set(expandedTagGroups);
		next.has(slug) ? next.delete(slug) : next.add(slug);
		expandedTagGroups = next;
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
	<div class="page-title">
		<h1 id="library-overview-title">Library</h1>
		<p>
			{library.stats.assets.toLocaleString()} assets · {library.stats.projects}
			projects · {library.stats.folders} folders · {library.stats.tags} tags
		</p>
	</div>

	{#if error}
		<p class="status-message">{error}</p>
	{:else if loading}
		<p class="status-message">Loading library...</p>
	{/if}

	<LibrarySearch />

	<div class="create-actions" aria-label="Create library organization">
		<button type="button" onclick={(event) => openCreate('project', event)}>
			<StackIcon size={18} />
			<span>New Project</span>
		</button>
		<button type="button" onclick={(event) => openCreate('folder', event)}>
			<FolderIcon size={18} />
			<span>New Folder</span>
		</button>
		<button type="button" onclick={(event) => openCreate('tag', event)}>
			<HashIcon size={18} />
			<span>New Tag</span>
		</button>
	</div>

	<ProjectCardGrid
		projects={hubProjects}
		onOpen={openProjectLibrary}
		onCreate={(event) => openCreate('project', event)}
	/>

	<section class="overview-section" aria-labelledby="folders-heading">
		<header>
			<h2 id="folders-heading">
				<FolderIcon size={20} />
				<span>Folders</span>
			</h2>
			<button type="button" onclick={(event) => openCreate('folder', event)}>+ New Folder</button>
		</header>
		{#if folderTree.length}
			<FolderTree
				nodes={folderTree}
				expanded={expandedFolders}
				onToggle={toggleFolder}
				onOpen={(folder) => openLibraryFolder(folder.path)}
			/>
		{:else}
			<button class="empty-row" type="button" onclick={(event) => openCreate('folder', event)}>
				<FolderIcon size={18} />
				<span>Create your first folder</span>
			</button>
		{/if}
	</section>

	<TagGroupList
		groups={tagGroups}
		expanded={expandedTagGroups}
		onToggle={toggleTagGroup}
		onCreateTag={(event) => openCreate('tag', event)}
		onCreateGroup={(event) => openCreate('tag-group', event)}
	/>

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
		gap: var(--space-6);
		overflow: auto;
		overscroll-behavior: contain;
		padding: var(--space-6) var(--space-5) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.page-title h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.85rem;
		font-weight: 600;
		line-height: 0.98;
	}

	.page-title p {
		margin: var(--space-2) 0 0;
		color: var(--color-muted);
	}

	.status-message {
		margin: 0;
		color: var(--color-muted);
	}

	.create-actions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}

	.create-actions button,
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

	.create-actions button:hover,
	.create-actions button:focus-visible,
	.empty-row:hover,
	.empty-row:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.overview-section {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	h2 {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-heading);
		font-size: 1.45rem;
		font-weight: 600;
		line-height: 1.1;
	}

	header button {
		border: 0;
		background: transparent;
		color: var(--color-accent);
		font: inherit;
		cursor: pointer;
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
			padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8));
		}

		.create-actions {
			grid-template-columns: 1fr;
		}
	}
</style>
