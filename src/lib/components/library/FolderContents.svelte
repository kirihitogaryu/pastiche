<script lang="ts">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import ListMagnifyingGlassIcon from 'phosphor-svelte/lib/ListMagnifyingGlassIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import SidebarSimpleIcon from 'phosphor-svelte/lib/SidebarSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import AssetGrid from '$lib/components/browse/AssetGrid.svelte';
	import type { AtlasResolvedTagCandidate } from '$lib/atlas/agentTypes';
	import { librarySmartFolders } from '$lib/data/library-organization';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import type { LibraryAsset, LibraryResponse } from '$lib/library/types';
	import {
		appState,
		exitSelection,
		openAdd,
		openFilter,
		openLibraryFolder,
		openLibraryOverview,
		openMobileInspect,
		selectAsset,
		setLibraryQuery,
		setLibrarySort,
		toggleSelection,
		updateLibraryFilters
	} from '$lib/state/app-state.svelte';
	import { setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset, LibraryFolder } from '$lib/types';
	import CreateOrganizationPopover from './CreateOrganizationPopover.svelte';
	import FolderCards from './FolderCards.svelte';
	import MoveAssetPopover from './MoveAssetPopover.svelte';
	import {
		filterAssetsByLibraryFilters,
		filterAssetsByLibraryQuery,
		filterAssetsByTag
	} from './libraryOverviewModel';

	type Props = {
		scope: 'all' | 'folder' | 'project' | 'smart' | 'tag';
		library: LibraryResponse;
		loading?: boolean;
		error?: string | null;
		onOpenFolders: () => void;
	};

	let { scope, library, loading = false, error = null, onOpenFolders }: Props = $props();
	let editMode = $state(false);
	let createOpen = $state(false);
	let createAnchor = $state<{ left: number; top: number } | null>(null);
	let localError = $state<string | null>(null);
	let busy = $state(false);
	let renameValue = $state('');
	let moveOpen = $state(false);
	let moveAnchor = $state<{ left: number; top: number } | null>(null);
	let controlOpen = $state<'sort' | 'storage' | null>(null);
	let searchFocused = $state(false);
	let searchResolving = $state(false);
	let searchSuggestions = $state<
		Array<{ id: string; expression: string; label: string; hint: string }>
	>([]);
	let resolvedSearchExpressions = $state<string[]>([]);
	let searchRequestId = 0;

	let folder = $derived(findFolderByPath(library, appState.activeLibraryFolderPath));
	let childFolders = $derived(
		scope === 'folder'
			? library.folders.filter((item) => item.parentId === folder?.id)
			: scope === 'all'
				? library.folders.filter((item) => !item.parentId)
				: []
	);
	let project = $derived(
		scope === 'project'
			? (library.projects.find((item) => item.id === appState.activeProjectId) ?? null)
			: null
	);
	let smartFolder = $derived(
		scope === 'smart'
			? (librarySmartFolders.find((item) => item.id === appState.activeSmartFolderId) ?? null)
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
	let assets = $derived.by(() => {
		if (scope === 'all') return library.assets;
		if (scope === 'project') {
			return library.assets.filter((asset) =>
				asset.projects.includes(appState.activeProjectId ?? '')
			);
		}
		if (scope === 'smart') return smartFolderAssets(library.assets, appState.activeSmartFolderId);
		if (scope === 'tag') return filterAssetsByTag(library.assets, appState.activeTagId);
		if (!folder) return [];
		const key = folder.path.join('/');
		return library.assets.filter((asset) =>
			appState.libraryFilters.includeSubfolders
				? asset.folderPath.join('/').startsWith(`${key}/`) || asset.folderPath.join('/') === key
				: asset.folderPath.join('/') === key
		);
	});
	let title = $derived(
		scope === 'all'
			? 'All images'
			: scope === 'project'
				? (project?.name ?? 'Project')
				: scope === 'smart'
					? (smartFolder?.label ?? 'Smart view')
					: scope === 'tag'
						? (tag?.value ?? 'Tag')
						: (folder?.name ?? 'Folder')
	);
	let visibleAssets = $derived.by(() => {
		const storageFiltered = assets.filter((asset) => {
			if (appState.libraryFilters.storageMode === 'saved') return asset.storageMode === 'download';
			if (appState.libraryFilters.storageMode === 'bookmarked') {
				return asset.storageMode === 'lazy_download' || asset.storageMode === 'url_reference';
			}
			return true;
		});
		const filtered = filterAssetsByLibraryFilters(
			filterAssetsByLibraryQuery(storageFiltered, appState.libraryQuery, resolvedSearchExpressions),
			appState.libraryFilters
		);
		return [...filtered].sort((a, b) => {
			if (appState.librarySort === 'Title') return a.title.localeCompare(b.title);
			const comparison = a.importedAt.localeCompare(b.importedAt);
			return appState.librarySort === 'Oldest' ? comparison : -comparison;
		});
	});
	let stats = $derived(
		`${visibleAssets.length.toLocaleString()} ${visibleAssets.length === 1 ? 'image' : 'images'}${
			childFolders.length
				? ` · ${childFolders.length.toLocaleString()} ${childFolders.length === 1 ? 'folder' : 'folders'}`
				: ''
		}`
	);
	let breadcrumbFolders = $derived.by(() => {
		if (!folder) return [];
		return folder.path
			.slice(1)
			.map((_, index) => {
				const path = folder.path.slice(0, index + 2);
				return library.folders.find((item) => item.path.join('/') === path.join('/')) ?? null;
			})
			.filter((item): item is LibraryFolder => Boolean(item));
	});
	let visibleBreadcrumbs = $derived(breadcrumbFolders.slice(-3));
	let selectedAssets = $derived(
		library.assets.filter((asset) => appState.selectedAssetIds.includes(asset.id))
	);
	let selectedAreAssigned = $derived(
		selectedAssets.some((asset) => asset.record?.organization.folderId !== null)
	);

	$effect(() => {
		if (folder && !editMode) renameValue = folder.name;
	});

	$effect(() => {
		const query = lastSearchSegment(appState.libraryQuery);
		const requestId = ++searchRequestId;
		if (query.length < 2) {
			searchSuggestions = [];
			resolvedSearchExpressions = [];
			searchResolving = false;
			return;
		}
		searchResolving = true;
		const timer = window.setTimeout(() => {
			void resolveLibrarySearch(query, requestId);
		}, 180);
		return () => window.clearTimeout(timer);
	});

	function findFolderByPath(source: LibraryResponse, path: string[]): LibraryFolder | null {
		const key = path.join('/');
		return source.folders.find((item) => item.path.join('/') === key) ?? null;
	}

	function openAsset(asset: Asset) {
		if (editMode) {
			toggleSelection(asset);
			return;
		}
		selectAsset(asset);
		if (window.matchMedia('(max-width: 1179px)').matches) openMobileInspect(asset, window.scrollY);
	}

	function toggleEdit() {
		editMode = !editMode;
		exitSelection();
		if (folder) renameValue = folder.name;
	}

	function showCreate(event: MouseEvent) {
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			const rect = target.getBoundingClientRect();
			createAnchor = {
				left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
				top: rect.bottom + 8
			};
		}
		createOpen = true;
	}

	function toggleControl(kind: 'sort' | 'storage', event: MouseEvent) {
		event.stopPropagation();
		controlOpen = controlOpen === kind ? null : kind;
	}

	async function resolveLibrarySearch(query: string, requestId: number) {
		try {
			const [resolverResponse, conceptsResponse] = await Promise.all([
				fetch('/api/atlas/tags/resolve', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ inputs: [query], context: 'search' })
				}),
				fetch(`/api/atlas/concepts?q=${encodeURIComponent(query)}&limit=6`)
			]);
			const resolverBody = (await resolverResponse.json()) as {
				candidates?: AtlasResolvedTagCandidate[];
			};
			const conceptsBody = (await conceptsResponse.json()) as {
				concepts?: Array<{
					id: string;
					slug: string;
					label: string;
					match: string;
				}>;
			};
			if (requestId !== searchRequestId) return;
			const candidate = resolverBody.candidates?.[0];
			const suggestions: Array<{
				id: string;
				expression: string;
				label: string;
				hint: string;
			}> = [];
			if (candidate && !candidate.blocked && ['existing', 'corrected'].includes(candidate.kind)) {
				suggestions.push({
					id: candidate.id,
					expression: candidate.expression,
					label: candidate.label,
					hint: candidate.kind === 'corrected' ? 'Suggested correction' : 'Atlas tag'
				});
			}
			for (const alternative of candidate?.alternatives ?? []) {
				suggestions.push({
					id: alternative.id,
					expression: alternative.expression,
					label: alternative.label,
					hint: 'Nearby Atlas tag'
				});
			}
			for (const concept of conceptsBody.concepts ?? []) {
				suggestions.push({
					id: concept.id,
					expression: concept.slug,
					label: concept.label,
					hint: concept.match === 'alias' ? 'Atlas alias' : 'Atlas tag'
				});
			}
			searchSuggestions = uniqueSearchSuggestions(suggestions).slice(0, 6);
			resolvedSearchExpressions =
				candidate &&
				!candidate.blocked &&
				(candidate.kind === 'existing' ||
					candidate.kind === 'corrected' ||
					candidate.confidence !== 'low')
					? [
							candidate.expression,
							...(candidate.alternatives[0]?.confidence !== 'low'
								? [candidate.alternatives[0]?.expression].filter((value): value is string =>
										Boolean(value)
									)
								: [])
						]
					: [];
		} catch {
			if (requestId !== searchRequestId) return;
			searchSuggestions = [];
			resolvedSearchExpressions = [];
		} finally {
			if (requestId === searchRequestId) searchResolving = false;
		}
	}

	function chooseSearchSuggestion(expression: string) {
		const parts = appState.libraryQuery.split(',');
		parts[parts.length - 1] = ` ${expression}`;
		setLibraryQuery(parts.join(',').trimStart());
		searchFocused = false;
	}

	function lastSearchSegment(query: string) {
		return (query.split(',').at(-1) ?? '').trim();
	}

	function uniqueSearchSuggestions(
		items: Array<{ id: string; expression: string; label: string; hint: string }>
	) {
		const seen = new Set<string>();
		return items.filter((item) => {
			if (!item.expression || seen.has(item.expression)) return false;
			seen.add(item.expression);
			return true;
		});
	}

	async function refresh() {
		setLibrarySnapshot(await loadLibrarySnapshot());
	}

	async function renameFolder(target: LibraryFolder, name: string) {
		if (!name.trim() || name.trim() === target.name) return;
		await updateFolder(target, name.trim());
	}

	async function updateFolder(target: LibraryFolder, name: string) {
		if (busy) return;
		busy = true;
		localError = null;
		try {
			const response = await fetch(`/api/library/folders/${encodeURIComponent(target.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const body = (await response.json()) as {
				error?: string;
				folder?: { path: string };
			};
			if (!response.ok || !body.folder)
				throw new Error(body.error ?? 'Folder could not be renamed.');
			await refresh();
			if (folder?.id === target.id) openLibraryFolder(body.folder.path.split('/'));
		} catch (updateError) {
			localError =
				updateError instanceof Error ? updateError.message : 'Folder could not be renamed.';
		} finally {
			busy = false;
		}
	}

	async function deleteFolder(target: LibraryFolder) {
		const destination = target.parentId === undefined ? 'All images' : 'the parent folder';
		if (
			!window.confirm(
				`Delete “${target.name}”? Its images and subfolders will move to ${destination}. No images will be deleted.`
			)
		) {
			return;
		}
		busy = true;
		localError = null;
		try {
			const response = await fetch(`/api/library/folders/${encodeURIComponent(target.id)}`, {
				method: 'DELETE'
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(body.error ?? 'Folder could not be deleted.');
			if (folder?.id === target.id) {
				const parent = target.parentId
					? library.folders.find((item) => item.id === target.parentId)
					: null;
				parent ? openLibraryFolder(parent.path) : openLibraryOverview();
			}
			await refresh();
		} catch (deleteError) {
			localError =
				deleteError instanceof Error ? deleteError.message : 'Folder could not be deleted.';
		} finally {
			busy = false;
		}
	}

	async function moveSelected(folderId: string | null) {
		if (!appState.selectedAssetIds.length || busy) return;
		busy = true;
		localError = null;
		try {
			const response = await fetch('/api/library/assets/bulk', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ asset_ids: appState.selectedAssetIds, folder_id: folderId })
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(body.error ?? 'Images could not be moved.');
			exitSelection();
			await refresh();
		} catch (moveError) {
			localError = moveError instanceof Error ? moveError.message : 'Images could not be moved.';
		} finally {
			busy = false;
		}
	}

	async function deleteSelected() {
		const count = appState.selectedAssetIds.length;
		if (!count || busy) return;
		if (
			!window.confirm(
				`Delete ${count} ${count === 1 ? 'image' : 'images'} from Pastiche? This removes the files and cannot be undone.`
			)
		) {
			return;
		}
		busy = true;
		localError = null;
		try {
			const response = await fetch('/api/library/assets/bulk', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ asset_ids: appState.selectedAssetIds })
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(body.error ?? 'Images could not be deleted.');
			exitSelection();
			await refresh();
		} catch (deleteError) {
			localError =
				deleteError instanceof Error ? deleteError.message : 'Images could not be deleted.';
		} finally {
			busy = false;
		}
	}

	function openMove(event: MouseEvent) {
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			const rect = target.getBoundingClientRect();
			moveAnchor = {
				left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
				top: rect.top - 8
			};
		}
		moveOpen = true;
	}

	function smartFolderAssets(items: LibraryAsset[], id: string | null) {
		if (id === 'favorites') return items.filter((asset) => asset.favorite);
		if (id === 'untagged') return items.filter((asset) => asset.tags.length === 0);
		if (id === 'missing-source') return items.filter((asset) => !asset.sourceUrl);
		if (id === 'recently-added') return items;
		return items;
	}
</script>

<svelte:window onclick={() => (controlOpen = null)} />

<section class="folder-view" aria-labelledby="folder-title">
	<header class="folder-header">
		<div class="breadcrumbs" aria-label="Folder path">
			<button class="folders-button" type="button" onclick={onOpenFolders}>
				<SidebarSimpleIcon size={18} />
				<span>Folders</span>
			</button>
			<button type="button" onclick={openLibraryOverview}>Library</button>
			{#if breadcrumbFolders.length > 3}<span>…</span>{/if}
			{#each visibleBreadcrumbs as item (item.id)}
				<CaretRightIcon size={13} />
				<button type="button" onclick={() => openLibraryFolder(item.path)}>{item.name}</button>
			{/each}
		</div>

		<div class="title-row">
			<div class="title-copy">
				{#if editMode && folder}
					<label>
						<span class="sr-only">Folder name</span>
						<input
							class="title-input"
							bind:value={renameValue}
							onkeydown={(event) => {
								if (event.key === 'Enter') renameFolder(folder, renameValue);
								if (event.key === 'Escape') renameValue = folder.name;
							}}
						/>
					</label>
					<button
						class="save-name"
						type="button"
						aria-label="Save folder name"
						disabled={busy || renameValue.trim() === folder.name}
						onclick={() => renameFolder(folder, renameValue)}
					>
						<CheckIcon size={17} />
					</button>
				{:else}
					<h1 id="folder-title">{title}</h1>
				{/if}
				<p>{stats}</p>
			</div>
			<div class="title-actions">
				{#if scope === 'folder' || scope === 'all'}
					<button type="button" onclick={showCreate}>
						<FolderPlusIcon size={17} /><span>New folder</span>
					</button>
				{/if}
				<button class:active={editMode} type="button" onclick={toggleEdit}>
					{#if editMode}<XIcon size={17} /> Done{:else}<PencilSimpleIcon size={17} /> Edit{/if}
				</button>
			</div>
		</div>

		<div class="browser-toolbar">
			<div class="search-control">
				<label class="image-search">
					<MagnifyingGlassIcon size={19} />
					<input
						value={appState.libraryQuery}
						type="search"
						aria-label="Search images"
						aria-autocomplete="list"
						aria-controls="library-tag-suggestions"
						placeholder={scope === 'folder' ? `Search ${title}...` : 'Search images or tags...'}
						onfocus={() => (searchFocused = true)}
						onblur={() => window.setTimeout(() => (searchFocused = false), 120)}
						onkeydown={(event) => {
							if (event.key === 'Escape') searchFocused = false;
						}}
						oninput={(event) => setLibraryQuery(event.currentTarget.value)}
					/>
				</label>
				{#if searchFocused && lastSearchSegment(appState.libraryQuery).length >= 2}
					<div
						id="library-tag-suggestions"
						class="search-suggestions"
						role="listbox"
						aria-label="Atlas tag suggestions"
					>
						{#if searchResolving}
							<p>Checking Atlas…</p>
						{:else if searchSuggestions.length}
							{#each searchSuggestions as suggestion (suggestion.id)}
								<button
									type="button"
									role="option"
									aria-selected="false"
									onmousedown={(event) => event.preventDefault()}
									onclick={() => chooseSearchSuggestion(suggestion.expression)}
								>
									<span>
										<strong>{suggestion.label}</strong>
										<small>{suggestion.expression}</small>
									</span>
									<em>{suggestion.hint}</em>
								</button>
							{/each}
						{:else}
							<p>No established Atlas tag matches. Searching filenames and metadata.</p>
						{/if}
					</div>
				{/if}
			</div>
			<div class="select-control">
				<button
					class="control"
					type="button"
					aria-haspopup="menu"
					aria-expanded={controlOpen === 'sort'}
					onclick={(event) => toggleControl('sort', event)}
				>
					<span>Sort</span>
					<strong>{appState.librarySort}</strong>
					<CaretDownIcon size={14} />
				</button>
				{#if controlOpen === 'sort'}
					<div class="control-menu" role="menu" tabindex="-1" aria-label="Sort images">
						{#each ['Newest', 'Oldest', 'Title'] as option}
							<button
								type="button"
								role="menuitem"
								onclick={() => {
									setLibrarySort(option as 'Newest' | 'Oldest' | 'Title');
									controlOpen = null;
								}}
							>
								<span>{option}</span>
								{#if appState.librarySort === option}<CheckIcon size={15} />{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<div class="select-control">
				<button
					class="control"
					type="button"
					aria-haspopup="menu"
					aria-expanded={controlOpen === 'storage'}
					onclick={(event) => toggleControl('storage', event)}
				>
					<span>Show</span>
					<strong>
						{appState.libraryFilters.storageMode === 'saved'
							? 'Saved locally'
							: appState.libraryFilters.storageMode === 'bookmarked'
								? 'Bookmarked'
								: 'All'}
					</strong>
					<CaretDownIcon size={14} />
				</button>
				{#if controlOpen === 'storage'}
					<div class="control-menu" role="menu" tabindex="-1" aria-label="Filter by storage">
						{#each [{ value: 'all', label: 'All' }, { value: 'saved', label: 'Saved locally' }, { value: 'bookmarked', label: 'Bookmarked' }] as option}
							<button
								type="button"
								role="menuitem"
								onclick={() => {
									updateLibraryFilters({
										storageMode: option.value as 'all' | 'saved' | 'bookmarked'
									});
									controlOpen = null;
								}}
							>
								<span>{option.label}</span>
								{#if (appState.libraryFilters.storageMode ?? 'all') === option.value}
									<CheckIcon size={15} />
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<button class="icon-control" type="button" aria-label="Open filters" onclick={openFilter}>
				<FunnelIcon size={18} />
			</button>
			<button class="add-images" type="button" onclick={openAdd}>
				Add images <PlusIcon size={17} />
			</button>
		</div>

		{#if scope === 'folder'}
			<label class="include-children">
				<input
					type="checkbox"
					checked={appState.libraryFilters.includeSubfolders}
					onchange={(event) =>
						updateLibraryFilters({ includeSubfolders: event.currentTarget.checked })}
				/>
				<span>Include subfolders</span>
			</label>
		{/if}
	</header>

	{#if error || localError}
		<p class="status-message" role="alert">{localError ?? error}</p>
	{:else if loading}
		<p class="status-message">Loading library...</p>
	{/if}

	<div class="folder-contents" aria-label="Folder contents">
		{#if childFolders.length > 0}
			<section class="subfolders" aria-labelledby="subfolder-title">
				<div class="section-label">
					<h2 id="subfolder-title">Folders</h2>
					<span>{childFolders.length}</span>
				</div>
				<FolderCards
					folders={childFolders}
					onOpen={openLibraryFolder}
					{editMode}
					onRename={renameFolder}
					onDelete={deleteFolder}
				/>
			</section>
		{/if}

		<section class="images-section" aria-labelledby="images-title">
			<div class="section-label">
				<h2 id="images-title">Images</h2>
				<span>{visibleAssets.length.toLocaleString()}</span>
			</div>
			{#if visibleAssets.length > 0}
				<AssetGrid
					assets={visibleAssets}
					mode="library"
					{editMode}
					activeId={appState.selectedAssetId}
					selectedIds={appState.selectedAssetIds}
					onOpen={openAsset}
					onSelect={(asset) => toggleSelection(asset)}
				/>
			{:else if assets.length > 0 && !loading}
				<div class="empty-content">
					<ListMagnifyingGlassIcon size={24} />
					<div>
						<strong>No matching images</strong>
						<span>Clear the search or adjust the filters.</span>
					</div>
				</div>
			{:else if !loading}
				<div class="empty-content">
					<ImageSquareIcon size={24} />
					<div>
						<strong>No images here yet</strong>
						<span>Add images or move existing images into this folder.</span>
					</div>
				</div>
			{/if}
		</section>
	</div>

	{#if editMode && folder}
		<footer class="folder-danger">
			<button type="button" disabled={busy} onclick={() => deleteFolder(folder)}>
				<TrashIcon size={17} /> Delete folder
			</button>
			<span>Images stay in Pastiche and move to the parent location.</span>
		</footer>
	{/if}
</section>

{#if editMode && appState.selectedAssetIds.length}
	<section class="selection-bar" aria-label={`${appState.selectedAssetIds.length} selected`}>
		<strong>{appState.selectedAssetIds.length} selected</strong>
		<button
			type="button"
			disabled={!selectedAreAssigned || busy}
			onclick={() => moveSelected(null)}
		>
			<FolderIcon size={18} /> Remove from folder
		</button>
		<button type="button" disabled={busy} onclick={openMove}>
			<FolderIcon size={18} /> Move
		</button>
		<button class="danger" type="button" disabled={busy} onclick={deleteSelected}>
			<TrashIcon size={18} /> Delete from Pastiche
		</button>
		<button
			class="selection-close"
			type="button"
			aria-label="Clear selection"
			onclick={exitSelection}
		>
			<XIcon size={18} />
		</button>
	</section>
{/if}

{#if createOpen}
	<CreateOrganizationPopover
		kind="folder"
		{library}
		asset={undefined}
		anchor={createAnchor}
		onClose={() => (createOpen = false)}
		onSnapshot={setLibrarySnapshot}
	/>
{/if}

{#if moveOpen && selectedAssets[0]}
	<MoveAssetPopover
		asset={selectedAssets[0]}
		assetIds={appState.selectedAssetIds}
		{library}
		anchor={moveAnchor}
		onClose={() => (moveOpen = false)}
		onMoved={async (folderId) => {
			moveOpen = false;
			await moveSelected(folderId);
		}}
	/>
{/if}

<style>
	.folder-view {
		box-sizing: border-box;
		height: 100%;
		overflow: auto;
		overscroll-behavior: contain;
		padding: var(--space-4) var(--space-5) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.folder-header {
		display: grid;
		gap: var(--space-3);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--color-border-soft);
	}

	.breadcrumbs {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow: hidden;
		color: var(--color-dim);
		font-size: 0.72rem;
	}

	.breadcrumbs button {
		min-width: 0;
		overflow: hidden;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}

	.breadcrumbs button:hover,
	.breadcrumbs button:focus-visible {
		color: var(--color-text);
	}

	.folders-button {
		display: none;
		align-items: center;
		gap: var(--space-2);
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.title-copy {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1,
	.title-input {
		font-family: var(--font-heading);
		font-size: 2rem;
		font-weight: 600;
		line-height: 1;
	}

	.title-copy p {
		color: var(--color-muted);
		font-size: 0.76rem;
		white-space: nowrap;
	}

	.title-input {
		width: min(26rem, 50vw);
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.save-name {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.title-actions {
		display: flex;
		gap: var(--space-2);
	}

	.title-actions button,
	.add-images,
	.icon-control {
		min-height: 2.65rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.title-actions button:hover,
	.title-actions button:focus-visible,
	.title-actions button.active,
	.add-images:hover,
	.add-images:focus-visible,
	.icon-control:hover,
	.icon-control:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.browser-toolbar {
		display: grid;
		grid-template-columns: minmax(14rem, 1fr) auto auto 2.65rem auto;
		gap: var(--space-2);
	}

	.search-control {
		position: relative;
		min-width: 0;
	}

	.image-search,
	.control {
		min-height: 2.75rem;
		display: grid;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.image-search {
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-2);
		padding: 0 var(--space-3);
		color: var(--color-muted);
	}

	.image-search:focus-within,
	.control:focus-visible {
		border-color: var(--color-border-strong);
	}

	.image-search input {
		width: 100%;
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.82rem;
	}

	.search-suggestions {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		z-index: calc(var(--z-sticky) + 3);
		overflow: hidden;
		padding: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(12.5% 0.007 70 / 0.99);
		box-shadow: 0 0.9rem 2rem oklch(0% 0 0 / 0.34);
	}

	.search-suggestions button {
		width: 100%;
		min-height: 2.75rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
		padding: 0.42rem var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.search-suggestions button:hover,
	.search-suggestions button:focus-visible {
		background: var(--color-hover);
	}

	.search-suggestions button > span {
		min-width: 0;
		display: grid;
		gap: 0.12rem;
	}

	.search-suggestions strong,
	.search-suggestions small,
	.search-suggestions em {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search-suggestions strong {
		font-size: 0.78rem;
		font-weight: 560;
	}

	.search-suggestions small {
		color: var(--color-muted);
		font-size: 0.66rem;
	}

	.search-suggestions em {
		color: var(--color-dim);
		font-size: 0.64rem;
		font-style: normal;
	}

	.search-suggestions p {
		margin: 0;
		padding: var(--space-3);
		color: var(--color-muted);
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.select-control {
		position: relative;
	}

	.control {
		width: 100%;
		grid-template-columns: auto auto auto;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		color: var(--color-dim);
		font: inherit;
		font-size: 0.67rem;
		text-transform: uppercase;
		cursor: pointer;
	}

	.control strong {
		color: var(--color-text);
		font-size: 0.78rem;
		font-weight: 500;
		text-transform: none;
	}

	.control :global(svg) {
		color: var(--color-muted);
	}

	.control-menu {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: calc(var(--z-sticky) + 2);
		width: max-content;
		min-width: 10.5rem;
		overflow: hidden;
		padding: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(12.5% 0.007 70 / 0.98);
		box-shadow: 0 0.9rem 2rem oklch(0% 0 0 / 0.34);
	}

	.control-menu button {
		width: 100%;
		min-height: 2.4rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.76rem;
		text-align: left;
		cursor: pointer;
	}

	.control-menu button:hover,
	.control-menu button:focus-visible {
		background: var(--color-hover);
	}

	.icon-control {
		width: 2.65rem;
		padding: 0;
	}

	.add-images {
		color: var(--color-text);
	}

	.include-children {
		width: fit-content;
		min-height: 2.25rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.72rem;
		cursor: pointer;
	}

	.include-children input {
		accent-color: var(--color-accent);
	}

	.status-message {
		margin-top: var(--space-3);
		color: #f0a4a8;
		font-size: 0.78rem;
	}

	.folder-contents {
		display: grid;
		gap: var(--space-5);
		padding-top: var(--space-4);
	}

	.subfolders,
	.images-section {
		min-width: 0;
		display: grid;
		gap: var(--space-2);
	}

	.section-label {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.section-label h2 {
		color: var(--color-muted);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.section-label span {
		color: var(--color-dim);
		font-size: 0.68rem;
	}

	:global(.folder-view .asset-grid) {
		padding: 0;
	}

	.empty-content {
		min-height: 12rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		color: var(--color-dim);
	}

	.empty-content > div {
		display: grid;
		gap: 0.15rem;
	}

	.empty-content strong {
		color: var(--color-muted);
		font-size: 0.86rem;
	}

	.empty-content span {
		font-size: 0.74rem;
	}

	.folder-danger {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border-soft);
		color: var(--color-dim);
		font-size: 0.72rem;
	}

	.folder-danger button {
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid oklch(48% 0.08 25 / 0.5);
		border-radius: var(--radius-md);
		background: transparent;
		color: #f0a4a8;
		cursor: pointer;
	}

	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: var(--space-4);
		z-index: calc(var(--z-sticky) + 1);
		width: min(44rem, calc(100vw - 2rem));
		min-height: 4.2rem;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: oklch(10% 0.006 70 / 0.94);
		backdrop-filter: blur(18px);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.34);
		transform: translateX(-50%);
	}

	.selection-bar strong {
		min-width: 5.5rem;
		padding-inline: var(--space-2);
		font-size: 0.8rem;
	}

	.selection-bar button {
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.74rem;
		cursor: pointer;
	}

	.selection-bar button:hover,
	.selection-bar button:focus-visible {
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.selection-bar button.danger {
		color: #f0a4a8;
	}

	.selection-bar .selection-close {
		width: 2.75rem;
		padding: 0;
		margin-left: auto;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@media (max-width: 1023px) {
		.folder-view {
			padding-inline: var(--space-4);
		}

		.folders-button {
			display: inline-flex;
		}

		.browser-toolbar {
			grid-template-columns: minmax(12rem, 1fr) auto auto 2.65rem;
		}

		.add-images {
			grid-column: 4;
			grid-row: 1;
			width: 2.65rem;
			padding: 0;
			font-size: 0;
		}

		.icon-control {
			grid-column: 3;
		}

		.select-control:nth-of-type(2) {
			display: none;
		}
	}

	@media (max-width: 759px) {
		.folder-view {
			height: auto;
			min-height: 100%;
			overflow: visible;
			padding: var(--space-3) var(--space-3) calc(var(--bottom-nav-height) + var(--space-6));
		}

		.folder-header {
			gap: var(--space-2);
			padding-bottom: var(--space-3);
		}

		.title-row {
			align-items: flex-start;
		}

		.title-copy {
			display: grid;
			gap: 0.2rem;
		}

		h1,
		.title-input {
			font-size: 1.55rem;
		}

		.title-input {
			width: min(15rem, 54vw);
		}

		.title-actions button {
			width: 2.75rem;
			height: 2.75rem;
			padding: 0;
			font-size: 0;
		}

		.title-actions button :global(svg) {
			width: 18px;
			height: 18px;
		}

		.browser-toolbar {
			grid-template-columns: minmax(0, 1fr) 2.75rem 2.75rem;
		}

		.select-control {
			display: none;
		}

		.icon-control {
			grid-column: 2;
		}

		.add-images {
			grid-column: 3;
		}

		.folder-contents {
			gap: var(--space-4);
			padding-top: var(--space-3);
		}

		.selection-bar {
			bottom: calc(var(--bottom-nav-height) + var(--space-2));
			display: grid;
			grid-template-columns: 1fr 1fr 2.75rem;
			border-radius: var(--radius-lg);
		}

		.selection-bar strong {
			grid-column: 1 / span 2;
			min-width: 0;
		}

		.selection-bar button {
			padding-inline: var(--space-2);
			font-size: 0.68rem;
		}

		.selection-bar button.danger {
			grid-column: 1 / span 2;
		}

		.selection-bar .selection-close {
			grid-column: 3;
			grid-row: 1;
		}

		.folder-danger {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
