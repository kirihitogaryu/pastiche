<script lang="ts">
	import { getExtensionApi } from '../shared/browser';
	import {
		MESSAGE_GET_STATUS,
		MESSAGE_DO_IMPORT,
		MESSAGE_FETCH_IMAGE,
		MESSAGE_ITEM_READY,
		MESSAGE_BATCH_READY,
		MESSAGE_FETCH_COMPLETE,
		MESSAGE_QUEUE_UPDATED,
		MESSAGE_QUEUE_REPLAYED,
		MESSAGE_CAPTURE_TAB_IMAGE,
		MESSAGE_CONTENT_PING,
		MESSAGE_CAPTURE_ACTIVATE,
		MESSAGE_CAPTURE_ACTIVATE_LASSO,
		MESSAGE_SWEEP,
		MESSAGE_DESELECT_ITEM,
		MESSAGE_CLEAR_SELECTION
	} from '../shared/messages';
	import type { ConnectionState, EnrichedItem, ImportResult } from '../shared/types';
	import type { TabInfo } from '../shared/browser';
	import StatusBar from './components/StatusBar.svelte';
	import SelectionList from './components/SelectionList.svelte';
	import FolderDropdown from './components/FolderDropdown.svelte';
	import EmptyState from './components/EmptyState.svelte';

	const api = getExtensionApi();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let status = $state<ConnectionState | null>(null);
	let loading = $state(true);
	let items = $state<EnrichedItem[]>([]);
	let importing = $state(false);
	let importResult = $state<ImportResult | null>(null);
	let captureError = $state<string | null>(null);

	// Folder assignment
	let selectedFolderId = $state<string | null>(null);
	let createFolderName = $state('');

	// ---------------------------------------------------------------------------
	// Boot: status check + incoming message listener
	// ---------------------------------------------------------------------------

	$effect(() => {
		void reconnect();

		// Listen for messages pushed from the service worker.
		api.runtime.onMessage.addListener(handleIncomingMessage);
		return () => {
			api.runtime.onMessage.removeListener(handleIncomingMessage);
		};
	});

	function handleIncomingMessage(message: Record<string, unknown>) {
		switch (message.type) {
			case MESSAGE_ITEM_READY: {
				const item = message.item as EnrichedItem;
				// Newest at top; deduplicate by id.
				items = [item, ...items.filter((i) => i.id !== item.id)];
				break;
			}

			case MESSAGE_BATCH_READY: {
				const incoming = message.items as EnrichedItem[];
				// Add new items at top; skip any already in the list.
				const existingIds = new Set(items.map((i) => i.id));
				const fresh = incoming.filter((i) => !existingIds.has(i.id));
				items = [...fresh, ...items];
				break;
			}

			case MESSAGE_FETCH_COMPLETE: {
				const { url, ok } = message as { url: string; ok: boolean };
				items = items.map((item) => {
					if (item.url !== url) return item;
					if (ok) {
						return {
							...item,
							fetchStatus: {
								state: 'done' as const,
								base64: message.base64 as string,
								mimeType: message.mimeType as string
							}
						};
					} else {
						// Fetch failed — downgrade to url_reference so import still works.
						return {
							...item,
							storageMode: 'url_reference' as const,
							storageModeReason: 'Download failed',
							fetchStatus: { state: 'error' as const, error: message.error as string }
						};
					}
				});
				break;
			}

			case MESSAGE_QUEUE_UPDATED: {
				if (status) {
					status = { ...status, queuedCount: message.count as number };
				}
				break;
			}

			case MESSAGE_QUEUE_REPLAYED: {
				// A queued job succeeded — clear the import result banner and refresh status.
				importResult = message as unknown as ImportResult;
				void reconnect();
				break;
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Connection
	// ---------------------------------------------------------------------------

	async function reconnect() {
		loading = true;
		status = (await api.runtime.sendMessage({ type: MESSAGE_GET_STATUS })) as ConnectionState;
		loading = false;
	}

	// ---------------------------------------------------------------------------
	// Capture activation (forwards to active tab's content script via SW)
	// ---------------------------------------------------------------------------

	async function activeTab() {
		const [tab] = await api.tabs.query({ active: true, currentWindow: true });
		return tab ?? null;
	}

	async function ensureContentScript(tabId: number) {
		try {
			await api.tabs.sendMessage(tabId, { type: MESSAGE_CONTENT_PING });
			return;
		} catch {
			// Existing tabs do not receive manifest content scripts after extension reload.
		}

		if (!api.scripting) throw new Error('Content script injection is unavailable.');
		await api.scripting.executeScript({
			target: { tabId },
			files: ['content/index.js']
		});
		await api.tabs.sendMessage(tabId, { type: MESSAGE_CONTENT_PING });
	}

	async function captureActiveTabImage(tab: TabInfo) {
		if (!tab.url) throw new Error('No active tab URL found.');
		const result = (await api.runtime.sendMessage({
			type: MESSAGE_CAPTURE_TAB_IMAGE,
			url: tab.url,
			pageTitle: tab.title ?? null
		})) as { ok?: boolean; error?: string };
		if (!result?.ok) throw new Error(result?.error ?? 'Active tab is not a selectable image.');
	}

	async function sendActiveTabMessage(
		message: Record<string, unknown>,
		options: { directImageFallback?: boolean } = {}
	) {
		const tab = await activeTab();
		if (!tab?.id) {
			captureError = 'No active tab found.';
			return;
		}

		try {
			await ensureContentScript(tab.id);
			await api.tabs.sendMessage(tab.id, message);
			captureError = null;
		} catch (error) {
			if (options.directImageFallback) {
				try {
					await captureActiveTabImage(tab);
					captureError = null;
					return;
				} catch (fallbackError) {
					console.error(fallbackError);
					captureError =
						fallbackError instanceof Error
							? fallbackError.message
							: 'Could not capture this page as an image.';
					return;
				}
			}
			console.error(error);
			captureError =
				error instanceof Error
					? error.message
					: 'Could not talk to this page. Refresh the tab and try again.';
		}
	}

	async function activateSingleCapture() {
		await sendActiveTabMessage({ type: MESSAGE_CAPTURE_ACTIVATE }, { directImageFallback: true });
	}

	async function captureCurrentTabImage() {
		const tab = await activeTab();
		if (!tab) {
			captureError = 'No active tab found.';
			return;
		}

		try {
			await captureActiveTabImage(tab);
			captureError = null;
		} catch (error) {
			console.error(error);
			captureError =
				error instanceof Error ? error.message : 'Could not capture this tab as an image.';
		}
	}

	async function activateLasso() {
		await sendActiveTabMessage(
			{ type: MESSAGE_CAPTURE_ACTIVATE_LASSO },
			{ directImageFallback: true }
		);
	}

	async function runSweep() {
		await sendActiveTabMessage(
			{
				type: MESSAGE_SWEEP,
				minDimension: 300
			},
			{ directImageFallback: true }
		);
	}

	// ---------------------------------------------------------------------------
	// Selection management
	// ---------------------------------------------------------------------------

	async function removeItem(id: string) {
		const item = items.find((i) => i.id === id);
		if (!item) return;

		items = items.filter((i) => i.id !== id);

		// Tell the content script to remove the badge from the page element.
		await sendActiveTabMessage({ type: MESSAGE_DESELECT_ITEM, url: item.url });
	}

	async function clearAll() {
		items = [];
		await sendActiveTabMessage({ type: MESSAGE_CLEAR_SELECTION });
	}

	function renameItem(id: string, name: string) {
		items = items.map((i) => (i.id === id ? { ...i, suggestedName: name } : i));
	}

	function toggleStorageMode(id: string) {
		items = items.map((item) => {
			if (item.id !== id) return item;
			// Cycle: url_reference ↔ download (lazy_download → download for override)
			const next = item.storageMode === 'url_reference' ? 'download' : 'url_reference';
			return {
				...item,
				storageMode: next,
				storageModeReason: next === 'download' ? 'Manual override' : 'Manual override',
				fetchStatus:
					next === 'download' ? { state: 'fetching' as const } : { state: 'idle' as const }
			};
		});

		// If we just switched to download, kick off the fetch via SW.
		const toggled = items.find((i) => i.id === id);
		if (toggled?.storageMode === 'download' && toggled.fetchStatus.state === 'fetching') {
			void api.runtime.sendMessage({ type: MESSAGE_FETCH_IMAGE, url: toggled.url });
		}
	}

	// ---------------------------------------------------------------------------
	// Import
	// ---------------------------------------------------------------------------

	const canImport = $derived(
		items.length > 0 &&
			!importing &&
			status?.connected === true &&
			// All download-mode items must have resolved (done or error — error
			// falls back to url_reference so that's fine too).
			items.every(
				(i) =>
					i.storageMode !== 'download' ||
					i.fetchStatus.state === 'done' ||
					i.fetchStatus.state === 'error'
			)
	);

	const importButtonLabel = $derived(() => {
		if (importing) return 'Importing…';
		const n = items.length;
		if (n === 0) return 'Import images';
		return `Import ${n} image${n === 1 ? '' : 's'}`;
	});

	async function doImport() {
		if (!canImport) return;
		importing = true;
		importResult = null;

		const result = (await api.runtime.sendMessage({
			type: MESSAGE_DO_IMPORT,
			payload: {
				destinationFolderId: selectedFolderId,
				createFolderName: createFolderName.trim() || undefined,
				items
			}
		})) as ImportResult;

		importing = false;
		importResult = result;

		if (result.ok) {
			// Remove successfully imported items from the list.
			const successIndexes = new Set(result.imported.map((r) => r.index));
			items = items.filter((_, i) => !successIndexes.has(i));

			// Clear badges for removed items.
			const [tab] = await api.tabs.query({ active: true, currentWindow: true });
			if (tab?.id && items.length === 0) {
				await sendActiveTabMessage({ type: MESSAGE_CLEAR_SELECTION });
			}

			// Refresh status so unassigned count updates.
			void reconnect();
		}
	}

	// ---------------------------------------------------------------------------
	// Settings
	// ---------------------------------------------------------------------------

	function openSettings() {
		api.runtime.openOptionsPage?.();
	}
</script>

<main>
	<!-- Status bar — always visible at top -->
	<StatusBar {status} {loading} onreconnect={reconnect} onsettings={openSettings} />

	<!-- Capture toolbar -->
	{#if status?.connected}
		<div class="capture-bar">
			<button
				class="capture-btn"
				type="button"
				onclick={activateSingleCapture}
				title="Single-click capture"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="3" />
					<path d="M3 12h2M19 12h2M12 3v2M12 19v2" />
					<path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4" />
				</svg>
				Click
			</button>
			<button
				class="capture-btn"
				type="button"
				onclick={captureCurrentTabImage}
				title="Capture active tab image"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<rect x="3" y="5" width="18" height="14" rx="2" />
					<circle cx="8" cy="10" r="1.5" />
					<path d="M21 16l-5-5L5 19" />
				</svg>
				Tab
			</button>
			<button class="capture-btn" type="button" onclick={activateLasso} title="Lasso selection">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M4 7c0-1.1 3.6-3 8-3s8 1.9 8 3-3.6 3-8 3-8-1.9-8-3z" />
					<path d="M4 7v10c0 1.1 3.6 3 8 3 1.4 0 2.7-.2 3.8-.5" />
					<path d="M12 17l4 4 6-6" />
				</svg>
				Lasso
			</button>
			<button class="capture-btn" type="button" onclick={runSweep} title="Sweep all images on page">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
				Sweep
			</button>
			{#if items.length > 0}
				<button class="clear-btn" type="button" onclick={clearAll}>Clear all</button>
			{/if}
		</div>
	{/if}

	{#if captureError}
		<div class="capture-error">{captureError}</div>
	{/if}

	<!-- Selection list or empty state -->
	{#if items.length > 0}
		<SelectionList
			{items}
			onremove={removeItem}
			onrename={renameItem}
			onoverridemodetoggle={toggleStorageMode}
		/>
	{:else}
		<EmptyState connected={status?.connected ?? false} onsweep={runSweep} />
	{/if}

	<!-- Folder assignment + import (only when there's something to import) -->
	{#if items.length > 0}
		<div class="bottom">
			<FolderDropdown
				folders={status?.recentFolders ?? []}
				selected={selectedFolderId}
				createName={createFolderName}
				onselect={(id) => (selectedFolderId = id)}
				oncreatenamechange={(name) => (createFolderName = name)}
			/>

			<div class="import-row">
				<button class="import-btn" type="button" disabled={!canImport} onclick={doImport}>
					{importButtonLabel()}
				</button>
			</div>

			<!-- Per-item import results -->
			{#if importResult}
				<div class="result-banner" class:result-error={!importResult.ok}>
					{#if importResult.ok}
						{importResult.imported.length} imported
						{#if importResult.failed.length}
							· {importResult.failed.length} failed
						{/if}
					{:else}
						{importResult.error ?? 'Import failed'}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background: #1d1914;
		color: #eee7dc;
		font-family: Montserrat, system-ui, sans-serif;
		font-size: 13px;
		-webkit-font-smoothing: antialiased;
	}

	main {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Capture toolbar */
	.capture-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 7px 10px;
		border-bottom: 1px solid rgb(255 255 255 / 8%);
		flex-shrink: 0;
	}

	.capture-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: #28231d;
		border: 1px solid rgb(255 255 255 / 12%);
		border-radius: 5px;
		color: #aaa196;
		font-size: 11px;
		font-family: inherit;
		padding: 5px 8px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.capture-btn:hover {
		background: #312b24;
		color: #eee7dc;
		border-color: rgb(255 255 255 / 20%);
	}

	.clear-btn {
		margin-left: auto;
		background: none;
		border: none;
		color: #6b6258;
		font-size: 11px;
		font-family: inherit;
		cursor: pointer;
		padding: 4px 6px;
	}

	.clear-btn:hover {
		color: #e06c75;
	}

	.capture-error {
		padding: 7px 12px;
		border-bottom: 1px solid rgb(224 108 117 / 24%);
		color: #e06c75;
		font-size: 11px;
		line-height: 1.35;
		background: rgb(224 108 117 / 9%);
		flex-shrink: 0;
	}

	/* Bottom zone */
	.bottom {
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding: 10px 0;
		border-top: 1px solid rgb(255 255 255 / 8%);
		flex-shrink: 0;
	}

	.import-row {
		padding: 0 12px;
	}

	.import-btn {
		width: 100%;
		padding: 10px;
		background: #b67aff;
		border: none;
		border-radius: 6px;
		color: #0f0c0a;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		letter-spacing: 0.01em;
	}

	.import-btn:hover:not(:disabled) {
		background: #c48fff;
	}

	.import-btn:disabled {
		background: #28231d;
		color: #6b6258;
		cursor: not-allowed;
		border: 1px solid rgb(255 255 255 / 10%);
	}

	/* Result banner */
	.result-banner {
		padding: 4px 12px;
		font-size: 11px;
		color: #98c379;
	}

	.result-banner.result-error {
		color: #e06c75;
	}
</style>
