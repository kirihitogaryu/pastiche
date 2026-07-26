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

import { getSettings, localApiHeaders } from '../shared/settings';
import { getExtensionApi } from '../shared/browser';
import { computeSourceHash, sourceKeyForUrls } from '../shared/source-hash';
import {
	imageDataBlobKeysForItems,
	storageSafeFetchStatus,
	storageSafeItems
} from '../shared/fetch-status';
import {
	deleteImageData,
	imageDataKeyForItem,
	loadImageData,
	saveImageData
} from '../shared/image-data-store';
import { readBoundedImageResponse } from '../shared/image-response';
import { MAX_CAPTURE_IMAGE_PIXELS } from '../shared/constants';
import {
	addToLibraryIndex as updateLibraryIndex,
	dequeue as removeQueuedJob,
	enqueue as enqueueStoredJob,
	isInLibraryIndex as checkDuplicate,
	readQueue as getQueuedJobs
} from '../shared/storage';
import {
	CAPTURE_TRAY_STORAGE_KEY,
	captureTrayItemsFromStorage,
	mergeCaptureTrayItem,
	mergeCaptureTrayItems,
	setCaptureTrayItemStorageMode
} from '../shared/capture-tray';
import { normalizeImageQualityUrl, resolveCanonicalImage } from './canonical-image';
import { enrichCapturedItem, wireImportItemForEnrichedItemAsync } from './enrich-capture';
import { HttpImportError, importErrorResult, shouldQueueImportError } from './import-result';
import { offlineStatusFromCache } from './status-state';
import { respondToExtensionMessage } from './message-handler';
import { capturedPayloadForVisibleScreenshot } from './screenshot-capture';
import { imageFetchUrlsForItem } from './image-fetch-plan';
import {
	CONTEXT_MENU_SAVE_IMAGE_ID,
	imageContextCaptureSource,
	type ImageContextCaptureSource,
	type ImageContextMenuInfo
} from './context-menu';
import { policyForSource } from './storage-policy';
import {
	MESSAGE_GET_STATUS,
	MESSAGE_GET_CAPTURE_TRAY,
	MESSAGE_REMOVE_CAPTURE_TRAY_ITEM,
	MESSAGE_CLEAR_CAPTURE_TRAY,
	MESSAGE_SAVE_CAPTURE_TRAY_ITEMS,
	MESSAGE_SMOKE_IMPORT,
	MESSAGE_CAPTURE_TAB_IMAGE,
	MESSAGE_CAPTURE_VISIBLE_TAB,
	MESSAGE_SHOW_CAPTURE_PANEL,
	MESSAGE_ITEM_CAPTURED,
	MESSAGE_SWEEP_RESULTS,
	MESSAGE_LASSO_RESULTS,
	MESSAGE_CAPTURE_ACTIVATE,
	MESSAGE_DO_IMPORT,
	MESSAGE_RETRY_ITEM,
	MESSAGE_FETCH_IMAGE,
	MESSAGE_SET_CAPTURE_STORAGE_MODE,
	MESSAGE_ENRICH_CAPTURE_METADATA,
	MESSAGE_EXTRACT_PAGE_METADATA,
	MESSAGE_ITEM_READY,
	MESSAGE_BATCH_READY,
	MESSAGE_FETCH_COMPLETE,
	MESSAGE_CAPTURE_FAILED,
	MESSAGE_STAGE_DROPPED_URL,
	MESSAGE_OPEN_CAPTURE_PANEL_FOR_DRAG,
	MESSAGE_STAGE_PENDING_DRAG,
	MESSAGE_QUEUE_UPDATED,
	MESSAGE_QUEUE_REPLAYED
} from '../shared/messages';
import type { SourceCaptureRecord, SourceCreator, SourceMedia } from '../shared/candidates';
import type {
	ConnectionState,
	SmokeImportResponse,
	ExtensionMessage,
	CapturedItemPayload,
	EnrichedItem,
	ImportJobPayload,
	ImportResult,
	ImportItemResult,
	StatusApiResponse
} from '../shared/types';
import type { TabInfo } from '../shared/browser';

const api = getExtensionApi();
const PENDING_DRAG_TTL_MS = 20_000;
const PENDING_DRAG_STORAGE_KEY = 'pastiche_pending_image_drag';
type PendingImageDrag = {
	item: CapturedItemPayload;
	expiresAt: number;
	panelOpen?: { opened: boolean; surface: 'embedded' };
};
let pendingDrag: PendingImageDrag | undefined;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

api.action?.onClicked.addListener((tab) => {
	void showCapturePanel(tab);
});

api.runtime.onInstalled?.addListener(() => {
	void registerContextMenus();
	void injectContentScriptIntoOpenTabs();
});
void registerContextMenus();
void injectContentScriptIntoOpenTabs();

api.contextMenus?.onClicked.addListener((info, tab) => {
	void handleImageContextMenuClick(info as ImageContextMenuInfo, tab);
});

async function registerContextMenus(): Promise<void> {
	if (!api.contextMenus) return;

	try {
		await Promise.resolve(api.contextMenus.remove(CONTEXT_MENU_SAVE_IMAGE_ID));
	} catch {
		// The menu does not exist yet, usually after install or extension reload.
	}

	try {
		await Promise.resolve(
			api.contextMenus.create({
				id: CONTEXT_MENU_SAVE_IMAGE_ID,
				title: 'Add image to Pastiche capture tray',
				contexts: ['image']
			})
		);
	} catch {
		// Best effort: duplicate menu ids can happen during service-worker restarts.
	}
}

async function handleImageContextMenuClick(
	info: ImageContextMenuInfo,
	tab?: TabInfo
): Promise<void> {
	const source = imageContextCaptureSource(info, tab);
	if (!source) return;

	try {
		await stageCapturedItem(await capturedPayloadForImageSource(source));
		if (tab) await showCapturePanel(tab);
	} catch (error) {
		broadcastToSidebar({
			type: MESSAGE_CAPTURE_FAILED,
			error: error instanceof Error ? error.message : 'Context menu capture failed'
		});
	}
}

// ---------------------------------------------------------------------------
// Keyboard command handler
// ---------------------------------------------------------------------------

// Handles the "activate-capture" command declared in manifest commands.
// The command reveals the same page panel used by drag capture, then enters
// single-click mode on the page.
api.commands.onCommand.addListener((command) => {
	if (command !== 'activate-capture') return;
	void (async () => {
		const [tab] = await api.tabs.query({ active: true, currentWindow: true });
		if (!tab?.id) return;
		await showCapturePanel(tab);
		await sendToContent(tab.id, { type: MESSAGE_CAPTURE_ACTIVATE });
	})();
});

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

