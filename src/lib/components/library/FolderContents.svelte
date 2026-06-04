<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import AssetGrid from '$lib/components/browse/AssetGrid.svelte';
	import type { LibraryResponse } from '$lib/library/types';
	import {
		appState,
		openLibraryFolder,
		openLibraryOverview,
		openMobileInspect,
		selectAsset,
		toggleSelection
	} from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';
	import type { LibraryFolder } from '$lib/types';
	import FolderCards from './FolderCards.svelte';
	import LibrarySearch from './LibrarySearch.svelte';

	type Props = {
		scope: 'all' | 'folder' | 'project';
		library: LibraryResponse;
		loading?: boolean;
		error?: string | null;
	};

	let { scope, library, loading = false, error = null }: Props = $props();

	let folder = $derived(findFolderByPath(library, appState.activeLibraryFolderPath));
	let childFolders = $derived(
		scope === 'folder' ? library.folders.filter((item) => item.parentId === folder?.id) : []
	);
	let project = $derived(
		scope === 'project'
			? library.projects.find((item) => item.id === appState.activeProjectId) ?? null
			: null
	);
	let assets = $derived(
		scope === 'all'
			? library.assets
			: scope === 'project'
				? library.assets.filter((asset) => asset.projects.includes(appState.activeProjectId ?? ''))
				: library.assets.filter((asset) => asset.folderPath.join('/') === folder?.path.join('/'))
	);
	let title = $derived(
		scope === 'all' ? 'All Library' : scope === 'project' ? (project?.name ?? 'Project') : (folder?.name ?? 'Folder')
	);
	let stats = $derived(
		scope === 'all'
			? `${assets.length.toLocaleString()} assets`
			: scope === 'project'
				? `${assets.length.toLocaleString()} assets · ${project?.folderCount ?? 0} folders`
				: `${(folder?.assetCount ?? 0).toLocaleString()} assets · ${folder?.childFolderCount ?? 0} subfolders`
	);

	function findFolderByPath(source: LibraryResponse, path: string[]): LibraryFolder | null {
		const key = path.join('/');
		return source.folders.find((item) => item.path.join('/') === key) ?? null;
	}

	function openAsset(asset: Asset) {
		selectAsset(asset);
		if (window.matchMedia('(max-width: 759px)').matches) {
			openMobileInspect(asset, window.scrollY);
		}
	}
</script>

<section class="folder-view" aria-labelledby="folder-title">
	<button class="back-action" type="button" onclick={openLibraryOverview}>
		<ArrowLeftIcon size={18} />
		<span>Library</span>
	</button>

	{#if scope === 'folder'}
		<nav class="breadcrumb" aria-label="Library breadcrumb">
			{#each folder?.path ?? ['library'] as segment, index (`${segment}-${index}`)}
				<button
					class:current={index === (folder?.path.length ?? 1) - 1}
					type="button"
					onclick={() =>
						index === 0
							? openLibraryOverview()
							: openLibraryFolder((folder?.path ?? ['library']).slice(0, index + 1))}
				>
					{segment}
				</button>
			{/each}
		</nav>
	{/if}

	<div class="folder-title">
		<h1 id="folder-title">{title}</h1>
		<p>{stats}</p>
		{#if error}
			<p class="status-message">{error}</p>
		{:else if loading}
			<p class="status-message">Loading library...</p>
		{/if}
	</div>

	<div class="search-sort">
		<LibrarySearch label={`Search ${title}`} />
		<button class="sort" type="button">Newest</button>
	</div>

	{#if childFolders.length > 0}
		<section class="content-section" aria-labelledby="subfolders-title">
			<h2 id="subfolders-title">Subfolders</h2>
			<FolderCards folders={childFolders} onOpen={openLibraryFolder} />
		</section>
	{/if}

	<section class="content-section" aria-labelledby="assets-title">
		<header>
			<h2 id="assets-title">Assets</h2>
			<div class="view-toggle" aria-label="View options">
				<button type="button" aria-label="Grid view"
					><SquaresFourIcon size={18} weight="fill" /></button
				>
				<button type="button" aria-label="List view"><ListBulletsIcon size={18} /></button>
			</div>
		</header>
		<AssetGrid
			{assets}
			mode="library"
			activeId={appState.selectedAssetId}
			selectedIds={appState.selectedAssetIds}
			onOpen={openAsset}
			onSelect={(asset) => toggleSelection(asset)}
		/>
	</section>
</section>

<style>
	.folder-view {
		height: 100%;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		overflow: auto;
		overscroll-behavior: contain;
		padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 1.65rem;
		overflow-x: auto;
		scrollbar-width: none;
		color: var(--color-muted);
		line-height: 1.2;
	}

	.breadcrumb::-webkit-scrollbar {
		display: none;
	}

	.breadcrumb button {
		min-height: 1.65rem;
		display: inline-flex;
		align-items: center;
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--color-muted);
		text-decoration: underline;
		cursor: pointer;
	}

	.breadcrumb button:not(:last-child)::after {
		content: '/';
		margin-left: var(--space-2);
		color: var(--color-dim);
		text-decoration: none;
	}

	.breadcrumb button.current {
		color: var(--color-text);
		text-decoration: none;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1,
	h2 {
		font-family: var(--font-heading);
		font-weight: 600;
	}

	h1 {
		font-size: 2.35rem;
		line-height: 1;
	}

	p {
		margin-top: var(--space-2);
		color: var(--color-muted);
	}

	.status-message {
		margin-top: var(--space-2);
		color: var(--color-muted);
	}

	.back-action {
		width: fit-content;
		min-height: 2.45rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.back-action:hover,
	.back-action:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.search-sort {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-3);
	}

	.sort {
		min-width: 6.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.sort:hover,
	.sort:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.content-section {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.view-toggle {
		display: flex;
		padding: var(--space-1);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
	}

	.view-toggle button {
		width: 2.1rem;
		height: 2.1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.view-toggle button:hover,
	.view-toggle button:focus-visible {
		background: var(--color-hover);
	}

	:global(.folder-view .asset-grid) {
		padding-inline: 0;
	}

	@media (max-width: 420px) {
		.search-sort {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 759px) {
		.folder-view {
			height: auto;
			min-height: 100%;
			overflow: visible;
		}
	}
</style>
