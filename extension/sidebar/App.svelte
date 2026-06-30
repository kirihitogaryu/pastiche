<script lang="ts">
	import { getExtensionApi } from '../shared/browser';
	import {
		MESSAGE_GET_STATUS,
		MESSAGE_DO_IMPORT,
		MESSAGE_FETCH_IMAGE,
		MESSAGE_ITEM_READY,
		MESSAGE_BATCH_READY,
		MESSAGE_FETCH_COMPLETE,
		MESSAGE_CONTEXT_IMPORT_STARTED,
		MESSAGE_CONTEXT_IMPORT_FINISHED,
		MESSAGE_CAPTURE_FAILED,
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
	import type { CaptureMetadata, CaptureSource } from '../shared/candidates';
	import StatusBar from './components/StatusBar.svelte';
	import SelectionList from './components/SelectionList.svelte';
	import FolderDropdown from './components/FolderDropdown.svelte';
	import EmptyState from './components/EmptyState.svelte';
	import SelectedItemInspector from './components/SelectedItemInspector.svelte';
	import CaptureCommandStrip from './components/CaptureCommandStrip.svelte';
	import {
		CONTEXT_IMPORT_NOTIFICATION_KEY,
		importNotificationFromMessage,
		importNotificationFromResult,
		recentStoredImportNotification,
		type ImportNotification
	} from '../shared/import-notification';
	import { selectCandidateForItem, updateItemMetadata, updateSelectedItemId } from './item-state';
	import type { CaptureCommandId } from './capture-commands';

	const api = getExtensionApi();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let status = $state<ConnectionState | null>(null);
	let loading = $state(true);
	let items = $state<EnrichedItem[]>([]);
	let selectedItemId = $state<string | null>(null);
	let importing = $state(false);
	let importResult = $state<ImportResult | null>(null);
	let importNotification = $state<ImportNotification | null>(null);
	let captureError = $state<string | null>(null);
	let importNotificationTimer: ReturnType<typeof setTimeout> | null = null;
	const shownStoredImportNotificationIds = new Set<string>();

	// Folder assignment
	let selectedFolderId = $state<string | null>(null);
	let createFolderName = $state('');
	const selectedItem = $derived(items.find((item) => item.id === selectedItemId) ?? null);

	// ---------------------------------------------------------------------------
	// Boot: status check + incoming message listener
	// ---------------------------------------------------------------------------

	$effect(() => {
		void reconnect();

		// Listen for messages pushed from the service worker.
		api.runtime.onMessage.addListener(handleIncomingMessage);
		return () => {
			api.runtime.onMessage.removeListener(handleIncomingMessage);
			if (importNotificationTimer) clearTimeout(importNotificationTimer);
		};
	});

	$effect(() => {
		const next = updateSelectedItemId(selectedItemId, items);
		if (next !== selectedItemId) selectedItemId = next;
	});

	function handleIncomingMessage(message: Record<string, unknown>) {
		switch (message.type) {
			case MESSAGE_ITEM_READY: {
				const item = message.item as EnrichedItem;
				// Newest at top; deduplicate by id.
				items = [item, ...items.filter((i) => i.id !== item.id)];
				selectedItemId = item.id;
				break;
			}

			case MESSAGE_BATCH_READY: {
				const incoming = message.items as EnrichedItem[];
				// Add new items at top; skip any already in the list.
				const existingIds = new Set(items.map((i) => i.id));
				const fresh = incoming.filter((i) => !existingIds.has(i.id));
				items = [...fresh, ...items];
				if (fresh[0]) selectedItemId = fresh[0].id;
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

			case MESSAGE_CONTEXT_IMPORT_STARTED: {
				showImportNotification(
					importNotificationFromMessage({
						type: MESSAGE_CONTEXT_IMPORT_STARTED,
						sourceImageUrl: message.sourceImageUrl as string
					})
				);
				break;
			}

			case MESSAGE_CONTEXT_IMPORT_FINISHED: {
				const result = message.result as ImportResult;
				importResult = result;
				showImportNotification(
					importNotificationFromMessage({
						type: MESSAGE_CONTEXT_IMPORT_FINISHED,
						result
					})
				);
				void reconnect();
				break;
			}

			case MESSAGE_CAPTURE_FAILED: {
				captureError =
					typeof message.error === 'string'
						? message.error
						: 'Could not add that image to the capture tray.';
				break;
			}
		}
	}

	function showImportNotification(notification: ImportNotification) {
		if (importNotificationTimer) {
			clearTimeout(importNotificationTimer);
			importNotificationTimer = null;
		}
		importNotification = notification;
		if (notification.state !== 'working') {
			importNotificationTimer = setTimeout(() => {
				importNotification = null;
				importNotificationTimer = null;
			}, 6500);
		}
	}

	function dismissImportNotification() {
		if (importNotificationTimer) {
			clearTimeout(importNotificationTimer);
			importNotificationTimer = null;
		}
		importNotification = null;
		void api.storage.local.set({ [CONTEXT_IMPORT_NOTIFICATION_KEY]: null });
	}

	async function restoreStoredImportNotification() {
		const stored = await api.storage.local.get([CONTEXT_IMPORT_NOTIFICATION_KEY]);
		const notification = recentStoredImportNotification(stored[CONTEXT_IMPORT_NOTIFICATION_KEY]);
		if (
			!notification ||
			shownStoredImportNotificationIds.has(notification.id) ||
			importNotification
		) {
			return;
		}

		shownStoredImportNotificationIds.add(notification.id);
		showImportNotification(notification);
	}

	// ---------------------------------------------------------------------------
	// Connection
	// ---------------------------------------------------------------------------

	async function reconnect() {
		loading = true;
		status = (await api.runtime.sendMessage({ type: MESSAGE_GET_STATUS })) as ConnectionState;
		loading = false;
		await restoreStoredImportNotification();
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

	function runCaptureCommand(command: CaptureCommandId) {
		switch (command) {
			case 'pick':
				void activateSingleCapture();
				break;
			case 'tab':
				void captureCurrentTabImage();
				break;
			case 'area':
				void activateLasso();
				break;
			case 'batch':
				void runSweep();
				break;
		}
	}

	// ---------------------------------------------------------------------------
	// Selection management
	// ---------------------------------------------------------------------------

	async function removeItem(id: string) {
		const item = items.find((i) => i.id === id);
		if (!item) return;

		items = items.filter((i) => i.id !== id);
		selectedItemId = updateSelectedItemId(selectedItemId === id ? null : selectedItemId, items);

		// Tell the content script to remove the badge from the page element.
		await sendActiveTabMessage({ type: MESSAGE_DESELECT_ITEM, url: item.url });
	}

	async function clearAll() {
		items = [];
		selectedItemId = null;
		await sendActiveTabMessage({ type: MESSAGE_CLEAR_SELECTION });
	}

	function renameItem(id: string, name: string) {
		items = updateItemMetadata(items, id, { title: name });
	}

	function selectItem(id: string) {
		selectedItemId = id;
	}

	function selectCandidate(itemId: string, candidateId: string) {
		items = selectCandidateForItem(items, itemId, candidateId);
		const changed = items.find((item) => item.id === itemId);
		if (changed?.storageMode === 'download' && changed.fetchStatus.state === 'fetching') {
			void api.runtime.sendMessage({ type: MESSAGE_FETCH_IMAGE, url: changed.url });
		}
	}

	function updateMetadata(itemId: string, patch: Partial<CaptureMetadata>) {
		items = updateItemMetadata(items, itemId, patch);
	}

	function updateSource(itemId: string, patch: Partial<CaptureSource>) {
		items = items.map((item) => {
			if (item.id !== itemId) return item;
			const source = { ...item.source, ...patch };
			return {
				...item,
				source,
				sourceUrl: source.canonicalPageUrl ?? source.pageUrl
			};
		});
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
		showImportNotification(importNotificationFromResult(result));

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
		<CaptureCommandStrip
			oncommand={runCaptureCommand}
			onclear={() => void clearAll()}
			showClear={items.length > 0}
		/>
	{/if}

	{#if captureError}
		<div class="capture-error">{captureError}</div>
	{/if}

	{#if importNotification}
		<div
			class="import-notification"
			class:notification-error={importNotification.state === 'error'}
		>
			<span class={`notification-dot ${importNotification.state}`}></span>
			<div>
				<strong>{importNotification.title}</strong>
				<span>{importNotification.detail}</span>
			</div>
			<button
				type="button"
				aria-label="Dismiss import notification"
				onclick={dismissImportNotification}>×</button
			>
		</div>
	{/if}

	<!-- Selection list or empty state -->
	{#if items.length > 0}
		<SelectedItemInspector
			item={selectedItem}
			onselectcandidate={selectCandidate}
			onmetadatachange={updateMetadata}
			onsourcechange={updateSource}
		/>
		<SelectionList
			{items}
			{selectedItemId}
			onselect={selectItem}
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

	.capture-error {
		padding: 7px 12px;
		border-bottom: 1px solid rgb(224 108 117 / 24%);
		color: #e06c75;
		font-size: 11px;
		line-height: 1.35;
		background: rgb(224 108 117 / 9%);
		flex-shrink: 0;
	}

	.import-notification {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 9px;
		margin: 10px 12px 0;
		padding: 10px;
		border: 1px solid rgb(255 255 255 / 10%);
		border-radius: 7px;
		background: #28231d;
		box-shadow: 0 10px 28px rgb(0 0 0 / 22%);
		flex-shrink: 0;
	}

	.import-notification.notification-error {
		border-color: rgb(224 108 117 / 28%);
		background: rgb(224 108 117 / 9%);
	}

	.notification-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #8f7765;
	}

	.notification-dot.working {
		background: #d0a85c;
		animation: pulse 1s ease-in-out infinite;
	}

	.notification-dot.success {
		background: #98c379;
	}

	.notification-dot.queued {
		background: #b67aff;
	}

	.notification-dot.error {
		background: #e06c75;
	}

	.import-notification div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.import-notification strong {
		color: #eee7dc;
		font-size: 12px;
		font-weight: 600;
	}

	.import-notification span:not(.notification-dot) {
		min-width: 0;
		color: #8f7765;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.import-notification button {
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: #8f7765;
		cursor: pointer;
		font: inherit;
	}

	.import-notification button:hover {
		background: rgb(255 255 255 / 7%);
		color: #eee7dc;
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
