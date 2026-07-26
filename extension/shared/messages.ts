/**
 * shared/messages.ts
 *
 * All message type constants used across the extension.
 * Import from here everywhere — never use raw string literals.
 */

// ---------------------------------------------------------------------------
// Existing (service worker ↔ sidebar / settings)
// ---------------------------------------------------------------------------

/** Sidebar → SW: get current Pastiche connection state. */
export const MESSAGE_GET_STATUS = 'PASTICHE_GET_STATUS';

/** Sidebar → SW: get the durable capture tray staged by the service worker. */
export const MESSAGE_GET_CAPTURE_TRAY = 'PASTICHE_GET_CAPTURE_TRAY';

/** Sidebar → SW: atomically remove one staged item and its cached original. */
export const MESSAGE_REMOVE_CAPTURE_TRAY_ITEM = 'PASTICHE_REMOVE_CAPTURE_TRAY_ITEM';

/** Sidebar → SW: atomically clear all staged items and cached originals. */
export const MESSAGE_CLEAR_CAPTURE_TRAY = 'PASTICHE_CLEAR_CAPTURE_TRAY';

/** Sidebar → SW: serialize ordinary metadata/source/candidate edits into the tray. */
export const MESSAGE_SAVE_CAPTURE_TRAY_ITEMS = 'PASTICHE_SAVE_CAPTURE_TRAY_ITEMS';

/** Settings page → SW: run a smoke import to verify connection. */
export const MESSAGE_SMOKE_IMPORT = 'PASTICHE_SMOKE_IMPORT';

// ---------------------------------------------------------------------------
// Capture (content script → SW)
// ---------------------------------------------------------------------------

/** Content → SW: user clicked an image in single-click capture mode. */
export const MESSAGE_ITEM_CAPTURED = 'PASTICHE_ITEM_CAPTURED';

/** Content → SW: page sweep completed; batch of candidates. */
export const MESSAGE_SWEEP_RESULTS = 'PASTICHE_SWEEP_RESULTS';

/** Content → SW: lasso selection completed; batch of candidates. */
export const MESSAGE_LASSO_RESULTS = 'PASTICHE_LASSO_RESULTS';

/** Sidebar → SW: capture the active tab URL as a direct image fallback. */
export const MESSAGE_CAPTURE_TAB_IMAGE = 'PASTICHE_CAPTURE_TAB_IMAGE';

/** Sidebar → SW: capture the active tab's visible viewport as rendered screenshot fallback. */
export const MESSAGE_CAPTURE_VISIBLE_TAB = 'PASTICHE_CAPTURE_VISIBLE_TAB';

// ---------------------------------------------------------------------------
// Capture activation (SW / sidebar → content script)
// ---------------------------------------------------------------------------

/** SW / sidebar → content: verify the content script is present in the tab. */
export const MESSAGE_CONTENT_PING = 'PASTICHE_CONTENT_PING';

/** SW / sidebar → content: enter single-click capture mode. */
export const MESSAGE_CAPTURE_ACTIVATE = 'PASTICHE_CAPTURE_ACTIVATE';

/** SW / sidebar → content: enter lasso capture mode. */
export const MESSAGE_CAPTURE_ACTIVATE_LASSO = 'PASTICHE_CAPTURE_ACTIVATE_LASSO';

/** SW / sidebar → content: run page sweep. Payload: { minDimension: number } */
export const MESSAGE_SWEEP = 'PASTICHE_SWEEP';

/** SW → content: reveal the single page-local capture panel. */
export const MESSAGE_SHOW_CAPTURE_PANEL = 'PASTICHE_SHOW_CAPTURE_PANEL';

// ---------------------------------------------------------------------------
// Selection sync (SW / sidebar → content script)
// ---------------------------------------------------------------------------

/** SW / sidebar → content: remove badge for a specific URL. Payload: { url: string } */
export const MESSAGE_DESELECT_ITEM = 'PASTICHE_DESELECT_ITEM';

/** SW / sidebar → content: remove all badges. */
export const MESSAGE_CLEAR_SELECTION = 'PASTICHE_CLEAR_SELECTION';

// ---------------------------------------------------------------------------
// Fetch status (SW → sidebar)
// ---------------------------------------------------------------------------