api.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	const extensionMessage = message as ExtensionMessage;
	void respondToExtensionMessage(extensionMessage, () => handleMessage(extensionMessage, _sender), {
		onCaptureError: (error) => broadcastToSidebar({ type: MESSAGE_CAPTURE_FAILED, error })
	}).then(sendResponse);
	return true; // Keep channel open for async response.
});

async function handleMessage(message: ExtensionMessage, sender?: unknown): Promise<unknown> {
	switch (message.type) {
		case MESSAGE_GET_STATUS:
			return getPasticheStatus();

		case MESSAGE_GET_CAPTURE_TRAY:
			return getCaptureTray();

		case MESSAGE_REMOVE_CAPTURE_TRAY_ITEM:
			return removeCaptureTrayItemById(message.itemId);

		case MESSAGE_CLEAR_CAPTURE_TRAY:
			return clearCaptureTray();

		case MESSAGE_SAVE_CAPTURE_TRAY_ITEMS:
			return saveCaptureTrayItems(message.items);

		case MESSAGE_SMOKE_IMPORT:
			return smokeImport();

		case MESSAGE_CAPTURE_TAB_IMAGE:
			return handleTabImageCaptured(message.url, message.pageTitle);

		case MESSAGE_CAPTURE_VISIBLE_TAB:
			return handleVisibleTabCaptured(message.pageUrl, message.pageTitle, message.windowId);

		case MESSAGE_ITEM_CAPTURED:
			pendingDrag = undefined;
			await clearPendingDrag();
			return handleItemCaptured(message.item);

		case MESSAGE_SWEEP_RESULTS:
		case MESSAGE_LASSO_RESULTS:
			return handleBatchCaptured(message.items);

		case MESSAGE_CAPTURE_FAILED:
			broadcastToSidebar({ type: MESSAGE_CAPTURE_FAILED, error: message.error });
			return { ok: true };

		case MESSAGE_STAGE_DROPPED_URL:
			pendingDrag = undefined;
			await clearPendingDrag();
			return handleDroppedUrlCaptured(message.imageUrl, message.sourceUrl, message.pageTitle);

		case MESSAGE_OPEN_CAPTURE_PANEL_FOR_DRAG:
			if (message.item) {
				pendingDrag = {
					item: message.item,
					expiresAt: Date.now() + PENDING_DRAG_TTL_MS
				};
				// Preserve the handoff across MV3 worker suspension. Do not await this
				// before invoking the sidebar API, because that would lose user activation.
				void writePendingDrag(pendingDrag);
			}
			{
				const panelOpen = { opened: true as const, surface: 'embedded' as const };
				if (pendingDrag) {
					pendingDrag = { ...pendingDrag, panelOpen };
					void writePendingDrag(pendingDrag);
				}
				return {
					ok: true,
					...panelOpen
				};
			}

		case MESSAGE_STAGE_PENDING_DRAG:
			return stagePendingDrag(message.sourceUrl);

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

		case MESSAGE_SET_CAPTURE_STORAGE_MODE:
			return handleCaptureStorageModeChange(message.itemId, message.storageMode);

		case MESSAGE_ENRICH_CAPTURE_METADATA:
			return handleMetadataEnrichment(message.itemId, message.tabId);

		default:
			return { ok: false, error: 'Unknown message' };
	}
}

async function showCapturePanel(tab: TabInfo): Promise<void> {
	if (!tab.id) return;
	await sendToContent(tab.id, { type: MESSAGE_SHOW_CAPTURE_PANEL });
}

async function sendToContent(tabId: number, message: unknown): Promise<unknown> {
	try {
		return await api.tabs.sendMessage(tabId, message);
	} catch (initialError) {
		if (!api.scripting) throw initialError;
		await api.scripting.executeScript({
			target: { tabId },
			files: ['content/index.js']
		});
		return api.tabs.sendMessage(tabId, message);
	}
}

async function injectContentScriptIntoOpenTabs(): Promise<void> {
	if (!api.scripting) return;
	const tabs = await api.tabs.query({});
	await Promise.allSettled(
		tabs
			.filter((tab) => tab.id !== undefined && injectableContentUrl(tab.url))
			.map(async (tab) => {
				try {
					await api.tabs.sendMessage(tab.id!, { type: MESSAGE_CONTENT_PING });
					return;
				} catch {
					// Existing tabs do not receive manifest content scripts when an
					// unpacked extension is installed or reloaded.
				}
				await api.scripting!.executeScript({
					target: { tabId: tab.id! },
					files: ['content/index.js']
				});
			})
	);
}

function injectableContentUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const protocol = new URL(url).protocol;
		return protocol === 'http:' || protocol === 'https:' || protocol === 'file:';
	} catch {
		return false;
	}
}

async function handleMetadataEnrichment(
	itemId: string,
	tabId?: number
): Promise<{ ok: boolean; item?: EnrichedItem; error?: string }> {
	const item = (await getCaptureTrayItems()).find((entry) => entry.id === itemId);
	if (!item) return { ok: false, error: 'Captured image was not found.' };
	if (item.enrichment.state === 'loading') return { ok: true, item };

	const requestId = crypto.randomUUID();
	const startedAt = new Date().toISOString();
	await mutateCaptureTray((items) =>
		items.map((entry) =>
			entry.id === itemId
				? {
						...entry,
						enrichment: { state: 'loading', requestId, startedAt }
					}
				: entry
		)
	);

	try {
		const targetTab = await tabForMetadataExtraction(tabId, item.source.pageUrl);
		if (!targetTab?.id) {
			throw new Error('Open the source page before adding metadata.');
		}
		if (!sameSourceDocument(targetTab.url, item.source.pageUrl)) {
			throw new Error('Open this image’s source page before adding metadata.');
		}
		const selectedCandidate = item.candidates.find(
			(candidate) => candidate.id === item.selectedCandidateId
		);
		const response = await withTimeout(
			api.tabs.sendMessage(targetTab.id, {
				type: MESSAGE_EXTRACT_PAGE_METADATA,
				captureKey: item.captureKey ?? item.url,
				imageUrl: item.url,
				sourceElementPath: selectedCandidate?.sourceElementPath ?? null,
				pageUrl: item.source.pageUrl
			}) as Promise<unknown>,
			15_000,
			'The page did not respond to metadata extraction.'
		);
		const record = sourceCaptureRecordFromResponse(response);
		const preferredOriginal = preferredOriginalForRecord(item, record);
		const upgradedId = preferredOriginal
			? await computeSourceHash(
					sourceKeyForUrls(preferredOriginal, record.canonicalPostUrl || item.sourceUrl)
				)
			: item.id;
		const upgradedAlreadyInLibrary =
			upgradedId === item.id ? item.alreadyInLibrary : await checkDuplicate(upgradedId);
		const { next } = await mutateCaptureTray((items) =>
			items
				.filter((entry) => entry.id === itemId || entry.id !== upgradedId)
				.map((entry) => {
					if (
						entry.id !== itemId ||
						entry.enrichment.state !== 'loading' ||
						entry.enrichment.requestId !== requestId
					) {
						return entry;
					}
					return mergeSourceCaptureRecord(
						entry,
						item,
						record,
						requestId,
						preferredOriginal,
						upgradedId,
						upgradedAlreadyInLibrary
					);
				})
		);
		const updated = next.find((entry) => entry.id === upgradedId);
		if (!updated) throw new Error('The captured image was removed before metadata was added.');
		if (preferredOriginal && item.fetchStatus.state === 'done' && item.fetchStatus.blobKey) {
			await deleteImageData(item.fetchStatus.blobKey).catch(() => undefined);
		}
		if (updated.storageMode === 'download' && updated.fetchStatus.state === 'fetching') {
			void fetchImageForItem(updated);
		}
		return { ok: true, item: updated };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Metadata could not be read from this page.';
		const { next } = await mutateCaptureTray((items) =>
			items.map((entry) =>
				entry.id === itemId &&
				entry.enrichment.state === 'loading' &&
				entry.enrichment.requestId === requestId
					? {
							...entry,
							enrichment: {
								state: 'error',
								requestId,
								completedAt: new Date().toISOString(),
								error: message
							}
						}
					: entry
			)
		);
		return { ok: false, item: next.find((entry) => entry.id === itemId), error: message };
	}
}

