<script lang="ts">
	import { appState, closeAdd, openAdd, setMode } from '$lib/state/app-state.svelte';
	import BrowseWorkspace from '$lib/components/browse/BrowseWorkspace.svelte';
	import HomeHub from '$lib/components/home/HomeHub.svelte';
	import ModeRail from '$lib/components/shell/ModeRail.svelte';
	import MobileHeader from '$lib/components/shell/MobileHeader.svelte';
	import TopBar from '$lib/components/shell/TopBar.svelte';
	import BottomNav from '$lib/components/ui/BottomNav.svelte';
</script>

<div class="app-shell">
	<ModeRail mode={appState.mode} onSelect={setMode} />
	<div class="app-main">
		<TopBar mode={appState.mode} />
		<MobileHeader />
		<main id="main-content" class="workspace">
			{#if appState.mode === 'home'}
				<HomeHub />
			{:else if appState.mode === 'library' || appState.mode === 'explore'}
				<BrowseWorkspace mode={appState.mode} />
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
