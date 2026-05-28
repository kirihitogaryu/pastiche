/**
 * background/service-worker.ts
 *
 * The extension's MV3 service worker. Single entry point for all background
 * work — Pastiche communication, image fetching, import, offline queue.
 *
 * Message routing (onMessage):
 *   PASTICHE_GET_STATUS      → getPasticheStatus()
 *   PASTICHE_SMOKE_IMPORT    → smokeImport()
 *   PASTICHE_ITEM_CAPTURED   → handleItemCaptured()
 *   PASTICHE_SWEEP_RESULTS   → handleBatchCaptured()
 *   PASTICHE_LASSO_RESULTS   → handleBatchCaptured()
 *   PASTICHE_DO_IMPORT       → handleDoImport()
 *   PASTICHE_RETRY_ITEM      → handleRetryItem()
 *
 * Offline queue:
 *   - Jobs serialised to chrome.storage.local under key QUEUE_STORAGE_KEY.
 *   - Drained automatically after every successful getPasticheStatus() call.
 *   - Sidebar is notified via MESSAGE_QUEUE_UPDATED on every change.
 */

import { getSettings } from '../shared/settings';
import { getExtensionApi } from '../shared/browser';
import { computeSourceHash, sourceKeyForUrls } from '../shared/source-hash';
import { normalizeImageQualityUrl, resolveCanonicalImage } from './canonical-image';
import { policyForSource } from './storage-policy';
import {
	MESSAGE_GET_STATUS,
	MESSAGE_SMOKE_IMPORT,
	MESSAGE_CAPTURE_TAB_IMAGE,
	MESSAGE_ITEM_CAPTURED,
	MESSAGE_SWEEP_RESULTS,
	MESSAGE_LASSO_RESULTS,
	MESSAGE_CAPTURE_ACTIVATE,
	MESSAGE_DO_IMPORT,
	MESSAGE_RETRY_ITEM,
	MESSAGE_FETCH_IMAGE,
	MESSAGE_ITEM_READY,
	MESSAGE_BATCH_READY,
	MESSAGE_FETCH_COMPLETE,
	MESSAGE_QUEUE_UPDATED,
	MESSAGE_QUEUE_REPLAYED
} from '../shared/messages';
import type {
	ConnectionState,
	SmokeImportResponse,
	ExtensionMessage,
	CapturedItemPayload,
	EnrichedItem,
	ImportJobPayload,
	ImportResult,
	ImportItemResult,
	QueuedJob,
	FetchStatus,
	StatusApiResponse
} from '../shared/types';

const api = getExtensionApi();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

api.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
	// Firefox / older Chromium — sidePanel API not yet available.
});

// ---------------------------------------------------------------------------
// Keyboard command handler
// ---------------------------------------------------------------------------

// Handles the "activate-capture" command declared in manifest commands.
// Forwards to the active tab's content script to enter single-click mode.
// On Firefox, browser.sidebarAction.open() is called first so the sidebar
// is visible before the crosshair cursor appears.
api.commands.onCommand.addListener((command) => {
	if (command !== 'activate-capture') return;
	void (async () => {
		const [tab] = await api.tabs.query({ active: true, currentWindow: true });
		if (!tab?.id) return;
		await api.tabs.sendMessage(tab.id, { type: MESSAGE_CAPTURE_ACTIVATE });
	})();
});

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

api.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	void handleMessage(message as ExtensionMessage).then(sendResponse);
	return true; // Keep channel open for async response.
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
	switch (message.type) {
		case MESSAGE_GET_STATUS:
			return getPasticheStatus();

		case MESSAGE_SMOKE_IMPORT:
			return smokeImport();

		case MESSAGE_CAPTURE_TAB_IMAGE:
			return handleTabImageCaptured(message.url, message.pageTitle);

		case MESSAGE_ITEM_CAPTURED:
			return handleItemCaptured(message.item);

		case MESSAGE_SWEEP_RESULTS:
		case MESSAGE_LASSO_RESULTS:
			return handleBatchCaptured(message.items);

		case MESSAGE_DO_IMPORT:
			return handleDoImport(message.payload);

		case MESSAGE_RETRY_ITEM:
			return handleRetryItem(message.item, message.destinationFolderId);

		case MESSAGE_FETCH_IMAGE: {
			const { url } = message as { type: string; url: string };
			if (!url) return { ok: false, error: 'No URL provided' };
			// Fire-and-forget — result delivered via MESSAGE_FETCH_COMPLETE.
			void fetchImageForUrl(url);
			return { ok: true };
		}

		default:
			return { ok: false, error: 'Unknown message' };
	}
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