async function tabForMetadataExtraction(
	requestedTabId: number | undefined,
	pageUrl: string
): Promise<TabInfo | null> {
	const tabs = await api.tabs.query({});
	if (requestedTabId !== undefined) {
		const requested = tabs.find((tab) => tab.id === requestedTabId);
		if (requested) return requested;
	}
	const exact = tabs.find((tab) => tab.url === pageUrl);
	const active = tabs.find((tab) => tab.active);
	return exact ?? active ?? null;
}

function sameSourceDocument(openUrl: string | undefined, sourceUrl: string): boolean {
	if (!openUrl) return false;
	try {
		const open = new URL(openUrl);
		const source = new URL(sourceUrl);
		return (
			open.origin === source.origin &&
			normalizeDocumentPath(open.pathname) === normalizeDocumentPath(source.pathname)
		);
	} catch {
		return openUrl === sourceUrl;
	}
}

function normalizeDocumentPath(value: string): string {
	return value.replace(/\/+$/, '') || '/';
}

function sourceCaptureRecordFromResponse(value: unknown): SourceCaptureRecord {
	if (!value || typeof value !== 'object') {
		throw new Error('The page returned no metadata.');
	}
	const response = value as { ok?: unknown; error?: unknown; record?: unknown };
	if (response.ok !== true || !response.record || typeof response.record !== 'object') {
		throw new Error(
			typeof response.error === 'string' ? response.error : 'The page returned invalid metadata.'
		);
	}
	const record = response.record as Partial<SourceCaptureRecord>;
	if (
		typeof record.adapterId !== 'string' ||
		typeof record.canonicalPostUrl !== 'string' ||
		!Array.isArray(record.creators) ||
		!Array.isArray(record.media) ||
		!Array.isArray(record.sourceTags)
	) {
		throw new Error('The page returned incomplete metadata.');
	}
	return record as SourceCaptureRecord;
}

function mergeSourceCaptureRecord(
	current: EnrichedItem,
	baseline: EnrichedItem,
	record: SourceCaptureRecord,
	requestId: string,
	preferredOriginal: string | null,
	upgradedId: string,
	upgradedAlreadyInLibrary: boolean
): EnrichedItem {
	const primaryCreator =
		record.creators.find((entry) => entry.role === 'artist') ?? record.creators[0] ?? null;
	const preserveTitle = current.metadata.title !== baseline.metadata.title;
	const preserveArtist =
		current.metadata.artist !== baseline.metadata.artist ||
		current.metadata.artistProfileUrl !== baseline.metadata.artistProfileUrl;
	const preserveDate = current.metadata.date !== baseline.metadata.date;
	const preserveDescription = current.metadata.description !== baseline.metadata.description;
	const sourceTags = mergeSourceTags(current.metadata.sourceTags, record.sourceTags);
	const candidates = mergeRecordMediaCandidates(current, record.media);
	const summary = metadataSummary(record);
	const usefulFields =
		Number(Boolean(record.title)) +
		Number(Boolean(record.description)) +
		Number(Boolean(record.publishedAt)) +
		record.creators.length +
		record.sourceTags.length +
		record.media.length;
	const enrichmentState = usefulFields > 2 ? 'success' : 'partial';
	const selectedOriginalCandidate = preferredOriginal
		? candidates.find((candidate) => candidate.url === preferredOriginal)
		: null;
	const upgraded = Boolean(preferredOriginal && preferredOriginal !== current.url);

	return {
		...current,
		id: upgradedId,
		revision: current.revision + 1,
		url: preferredOriginal ?? current.url,
		selectedCandidateId: selectedOriginalCandidate?.id ?? current.selectedCandidateId,
		candidates,
		previewUrl: upgraded ? (current.previewUrl ?? current.url) : current.previewUrl,
		naturalWidth: selectedOriginalCandidate?.width ?? current.naturalWidth,
		naturalHeight: selectedOriginalCandidate?.height ?? current.naturalHeight,
		mimeType: selectedOriginalCandidate?.mimeType ?? current.mimeType,
		alreadyInLibrary: upgradedAlreadyInLibrary,
		fetchStatus:
			upgraded && current.storageMode === 'download' ? { state: 'fetching' } : current.fetchStatus,
		storageModeReason:
			upgraded && current.storageMode === 'download'
				? 'Original not stored yet'
				: current.storageModeReason,
		source: {
			...current.source,
			canonicalPageUrl: record.canonicalPostUrl || current.source.canonicalPageUrl,
			detailUrl: record.canonicalPostUrl || current.source.detailUrl,
			imageHost: preferredOriginal
				? (hostnameFrom(preferredOriginal) ?? current.source.imageHost)
				: current.source.imageHost
		},
		sourceUrl: record.canonicalPostUrl || current.sourceUrl,
		metadata: {
			...current.metadata,
			title: preserveTitle
				? current.metadata.title
				: (record.title?.value ?? current.metadata.title),
			artist: preserveArtist
				? current.metadata.artist
				: (primaryCreator?.displayName ?? current.metadata.artist),
			artistProfileUrl: preserveArtist
				? current.metadata.artistProfileUrl
				: (primaryCreator?.profileUrl ?? current.metadata.artistProfileUrl),
			artistUsername: preserveArtist
				? current.metadata.artistUsername
				: (primaryCreator?.username ?? current.metadata.artistUsername),
			artistCandidates: mergeRecordCreatorCandidates(
				current.metadata.artistCandidates ?? [],
				record.creators
			),
			date: preserveDate
				? current.metadata.date
				: (record.publishedAt?.value ?? current.metadata.date),
			description: preserveDescription
				? current.metadata.description
				: (record.description?.value ?? current.metadata.description),
			suggestedTags: [
				...new Set([
					...current.metadata.suggestedTags,
					...record.sourceTags.map((tag) => tag.label)
				])
			],
			sourceTags,
			sourceRecord: record
		},
		suggestedName: preserveTitle
			? current.suggestedName
			: (record.title?.value ?? current.suggestedName),
		enrichment: {
			state: enrichmentState,
			requestId,
			completedAt: new Date().toISOString(),
			summary,
			adapterId: record.adapterId
		}
	};
}

