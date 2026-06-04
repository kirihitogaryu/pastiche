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
		gap: 0.15rem;
	}

	.depth-0 {
		--indent: 0rem;
		--row-height: 2.8rem;
		--font-size: 1rem;
	}

	.depth-1 {
		--indent: 1.55rem;
		--row-height: 2.45rem;
		--font-size: 0.93rem;
	}

	.depth-2 {
		--indent: 2.95rem;
		--row-height: 2.35rem;
		--font-size: 0.88rem;
	}

	.folder-row {
		position: relative;
		min-width: 0;
		display: grid;
		grid-template-columns: 1.65rem 1fr;
		padding-left: var(--indent);
	}

	.folder-row.depth-1::before,
	.folder-row.depth-2::before {
		content: '';
		position: absolute;
		left: calc(var(--indent) - 1.05rem);
		top: -0.35rem;
		bottom: 50%;
		width: 0.8rem;
		border-left: 1px solid var(--color-border-soft);
		border-bottom: 1px solid var(--color-border-soft);
		border-bottom-left-radius: var(--radius-sm);
		pointer-events: none;
		opacity: 0.9;
	}

	.folder-toggle,
	.folder-spacer {
		width: 1.65rem;
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
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.depth-0 .folder-open {
		border-color: var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(18% 0.01 70 / 0.52);
	}

	.depth-1 .folder-open,
	.depth-2 .folder-open {
		color: oklch(83% 0.015 70);
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