async function getPasticheStatus(): Promise<ConnectionState> {
	const settings = await getSettings();
	try {
		const response = await fetch(`http://localhost:${settings.pastichePort}/api/status`, {
			signal: AbortSignal.timeout(2000)
		});
		if (!response.ok) throw new Error('Pastiche is offline.');

		const status = (await response.json()) as StatusApiResponse;
		const importedSources = status.imported_sources ?? [];
		await updateLibraryIndex(importedSources.map((source) => source.source_hash));

		const queued = await getQueuedJobs();
		const state: ConnectionState = {
			connected: true,
			offline: false,
			queuedCount: queued.length,
			unassignedCount: status.unassigned_count,
			recentFolders: status.recent_folders,
			importedSources
		};

		await api.storage.local.set({ lastStatus: state });

		// Pastiche is reachable — drain the offline queue.
		if (queued.length > 0) {
			void drainQueue(settings.pastichePort);
		}

		return state;
	} catch {
		const cached = await api.storage.local.get(['lastStatus']);
		const lastStatus = cached.lastStatus as ConnectionState | undefined;
		const queued = await getQueuedJobs();
		return (
			lastStatus ?? {
				connected: false,
				offline: true,
				queuedCount: queued.length,
				unassignedCount: 0,
				recentFolders: [],
				importedSources: []
			}
		);
	}
}

// ---------------------------------------------------------------------------
// Smoke import (settings page verification)
// ---------------------------------------------------------------------------

async function smokeImport(): Promise<SmokeImportResponse> {
	const settings = await getSettings();
	try {
		const response = await fetch(`http://localhost:${settings.pastichePort}/api/import`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				destination_folder_id: null,
				items: [
					{
						filename: 'Pastiche extension smoke test',
						storage_mode: 'url_reference',
						image_data: null,
						source_image_url: 'https://example.com/pastiche-extension-smoke.jpg',
						mime_type: 'image/jpeg',
						natural_width: 800,
						natural_height: 600,
						source_url: 'https://example.com/pastiche-extension-smoke',
						page_title: 'Pastiche extension smoke test',
						alt_text: null,
						captured_at: new Date().toISOString()
					}
				]
			})
		});
		if (!response.ok) return { ok: false, error: 'Import failed' };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Import failed' };
	}
}

// ---------------------------------------------------------------------------
// Capture handling
// ---------------------------------------------------------------------------

/**
 * Single item captured from a page. Enrich it (policy, name inference,
 * optional immediate fetch) then notify the sidebar.
 */
async function handleItemCaptured(captured: CapturedItemPayload): Promise<{ ok: boolean }> {
	const item = await enrichItem(captured);

	// Notify sidebar immediately so it can show the item (possibly with a
	// loading spinner if the fetch is still in flight).
	broadcastToSidebar({ type: MESSAGE_ITEM_READY, item });

	// For download-mode items, kick off the fetch now (after notifying the
	// sidebar so the spinner appears without waiting for the full fetch).
	if (item.storageMode === 'download' && item.fetchStatus.state === 'fetching') {
		void fetchImageForItem(item);
	}

	return { ok: true };
}

/**
 * Batch of items from sweep or lasso. Enrich all, notify sidebar, then fetch
 * any download-mode items.
 */
async function handleBatchCaptured(captured: CapturedItemPayload[]): Promise<{ ok: boolean }> {
	const items = await Promise.all(captured.map(enrichItem));

	broadcastToSidebar({ type: MESSAGE_BATCH_READY, items });

	// Fire fetches for download items without blocking the response.
	for (const item of items) {
		if (item.storageMode === 'download' && item.fetchStatus.state === 'fetching') {
			void fetchImageForItem(item);
		}
	}

	return { ok: true };
}

/**
 * Direct image documents (for example a pbs.twimg.com/media URL opened in a
 * tab) do not always have a page DOM that content scripts can inspect. Capture
 * those from the service worker by treating the active tab URL as the image.
 */
