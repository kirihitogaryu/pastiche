<script lang="ts">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import FolderTree from './FolderTree.svelte';
	import type { FolderTreeNode } from './libraryOverviewModel';

	type Props = {
		nodes: FolderTreeNode[];
		expanded: Set<string>;
		onToggle: (id: string) => void;
		onOpen: (node: FolderTreeNode) => void;
	};

	let { nodes, expanded, onToggle, onOpen }: Props = $props();
</script>

<div class="folder-tree">
	{#each nodes as node (node.id)}
		<div class="folder-row depth-{Math.min(node.depth, 2)}">
			{#if node.children.length}
				<button
					class="folder-toggle"
					type="button"
					aria-label={`Toggle ${node.name}`}
					onclick={() => onToggle(node.id)}
				>
					{#if expanded.has(node.id)}
						<CaretDownIcon size={16} />
					{:else}
						<CaretRightIcon size={16} />
					{/if}
				</button>
			{:else}
				<span class="folder-spacer"></span>
			{/if}
			<button class="folder-open" type="button" onclick={() => onOpen(node)}>
				<FolderIcon size={18} />
				<span>{node.name}</span>
				<small>{node.assetCount.toLocaleString()}</small>
			</button>
		</div>
		{#if node.children.length && expanded.has(node.id)}
			<FolderTree nodes={node.children} {expanded} {onToggle} {onOpen} />
		{/if}
	{/each}
</div>

<style>
	.folder-tree {
		display: grid;
		gap: var(--space-1);
	}

	.depth-0 {
		--indent: 0rem;
		--row-height: 3rem;
		--font-size: 1rem;
	}

	.depth-1 {
		--indent: 1.35rem;
		--row-height: 2.75rem;
		--font-size: 0.93rem;
	}

	.depth-2 {
		--indent: 2.35rem;
		--row-height: 2.55rem;
		--font-size: 0.88rem;
	}

	.folder-row {
		min-width: 0;
		display: grid;
		grid-template-columns: 2rem 1fr;
		padding-left: var(--indent);
	}

	.folder-toggle,
	.folder-spacer {
		width: 2rem;
		min-height: var(--row-height);
		display: grid;
		place-items: center;
	}

	.folder-toggle {
		border: 0;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.folder-open {
		min-width: 0;
		min-height: var(--row-height);
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.folder-open:hover,
	.folder-open:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.folder-open span {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.folder-open small {
		color: var(--color-muted);
		font-size: 0.85em;
	}
</style>
