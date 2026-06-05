<script lang="ts">
	import {
		appState,
		closeAdd,
		closeMobileInspect,
		exitSelection,
		openAdd,
		setShellScrolled,
		setMode
	} from '$lib/state/app-state.svelte';
	import AtlasWorkspace from '$lib/components/atlas/AtlasWorkspace.svelte';
	import ExploreWorkspace from '$lib/components/explore/ExploreWorkspace.svelte';
	import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
	import HomeHub from '$lib/components/home/HomeHub.svelte';
	import FocusedAssetPreview from '$lib/components/inspector/FocusedAssetPreview.svelte';
	import MobileInspect from '$lib/components/inspector/MobileInspect.svelte';
	import LibraryWorkspace from '$lib/components/library/LibraryWorkspace.svelte';
	import ModeRail from '$lib/components/shell/ModeRail.svelte';
	import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
	import TopBar from '$lib/components/shell/TopBar.svelte';
	import AddToLibrarySheet from '$lib/components/ui/AddToLibrarySheet.svelte';
	import BottomNav from '$lib/components/ui/BottomNav.svelte';
	import SelectionBar from '$lib/components/ui/SelectionBar.svelte';
	import { libraryState } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	let selectedAsset = $derived(
		libraryState.snapshot.assets.find((asset) => asset.id === appState.selectedAssetId) ?? null
	);
	let mobilePreviewAsset = $state<Asset | null>(null);
</script>

<div class="app-shell">
	<ModeRail mode={appState.mode} onSelect={setMode} />
	<div class="app-main">
		<TopBar mode={appState.mode} />
		<MobileHeader mode={appState.mode} compact={appState.shellScrolled} />
		<main
			id="main-content"
			class="workspace"
			onscroll={(event) => setShellScrolled(event.currentTarget.scrollTop > 12)}
		>
			{#if appState.mode === 'home'}
				<HomeHub />
			{:else if appState.mode === 'library'}
				<LibraryWorkspace />
			{:else if appState.mode === 'explore'}
				<ExploreWorkspace />
			{:else if appState.mode === 'atlas'}
				<AtlasWorkspace />
			{:else}
				<section class="placeholder" aria-label={`${appState.mode} workspace placeholder`}>
					<p>{appState.mode}</p>
					<h1>{appState.mode[0].toUpperCase() + appState.mode.slice(1)} workspace</h1>
					<span>This surface is wired into the shell and will be filled in the next task.</span>
				</section>
			{/if}
		</main>
	</div>
</div>

{#if appState.addOpen}
	<button class="scrim" aria-label="Close Add to Library" onclick={closeAdd}></button>
	<AddToLibrarySheet onClose={closeAdd} />
{/if}

{#if appState.mobileState === 'selecting'}
	<SelectionBar count={appState.selectedAssetIds.length} onClose={exitSelection} />
{/if}

{#if appState.mobileState === 'inspecting' && selectedAsset}
	<MobileInspect
		asset={selectedAsset}
		onClose={closeMobileInspect}
		onPreview={(asset) => (mobilePreviewAsset = asset)}
	/>
{/if}

{#if mobilePreviewAsset}
	<FocusedAssetPreview asset={mobilePreviewAsset} onClose={() => (mobilePreviewAsset = null)} />
{/if}

{#if appState.filterOpen}
	<FilterPanel />
{/if}

<BottomNav
	mode={appState.mode}
	onSelect={setMode}
	onAdd={openAdd}
	secondary={appState.mobileState === 'selecting'}
/>

<style>
	.app-shell {
		width: 100vw;
		height: 100vh;
		display: flex;
		overflow: hidden;
		background:
			radial-gradient(circle at top left, oklch(26% 0.025 75 / 0.35), transparent 28rem),
			var(--color-bg);
	}

	.app-main {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.workspace {
		min-height: 0;
		flex: 1;
		overflow: hidden;
	}

	.placeholder {
		height: 100%;
		display: grid;
		align-content: center;
		justify-items: start;
		gap: var(--space-3);
		padding: var(--space-8);
	}

	.placeholder p {
		margin: 0;
		color: var(--color-accent);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.placeholder h1 {
		margin: 0;
		font-size: clamp(2rem, 7vw, 4.5rem);
	}

	.placeholder span {
		color: var(--color-muted);
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		border: 0;
		background: oklch(0% 0 0 / 0.42);
	}

	@media (max-width: 759px) {
		.workspace {
			overflow: auto;
		}
	}
</style>