async function handleTabImageCaptured(
	tabUrl: string,
	pageTitle: string | null
): Promise<{ ok: boolean; error?: string }> {
	const imageUrl = normalizeImageQualityUrl(tabUrl);

	try {
		const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const blob = await response.blob();
		const mimeType = blob.type || mimeTypeFromUrl(imageUrl);
		if (!mimeType?.startsWith('image/')) {
			throw new Error('Active tab is not an image URL.');
		}

		const dimensions = await dimensionsForImageBlob(blob);
		const base64 = await blobToBase64(blob);

		return handleItemCaptured({
			url: imageUrl,
			detailUrl: null,
			naturalWidth: dimensions.width,
			naturalHeight: dimensions.height,
			mimeType,
			inlineData: `data:${mimeType};base64,${base64}`,
			altText: null,
			sourceUrl: tabUrl,
			pageTitle: pageTitle ?? tabUrl,
			capturedAt: new Date().toISOString()
		});
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'Active tab is not a selectable image.'
		};
	}
}

// ---------------------------------------------------------------------------
// Item enrichment
// ---------------------------------------------------------------------------

/**
 * Turn a raw CapturedItemPayload (from the content script) into an
 * EnrichedItem with storage policy applied and name inferred.
 */
async function enrichItem(captured: CapturedItemPayload): Promise<EnrichedItem> {
	const canonical = captured.inlineData
		? { url: captured.url, detailUrl: captured.detailUrl, candidates: [captured.url] }
		: await resolveCanonicalImage({
				imageUrl: captured.url,
				detailUrl: captured.detailUrl
			});
	const resolvedUrl = canonical.url;
	const previewUrl = resolvedUrl === captured.url ? null : captured.url;
	const policy = policyForSource(resolvedUrl);
	const storageMode = captured.inlineData ? 'download' : policy.mode;
	const storageModeReason = captured.inlineData ? 'Captured image bytes' : policy.reason;
	const sourceHash = await computeSourceHash(sourceKeyForUrls(resolvedUrl, captured.sourceUrl));
	const id = sourceHash;

	// Check the library index for duplicates (best-effort — status cache only).
	// A proper check happens server-side at import time.
	const alreadyInLibrary = await checkDuplicate(sourceHash);

	// Name inference: alt text → page title → fallback to domain
	const suggestedName =
		captured.altText?.trim() ||
		captured.pageTitle?.trim() ||
		hostnameFrom(captured.sourceUrl) ||
		'Untitled';

	// If inline data is already present (canvas/video frame) we don't need a
	// fetch — treat it as a completed download.
	let fetchStatus: FetchStatus;
	if (captured.inlineData) {
		const mimeType = captured.mimeType ?? 'image/png';
		// Strip the data URL prefix to get raw base64.
		const base64 = captured.inlineData.replace(/^data:[^;]+;base64,/, '');
		fetchStatus = { state: 'done', base64, mimeType };
	} else if (policy.mode === 'download') {
		// Will be fetched — start as 'fetching' so sidebar shows spinner.
		fetchStatus = { state: 'fetching' };
	} else {
		fetchStatus = { state: 'idle' };
	}

	return {
		id,
		url: resolvedUrl,
		previewUrl,
		naturalWidth: captured.naturalWidth,
		naturalHeight: captured.naturalHeight,
		mimeType: captured.mimeType,
		altText: captured.altText,
		suggestedName,
		sourceUrl: captured.sourceUrl,
		pageTitle: captured.pageTitle,
		capturedAt: captured.capturedAt,
		storageMode,
		storageModeReason,
		fetchStatus,
		destinationFolderId: null,
		alreadyInLibrary
	};
}

// ---------------------------------------------------------------------------
// Background image fetch (download-mode items)
// ---------------------------------------------------------------------------

/**
 * Fetch image bytes for a download-mode item in the service worker context.
 * Converts to base64, then notifies the sidebar via MESSAGE_FETCH_COMPLETE.
 *
 * Per spec rule 2: image fetching must happen here, never in the content
 * script (memory pressure / lifecycle) or via Pastiche's local server
 * (CORS failures on CDN images).
 *
 * CDN tokens expire — we fetch immediately on capture, not lazily.
 */
async function fetchImageForItem(item: EnrichedItem): Promise<void> {
	try {
		const response = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const blob = await response.blob();
		const mimeType = blob.type || item.mimeType || 'image/jpeg';
		const base64 = await blobToBase64(blob);

		broadcastToSidebar({
			type: MESSAGE_FETCH_COMPLETE,
			url: item.url,
			ok: true,
			base64,
			mimeType
		});
	} catch (err) {
		broadcastToSidebar({
			type: MESSAGE_FETCH_COMPLETE,
			url: item.url,
			ok: false,
			error: err instanceof Error ? err.message : 'Fetch failed'
		});
	}
}

