<script lang="ts">
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import AssetInspector from '$lib/components/inspector/AssetInspector.svelte';
	import FocusedAssetPreview from '$lib/components/inspector/FocusedAssetPreview.svelte';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import { appState, closeInspector, toggleLibrarySidebar } from '$lib/state/app-state.svelte';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';
	import FolderContents from './FolderContents.svelte';
	import LibrarySidebar from './LibrarySidebar.svelte';

	let library = $derived(libraryState.snapshot);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let previewAsset = $state<Asset | null>(null);
	let drawerOpen = $state(false);
	let selectedAsset = $derived(
		library.assets.find((asset) => asset.id === appState.selectedAssetId) ?? null
	);
	let showInspector = $derived(appState.inspectorOpen && Boolean(selectedAsset));

	$effect(() => {
		let cancelled = false;
		loading = true;
		error = null;
		void loadLibrarySnapshot()
			.then((snapshot) => {
				if (cancelled) return;
				setLibrarySnapshot(snapshot);
			})
			.catch((loadError) => {
				if (cancelled) return;
				error = loadError instanceof Error ? loadError.message : 'Library could not be loaded.';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	async function deleteAsset(asset: Asset) {
		if (!window.confirm(`Delete “${asset.title}” from Pastiche? This cannot be undone.`)) return;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
				method: 'DELETE'
			});
			if (!response.ok && response.status !== 404) {
				throw new Error('Asset could not be deleted.');
			}
			setLibrarySnapshot(await loadLibrarySnapshot());
			closeInspector();
			error = null;
		} catch (deleteError) {
			error = deleteError instanceof Error ? deleteError.message : 'Asset could not be deleted.';
		}
	}

	function openFolders() {
		if (window.matchMedia('(max-width: 1023px)').matches) {
			drawerOpen = true;
			return;
		}
		if (appState.librarySidebarCollapsed) toggleLibrarySidebar();
	}
</script>

<div class:inspector-open={showInspector} class="library-workspace">
	{#if !appState.librarySidebarCollapsed}
		<div class="desktop-sidebar">
			<LibrarySidebar {library} onClose={toggleLibrarySidebar} />
		</div>
	{:else}
		<button
			class="restore-sidebar"
			type="button"
			aria-label="Open folder browser"
			onclick={toggleLibrarySidebar}
		>
			<CaretRightIcon size={18} />
		</button>
	{/if}

	<div class="library-content">
		{#if appState.libraryView === 'folder'}
			<FolderContents scope="folder" {library} {loading} {error} onOpenFolders={openFolders} />
		{:else if appState.libraryView === 'project'}
			<FolderContents scope="project" {library} {loading} {error} onOpenFolders={openFolders} />
		{:else if appState.libraryView === 'smart'}
			<FolderContents scope="smart" {library} {loading} {error} onOpenFolders={openFolders} />
		{:else if appState.libraryView === 'tag'}
			<FolderContents scope="tag" {library} {loading} {error} onOpenFolders={openFolders} />
		{:else}
			<FolderContents scope="all" {library} {loading} {error} onOpenFolders={openFolders} />
		{/if}
	</div>

	{#if showInspector}
		<AssetInspector
			asset={selectedAsset}
			onClose={closeInspector}
			onDelete={deleteAsset}
			onPreview={(asset) => (previewAsset = asset)}
		/>
	{/if}
</div>

{#if drawerOpen}
	<button
		class="drawer-scrim"
		type="button"
		aria-label="Close folder browser"
		onclick={() => (drawerOpen = false)}
	></button>
	<LibrarySidebar drawer {library} onClose={() => (drawerOpen = false)} />
{/if}

{#if previewAsset}
	<FocusedAssetPreview asset={previewAsset} onClose={() => (previewAsset = null)} />
{/if}

<style>
	.library-workspace {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		display: flex;
	}

	.desktop-sidebar {
		height: 100%;
	}

	.library-content {
		min-width: 0;
		flex: 1;
		height: 100%;
	}

	.restore-sidebar {
		position: absolute;
		top: var(--space-4);
		left: 0;
		z-index: var(--z-sticky);
		width: 2.4rem;
		height: 2.8rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border);
		border-left: 0;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		background: oklch(12% 0.006 70 / 0.94);
		color: var(--color-muted);
		cursor: pointer;
	}

	.restore-sidebar:hover,
	.restore-sidebar:focus-visible {
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.drawer-scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		border: 0;
		background: oklch(0% 0 0 / 0.58);
		backdrop-filter: blur(2px);
	}

	@media (max-width: 1023px) {
		.desktop-sidebar,
		.restore-sidebar {
			display: none;
		}
	}

	@media (max-width: 759px) {
		.library-workspace {
			display: block;
			height: auto;
			min-height: 100%;
		}

		.library-content {
			height: auto;
			min-height: 100%;
		}
	}
</style>
