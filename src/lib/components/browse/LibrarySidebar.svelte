<script lang="ts">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwiseIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import { libraryFolders, smartFolders } from '$lib/data/mock-navigation';

	type Props = {
		collapsed?: boolean;
		path: string[];
		onPath: (path: string[]) => void;
	};

	let { collapsed = false, path, onPath }: Props = $props();

	const roots = [
		{ label: 'All Images', count: '12,842', icon: ImageSquareIcon },
		{ label: 'Favorites', count: '1,203', icon: HeartIcon },
		{ label: 'Recent', count: '842', icon: ClockCounterClockwiseIcon },
		{ label: 'Trash', count: '34', icon: TrashIcon }
	];
</script>

<aside class:collapsed class="library-sidebar" aria-label="Library folders">
	<header>
		<span><FolderIcon size={18} weight="duotone" /> Library</span>
		<button type="button" aria-label="Collapse library sidebar">
			<CaretDownIcon size={16} />
		</button>
	</header>

	<nav class="sidebar-section" aria-label="Library shortcuts">
		{#each roots as item}
			{@const Icon = item.icon}
			<button type="button">
				<Icon size={18} />
				<span>{item.label}</span>
				<small>{item.count}</small>
			</button>
		{/each}
	</nav>

	<div class="section-heading">
		<span>Folders</span>
		<button type="button" aria-label="Create folder"><PlusIcon size={15} /></button>
	</div>
	<nav class="folder-tree" aria-label="Folders">
		{#each libraryFolders as folder}
			<button
				class:active={folder.path.join('/') === path.join('/')}
				style={`--depth: ${Math.max(folder.path.length - 2, 0)}`}
				type="button"
				onclick={() => onPath(folder.path)}
			>
				<FolderIcon size={16} />
				<span>{folder.label}</span>
				<small>{folder.count.toLocaleString()}</small>
			</button>
		{/each}
	</nav>

	<div class="section-heading">
		<span>Smart Folders</span>
		<button type="button" aria-label="Create smart folder"><PlusIcon size={15} /></button>
	</div>
	<nav class="sidebar-section" aria-label="Smart folders">
		{#each smartFolders as folder}
			<button type="button">
				<span>{folder.label}</span>
				<small>{folder.count}</small>
			</button>
		{/each}
	</nav>

	<footer>
		<p>842 GB used of 1 TB</p>
		<span><i></i></span>
	</footer>
</aside>

<style>
	.library-sidebar {
		width: var(--sidebar-width);
		min-width: var(--sidebar-width);
		height: 100%;
		padding: var(--space-4);
		display: none;
		flex-direction: column;
		gap: var(--space-4);
		border-right: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.72);
		overflow: auto;
	}

	header,
	.section-heading,
	button {
		display: flex;
		align-items: center;
	}

	header {
		justify-content: space-between;
		color: var(--color-accent);
		font-weight: 700;
	}

	header span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	button {
		width: 100%;
		min-height: 2.2rem;
		gap: var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		text-align: left;
	}

	button:hover,
	button.active {
		background: var(--color-hover);
		color: var(--color-text);
	}

	button span {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button small {
		color: var(--color-dim);
		font-size: 0.78rem;
	}

	.sidebar-section,
	.folder-tree {
		display: grid;
		gap: 0.2rem;
	}

	.folder-tree button {
		padding-left: calc(var(--space-2) + var(--depth) * 1rem);
	}

	.section-heading {
		justify-content: space-between;
		margin-top: var(--space-2);
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.section-heading button,
	header button {
		width: 2rem;
		height: 2rem;
		justify-content: center;
	}

	footer {
		margin-top: auto;
		display: grid;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.82rem;
	}

	footer p {
		margin: 0;
	}

	footer span {
		height: 0.22rem;
		border-radius: var(--radius-pill);
		background: var(--color-border);
		overflow: hidden;
	}

	footer i {
		display: block;
		width: 84%;
		height: 100%;
		border-radius: inherit;
		background: var(--color-accent);
	}

	@media (min-width: 960px) {
		.library-sidebar {
			display: flex;
		}
	}
</style>