/**
 * Fetch image bytes for a URL given directly — no full EnrichedItem needed.
 * Called when the sidebar user manually overrides storage mode to "download"
 * (PASTICHE_FETCH_IMAGE message). Delivers the result via MESSAGE_FETCH_COMPLETE
 * exactly like fetchImageForItem, so the sidebar's existing handler covers both.
 */
async function fetchImageForUrl(url: string): Promise<void> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const blob = await response.blob();
		const mimeType = blob.type || 'image/jpeg';
		const base64 = await blobToBase64(blob);

		broadcastToSidebar({
			type: MESSAGE_FETCH_COMPLETE,
			url,
			ok: true,
			base64,
			mimeType
		});
	} catch (err) {
		broadcastToSidebar({
			type: MESSAGE_FETCH_COMPLETE,
			url,
			ok: false,
			error: err instanceof Error ? err.message : 'Fetch failed'
		});
	}
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Fire the actual import request to Pastiche. Called when the sidebar user
 * hits the Import button.
 *
 * If Pastiche is unreachable, serialise the job to chrome.storage.local
 * for automatic replay. The sidebar is notified of queue changes.
 */
async function handleDoImport(payload: ImportJobPayload): Promise<ImportResult> {
	const settings = await getSettings();

	try {
		const result = await postImport(settings.pastichePort, payload);

		// Update the local duplicate-detection index for all successfully
		// imported items so subsequent captures show "Already in library".
		if (result.ok && result.imported.length > 0) {
			const importedItems = result.imported.map((r) => payload.items[r.index]).filter(Boolean);
			const hashes = await Promise.all(
				importedItems.map((item) => computeSourceHash(sourceKeyForUrls(item.url, item.sourceUrl)))
			);
			await updateLibraryIndex(hashes);
		}

		return result;
	} catch {
		// Pastiche unreachable — queue for later.
		await enqueueJob(payload);
		const queued = await getQueuedJobs();
		broadcastToSidebar({ type: MESSAGE_QUEUE_UPDATED, count: queued.length });
		return {
			ok: false,
			imported: [],
			failed: payload.items.map(
				(_, i) => ({ index: i, ok: false, error: 'Queued — Pastiche offline' }) as ImportItemResult
			),
			error: 'Pastiche is offline. Import queued.'
		};
	}
}

async function handleRetryItem(
	item: EnrichedItem,
	destinationFolderId: string | null
): Promise<ImportResult> {
	const settings = await getSettings();
	try {
		const result = await postImport(settings.pastichePort, {
			destinationFolderId,
			items: [item]
		});
		if (result.ok && result.imported.length > 0) {
			await updateLibraryIndex([
				await computeSourceHash(sourceKeyForUrls(item.url, item.sourceUrl))
			]);
		}
		return result;
	} catch {
		return {
			ok: false,
			imported: [],
			failed: [{ index: 0, ok: false, error: 'Pastiche unreachable' }],
			error: 'Pastiche unreachable'
		};
	}
}

/**
 * Build the wire-format payload and POST to /api/import.
 * Throws on network error so the caller can decide to queue.
 */
async function postImport(port: number, payload: ImportJobPayload): Promise<ImportResult> {
	const wireItems = payload.items.map((item) => {
		// For download items use the fetched base64; for others send the URL.
		const isDone = item.fetchStatus.state === 'done';
		return {
			filename: item.suggestedName,
			storage_mode: item.storageMode,
			image_data: isDone
				? (item.fetchStatus as { state: 'done'; base64: string; mimeType: string }).base64
				: null,
			source_image_url: item.url,
			mime_type: isDone
				? (item.fetchStatus as { state: 'done'; base64: string; mimeType: string }).mimeType
				: item.mimeType,
			natural_width: item.naturalWidth,
			natural_height: item.naturalHeight,
			source_url: item.sourceUrl,
			page_title: item.pageTitle,
			alt_text: item.altText,
			captured_at: item.capturedAt
		};
	});

	const body = {
		destination_folder_id: payload.destinationFolderId,
		...(payload.createFolderName ? { create_folder_name: payload.createFolderName } : {}),
		items: wireItems
	};

	const response = await fetch(`http://localhost:${port}/api/import`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15_000)
	});

	if (!response.ok) {
		const err = (await response.json().catch(() => ({ error: 'Import failed' }))) as {
			error?: string;
		};
		throw new Error(err.error ?? 'Import failed');
	}

	const result = (await response.json()) as {
		imported: Array<{ index: number; duplicate: boolean }>;
		failed: Array<{ index: number; error: string }>;
	};

	return {
		ok: true,
		imported: result.imported.map((r) => ({ index: r.index, ok: true, duplicate: r.duplicate })),
		failed: result.failed.map((r) => ({ index: r.index, ok: false, error: r.error }))
	};
}

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = 'pastiche_import_queue';