function preferredOriginalForRecord(
	item: EnrichedItem,
	record: SourceCaptureRecord
): string | null {
	const matching =
		record.media.find(
			(media) =>
				sameRemoteResource(media.previewUrl, item.url) ||
				sameRemoteResource(media.originalUrl, item.url)
		) ?? record.media[0];
	const value = matching?.originalUrl;
	return value && isHttpUrl(value) && value !== item.url ? value : null;
}

function sameRemoteResource(left: string | null, right: string): boolean {
	if (!left) return false;
	try {
		const first = new URL(left);
		const second = new URL(right);
		first.hash = '';
		second.hash = '';
		return first.toString() === second.toString();
	} catch {
		return left === right;
	}
}

function mergeRecordCreatorCandidates(
	current: NonNullable<EnrichedItem['metadata']['artistCandidates']>,
	creators: SourceCreator[]
) {
	const merged = [...current];
	for (const entry of creators) {
		if (
			merged.some(
				(candidate) =>
					candidate.profileUrl === entry.profileUrl &&
					candidate.label.toLowerCase() === entry.displayName.toLowerCase()
			)
		) {
			continue;
		}
		merged.push({
			label: entry.displayName,
			username: entry.username,
			profileUrl: entry.profileUrl,
			confidence: entry.confidence,
			reason: entry.evidence ?? `${recordRoleLabel(entry.role)} from page`
		});
	}
	return merged;
}

function recordRoleLabel(role: SourceCreator['role']): string {
	return role.replace(/_/g, ' ');
}

function mergeSourceTags(
	current: EnrichedItem['metadata']['sourceTags'],
	incoming: EnrichedItem['metadata']['sourceTags']
) {
	const byKey = new Map(
		current.map((tag) => [`${tag.source}:${tag.category}:${tag.slug}`, tag] as const)
	);
	for (const tag of incoming) {
		byKey.set(`${tag.source}:${tag.category}:${tag.slug}`, tag);
	}
	return [...byKey.values()];
}

function mergeRecordMediaCandidates(item: EnrichedItem, media: SourceMedia[]) {
	const byUrl = new Map(item.candidates.map((candidate) => [candidate.url, candidate]));
	for (const entry of media) {
		const url = entry.originalUrl ?? entry.previewUrl;
		if (!url || byUrl.has(url)) continue;
		byUrl.set(url, {
			id: `metadata:${entry.sourceMediaId ?? entry.ordinal}:${url}`,
			url,
			kind: entry.kind === 'video' ? 'network' : 'img',
			width: entry.width,
			height: entry.height,
			visibleWidth: null,
			visibleHeight: null,
			mimeType: entry.mimeType,
			byteSize: null,
			altText: entry.altText,
			sourceElementPath: null,
			detailUrl: item.source.detailUrl ?? item.source.pageUrl,
			inlineData: null,
			score: entry.originalUrl ? 760 : 180,
			confidence: entry.originalUrl ? 'high' : 'medium',
			rejectionReasons: [],
			scoreReasons: [entry.originalUrl ? 'Original from page metadata' : 'Page media']
		});
	}
	return [...byUrl.values()];
}

