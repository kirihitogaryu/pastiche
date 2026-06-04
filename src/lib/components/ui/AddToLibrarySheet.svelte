<script lang="ts">
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardTextIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import type { LibraryResponse } from '$lib/library/types';
	import { appState } from '$lib/state/app-state.svelte';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { ImportResponse } from '$lib/server/library/types';
	import {
		buildImportRequest,
		clipboardImageToFile,
		fileToImportItem,
		urlToImportItem,
		type AddToLibraryImportItem
	} from './addToLibraryImport';

	type Props = {
		onClose: () => void;
	};

	let { onClose }: Props = $props();
	let galleryInput = $state<HTMLInputElement | null>(null);
	let folderInput = $state<HTMLInputElement | null>(null);
	let importing = $state(false);
	let statusMessage = $state<string | null>(null);
	let urlOpen = $state(false);
	let urlDraft = $state('');
	let library = $derived(libraryState.snapshot);
	let currentFolderId = $derived(resolveCurrentFolderId(library));

	function resolveCurrentFolderId(source: LibraryResponse) {
		if (appState.libraryView !== 'folder') return null;
		const pathKey = appState.activeLibraryFolderPath.join('/');
		return source.folders.find((folder) => folder.path.join('/') === pathKey)?.id ?? null;
	}

	async function importFiles(files: FileList | null) {
		const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
		if (!imageFiles.length) {
			statusMessage = 'Choose at least one image file.';
			return;
		}
		await submitImportItems(await Promise.all(imageFiles.map((file) => fileToImportItem(file))));
	}

	async function importUrl() {
		if (!urlDraft.trim()) {
			statusMessage = 'Enter an image URL.';
			return;
		}
		await submitImportItems([await urlToImportItem(urlDraft)]);
		urlDraft = '';
		urlOpen = false;
	}

	async function importClipboardImage() {
		await importFiles(fileListFromFile(await clipboardImageToFile()));
	}

	async function submitImportItems(items: AddToLibraryImportItem[]) {
		if (importing) return;
		importing = true;
		statusMessage = 'Importing...';
		try {
			const response = await fetch('/api/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(buildImportRequest({ destinationFolderId: currentFolderId, items }))
			});
			const body = (await response.json()) as (ImportResponse & { error?: string }) | { error: string };
			if (!response.ok || 'error' in body) {
				throw new Error('error' in body ? body.error : 'Import failed.');
			}
			const snapshot = await loadLibrarySnapshot();
			setLibrarySnapshot(snapshot);
			statusMessage = importSummary(body);
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Import failed.';
		} finally {
			importing = false;
		}
	}

	function importSummary(result: ImportResponse) {
		const duplicates = result.imported.filter((item) => item.duplicate).length;
		const pieces = [`${result.imported.length.toLocaleString()} imported`];
		if (duplicates) pieces.push(`${duplicates.toLocaleString()} duplicates`);
		if (result.failed.length) pieces.push(`${result.failed.length.toLocaleString()} failed`);
		return pieces.join(' · ');
	}

	function fileListFromFile(file: File): FileList {
		const transfer = new DataTransfer();
		transfer.items.add(file);
		return transfer.files;
	}
</script>

<section class="add-sheet" aria-label="Add to Library">
	<i aria-hidden="true"></i>
	<header>
		<h2>Add to Library</h2>
		<p>Import images into this folder</p>
	</header>

	<input
		bind:this={galleryInput}
		class="hidden-input"
		type="file"
		accept="image/*"
		multiple
		onchange={(event) => {
			void importFiles(event.currentTarget.files);
			event.currentTarget.value = '';
		}}
	/>
	<input
		bind:this={folderInput}
		class="hidden-input"
		type="file"
		accept="image/*"
		multiple
		webkitdirectory
		onchange={(event) => {
			void importFiles(event.currentTarget.files);
			event.currentTarget.value = '';
		}}
	/>

	<div class="options">
		<button type="button" disabled={importing} onclick={() => galleryInput?.click()}>
			<ImageSquareIcon size={27} />
			<span>
				<strong>From Gallery</strong>
				<small>Choose images from your device</small>
			</span>
		</button>
		<button type="button" disabled={importing} onclick={() => folderInput?.click()}>
			<FolderIcon size={27} />
			<span>
				<strong>From Folder</strong>
				<small>Import all images from a folder</small>
			</span>
		</button>
		<button type="button" disabled={importing} onclick={() => (urlOpen = !urlOpen)}>
			<LinkIcon size={27} />
			<span>
				<strong>From URL</strong>
				<small>Import image from a web address</small>
			</span>
		</button>
		{#if urlOpen}
			<form
				class="url-form"
				onsubmit={(event) => {
					event.preventDefault();
					void importUrl();
				}}
			>
				<input bind:value={urlDraft} type="url" placeholder="https://example.com/image.jpg" />
				<button type="submit" disabled={importing || !urlDraft.trim()}>Import</button>
			</form>
		{/if}
		<button
			type="button"
			disabled={importing}
			onclick={() => {
				void importClipboardImage();
			}}
		>
			<ClipboardTextIcon size={27} />
			<span>
				<strong>Paste from Clipboard</strong>
				<small>Paste image from clipboard</small>
			</span>
		</button>
	</div>

	{#if statusMessage}
		<p class="status">{statusMessage}</p>
	{/if}

	<button class="cancel" type="button" onclick={onClose}>
		<XIcon size={22} />
		<span>Cancel</span>
	</button>
</section>

<style>
	.add-sheet {
		position: fixed;
		right: var(--space-6);
		top: calc(var(--topbar-height) + var(--space-4));
		z-index: calc(var(--z-sheet) + 1);
		width: min(24rem, calc(100vw - 2rem));
		display: grid;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(15% 0.01 70 / 0.98);
		box-shadow: 0 1.5rem 4rem oklch(0% 0 0 / 0.45);
	}

	.add-sheet > i,
	.hidden-input {
		display: none;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.15rem;
	}

	p,
	small {
		color: var(--color-muted);
	}

	.options {
		display: grid;
		gap: var(--space-2);
	}

	button,
	.url-form input {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}

	button {
		cursor: pointer;
	}

	.options > button {
		min-height: 4rem;
		display: grid;
		grid-template-columns: 2.15rem 1fr;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		text-align: left;
	}

	.options span {
		display: grid;
		gap: 0.2rem;
	}

	.options strong {
		font-weight: 650;
	}

	.options small {
		font-size: 0.82rem;
	}

	.url-form {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
	}

	.url-form input {
		min-width: 0;
		min-height: 2.4rem;
		padding: 0 var(--space-3);
	}

	.url-form button {
		min-height: 2.4rem;
		padding: 0 var(--space-3);
	}

	.status {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(18% 0.01 70 / 0.72);
		font-size: 0.84rem;
	}

	.cancel {
		justify-self: center;
		min-width: 6rem;
		min-height: 2.6rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	@media (max-width: 759px) {
		.add-sheet {
			left: var(--space-3);
			right: var(--space-3);
			top: auto;
			bottom: 0;
			width: auto;
			gap: var(--space-3);
			padding: var(--space-4) var(--space-3) max(var(--space-4), env(safe-area-inset-bottom));
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;
		}

		.add-sheet > i {
			justify-self: center;
			display: block;
			width: 3.5rem;
			height: 0.3rem;
			border-radius: var(--radius-pill);
			background: var(--color-border-strong);
		}

		.options > button {
			min-height: 3.45rem;
			padding: var(--space-2) var(--space-3);
		}
	}
</style>