async function getQueuedJobs(): Promise<QueuedJob[]> {
	const stored = await api.storage.local.get([QUEUE_STORAGE_KEY]);
	return (stored[QUEUE_STORAGE_KEY] as QueuedJob[] | undefined) ?? [];
}

async function enqueueJob(payload: ImportJobPayload): Promise<void> {
	const jobs = await getQueuedJobs();
	const job: QueuedJob = {
		id: crypto.randomUUID(),
		queuedAt: new Date().toISOString(),
		payload
	};
	await api.storage.local.set({ [QUEUE_STORAGE_KEY]: [...jobs, job] });
}

async function removeQueuedJob(jobId: string): Promise<void> {
	const jobs = await getQueuedJobs();
	await api.storage.local.set({
		[QUEUE_STORAGE_KEY]: jobs.filter((j) => j.id !== jobId)
	});
}

/**
 * Attempt to replay all queued jobs now that Pastiche is reachable.
 * Jobs that succeed are removed. Jobs that fail remain for the next attempt.
 * Sidebar is notified after each success and at the end.
 */
async function drainQueue(port: number): Promise<void> {
	const jobs = await getQueuedJobs();
	if (jobs.length === 0) return;

	for (const job of jobs) {
		try {
			const result = await postImport(port, job.payload);
			await removeQueuedJob(job.id);
			broadcastToSidebar({ type: MESSAGE_QUEUE_REPLAYED, ...result });
		} catch {
			// Still offline or import failed — leave in queue.
		}
	}

	const remaining = await getQueuedJobs();
	broadcastToSidebar({ type: MESSAGE_QUEUE_UPDATED, count: remaining.length });
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Check the locally cached library index for a URL hash.
 * This is best-effort — the authoritative check is server-side at import time.
 * The server returns `duplicate: true` in the import response for real dedup.
 */
async function checkDuplicate(urlHash: string): Promise<boolean> {
	const stored = await api.storage.local.get(['libraryIndex']);
	const index = (stored.libraryIndex as Record<string, true> | undefined) ?? {};
	return urlHash in index;
}

/**
 * Update the local library index after a successful import.
 * Called with the URL hashes of items that were successfully imported.
 */
async function updateLibraryIndex(urlHashes: string[]): Promise<void> {
	const stored = await api.storage.local.get(['libraryIndex']);
	const index = (stored.libraryIndex as Record<string, true> | undefined) ?? {};
	for (const hash of urlHashes) {
		index[hash] = true;
	}
	await api.storage.local.set({ libraryIndex: index });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Broadcast a message to all extension pages (sidebar, settings).
 * Uses runtime.sendMessage which reaches any open extension page.
 * Swallows errors — pages may not be open.
 */
function broadcastToSidebar(message: Record<string, unknown>): void {
	api.runtime.sendMessage(message).catch(() => {
		// No receiver — sidebar may be closed. That's fine.
	});
}

/** Convert a Blob to a base64 string (without the data URL prefix).
 *
 * Uses Blob.arrayBuffer() rather than FileReader — FileReader is a Window
 * API and is not available in service worker contexts on Chrome. The
 * arrayBuffer approach works in both Chrome and Firefox service workers.
 */
async function blobToBase64(blob: Blob): Promise<string> {
	const buffer = await blob.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = '';
	// Process in chunks to avoid call-stack limits on large images.
	const CHUNK = 8192;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

async function dimensionsForImageBlob(blob: Blob): Promise<{ width: number; height: number }> {
	if (typeof createImageBitmap !== 'function') {
		throw new Error('This browser cannot read active image dimensions.');
	}

	const bitmap = await createImageBitmap(blob);
	try {
		return { width: bitmap.width, height: bitmap.height };
	} finally {
		bitmap.close();
	}
}

function mimeTypeFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname.toLowerCase();
		if (pathname.endsWith('.png')) return 'image/png';
		if (pathname.endsWith('.webp')) return 'image/webp';
		if (pathname.endsWith('.avif')) return 'image/avif';
		if (pathname.endsWith('.gif')) return 'image/gif';
	} catch {
		// Fall through to the JPEG default.
	}
	return 'image/jpeg';
}

function hostnameFrom(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return '';
	}
}