function metadataSummary(record: SourceCaptureRecord): string {
	const parts: string[] = [];
	if (record.creators.length) {
		parts.push(`${record.creators.length} creator${record.creators.length === 1 ? '' : 's'}`);
	}
	if (record.publishedAt) parts.push('date');
	if (record.sourceTags.length) {
		parts.push(
			`${record.sourceTags.length} source tag${record.sourceTags.length === 1 ? '' : 's'}`
		);
	}
	if (record.media.length > 1) parts.push(`${record.media.length} media files`);
	if (!parts.length && (record.title || record.description)) parts.push('page details');
	return parts.length ? `Added ${parts.join(', ')}` : 'No additional metadata was found';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

async function stagePendingDrag(
	expectedSourceUrl?: string
): Promise<{ ok: boolean; error?: string }> {
	const current = pendingDrag ?? (await readPendingDrag());
	pendingDrag = undefined;
	await clearPendingDrag();
	if (!current || current.expiresAt < Date.now()) {
		return { ok: false, error: 'No recent image drag is available.' };
	}
	if (expectedSourceUrl && !sameSourceDocument(expectedSourceUrl, current.item.sourceUrl)) {
		return { ok: false, error: 'The recent drag belongs to a different page.' };
	}
	return handleItemCaptured(current.item);
}

function pendingDragStorage() {
	return api.storage.session ?? api.storage.local;
}

async function writePendingDrag(value: PendingImageDrag): Promise<void> {
	try {
		await pendingDragStorage().set({ [PENDING_DRAG_STORAGE_KEY]: value });
	} catch {
		// The in-memory handoff still covers browsers that keep the worker alive.
	}
}

async function readPendingDrag(): Promise<PendingImageDrag | undefined> {
	try {
		const stored = await pendingDragStorage().get(PENDING_DRAG_STORAGE_KEY);
		const value = stored[PENDING_DRAG_STORAGE_KEY];
		if (!value || typeof value !== 'object') return undefined;
		const candidate = value as Partial<PendingImageDrag>;
		if (
			!candidate.item ||
			typeof candidate.item !== 'object' ||
			typeof candidate.expiresAt !== 'number'
		) {
			return undefined;
		}
		return candidate as PendingImageDrag;
	} catch {
		return undefined;
	}
}

async function clearPendingDrag(): Promise<void> {
	try {
		await pendingDragStorage().remove(PENDING_DRAG_STORAGE_KEY);
	} catch {
		// Expired handoffs are harmless and overwritten by the next drag.
	}
}

async function handleCaptureStorageModeChange(
	itemId: string,
	storageMode: 'download' | 'lazy_download'
): Promise<{ ok: boolean; item?: EnrichedItem; error?: string }> {
	const { previous, next } = await mutateCaptureTray((items) =>
		setCaptureTrayItemStorageMode(items, itemId, storageMode)
	);
	const previousItem = previous.find((item) => item.id === itemId);
	if (!previousItem) return { ok: false, error: 'Captured image was not found.' };

	const item = next.find((candidate) => candidate.id === itemId);
	if (!item) return { ok: false, error: 'Captured image could not be updated.' };

	if (storageMode === 'lazy_download') {
		if (previousItem.fetchStatus.state === 'done' && previousItem.fetchStatus.blobKey) {
			await deleteImageData(previousItem.fetchStatus.blobKey).catch(() => undefined);
		}
	} else {
		void fetchImageForItem(item);
	}

	return { ok: true, item };
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

async function getPasticheStatus(): Promise<ConnectionState> {
	const settings = await getSettings();
	const cached = await api.storage.local.get(['lastStatus']);
	const lastStatus = cached.lastStatus as ConnectionState | undefined;
	try {
		const statusUrl = new URL(`http://localhost:${settings.pastichePort}/api/status`);
		if (lastStatus?.statusCursor) statusUrl.searchParams.set('since', lastStatus.statusCursor);
		const response = await fetch(statusUrl, {
			headers: localApiHeaders(settings),
			signal: AbortSignal.timeout(2000)
		});
		if (!response.ok) throw new Error('Pastiche is offline.');

		const status = (await response.json()) as StatusApiResponse;
		const changedSources = status.imported_sources ?? [];
		await updateLibraryIndex(changedSources.map((source) => source.source_hash));
		const importedSources = mergeImportedSources(lastStatus?.importedSources ?? [], changedSources);

		const queued = await getQueuedJobs();
		const state: ConnectionState = {
			connected: true,
			offline: false,
			queuedCount: queued.length,
			unassignedCount: status.unassigned_count,
			recentFolders: status.recent_folders,
			folders: status.folders,
			importedSources,
			statusCursor: status.status_cursor ?? lastStatus?.statusCursor
		};

		await api.storage.local.set({ lastStatus: state });

		// Pastiche is reachable — drain the offline queue.
		if (queued.length > 0) {
			void drainQueue(settings.pastichePort);
		}

		return state;
	} catch {
		const queued = await getQueuedJobs();
		return offlineStatusFromCache(lastStatus, queued.length);
	}
}

function mergeImportedSources(
	existing: StatusApiResponse['imported_sources'],
	changed: StatusApiResponse['imported_sources']
) {
	const byHash = new Map(existing.map((source) => [source.source_hash, source]));
	for (const source of changed) byHash.set(source.source_hash, source);
	return [...byHash.values()];
}

// ---------------------------------------------------------------------------
// Smoke import (settings page verification)
// ---------------------------------------------------------------------------

async function smokeImport(): Promise<SmokeImportResponse> {
	const settings = await getSettings();
	try {
		const response = await fetch(`http://localhost:${settings.pastichePort}/api/import`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...localApiHeaders(settings) },
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
	await stageCapturedItem(captured);
	return { ok: true };
}

/**
 * Batch of items from sweep or lasso. Enrich all, notify sidebar, then fetch
 * any download-mode items.
 */
async function handleBatchCaptured(captured: CapturedItemPayload[]): Promise<{ ok: boolean }> {
	const items = await Promise.all(
		captured.map(async (item) => prepareItemForStorage(await enrichItem(item)))
	);
	await addCaptureTrayItems(items);

	broadcastToSidebar({ type: MESSAGE_BATCH_READY, items });

	// Fire fetches for download items without blocking the response.
	for (const item of items) {
		if (item.storageMode === 'download' && item.fetchStatus.state === 'fetching') {
			void fetchImageForItem(item);
		}
	}

	return { ok: true };
}

async function stageCapturedItem(captured: CapturedItemPayload): Promise<EnrichedItem> {
	const item = await prepareItemForStorage(await enrichItem(captured));
	await addCaptureTrayItem(item);

	// Notify sidebar immediately so it can show the item (possibly with a
	// loading spinner if the fetch is still in flight). Storage persistence is
	// the durable path if this transient broadcast is missed.
	broadcastToSidebar({ type: MESSAGE_ITEM_READY, item });

	if (item.storageMode === 'download' && item.fetchStatus.state === 'fetching') {
		void fetchImageForItem(item);
	}

	return item;
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
	try {
		return handleItemCaptured(
			await capturedPayloadForImageSource({
				imageUrl: tabUrl,
				sourceUrl: tabUrl,
				detailUrl: null,
				pageTitle: pageTitle ?? tabUrl
			})
		);
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'Active tab is not a selectable image.'
		};
	}
}

async function handleVisibleTabCaptured(
	pageUrl: string,
	pageTitle: string | null,
	windowId?: number
): Promise<{ ok: boolean; error?: string }> {
	try {
		const dataUrl = await api.tabs.captureVisibleTab(windowId, { format: 'png' });
		const dimensions = await dimensionsForDataUrl(dataUrl);
		return handleItemCaptured(
			capturedPayloadForVisibleScreenshot({
				dataUrl,
				pageUrl,
				pageTitle,
				width: dimensions.width,
				height: dimensions.height
			})
		);
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'Could not capture the visible viewport.'
		};
	}
}

async function handleDroppedUrlCaptured(
	imageUrl: string,
	sourceUrl: string,
	pageTitle: string | null
): Promise<{ ok: boolean; error?: string }> {
	try {
		await stageCapturedItem(
			await capturedPayloadForImageSource({
				imageUrl,
				sourceUrl,
				detailUrl: null,
				pageTitle: pageTitle ?? sourceUrl
			})
		);
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : 'Dropped URL is not a selectable image.'
		};
	}
}

