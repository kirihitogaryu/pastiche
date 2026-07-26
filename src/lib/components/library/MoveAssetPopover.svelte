<script lang="ts">
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import type { LibraryAsset, LibraryResponse } from '$lib/library/types';
	import { replaceLibraryAsset } from '$lib/state/library-state.svelte';
	import type { LibraryFolder } from '$lib/types';
	import { buildFolderTree, type FolderTreeNode } from './libraryOverviewModel';

	type Props = {
		asset: { id: string; title: string; record?: { organization: { folderId: string | null } } };
		library: LibraryResponse;
		assetIds?: string[];
		anchor?: { left: number; top: number } | null;
		onClose: () => void;
		onMoved?: (folderId: string | null) => void | Promise<void>;
	};

	let { asset, library, assetIds = [], anchor = null, onClose, onMoved }: Props = $props();
	let movingTo = $state<string | null | undefined>(undefined);
	let error = $state<string | null>(null);
	let popoverElement = $state<HTMLElement | null>(null);
	let canDismiss = $state(false);

	let folders = $derived(buildFolderTree(library.folders));
	let currentFolderId = $derived(asset.record?.organization.folderId ?? null);
	let popoverStyle = $derived(
		anchor ? `--popover-left: ${anchor.left}px; --popover-top: ${anchor.top}px;` : ''
	);

	$effect(() => {
		canDismiss = false;
		const frame = requestAnimationFrame(() => {
			canDismiss = true;
		});
		return () => cancelAnimationFrame(frame);
	});

	async function moveTo(folderId: string | null) {
		if (movingTo !== undefined) return;
		movingTo = folderId;
		error = null;
		try {
			if (assetIds.length && onMoved) {
				await onMoved(folderId);
				return;
			}
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ folder_id: folderId })
			});
			const body = (await response.json()) as { error?: string; asset?: LibraryAsset };
			if (!response.ok || !body.asset) {
				throw new Error(body.error ?? 'Asset could not be moved.');
			}
			replaceLibraryAsset(body.asset);
			onClose();
		} catch (moveError) {
			error = moveError instanceof Error ? moveError.message : 'Asset could not be moved.';
		} finally {
			movingTo = undefined;
		}
	}

	function flatFolders(nodes: FolderTreeNode[]): FolderTreeNode[] {
		return nodes.flatMap((node) => [node, ...flatFolders(node.children)]);
	}

	function folderLabel(folder: LibraryFolder) {
		return folder.path.slice(1).join(' / ') || folder.name;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
	onclick={(event) => {
		if (
			canDismiss &&
			popoverElement &&
			event.target instanceof Node &&
			!popoverElement.contains(event.target)
		) {
			onClose();
		}
	}}
/>

<section
	bind:this={popoverElement}
	class="move-popover"
	style={popoverStyle}
	aria-label={`Move ${asset.title}`}
>
	<header>
		<FolderIcon size={18} />
		<strong>{assetIds.length > 1 ? `Move ${assetIds.length} images` : 'Move to folder'}</strong>
	</header>

	<div class="folder-list">
		<button class:active={currentFolderId === null} type="button" onclick={() => moveTo(null)}>
			<span class="folder-name">Unassigned</span>
			{#if currentFolderId === null}
				<CheckIcon size={16} />
			{/if}
		</button>
		{#each flatFolders(folders) as folder (folder.id)}
			<button
				class:active={currentFolderId === folder.id}
				type="button"
				style={`--indent: ${folder.depth * 0.85}rem`}
				onclick={() => moveTo(folder.id)}
			>
				<span class="folder-name">{folderLabel(folder)}</span>
				<small>{folder.assetCount.toLocaleString()} assets</small>
				{#if currentFolderId === folder.id}
					<CheckIcon size={16} />
				{/if}
			</button>
		{/each}
	</div>

	{#if error}
		<p>{error}</p>
	{/if}
</section>

<style>
	.move-popover {
		position: fixed;
		top: var(--popover-top, calc(var(--topbar-height) + var(--space-3)));
		left: var(--popover-left, calc(100vw - 22rem));
		z-index: calc(var(--z-toast) + 1);
		width: min(21rem, calc(100vw - var(--space-6)));
		max-height: min(28rem, calc(100dvh - var(--space-8)));
		overflow: auto;
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(13% 0.008 70 / 0.98);
		box-shadow: 0 1rem 2.4rem oklch(0% 0 0 / 0.32);
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.folder-list {
		display: grid;
		gap: var(--space-1);
	}

	button {
		min-height: 2.35rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		padding-left: calc(var(--space-3) + var(--indent, 0rem));
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible,
	button.active {
		border-color: var(--color-border);
		background: var(--color-surface);
	}

	.folder-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small,
	p {
		color: var(--color-muted);
	}

	p {
		margin: 0;
		color: #f0a4a8;
		font-size: 0.78rem;
	}

	@media (max-width: 759px) {
		.move-popover {
			top: auto;
			left: var(--space-3);
			right: var(--space-3);
			bottom: calc(var(--bottom-nav-height) + var(--space-3));
			width: auto;
			max-height: 58dvh;
		}
	}
</style>
