<script lang="ts">
	import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import TagChevronIcon from 'phosphor-svelte/lib/TagChevronIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import CreateOrganizationPopover from '$lib/components/library/CreateOrganizationPopover.svelte';
	import SearchBox from '$lib/components/shell/SearchBox.svelte';
	import type { AppMode } from '$lib/types';
	import { openAdd, openFilter, setMode } from '$lib/state/app-state.svelte';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';

	type Props = {
		mode: AppMode;
	};

	let { mode }: Props = $props();
	type CreateKind = 'folder' | 'project' | 'tag' | 'tag-group';

	let createOpen = $state<CreateKind | null>(null);
	let createAnchor = $state<{ left: number; top: number } | null>(null);

	const labels: Record<AppMode, string> = {
		home: 'Home',
		library: 'Library',
		explore: 'Explore',
		canvas: 'Canvas',
		colors: 'Colors',
		resources: 'Resources'
	};

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
</script>

<header class="topbar">
	<button class="wordmark" type="button" aria-label="Pastiche Home" onclick={() => setMode('home')}>
		pastiche.
	</button>
	<div class="mode-pill">{labels[mode]}</div>
	<div class="search-slot">
		<SearchBox
			{mode}
			label={`Search ${labels[mode]}`}
			placeholder="Search artwork, artists, or collections..."
			showShortcut
		/>
	</div>
	{#if mode === 'library'}
		<div class="tool-wrap">
			<button
				class="icon-tool"
				type="button"
				aria-label="New folder"
				onclick={(event) => openCreate('folder', event)}
			>
				<FolderIcon size={20} />
			</button>
			{#if createOpen === 'folder'}
				<CreateOrganizationPopover
					kind="folder"
					library={libraryState.snapshot}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
		<div class="tool-wrap">
			<button
				class="icon-tool"
				type="button"
				aria-label="New project"
				onclick={(event) => openCreate('project', event)}
			>
				<StackIcon size={20} />
			</button>
			{#if createOpen === 'project'}
				<CreateOrganizationPopover
					kind="project"
					library={libraryState.snapshot}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
		<div class="tool-wrap">
			<button
				class="icon-tool"
				type="button"
				aria-label="New tag"
				onclick={(event) => openCreate('tag', event)}
			>
				<HashIcon size={20} />
			</button>
			{#if createOpen === 'tag'}
				<CreateOrganizationPopover
					kind="tag"
					library={libraryState.snapshot}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
		<div class="tool-wrap">
			<button
				class="icon-tool"
				type="button"
				aria-label="New tag group"
				onclick={(event) => openCreate('tag-group', event)}
			>
				<TagChevronIcon size={20} />
			</button>
			{#if createOpen === 'tag-group'}
				<CreateOrganizationPopover
					kind="tag-group"
					library={libraryState.snapshot}
					anchor={createAnchor}
					onClose={() => (createOpen = null)}
					onSnapshot={setLibrarySnapshot}
				/>
			{/if}
		</div>
	{/if}
	<button class="tool" type="button" onclick={openFilter}>
		<FunnelIcon size={20} />
		<span>Filter</span>
	</button>
	<button class="add" type="button" aria-label="Add to Library" onclick={openAdd}>
		<PlusIcon size={24} />
	</button>
</header>

<style>
	.topbar {
		display: none;
		align-items: center;
		gap: var(--space-3);
		min-height: 3.75rem;
		padding: 0.55rem var(--space-5);
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.86);
	}

	.wordmark {
		border: 0;
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-wordmark);
		font-size: 1.55rem;
		font-style: italic;
		white-space: nowrap;
		cursor: pointer;
	}

	.mode-pill,
	.tool,
	.icon-tool,
	.add {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.mode-pill {
		padding: 0.58rem 0.85rem;
		font-weight: 600;
		font-size: 0.86rem;
	}

	.search-slot {
		min-width: 16rem;
		max-width: 38rem;
		flex: 1;
	}

	.tool:hover,
	.tool:focus-visible,
	.icon-tool:hover,
	.icon-tool:focus-visible,
	.add:hover,
	.add:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.tool,
	.icon-tool,
	.add {
		height: 2.55rem;
		border: 0;
		color: var(--color-text);
		cursor: pointer;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
	}

	.tool-wrap {
		position: relative;
	}

	.icon-tool {
		width: 2.55rem;
		display: grid;
		place-items: center;
		padding: 0;
	}

	.add {
		width: 2.55rem;
		display: grid;
		place-items: center;
		border-radius: var(--radius-md);
		background: transparent;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.add {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	@media (min-width: 760px) {
		.topbar {
			display: flex;
		}
	}
</style>