async function capturedPayloadForImageSource(
	source: ImageContextCaptureSource
): Promise<CapturedItemPayload> {
	const imageUrl = normalizeImageQualityUrl(source.imageUrl);

	const response = await fetch(imageUrl, {
		credentials: 'include',
		signal: AbortSignal.timeout(30_000)
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const blob = await readBoundedImageResponse(response, {
		fallbackMimeType: mimeTypeFromUrl(imageUrl)
	});
	const mimeType = blob.type || mimeTypeFromUrl(imageUrl);

	const dimensions = await dimensionsForImageBlob(blob);
	assertCapturePixelLimit(dimensions);
	const base64 = await blobToBase64(blob);

	return {
		url: imageUrl,
		detailUrl: source.detailUrl,
		naturalWidth: dimensions.width,
		naturalHeight: dimensions.height,
		mimeType,
		inlineData: `data:${mimeType};base64,${base64}`,
		altText: null,
		sourceUrl: source.sourceUrl,
		pageTitle: source.pageTitle,
		capturedAt: new Date().toISOString()
	};
}

// ---------------------------------------------------------------------------
// Item enrichment
// ---------------------------------------------------------------------------

/**
 * Turn a raw CapturedItemPayload (from the content script) into an
 * EnrichedItem with storage policy applied and name inferred.
 */
async function enrichItem(captured: CapturedItemPayload): Promise<EnrichedItem> {
	return enrichCapturedItem(captured, {
		resolveCanonicalImage,
		policyForSource,
		computeSourceHash,
		checkDuplicate
	});
}

async function prepareItemForStorage(item: EnrichedItem): Promise<EnrichedItem> {
	if (item.fetchStatus.state !== 'done' || !item.fetchStatus.base64) return item;
	const blobKey = item.fetchStatus.blobKey ?? imageDataKeyForItem(item.id, item.url);
	await saveImageData(blobKey, item.fetchStatus.base64);
	return {
		...item,
		fetchStatus: {
			...item.fetchStatus,
			blobKey
		}
	};
}

// ---------------------------------------------------------------------------
// Background image fetch (download-mode items)
// ---------------------------------------------------------------------------

/**
 * Fetch image bytes for a download-mode item in the service worker context.
 * Stores the bounded Blob in IndexedDB, then notifies the sidebar by key.
 *
 * Per spec rule 2: image fetching must happen here, never in the content
 * script (memory pressure / lifecycle) or via Pastiche's local server
 * (CORS failures on CDN images).
 *
 * CDN tokens expire — we fetch immediately on capture, not lazily.
 */
async function fetchImageForItem(item: EnrichedItem): Promise<void> {
	const fetchUrls = imageFetchUrlsForItem(item);
	let lastError = 'No downloadable image candidate was found';
	for (const fetchUrl of fetchUrls) {
		try {
			const referrer =
				item.metadata.sourceRecord?.media.find(
					(media) => media.originalUrl === fetchUrl || media.previewUrl === fetchUrl
				)?.referrer ?? item.source.pageUrl;
			const response = await fetch(fetchUrl, {
				credentials: 'include',
				...(isHttpUrl(referrer)
					? { referrer, referrerPolicy: 'no-referrer-when-downgrade' as const }
					: {}),
				signal: AbortSignal.timeout(30_000)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const candidate = item.candidates.find((entry) => entry.url === fetchUrl);
			const blob = await readBoundedImageResponse(response, {
				fallbackMimeType: candidate?.mimeType ?? item.mimeType
			});
			const mimeType = blob.type || candidate?.mimeType || item.mimeType || 'image/jpeg';
			const dimensions = await dimensionsForImageBlob(blob);
			assertCapturePixelLimit(dimensions);
			if (!(await captureFetchStillCurrent(item))) return;
			const blobKey = imageDataKeyForItem(item.id, item.url);
			await saveImageData(blobKey, blob);

			broadcastToSidebar({
				type: MESSAGE_FETCH_COMPLETE,
				itemId: item.id,
				capturedAt: item.capturedAt,
				revision: item.revision,
				url: item.url,
				fetchedUrl: fetchUrl,
				ok: true,
				blobKey,
				mimeType,
				width: dimensions.width,
				height: dimensions.height,
				byteSize: blob.size
			});
			await updateCaptureTrayFetchStatus(
				item.id,
				item.capturedAt,
				{
					state: 'done',
					blobKey,
					mimeType
				},
				{ ...dimensions, byteSize: blob.size, mimeType, fetchedUrl: fetchUrl }
			);
			return;
		} catch (err) {
			lastError = err instanceof Error ? err.message : 'Fetch failed';
		}
	}

	broadcastToSidebar({
		type: MESSAGE_FETCH_COMPLETE,
		itemId: item.id,
		capturedAt: item.capturedAt,
		revision: item.revision,
		url: item.url,
		ok: false,
		error: lastError
	});
	await updateCaptureTrayFetchStatus(item.id, item.capturedAt, {
		state: 'error',
		error: lastError
	});
}

async function captureFetchStillCurrent(item: EnrichedItem): Promise<boolean> {
	const current = (await getCaptureTrayItems()).find((entry) => entry.id === item.id);
	return Boolean(
		current &&
		current.capturedAt === item.capturedAt &&
		current.url === item.url &&
		current.storageMode === 'download'
	);
}

/**
 * Fetch image bytes for a URL given directly — no full EnrichedItem needed.
 * Called when the sidebar user manually overrides storage mode to "download"
 * (PASTICHE_FETCH_IMAGE message). Delivers the result via MESSAGE_FETCH_COMPLETE
 * exactly like fetchImageForItem, so the sidebar's existing handler covers both.
 */
async function fetchImageForUrl(url: string): Promise<void> {
	const item = (await getCaptureTrayItems()).find((candidate) => candidate.url === url);
	if (item) {
		await fetchImageForItem(item);
		return;
	}
	try {
		const response = await fetch(url, {
			credentials: 'include',
			signal: AbortSignal.timeout(30_000)
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const blob = await readBoundedImageResponse(response);
		const mimeType = blob.type || 'image/jpeg';
		const dimensions = await dimensionsForImageBlob(blob);
		assertCapturePixelLimit(dimensions);
		const blobKey = imageDataKeyForItem(url, url);
		await saveImageData(blobKey, blob);

		broadcastToSidebar({
			type: MESSAGE_FETCH_COMPLETE,
			url,
			ok: true,
			blobKey,
			mimeType,
			width: dimensions.width,
			height: dimensions.height,
			byteSize: blob.size
		});
		await updateCaptureTrayFetchStatus(
			url,
			undefined,
			{
				state: 'done',
				blobKey,
				mimeType
			},
			{ ...dimensions, byteSize: blob.size, mimeType }
		);
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Fetch failed';
		broadcastToSidebar({
			type: MESSAGE_FETCH_COMPLETE,
			url,
			ok: false,
			error
		});
		await updateCaptureTrayFetchStatus(url, undefined, {
			state: 'error',
			error
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
	const identifiedPayload = withImportJobId(payload);

	// Check the small status endpoint before loading and base64-encoding every
	// staged original. When Pastiche is down this makes queuing prompt instead
	// of leaving the sidebar apparently frozen on a large local preparation.
	if (!(await isPasticheReachable(settings.pastichePort))) {
		return queueImportForLater(identifiedPayload);
	}

	try {
		const result = await postImport(settings.pastichePort, identifiedPayload);

		// Update the local duplicate-detection index for all successfully
		// imported items so subsequent captures show "Already in library".
		if (result.ok && result.imported.length > 0) {
			const importedItems = result.imported
				.map((r) => identifiedPayload.items[r.index])
				.filter(Boolean);
			const hashes = await Promise.all(
				importedItems.map((item) => computeSourceHash(sourceKeyForUrls(item.url, item.sourceUrl)))
			);
			await updateLibraryIndex(hashes);
		}

		return result;
	} catch (error) {
		if (!shouldQueueImportError(error)) {
			return importErrorResult(error, identifiedPayload.items.length);
		}

		return queueImportForLater(identifiedPayload);
	}
}

async function isPasticheReachable(port: number): Promise<boolean> {
	const settings = await getSettings();
	try {
		const response = await fetch(`http://localhost:${port}/api/status`, {
			headers: localApiHeaders(settings),
			signal: AbortSignal.timeout(2_000)
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function queueImportForLater(payload: ImportJobPayload): Promise<ImportResult> {
	await enqueueJob(payload);
	const queued = await getQueuedJobs();
	broadcastToSidebar({ type: MESSAGE_QUEUE_UPDATED, count: queued.length });
	return {
		ok: false,
		imported: [],
		failed: payload.items.map(
			(_, index) => ({ index, ok: false, error: 'Queued — Pastiche offline' }) as ImportItemResult
		),
		error: 'Pastiche is offline. Import queued.'
	};
}

async function handleRetryItem(
	item: EnrichedItem,
	destinationFolderId: string | null
): Promise<ImportResult> {
	const settings = await getSettings();
	const payload = withImportJobId({
		destinationFolderId,
		items: [item]
	});
	try {
		const result = await postImport(settings.pastichePort, payload);
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
	const settings = await getSettings();
	const wireItems = await Promise.all(
		payload.items.map((item) => wireImportItemForEnrichedItemAsync(item, loadImageData))
	);

	const body = {
		import_job_id: payload.jobId ?? crypto.randomUUID(),
		destination_folder_id: payload.destinationFolderId,
		...(payload.createFolderName ? { create_folder_name: payload.createFolderName } : {}),
		items: wireItems
	};

	const response = await fetch(`http://localhost:${port}/api/import`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...localApiHeaders(settings) },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15_000)
	});

	if (!response.ok) {
		const err = (await response.json().catch(() => ({ error: 'Import failed' }))) as {
			error?: string;
		};
		throw new HttpImportError(err.error ?? 'Import failed', response.status);
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

let activeQueueDrain: Promise<void> | null = null;

async function enqueueJob(payload: ImportJobPayload): Promise<void> {
	await enqueueStoredJob({ ...payload, items: storageSafeItems(payload.items) });
}

/**
 * Attempt to replay all queued jobs now that Pastiche is reachable.
 * Jobs that succeed are removed. Jobs that fail remain for the next attempt.
 * Sidebar is notified after each success and at the end.
 */
function drainQueue(port: number): Promise<void> {
	if (activeQueueDrain) return activeQueueDrain;
	activeQueueDrain = drainQueueOnce(port).finally(() => {
		activeQueueDrain = null;
	});
	return activeQueueDrain;
}

async function drainQueueOnce(port: number): Promise<void> {
	const jobs = await getQueuedJobs();
	if (jobs.length === 0) return;

	for (const job of jobs) {
		try {
			const result = await postImport(port, {
				...job.payload,
				jobId: job.payload.jobId ?? job.id
			});
			const importedItems = result.imported
				.map((entry) => job.payload.items[entry.index])
				.filter((item): item is EnrichedItem => Boolean(item));
			if (importedItems.length > 0) {
				const hashes = await Promise.all(
					importedItems.map((item) => computeSourceHash(sourceKeyForUrls(item.url, item.sourceUrl)))
				);
				await updateLibraryIndex(hashes);
			}
			await removeQueuedJob(job.id);
			if (importedItems.length > 0) {
				await removeCaptureTrayItemsById(new Set(importedItems.map((item) => item.id)));
				await deleteUnreferencedImageData(importedItems);
			}
			broadcastToSidebar({ type: MESSAGE_QUEUE_REPLAYED, ...result });
		} catch {
			// Still offline or import failed — leave in queue.
		}
	}

	const remaining = await getQueuedJobs();
	broadcastToSidebar({ type: MESSAGE_QUEUE_UPDATED, count: remaining.length });
}

function withImportJobId(payload: ImportJobPayload): ImportJobPayload {
	return payload.jobId ? payload : { ...payload, jobId: crypto.randomUUID() };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Check the locally cached library index for a URL hash.
 * This is best-effort — the authoritative check is server-side at import time.
 * The server returns `duplicate: true` in the import response for real dedup.
 */
// ---------------------------------------------------------------------------
// Capture tray persistence
// ---------------------------------------------------------------------------

const CAPTURE_TRAY_UPDATED_AT_KEY = 'pastiche_capture_tray_updated_at';
let captureTrayMutationTail: Promise<void> = Promise.resolve();

async function getCaptureTray(): Promise<{
	ok: true;
	items: EnrichedItem[];
	updatedAt: string | null;
}> {
	const stored = await api.storage.local.get([
		CAPTURE_TRAY_STORAGE_KEY,
		CAPTURE_TRAY_UPDATED_AT_KEY
	]);
	return {
		ok: true,
		items: captureTrayItemsFromStorage(stored[CAPTURE_TRAY_STORAGE_KEY]),
		updatedAt:
			typeof stored[CAPTURE_TRAY_UPDATED_AT_KEY] === 'string'
				? stored[CAPTURE_TRAY_UPDATED_AT_KEY]
				: null
	};
}

async function getCaptureTrayItems(): Promise<EnrichedItem[]> {
	const stored = await api.storage.local.get([CAPTURE_TRAY_STORAGE_KEY]);
	return captureTrayItemsFromStorage(stored[CAPTURE_TRAY_STORAGE_KEY]);
}

async function mutateCaptureTray(
	mutator: (items: EnrichedItem[]) => EnrichedItem[] | Promise<EnrichedItem[]>
): Promise<{ previous: EnrichedItem[]; next: EnrichedItem[] }> {
	const operation = captureTrayMutationTail.then(async () => {
		const previous = await getCaptureTrayItems();
		const next = await mutator(previous);
		await api.storage.local.set({
			[CAPTURE_TRAY_STORAGE_KEY]: storageSafeItems(next),
			[CAPTURE_TRAY_UPDATED_AT_KEY]: new Date().toISOString()
		});
		return { previous, next };
	});
	captureTrayMutationTail = operation.then(
		() => undefined,
		() => undefined
	);
	return operation;
}

async function addCaptureTrayItem(item: EnrichedItem): Promise<void> {
	await mutateCaptureTray((items) => mergeCaptureTrayItem(items, item));
}

async function addCaptureTrayItems(items: EnrichedItem[]): Promise<void> {
	await mutateCaptureTray((existing) => mergeCaptureTrayItems(existing, items));
}

async function removeCaptureTrayItemById(
	itemId: string
): Promise<{ ok: boolean; removed?: EnrichedItem; error?: string }> {
	const [removed] = await removeCaptureTrayItemsById(new Set([itemId]));
	if (!removed) return { ok: true };
	return { ok: true, removed };
}

async function clearCaptureTray(): Promise<{ ok: true }> {
	const { previous } = await mutateCaptureTray(() => []);
	await deleteUnreferencedImageData(previous);
	return { ok: true };
}

async function saveCaptureTrayItems(
	incoming: EnrichedItem[]
): Promise<{ ok: true; items: EnrichedItem[] }> {
	const safeIncoming = storageSafeItems(incoming);
	const { next } = await mutateCaptureTray((current) =>
		mergeCaptureTrayEdits(current, safeIncoming)
	);
	return { ok: true, items: next };
}

function mergeCaptureTrayEdits(current: EnrichedItem[], incoming: EnrichedItem[]): EnrichedItem[] {
	const matchedCurrentIds = new Set<string>();
	const edited = incoming.map((edit) => {
		const existing = current.find(
			(item) =>
				item.id === edit.id ||
				(Boolean(item.captureKey) &&
					Boolean(edit.captureKey) &&
					item.captureKey === edit.captureKey)
		);
		if (!existing) return edit;
		matchedCurrentIds.add(existing.id);
		if (existing.url !== edit.url) return edit;

		// Fetch completion is authoritative for byte state and dimensions.
		// Sidebar edits are authoritative for human metadata and provenance.
		return {
			...edit,
			id: existing.id,
			revision: Math.max(existing.revision, edit.revision) + 1,
			naturalWidth: existing.naturalWidth,
			naturalHeight: existing.naturalHeight,
			mimeType: existing.mimeType,
			candidates: existing.candidates,
			selectedCandidateId: existing.selectedCandidateId,
			storageMode: existing.storageMode,
			storageModeReason: existing.storageModeReason,
			fetchStatus: existing.fetchStatus,
			alreadyInLibrary: existing.alreadyInLibrary,
			enrichment:
				existing.enrichment.state === 'loading' || existing.revision > edit.revision
					? existing.enrichment
					: edit.enrichment,
			metadata: {
				...edit.metadata,
				sourceRecord:
					existing.revision > edit.revision
						? existing.metadata.sourceRecord
						: edit.metadata.sourceRecord
			}
		};
	});
	return [...edited, ...current.filter((item) => !matchedCurrentIds.has(item.id))];
}

async function removeCaptureTrayItemsById(itemIds: Set<string>): Promise<EnrichedItem[]> {
	const { previous } = await mutateCaptureTray((items) =>
		items.filter((item) => !itemIds.has(item.id))
	);
	const removed = previous.filter((item) => itemIds.has(item.id));
	await deleteUnreferencedImageData(removed);
	return removed;
}

async function deleteUnreferencedImageData(items: EnrichedItem[]): Promise<void> {
	const keys = imageDataBlobKeysForItems(items);
	if (keys.length === 0) return;
	const [tray, queuedJobs] = await Promise.all([getCaptureTrayItems(), getQueuedJobs()]);
	const referenced = new Set([
		...imageDataBlobKeysForItems(tray),
		...queuedJobs.flatMap((job) => imageDataBlobKeysForItems(job.payload.items))
	]);
	await Promise.all(
		keys.map((key) =>
			referenced.has(key) ? Promise.resolve() : deleteImageData(key).catch(() => undefined)
		)
	);
}

async function updateCaptureTrayFetchStatus(
	itemId: string,
	capturedAt: string | undefined,
	fetchStatus: EnrichedItem['fetchStatus'],
	details?: {
		width: number;
		height: number;
		byteSize: number;
		mimeType: string;
		fetchedUrl?: string;
	}
): Promise<void> {
	await mutateCaptureTray((items) =>
		items.map((item) => {
			const matches = item.id === itemId || (capturedAt === undefined && item.url === itemId);
			if (!matches || (capturedAt !== undefined && item.capturedAt !== capturedAt)) return item;
			if (item.storageMode !== 'download') return item;
			const safeFetchStatus = storageSafeFetchStatus(fetchStatus);
			if (safeFetchStatus.state === 'error') {
				return {
					...item,
					revision: item.revision + 1,
					storageModeReason: 'Original not stored yet',
					fetchStatus: safeFetchStatus
				};
			}
			if (!details) {
				return { ...item, revision: item.revision + 1, fetchStatus: safeFetchStatus };
			}
			return {
				...item,
				revision: item.revision + 1,
				naturalWidth: details.width,
				naturalHeight: details.height,
				mimeType: details.mimeType,
				storageModeReason: 'Original stored locally',
				fetchStatus: safeFetchStatus,
				candidates: item.candidates.map((candidate) =>
					candidate.url === (details.fetchedUrl ?? item.url)
						? {
								...candidate,
								width: details.width,
								height: details.height,
								byteSize: details.byteSize,
								mimeType: details.mimeType
							}
						: candidate
				)
			};
		})
	);
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

async function dimensionsForDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
	const response = await fetch(dataUrl);
	const blob = await response.blob();
	return dimensionsForImageBlob(blob);
}

function assertCapturePixelLimit(dimensions: { width: number; height: number }) {
	if (dimensions.width * dimensions.height > MAX_CAPTURE_IMAGE_PIXELS) {
		throw new Error('Images are limited to 200 megapixels');
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

function isHttpUrl(value: string | null | undefined): value is string {
	if (!value) return false;
	try {
		const protocol = new URL(value).protocol;
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

function hostnameFrom(value: string): string | null {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return null;
	}
}
