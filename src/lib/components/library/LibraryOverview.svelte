<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import { librarySectionChips, librarySmartFolders } from '$lib/data/library-organization';
	import type { LibraryResponse } from '$lib/library/types';
	import {
		openFullLibrary,
		openLibraryFolder,
		openProjectLibrary,
		openSmartFolder
	} from '$lib/state/app-state.svelte';
	import { setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import CreateOrganizationPopover from './CreateOrganizationPopover.svelte';
	import GroupedNavList from './GroupedNavList.svelte';
	import LibrarySearch from './LibrarySearch.svelte';

	type Props = {
		library: LibraryResponse;
		loading?: boolean;
		error?: string | null;
	};

	let { library, loading = false, error = null }: Props = $props();
	let activeSection = $state('Overview');
	let createOpen = $state<'folder' | 'project' | 'tag' | null>(null);
	let createAnchor = $state<{ left: number; top: number } | null>(null);
	let topFolders = $derived(library.folders.filter((folder) => !folder.parentId).slice(0, 8));

	function openCreate(kind: 'folder' | 'project' | 'tag', event: MouseEvent) {
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
		<div class="create-wrap">
			<button type="button" onclick={(event) => openCreate('project', event)}>
				<StackIcon size={18} />
				<span>New Project</span>
			</button>
			{#if createOpen === 'project'}
				<CreateOrganizationPopover
					kind="project"
					{library}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
		<div class="create-wrap">
			<button type="button" onclick={(event) => openCreate('folder', event)}>
				<FolderIcon size={18} />
				<span>New Folder</span>
			</button>
			{#if createOpen === 'folder'}
				<CreateOrganizationPopover
					kind="folder"
					{library}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
		<div class="create-wrap">
			<button type="button" onclick={(event) => openCreate('tag', event)}>
				<HashIcon size={18} />
				<span>New Tag</span>
			</button>
			{#if createOpen === 'tag'}
				<CreateOrganizationPopover
					kind="tag"
					{library}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
	</div>

	<nav class="section-chips" aria-label="Library sections">
		{#each librarySectionChips as section (section)}
			<button
				class:active={activeSection === section}
				type="button"
				onclick={() => (activeSection = section)}
			>
				{section}
			</button>
		{/each}
	</nav>

	<button class="full-library" type="button" onclick={openFullLibrary}>
		<SquaresFourIcon size={21} />
		<span>View Full Library</span>
		<span aria-hidden="true">></span>
	</button>

	<section class="overview-section" aria-labelledby="pinned-projects-heading">
		<header>
			<h2 id="pinned-projects-heading">Pinned Projects</h2>
			<button type="button" onclick={(event) => openCreate('project', event)}>+ New Project</button>
		</header>
		<GroupedNavList
			ariaLabel="Projects"
			rows={library.projects.map((project) => ({
				id: project.id,
				label: project.name,
				count: project.assetCount,
				icon: 'project'
			}))}
			onOpen={openProjectLibrary}
		/>
	</section>

	<section class="overview-section" aria-labelledby="folders-heading">
		<header>
			<h2 id="folders-heading">Folders</h2>
			<button type="button" onclick={(event) => openCreate('folder', event)}>+ New Folder</button>
		</header>
		<GroupedNavList
			ariaLabel="Top-level folders"
			rows={topFolders.map((folder) => ({
				id: folder.id,
				label: folder.name,
				count: folder.assetCount,
				icon: 'folder'
			}))}
			onOpen={(id) => {
				const folder = topFolders.find((item) => item.id === id);
				if (folder) openLibraryFolder(folder.path);
			}}
		/>
	</section>

	<section class="overview-section" aria-labelledby="smart-folders-heading">
		<header>
			<h2 id="smart-folders-heading">Smart Folders</h2>
			<button type="button">See all</button>
		</header>
		<GroupedNavList
			ariaLabel="Smart folders"
			rows={librarySmartFolders.map((folder) => ({
				id: folder.id,
				label: folder.label,
				count: folder.count,
				icon: folder.icon
			}))}
			onOpen={openSmartFolder}
		/>
	</section>

	<section class="overview-section" aria-labelledby="tags-heading">
		<header>
			<h2 id="tags-heading">Tags</h2>
			<button type="button" onclick={(event) => openCreate('tag', event)}>+ New Tag</button>
		</header>
		<GroupedNavList
			ariaLabel="Tag facets"
			rows={library.tagFacets.map((facet) => ({
				id: facet.id,
				label: facet.name,
				count: facet.tagCount,
				icon: 'tag'
			}))}
			onOpen={() => undefined}
		/>
	</section>
</section>

<style>
	.library-overview {
		height: 100%;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		overflow: auto;
		overscroll-behavior: contain;
		padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.page-title h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.35rem;
		font-weight: 600;
		line-height: 1;
	}

	.page-title p {
		margin: var(--space-2) 0 0;
		color: var(--color-muted);
	}

	.status-message {
		margin: 0;
		color: var(--color-muted);
	}

	.section-chips {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.create-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.create-wrap {
		position: relative;
	}

	.section-chips::-webkit-scrollbar {
		display: none;
	}

	.create-actions button,
	.section-chips button,
	.full-library,
	header button {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.create-actions button,
	.section-chips button {
		min-height: 2.45rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		white-space: nowrap;
	}

	.section-chips button.active {
		background: var(--color-surface-raised);
	}

	.create-actions button,
	.section-chips button,
	.full-library,
	header button {
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.create-actions button:hover,
	.create-actions button:focus-visible,
	.section-chips button:hover,
	.full-library:hover {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.full-library {
		min-height: 3.25rem;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		border-radius: var(--radius-lg);
		text-align: left;
	}

	.full-library:hover {
		transform: translateY(-1px);
	}

	.overview-section {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 600;
	}

	header button {
		border: 0;
		background: transparent;
		color: var(--color-muted);
	}

	@media (min-width: 760px) {
		.library-overview {
			padding: var(--space-6);
		}
	}

	@media (max-width: 759px) {
		.library-overview {
			height: auto;
			min-height: 100%;
			overflow: visible;
		}
	}
</style>