/**
 * SW → sidebar: a background image fetch completed or failed.
 * Payload: { url: string; ok: true; blobKey: string; mimeType: string;
 *            width: number; height: number; byteSize: number }
 *        | { url: string; ok: false; error: string }
 */
export const MESSAGE_FETCH_COMPLETE = 'PASTICHE_FETCH_COMPLETE';

/**
 * SW → sidebar: enriched item is ready to display (after policy + optional fetch).
 * Payload: EnrichedItem
 */
export const MESSAGE_ITEM_READY = 'PASTICHE_ITEM_READY';

/**
 * SW → sidebar: batch of enriched items ready (sweep / lasso).
 * Payload: { items: EnrichedItem[] }
 */
export const MESSAGE_BATCH_READY = 'PASTICHE_BATCH_READY';

/**
 * Sidebar → SW: manually trigger a background image fetch for a single URL.
 * Sent when the user retries an original import or converts a bookmark.
 * Payload: { url: string }
 * Result delivered via MESSAGE_FETCH_COMPLETE.
 */
export const MESSAGE_FETCH_IMAGE = 'PASTICHE_FETCH_IMAGE';

/** Sidebar → SW: atomically switch a staged item between local original and Bookmark. */
export const MESSAGE_SET_CAPTURE_STORAGE_MODE = 'PASTICHE_SET_CAPTURE_STORAGE_MODE';

/** Sidebar → SW: explicitly enrich one staged item from the active page DOM. */
export const MESSAGE_ENRICH_CAPTURE_METADATA = 'PASTICHE_ENRICH_CAPTURE_METADATA';

/** Content → SW: apply a normalized live-page metadata record to a staged item. */
export const MESSAGE_APPLY_CAPTURE_METADATA = 'PASTICHE_APPLY_CAPTURE_METADATA';

/** SW → content: extract metadata for one staged image from the live page. */
export const MESSAGE_EXTRACT_PAGE_METADATA = 'PASTICHE_EXTRACT_PAGE_METADATA';

/** SW → sidebar: context-menu import has started fetching and saving a clicked image. */
export const MESSAGE_CONTEXT_IMPORT_STARTED = 'PASTICHE_CONTEXT_IMPORT_STARTED';

/** SW → sidebar: context-menu import finished, queued, or failed. Payload: ImportResult */
export const MESSAGE_CONTEXT_IMPORT_FINISHED = 'PASTICHE_CONTEXT_IMPORT_FINISHED';

/** SW → sidebar: capture selection failed before an item could be added to the tray. */
export const MESSAGE_CAPTURE_FAILED = 'PASTICHE_CAPTURE_FAILED';

/** Sidebar → SW: stage an image URL dropped onto the sidebar. */
export const MESSAGE_STAGE_DROPPED_URL = 'PASTICHE_STAGE_DROPPED_URL';

/**
 * Content → SW: preserve the resolved image while the page-local panel opens during a drag.
 * The pending payload survives browsers stripping DataTransfer data during the handoff.
 */
export const MESSAGE_OPEN_CAPTURE_PANEL_FOR_DRAG = 'PASTICHE_OPEN_CAPTURE_PANEL_FOR_DRAG';

/** Sidebar → SW: commit the most recent unexpired page drag. */
export const MESSAGE_STAGE_PENDING_DRAG = 'PASTICHE_STAGE_PENDING_DRAG';

// ---------------------------------------------------------------------------
// Import (sidebar → SW)
// ---------------------------------------------------------------------------

/**
 * Sidebar → SW: fire the import request to Pastiche.
 * Payload: ImportJobPayload
 */
export const MESSAGE_DO_IMPORT = 'PASTICHE_DO_IMPORT';

/**
 * Sidebar → SW: retry a single previously-failed item.
 * Payload: { item: EnrichedItem; destinationFolderId: string | null }
 */
export const MESSAGE_RETRY_ITEM = 'PASTICHE_RETRY_ITEM';

// ---------------------------------------------------------------------------
// Offline queue (SW → sidebar)
// ---------------------------------------------------------------------------

/**
 * SW → sidebar: offline queue count changed.
 * Payload: { count: number }
 */
export const MESSAGE_QUEUE_UPDATED = 'PASTICHE_QUEUE_UPDATED';

/**
 * SW → sidebar: a queued job was successfully replayed.
 * Payload: ImportResult
 */
export const MESSAGE_QUEUE_REPLAYED = 'PASTICHE_QUEUE_REPLAYED';
