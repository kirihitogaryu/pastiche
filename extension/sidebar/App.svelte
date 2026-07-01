<script lang="ts">
	import { getExtensionApi } from '../shared/browser';
	import {
		MESSAGE_GET_STATUS,
		MESSAGE_GET_CAPTURE_TRAY,
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
		MESSAGE_CAPTURE_VISIBLE_TAB,
		MESSAGE_CONTENT_PING,
		MESSAGE_CAPTURE_ACTIVATE,
		MESSAGE_CAPTURE_ACTIVATE_LASSO,
		MESSAGE_SWEEP,
		MESSAGE_DESELECT_ITEM,
		MESSAGE_CLEAR_SELECTION,
		MESSAGE_STAGE_DROPPED_URL,
		MESSAGE_ITEM_CAPTURED
	} from '../shared/messages';
	import type {
		CaptureTrayResponse,
		ConnectionState,
		EnrichedItem,
		ImportResult
	} from '../shared/types';
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
	import {
		CAPTURE_TRAY_STORAGE_KEY,
		captureTrayItemsFromStorage,
		mergeCaptureTrayItem,
		mergeCaptureTrayItems,
		removeCaptureTrayItem,
		removeCaptureTrayIndexes
	} from '../shared/capture-tray';
	import {
		selectCandidateForItem,
		selectInstagramLargeCandidateForItem,
		updateItemMetadata,
		updateSelectedItemId
	} from './item-state';
	import type { CaptureCommandId } from './capture-commands';
	import {
		captureNoticeForCommandStart,
		captureNoticeForSweepResult,
		captureNoticeFromError,
		type CaptureNotice
	} from './capture-status';
	import { shouldSurfaceContentScriptError } from './capture-maintenance';
	import {
		capturedPayloadForDroppedImageFile,
		droppedImageFileFromDataTransfer,
		droppedImageUrlFromDataTransfer
	} from './drop-import';

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
	let captureNotice = $state<CaptureNotice | null>(null);
	let importNotificationTimer: ReturnType<typeof setTimeout> | null = null;
	let captureNoticeTimer: ReturnType<typeof setTimeout> | null = null;
	let trayPollTimer: ReturnType<typeof setInterval> | null = null;
	let dropActive = $state(false);
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
		api.storage.onChanged?.addListener(handleStorageChanged);
		trayPollTimer = setInterval(() => {
			void refreshCaptureTray();
		}, 1000);
		return () => {
			api.runtime.onMessage.removeListener(handleIncomingMessage);
			api.storage.onChanged?.removeListener(handleStorageChanged);
			if (importNotificationTimer) clearTimeout(importNotificationTimer);
			if (captureNoticeTimer) clearTimeout(captureNoticeTimer);
			if (trayPollTimer) clearInterval(trayPollTimer);
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
				items = mergeCaptureTrayItem(items, item);
				selectedItemId = item.id;
				captureError = null;
				showCaptureNotice(
					{
						tone: 'success',
						title: 'Image added',
						detail: item.metadata.title
					},
					{ autoDismiss: true }
				);
				void persistCaptureTray(items);
				break;
			}

			case MESSAGE_BATCH_READY: {
				const incoming = message.items as EnrichedItem[];
				items = mergeCaptureTrayItems(items, incoming);
				if (incoming[0]) selectedItemId = incoming[0].id;
				captureError = null;
				if (incoming.length > 0) {
					showCaptureNotice(
						captureNoticeForSweepResult({
							found: incoming.length,
							delivered: incoming.length
						}),
						{ autoDismiss: true }
					);
				}
				void persistCaptureTray(items);
				break;
			}

			case MESSAGE_FETCH_COMPLETE: {
				const { url, ok } = message as { url: string; ok: boolean };
				const next = items.map((item) => {
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
				items = next;
				void persistCaptureTray(next);
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
				const error =
					typeof message.error === 'string'
						? message.error
						: 'Could not add that image to the capture tray.';
				captureError = null;
				showCaptureNotice(captureNoticeFromError(error));
				break;
			}
		}
	}

	function handleStorageChanged(
		changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
		areaName: string
	) {
		if (areaName !== 'local' || !(CAPTURE_TRAY_STORAGE_KEY in changes)) return;
		const next = captureTrayItemsFromStorage(changes[CAPTURE_TRAY_STORAGE_KEY].newValue);
		applyCaptureTrayItems(next);
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

	function showCaptureNotice(notice: CaptureNotice, options: { autoDismiss?: boolean } = {}) {
		if (captureNoticeTimer) {
			clearTimeout(captureNoticeTimer);
			captureNoticeTimer = null;
		}
		captureNotice = notice;
		if (options.autoDismiss) {
			captureNoticeTimer = setTimeout(() => {
				captureNotice = null;
				captureNoticeTimer = null;
			}, 6500);
		}
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

	async function restoreCaptureTray() {
		await refreshCaptureTray();
	}

	async function refreshCaptureTray(): Promise<EnrichedItem[]> {
		try {
			const response = (await api.runtime.sendMessage({
				type: MESSAGE_GET_CAPTURE_TRAY
			})) as CaptureTrayResponse | { ok?: false; error?: string };
			if (response?.ok) {
				applyCaptureTrayItems(response.items);
				return response.items;
			}
		} catch {
			// Fall through to direct storage read for older or waking service workers.
		}

		const stored = await api.storage.local.get([CAPTURE_TRAY_STORAGE_KEY]);
		const next = captureTrayItemsFromStorage(stored[CAPTURE_TRAY_STORAGE_KEY]);
		applyCaptureTrayItems(next);
		return next;
	}

	function applyCaptureTrayItems(next: EnrichedItem[]) {
		const hadItems = items.length > 0;
		if (sameItemList(items, next)) return;
		items = next;
		selectedItemId = updateSelectedItemId(selectedItemId, next);
		if (hadItems && next.length === 0) captureNotice = null;
	}

	async function persistCaptureTray(next: EnrichedItem[]) {
		await api.storage.local.set({ [CAPTURE_TRAY_STORAGE_KEY]: next });
	}

	function sameItemList(left: EnrichedItem[], right: EnrichedItem[]) {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	// ---------------------------------------------------------------------------
	// Connection
	// ---------------------------------------------------------------------------

	async function reconnect() {
		loading = true;
		status = (await api.runtime.sendMessage({ type: MESSAGE_GET_STATUS })) as ConnectionState;
		loading = false;
		await restoreCaptureTray();
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
		await refreshCaptureTray();
	}

	async function sendActiveTabMessage(
		message: Record<string, unknown>,
		options: { directImageFallback?: boolean; surfaceErrors?: boolean } = {}
	): Promise<Record<string, unknown> | null> {
		const tab = await activeTab();
		const surfaceErrors = options.surfaceErrors !== false;
		if (!tab?.id) {
			if (surfaceErrors) captureError = 'No active tab found.';
			return null;
		}

		try {
			await ensureContentScript(tab.id);
			const response = (await api.tabs.sendMessage(tab.id, message)) as
				| Record<string, unknown>
				| undefined;
			captureError = null;
			setTimeout(() => void refreshCaptureTray(), 250);
			return response ?? null;
		} catch (error) {
			if (options.directImageFallback) {
				try {
					await captureActiveTabImage(tab);
					captureError = null;
					return { ok: true, fallback: true };
				} catch (fallbackError) {
					console.error(fallbackError);
					captureError =
						fallbackError instanceof Error
							? fallbackError.message
							: 'Could not capture this page as an image.';
					return null;
				}
			}
			console.error(error);
			const messageType = typeof message.type === 'string' ? message.type : '';
			if (
				!surfaceErrors ||
				!shouldSurfaceContentScriptError({
					messageType,
					error
				})
			) {
				return null;
			}
			captureError =
				error instanceof Error
					? error.message
					: 'Could not talk to this page. Refresh the tab and try again.';
			return null;
		}
	}

	async function activateSingleCapture() {
		showCaptureNotice(captureNoticeForCommandStart('pick'));
		await sendActiveTabMessage({ type: MESSAGE_CAPTURE_ACTIVATE }, { directImageFallback: true });
	}

	async function captureCurrentTabImage() {
		showCaptureNotice(captureNoticeForCommandStart('tab'));
		const tab = await activeTab();
		if (!tab) {
			captureError = 'No active tab found.';
			return;
		}

		try {
			await captureActiveTabImage(tab);
			captureError = null;
			showCaptureNotice(
				{ tone: 'success', title: 'Image added', detail: 'Current tab image is staged.' },
				{ autoDismiss: true }
			);
		} catch (error) {
			console.error(error);
			captureError =
				error instanceof Error ? error.message : 'Could not capture this tab as an image.';
			showCaptureNotice(captureNoticeFromError(captureError));
		}
	}

	async function captureVisibleTab() {
		showCaptureNotice(captureNoticeForCommandStart('visible'));
		const tab = await activeTab();
		if (!tab?.url) {
			captureError = 'No active tab found.';
			return;
		}

		try {
			const result = (await api.runtime.sendMessage({
				type: MESSAGE_CAPTURE_VISIBLE_TAB,
				pageUrl: tab.url,
				pageTitle: tab.title ?? null,
				windowId: tab.windowId
			})) as { ok?: boolean; error?: string };
			if (!result?.ok) throw new Error(result?.error ?? 'Could not capture the visible viewport.');
			captureError = null;
			await refreshCaptureTray();
			showCaptureNotice(
				{ tone: 'success', title: 'Visible area captured', detail: 'Viewport capture is staged.' },
				{ autoDismiss: true }
			);
		} catch (error) {
			console.error(error);
			captureError =
				error instanceof Error ? error.message : 'Could not capture the visible viewport.';
			showCaptureNotice(captureNoticeFromError(captureError));
		}
	}

	async function activateLasso() {
		showCaptureNotice(captureNoticeForCommandStart('area'));
		await sendActiveTabMessage(
			{ type: MESSAGE_CAPTURE_ACTIVATE_LASSO },
			{ directImageFallback: true }
		);
	}

	async function runSweep() {
		showCaptureNotice(captureNoticeForCommandStart('batch'));
		const response = await sendActiveTabMessage(
			{
				type: MESSAGE_SWEEP,
				minDimension: 300
			},
			{ directImageFallback: true }
		);
		if (response && typeof response.found === 'number') {
			showCaptureNotice(
				captureNoticeForSweepResult({
					found: response.found,
					delivered: typeof response.delivered === 'number' ? response.delivered : 0
				}),
				{ autoDismiss: Number(response.delivered ?? 0) > 0 }
			);
			await refreshCaptureTray();
		}
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
			case 'visible':
				void captureVisibleTab();
				break;
		}
	}

	// ---------------------------------------------------------------------------
	// Selection management
	// ---------------------------------------------------------------------------

	async function removeItem(id: string) {
		const item = items.find((i) => i.id === id);
		if (!item) return;

		items = removeCaptureTrayItem(items, id);
		selectedItemId = updateSelectedItemId(selectedItemId === id ? null : selectedItemId, items);
		await persistCaptureTray(items);

		// Tell the content script to remove the badge from the page element.
		await sendActiveTabMessage(
			{ type: MESSAGE_DESELECT_ITEM, url: item.url },
			{ surfaceErrors: false }
		);
	}

	async function clearAll() {
		items = [];
		selectedItemId = null;
		captureNotice = null;
		await persistCaptureTray([]);
		await sendActiveTabMessage({ type: MESSAGE_CLEAR_SELECTION }, { surfaceErrors: false });
	}

	function renameItem(id: string, name: string) {
		items = updateItemMetadata(items, id, { title: name });
		void persistCaptureTray(items);
	}

	function selectItem(id: string) {
		selectedItemId = id;
	}

	function selectCandidate(itemId: string, candidateId: string) {
		items = selectCandidateForItem(items, itemId, candidateId);
		void persistCaptureTray(items);
		fetchSelectedDownloadCandidate(itemId);
	}

	function selectInstagramLargeCandidate(itemId: string) {
		items = selectInstagramLargeCandidateForItem(items, itemId);
		void persistCaptureTray(items);
		fetchSelectedDownloadCandidate(itemId);
	}

	function fetchSelectedDownloadCandidate(itemId: string) {
		const changed = items.find((item) => item.id === itemId);
		if (changed?.storageMode === 'download' && changed.fetchStatus.state === 'fetching') {
			void api.runtime.sendMessage({ type: MESSAGE_FETCH_IMAGE, url: changed.url });
		}
	}

	function updateMetadata(itemId: string, patch: Partial<CaptureMetadata>) {
		items = updateItemMetadata(items, itemId, patch);
		void persistCaptureTray(items);
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
		void persistCaptureTray(items);
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
		void persistCaptureTray(items);

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
			items = removeCaptureTrayIndexes(items, successIndexes);
			selectedItemId = updateSelectedItemId(selectedItemId, items);
			await persistCaptureTray(items);

			// Clear badges for removed items.
			const [tab] = await api.tabs.query({ active: true, currentWindow: true });
			if (tab?.id && items.length === 0) {
				await sendActiveTabMessage({ type: MESSAGE_CLEAR_SELECTION }, { surfaceErrors: false });
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

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dropActive = true;
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function handleDragLeave(event: DragEvent) {
		if (event.currentTarget === event.target) dropActive = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dropActive = false;
		const transfer = event.dataTransfer;
		if (!transfer) return;

		const tab = await activeTab();
		const sourceUrl = tab?.url ?? 'pastiche://dropped-image';
		const pageTitle = tab?.title ?? 'Dropped image';

		try {
			const file = droppedImageFileFromDataTransfer(transfer);
			if (file) {
				const item = await capturedPayloadForDroppedImageFile(file, { sourceUrl, pageTitle });
				const response = (await api.runtime.sendMessage({
					type: MESSAGE_ITEM_CAPTURED,
					item
				})) as { ok?: boolean; error?: string };
				if (!response?.ok) throw new Error(response?.error ?? 'Dropped image could not be staged.');
				captureError = null;
				showCaptureNotice(
					{ tone: 'success', title: 'Image added', detail: file.name },
					{ autoDismiss: true }
				);
				await refreshCaptureTray();
				return;
			}

			const imageUrl = droppedImageUrlFromDataTransfer(transfer);
			if (!imageUrl) throw new Error('Drop an image file or image URL.');

			const response = (await api.runtime.sendMessage({
				type: MESSAGE_STAGE_DROPPED_URL,
				imageUrl,
				sourceUrl,
				pageTitle
			})) as { ok?: boolean; error?: string };
			if (!response?.ok) throw new Error(response?.error ?? 'Dropped URL could not be staged.');
			captureError = null;
			showCaptureNotice(
				{ tone: 'success', title: 'Image added', detail: imageUrl },
				{ autoDismiss: true }
			);
			await refreshCaptureTray();
		} catch (error) {
			console.error(error);
			captureError = error instanceof Error ? error.message : 'Dropped image could not be staged.';
			showCaptureNotice(captureNoticeFromError(captureError));
		}
	}
</script>

<main
	class:drop-active={dropActive}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if dropActive}
		<div class="drop-overlay" aria-hidden="true">Drop image to stage</div>
	{/if}

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

	<div class="scroll-region">
		{#if captureNotice}
			<div class={`capture-notice ${captureNotice.tone}`} aria-live="polite">
				<span class={`notice-dot ${captureNotice.tone}`}></span>
				<div>
					<strong>{captureNotice.title}</strong>
					<span>{captureNotice.detail}</span>
				</div>
			</div>
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
				onselectinstagramlarge={selectInstagramLargeCandidate}
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
	</div>

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

	:global(:root) {
		color-scheme: dark;
		--ext-bg: oklch(13% 0.01 70);
		--ext-panel: oklch(16% 0.01 70);
		--ext-panel-soft: oklch(18% 0.01 70);
		--ext-control: oklch(21% 0.012 70);
		--ext-control-hover: oklch(25% 0.012 70);
		--ext-selected: oklch(27% 0.018 74);
		--ext-border: oklch(100% 0 0 / 0.11);
		--ext-border-soft: oklch(100% 0 0 / 0.07);
		--ext-border-strong: oklch(100% 0 0 / 0.2);
		--ext-text: oklch(90% 0.01 75);
		--ext-muted: oklch(70% 0.012 75);
		--ext-dim: oklch(55% 0.012 75);
		--ext-subtle: oklch(45% 0.012 75);
		--ext-accent: oklch(78% 0.08 78);
		--ext-accent-strong: oklch(83% 0.1 78);
		--ext-accent-soft: oklch(78% 0.08 78 / 0.12);
		--ext-danger: oklch(62% 0.18 28);
		--ext-danger-soft: oklch(62% 0.18 28 / 0.12);
		--ext-success: oklch(72% 0.12 150);
		--ext-success-soft: oklch(72% 0.12 150 / 0.12);
		--ext-warning: oklch(76% 0.08 78);
		--ext-warning-soft: oklch(76% 0.08 78 / 0.12);
		--ext-radius-sm: 4px;
		--ext-radius-md: 6px;
		--ext-radius-lg: 8px;
	}

	:global(body) {
		margin: 0;
		background: var(--ext-bg);
		color: var(--ext-text);
		font-family: Montserrat, system-ui, sans-serif;
		font-size: 13px;
		-webkit-font-smoothing: antialiased;
		scrollbar-width: thin;
		scrollbar-color: oklch(62% 0.006 75 / 0.42) transparent;
	}

	main {
		height: 100vh;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--ext-bg);
	}

	main.drop-active {
		outline: 1px solid var(--ext-accent);
		outline-offset: -1px;
	}

	.drop-overlay {
		position: absolute;
		inset: 8px;
		z-index: 30;
		display: grid;
		place-items: center;
		border: 1px dashed oklch(78% 0.08 78 / 0.62);
		border-radius: var(--ext-radius-lg);
		background: oklch(10% 0.008 70 / 0.82);
		color: var(--ext-accent-strong);
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0;
		pointer-events: none;
	}

	.scroll-region {
		min-height: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		scrollbar-gutter: stable;
	}

	.scroll-region::-webkit-scrollbar {
		width: 6px;
	}

	.scroll-region::-webkit-scrollbar-track {
		background: transparent;
	}

	.scroll-region::-webkit-scrollbar-thumb {
		border-radius: 999px;
		background: oklch(62% 0.006 75 / 0.36);
	}

	.capture-error {
		padding: 7px 12px;
		border-bottom: 1px solid oklch(62% 0.18 28 / 0.24);
		color: var(--ext-danger);
		font-size: 11px;
		line-height: 1.35;
		background: var(--ext-danger-soft);
		flex-shrink: 0;
	}

	.import-notification {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 9px;
		margin: 10px 12px 0;
		padding: 10px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-lg);
		background: var(--ext-panel-soft);
		flex-shrink: 0;
	}

	.capture-notice {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 9px;
		margin: 10px 12px 0;
		padding: 10px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-lg);
		background: var(--ext-panel-soft);
		flex-shrink: 0;
	}

	.capture-notice.success {
		border-color: oklch(72% 0.12 150 / 0.28);
		background: var(--ext-success-soft);
	}

	.capture-notice.warning {
		border-color: oklch(76% 0.08 78 / 0.28);
		background: var(--ext-warning-soft);
	}

	.capture-notice.error {
		border-color: oklch(62% 0.18 28 / 0.28);
		background: var(--ext-danger-soft);
	}

	.notice-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ext-dim);
	}

	.notice-dot.working {
		background: var(--ext-warning);
		animation: pulse 1s ease-in-out infinite;
	}

	.notice-dot.success {
		background: var(--ext-success);
	}

	.notice-dot.warning {
		background: var(--ext-warning);
	}

	.notice-dot.error {
		background: var(--ext-danger);
	}

	.capture-notice div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.capture-notice strong {
		color: var(--ext-text);
		font-size: 12px;
		font-weight: 600;
	}

	.capture-notice span:not(.notice-dot) {
		min-width: 0;
		color: var(--ext-muted);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.import-notification.notification-error {
		border-color: oklch(62% 0.18 28 / 0.28);
		background: var(--ext-danger-soft);
	}

	.notification-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ext-dim);
	}

	.notification-dot.working {
		background: var(--ext-warning);
		animation: pulse 1s ease-in-out infinite;
	}

	.notification-dot.success {
		background: var(--ext-success);
	}

	.notification-dot.queued {
		background: var(--ext-accent);
	}

	.notification-dot.error {
		background: var(--ext-danger);
	}

	.import-notification div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.import-notification strong {
		color: var(--ext-text);
		font-size: 12px;
		font-weight: 600;
	}

	.import-notification span:not(.notification-dot) {
		min-width: 0;
		color: var(--ext-muted);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.import-notification button {
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: var(--ext-radius-sm);
		background: transparent;
		color: var(--ext-dim);
		cursor: pointer;
		font: inherit;
	}

	.import-notification button:hover {
		background: var(--ext-control-hover);
		color: var(--ext-text);
	}

	/* Bottom zone */
	.bottom {
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding: 10px 0;
		border-top: 1px solid var(--ext-border-soft);
		flex-shrink: 0;
	}

	.import-row {
		padding: 0 12px;
	}

	.import-btn {
		width: 100%;
		padding: 9px 10px;
		background: var(--ext-accent);
		border: none;
		border-radius: var(--ext-radius-md);
		color: var(--ext-bg);
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		letter-spacing: 0.01em;
	}

	.import-btn:hover:not(:disabled) {
		background: var(--ext-accent-strong);
	}

	.import-btn:disabled {
		background: var(--ext-control);
		color: var(--ext-dim);
		cursor: not-allowed;
		border: 1px solid var(--ext-border);
	}

	/* Result banner */
	.result-banner {
		padding: 4px 12px;
		font-size: 11px;
		color: var(--ext-success);
	}

	.result-banner.result-error {
		color: var(--ext-danger);
	}
</style>
