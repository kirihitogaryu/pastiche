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
 * Payload: { url: string; ok: true; base64: string; mimeType: string }
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
 * Sent when the user overrides a url_reference item to "download" mode.
 * Payload: { url: string }
 * Result delivered via MESSAGE_FETCH_COMPLETE.
 */
export const MESSAGE_FETCH_IMAGE = 'PASTICHE_FETCH_IMAGE';

/** SW → sidebar: context-menu import has started fetching and saving a clicked image. */
export const MESSAGE_CONTEXT_IMPORT_STARTED = 'PASTICHE_CONTEXT_IMPORT_STARTED';

/** SW → sidebar: context-menu import finished, queued, or failed. Payload: ImportResult */
export const MESSAGE_CONTEXT_IMPORT_FINISHED = 'PASTICHE_CONTEXT_IMPORT_FINISHED';

/** SW → sidebar: capture selection failed before an item could be added to the tray. */
export const MESSAGE_CAPTURE_FAILED = 'PASTICHE_CAPTURE_FAILED';

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
