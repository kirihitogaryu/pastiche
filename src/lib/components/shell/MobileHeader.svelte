<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import TagChevronIcon from 'phosphor-svelte/lib/TagChevronIcon';
	import CreateOrganizationPopover from '$lib/components/library/CreateOrganizationPopover.svelte';
	import SearchBox from '$lib/components/shell/SearchBox.svelte';
	import type { AppMode } from '$lib/types';
	import { appState, openFilter, setMode } from '$lib/state/app-state.svelte';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';

	type Props = {
		mode: AppMode;
		compact?: boolean;
	};

	let { mode, compact = false }: Props = $props();
	let createOpen = $state<'folder' | 'project' | 'tag' | 'tag-group' | null>(null);

	let visible = $derived(mode === 'library' || mode === 'explore');
	let showSearch = $derived(mode === 'explore');
	let showBreadcrumb = $derived(false);
	let searchLabel = $derived('Search sources');
	let searchPlaceholder = $derived('Search artworks, collections, artists...');
</script>

{#if visible}
	<header class:compact={mode === 'explore' && compact} class="mobile-header">
		<div class="brand-row">
			<div class="brand-cluster">
				<button class="home-button" type="button" aria-label="Home" onclick={() => setMode('home')}>
					<HouseIcon size={17} />
				</button>
				<div class="wordmark">pastiche.</div>
			</div>
			<div class="actions">
				{#if mode === 'library'}
					<div class="action-wrap">
						<button
							type="button"
							aria-label="New folder"
							onclick={() => (createOpen = createOpen === 'folder' ? null : 'folder')}
						>
							<FolderIcon size={19} />
						</button>
						{#if createOpen === 'folder'}
							<CreateOrganizationPopover
								kind="folder"
								library={libraryState.snapshot}
								onClose={() => (createOpen = null)}
								onSnapshot={setLibrarySnapshot}
							/>
						{/if}
					</div>
					<div class="action-wrap">
						<button
							type="button"
							aria-label="New project"
							onclick={() => (createOpen = createOpen === 'project' ? null : 'project')}
						>
							<StackIcon size={19} />
						</button>
						{#if createOpen === 'project'}
							<CreateOrganizationPopover
								kind="project"
								library={libraryState.snapshot}
								onClose={() => (createOpen = null)}
								onSnapshot={setLibrarySnapshot}
							/>
						{/if}
					</div>
					<div class="action-wrap">
						<button
							type="button"
							aria-label="New tag"
							onclick={() => (createOpen = createOpen === 'tag' ? null : 'tag')}
						>
							<HashIcon size={19} />
						</button>
						{#if createOpen === 'tag'}
							<CreateOrganizationPopover
								kind="tag"
								library={libraryState.snapshot}
								onClose={() => (createOpen = null)}
								onSnapshot={setLibrarySnapshot}
							/>
						{/if}
					</div>
					<div class="action-wrap">
						<button
							type="button"
							aria-label="New tag group"
							onclick={() => (createOpen = createOpen === 'tag-group' ? null : 'tag-group')}
						>
							<TagChevronIcon size={19} />
						</button>
						{#if createOpen === 'tag-group'}
							<CreateOrganizationPopover
								kind="tag-group"
								library={libraryState.snapshot}
								onClose={() => (createOpen = null)}
								onSnapshot={setLibrarySnapshot}
							/>
						{/if}
					</div>
				{/if}
				<button type="button" aria-label="Filter" onclick={openFilter}
					><FunnelIcon size={19} /></button
				>
				<button type="button" aria-label="More"><DotsThreeIcon size={21} weight="bold" /></button>
			</div>
		</div>
		{#if showBreadcrumb}
			<div class="crumbs" aria-label="Current location">
				<span>{appState.folderPath.join(' / ')}</span>
			</div>
		{/if}
		{#if showSearch}
			<div class="search-row">
				<button
					class="home-button compact-home"
					type="button"
					aria-label="Home"
					onclick={() => setMode('home')}
				>
					<HouseIcon size={17} />
				</button>
				<SearchBox {mode} label={searchLabel} placeholder={searchPlaceholder} />
			</div>
		{/if}
	</header>
{/if}

<style>
	.mobile-header {
		display: grid;
		gap: var(--space-2);
		padding: max(var(--space-3), env(safe-area-inset-top)) var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--color-border-soft);
		transition:
			padding var(--duration-base) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.brand-row,
	.brand-cluster,
	.crumbs,
	.search-row,
	.actions {
		display: flex;
		align-items: center;
	}

	.brand-row {
		justify-content: space-between;
	}

	.brand-cluster {
		min-width: 0;
		gap: var(--space-2);
	}

	.wordmark {
		font-family: var(--font-wordmark);
		font-size: 1.6rem;
		font-style: italic;
		line-height: 1;
	}

	.actions {
		gap: var(--space-2);
	}

	.action-wrap {
		position: relative;
	}

	.action-wrap :global(.create-popover) {
		right: 0;
	}

	button {
		width: 2.35rem;
		height: 2.35rem;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-text);
		display: grid;
		place-items: center;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.home-button {
		width: 2rem;
		height: 2rem;
		background: transparent;
		color: var(--color-muted);
	}

	.home-button:focus-visible,
	.home-button:hover {
		color: var(--color-text);
		border-color: var(--color-border-strong);
	}

	.compact-home {
		display: none;
		flex: 0 0 auto;
	}

	.crumbs {
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.78rem;
		line-height: 1.2;
		overflow: hidden;
		white-space: nowrap;
	}

	.crumbs span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-row :global(.search-wrap) {
		flex: 1;
	}

	.search-row :global(.search) {
		height: 2.75rem;
		border-radius: var(--radius-xl);
		padding-inline: var(--space-3);
		gap: var(--space-2);
	}

	.mobile-header.compact {
		gap: 0;
		padding: max(0.55rem, env(safe-area-inset-top)) var(--space-3) 0.55rem;
	}

	.mobile-header.compact .brand-row,
	.mobile-header.compact .crumbs {
		display: none;
	}

	.mobile-header.compact .compact-home {
		display: grid;
	}

	.mobile-header.compact :global(.search) {
		height: 2.55rem;
	}

	@media (min-width: 760px) {
		.mobile-header {
			display: none;
		}
	}
</style>
