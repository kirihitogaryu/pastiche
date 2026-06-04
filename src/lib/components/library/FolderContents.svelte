<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import AssetGrid from '$lib/components/browse/AssetGrid.svelte';
	import { librarySmartFolders } from '$lib/data/library-organization';
	import type { LibraryAsset, LibraryResponse } from '$lib/library/types';
	import {
		appState,
		openLibraryFolder,
		openLibraryTag,
		openLibraryOverview,
		openProjectLibrary,
		openMobileInspect,
		selectAsset,
		toggleSelection
	} from '$lib/state/app-state.svelte';
	import { setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';
	import type { LibraryFolder } from '$lib/types';
	import AddProjectAssetsPopover from './AddProjectAssetsPopover.svelte';
	import CreateOrganizationPopover from './CreateOrganizationPopover.svelte';
	import FolderCards from './FolderCards.svelte';
	import LibrarySearch from './LibrarySearch.svelte';
	import { filterAssetsByLibraryQuery, filterAssetsByTag } from './libraryOverviewModel';

	type Props = {
		scope: 'all' | 'folder' | 'project' | 'smart' | 'tag';
		library: LibraryResponse;
		loading?: boolean;
		error?: string | null;
	};

	let { scope, library, loading = false, error = null }: Props = $props();
	let addImagesOpen = $state(false);
	let coverPickerOpen = $state(false);
	let subfolderOpen = $state(false);
	let actionAnchor = $state<{ left: number; top: number } | null>(null);
	let coverSavingId = $state<string | null>(null);
	let localError = $state<string | null>(null);

	let folder = $derived(findFolderByPath(library, appState.activeLibraryFolderPath));
	let childFolders = $derived(
		scope === 'folder' ? library.folders.filter((item) => item.parentId === folder?.id) : []
	);
	let project = $derived(
		scope === 'project'
			? library.projects.find((item) => item.id === appState.activeProjectId) ?? null
			: null
	);
	let smartFolder = $derived(
		scope === 'smart'
			? librarySmartFolders.find((item) => item.id === appState.activeSmartFolderId) ?? null
			: null
	);
	let tag = $derived(
		scope === 'tag'
			? (library.tagFacets
					.flatMap((group) => group.tags)
					.find((item) => item.id === appState.activeTagId || item.slug === appState.activeTagId) ??
				null)
			: null
	);
	let assets = $derived(
		scope === 'all'
			? library.assets
			: scope === 'project'
				? library.assets.filter((asset) => asset.projects.includes(appState.activeProjectId ?? ''))
				: scope === 'smart'
					? smartFolderAssets(library.assets, appState.activeSmartFolderId)
					: scope === 'tag'
						? filterAssetsByTag(library.assets, appState.activeTagId)
						: library.assets.filter((asset) => asset.folderPath.join('/') === folder?.path.join('/'))
	);
	let title = $derived(
		scope === 'all'
			? 'All Library'
			: scope === 'project'
				? (project?.name ?? 'Project')
				: scope === 'smart'
					? (smartFolder?.label ?? 'Smart Folder')
					: scope === 'tag'
						? (tag?.value ?? 'Tag')
						: (folder?.name ?? 'Folder')
	);
	let stats = $derived(
		scope === 'all'
			? `${assets.length.toLocaleString()} assets`
			: scope === 'project'
				? `${assets.length.toLocaleString()} assets · ${project?.folderCount ?? 0} folders`
				: scope === 'smart'
					? `${assets.length.toLocaleString()} assets`
					: scope === 'tag'
						? `${assets.length.toLocaleString()} assets · ${tag?.facetName ?? 'Tag Group'}`
						: `${(folder?.assetCount ?? 0).toLocaleString()} assets · ${folder?.childFolderCount ?? 0} subfolders`
	);
	let visibleAssets = $derived(filterAssetsByLibraryQuery(assets, appState.query));

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

	function openAnchored(kind: 'images' | 'cover' | 'subfolder', event: MouseEvent) {
		actionAnchor = anchorFrom(event.currentTarget);
		if (kind === 'images') {
			addImagesOpen = !addImagesOpen;
			coverPickerOpen = false;
			subfolderOpen = false;
		} else if (kind === 'cover') {
			coverPickerOpen = !coverPickerOpen;
			addImagesOpen = false;
			subfolderOpen = false;
		} else {
			subfolderOpen = !subfolderOpen;
			addImagesOpen = false;
			coverPickerOpen = false;
		}
	}

	function openPrimaryMobileAction(event: MouseEvent) {
		if (scope === 'folder' && folder) {
			openAnchored('subfolder', event);
		} else if (scope === 'project' && project) {
			openAnchored('images', event);
		}
	}

	function anchorFrom(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return null;
		const rect = target.getBoundingClientRect();
		const width = 368;
		return {
			left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
			top: rect.bottom + 8
		};
	}

	async function setProjectCover(asset: Asset) {
		if (!project || coverSavingId) return;
		coverSavingId = asset.id;
		localError = null;
		try {
			const response = await fetch(`/api/library/projects/${encodeURIComponent(project.id)}/cover`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ asset_id: asset.id })
			});
			const body = (await response.json()) as { error?: string; snapshot?: LibraryResponse };
			if (!response.ok || !body.snapshot) {
				throw new Error(body.error ?? 'Project cover could not be updated.');
			}
			setLibrarySnapshot(body.snapshot);
		} catch (coverError) {
			localError =
				coverError instanceof Error ? coverError.message : 'Project cover could not be updated.';
		} finally {
			coverSavingId = null;
		}
	}

	function smartFolderAssets(assets: LibraryAsset[], id: string | null) {
		if (id === 'favorites') return assets.filter((asset) => asset.favorite);
		if (id === 'untagged') return assets.filter((asset) => asset.tags.length === 0);
		if (id === 'missing-source') return assets.filter((asset) => !asset.sourceUrl);
		if (id === 'recently-added') {
			return [...assets].sort((a, b) => {
				const aImported = 'importedAt' in a && typeof a.importedAt === 'string' ? a.importedAt : '';
				const bImported = 'importedAt' in b && typeof b.importedAt === 'string' ? b.importedAt : '';
				return bImported.localeCompare(aImported);
			});
		}
		return assets;
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
		{:else if localError}
			<p class="status-message">{localError}</p>
		{:else if loading}
			<p class="status-message">Loading library...</p>
		{/if}
	</div>

	<div class="search-sort">
		<LibrarySearch
			{library}
			label={`Search ${title}`}
			scopeLabel={title}
			onOpenFolder={(path) => openLibraryFolder(path)}
			onOpenProject={(id) => openProjectLibrary(id)}
			onOpenTag={(id) => openLibraryTag(id)}
			onOpenAsset={openAsset}
		/>
		<div class="view-actions desktop-actions">
			{#if scope === 'folder' && folder}
				<button class="sort" type="button" onclick={(event) => openAnchored('subfolder', event)}>
					<FolderPlusIcon size={17} />
					<span>New Subfolder</span>
				</button>
			{/if}
			{#if scope === 'project' && project}
				<button class="sort" type="button" onclick={(event) => openAnchored('images', event)}>
					<ImageSquareIcon size={17} />
					<span>Add Images</span>
				</button>
				<button class="sort" type="button" onclick={(event) => openAnchored('cover', event)}>
					<ImageSquareIcon size={17} />
					<span>Choose Cover</span>
				</button>
			{/if}
			<button class="sort" type="button">Newest</button>
		</div>
		{#if (scope === 'folder' && folder) || (scope === 'project' && project)}
			<button class="mobile-overflow" type="button" aria-label="View actions" onclick={openPrimaryMobileAction}>
				<DotsThreeIcon size={19} weight="bold" />
			</button>
		{/if}
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
			assets={visibleAssets}
			mode="library"
			activeId={appState.selectedAssetId}
			selectedIds={appState.selectedAssetIds}
			projectCoverId={scope === 'project' ? project?.coverAssetId : null}
			onOpen={openAsset}
			onSelect={(asset) => toggleSelection(asset)}
			onSetProjectCover={scope === 'project' ? setProjectCover : undefined}
		/>
	</section>
</section>

{#if subfolderOpen && scope === 'folder' && folder}
	<CreateOrganizationPopover
		kind="folder"
		{library}
		anchor={actionAnchor}
		onClose={() => (subfolderOpen = false)}
		onSnapshot={setLibrarySnapshot}
	/>
{/if}

{#if addImagesOpen && scope === 'project' && project}
	<AddProjectAssetsPopover
		{library}
		projectId={project.id}
		purpose="add"
		anchor={actionAnchor}
		onClose={() => (addImagesOpen = false)}
		onSnapshot={setLibrarySnapshot}
	/>
{/if}

{#if coverPickerOpen && scope === 'project' && project}
	<AddProjectAssetsPopover
		{library}
		projectId={project.id}
		purpose="cover"
		anchor={actionAnchor}
		onClose={() => (coverPickerOpen = false)}
		onSnapshot={setLibrarySnapshot}
	/>
{/if}

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

	.view-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: var(--space-2);
	}

	.mobile-overflow {
		display: none;
	}

	.sort {
		min-width: 6.5rem;
		min-height: 2.65rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
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

	@media (max-width: 759px) {
		.folder-view {
			height: auto;
			min-height: 100%;
			overflow: visible;
			gap: var(--space-4);
			padding: var(--space-4) var(--space-3) calc(var(--bottom-nav-height) + var(--space-6));
		}

		.search-sort {
			grid-template-columns: 1fr auto;
			gap: var(--space-2);
		}

		.desktop-actions {
			display: none;
		}

		.mobile-overflow {
			width: 2.6rem;
			height: 2.6rem;
			display: grid;
			place-items: center;
			border: 1px solid var(--color-border);
			border-radius: var(--radius-md);
			background: var(--color-surface);
			color: var(--color-muted);
			cursor: pointer;
		}

		.mobile-overflow:hover,
		.mobile-overflow:focus-visible {
			border-color: var(--color-border-strong);
			background: var(--color-surface-soft);
			color: var(--color-text);
		}
	}
</style>
