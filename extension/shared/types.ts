/**
 * shared/types.ts
 *
 * TypeScript types shared across background, content, sidebar, and settings.
 * No runtime code here — types only.
 */

// ---------------------------------------------------------------------------
// StorageMode — defined here rather than imported from the main Pastiche app.
//
// The main app (src/lib/library/types) uses the same three values. Keeping
// a local copy means the extension can be type-checked independently and
// won't silently break if the main app's type is ever renamed or moved.
// If the main app adds a fourth mode, add it here too.
// ---------------------------------------------------------------------------

import type { CaptureMetadata, CaptureSource, ImageCandidate } from './candidates';

export type StorageMode = 'url_reference' | 'download' | 'lazy_download';

// ---------------------------------------------------------------------------
// Re-export for convenience (kept for any existing import { StorageMode } sites)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Existing types (preserved)
// ---------------------------------------------------------------------------

export type RecentFolder = {
	id: string;
	name: string;
	last_used: string;
};

export type ImportedSource = {
	source_hash: string;
	source_image_url: string | null;
	source_url: string;
};

export type StatusApiResponse = {
	connected: true;
	unassigned_count: number;
	recent_folders: RecentFolder[];
	imported_sources: ImportedSource[];
};

export type ConnectionState = {
	connected: boolean;
	offline: boolean;
	/** Items queued in chrome.storage.local waiting for Pastiche to come back. */
	queuedCount: number;
	unassignedCount: number;
	recentFolders: RecentFolder[];
	importedSources: ImportedSource[];
};

export type CaptureTrayResponse = {
	ok: true;
	items: EnrichedItem[];
	updatedAt: string | null;
};

export type SmokeImportResponse = {
	ok: boolean;
	error?: string;
};

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Raw capture payload sent from content/index.ts → service worker.
 * Mirrors ResolvedImage from resolver.ts plus page-level metadata.
 */
export type CapturedItemPayload = {
	/** Resolved image URL (already Artsy-upsized). */
	url: string;
	/** Candidate selected by the content scanner, when richer candidate data is available. */
	selectedCandidateId?: string;
	/** Candidate set discovered on the page, including alternates. */
	candidates?: ImageCandidate[];
	/** Human-readable source/provenance context. */
	source?: CaptureSource;
	/** Editable import metadata inferred from page and candidate context. */
	metadata?: CaptureMetadata;
	/** Linked detail/canonical page for gallery thumbnails, when one is available. */
	detailUrl: string | null;
	naturalWidth: number;
	naturalHeight: number;
	/** MIME type when known from canvas/video export. */
	mimeType: string | null;
	/**
	 * For canvas / video frame exports, the bytes are already here as a
	 * data URL. The SW uses this directly and skips the fetch step.
	 */
	inlineData: string | null;
	altText: string | null;
	sourceUrl: string;
	pageTitle: string;
	capturedAt: string;
};

// ---------------------------------------------------------------------------
// Enriched item — after storage policy applied + optional fetch
// ---------------------------------------------------------------------------

export type FetchStatus =
	| { state: 'idle' }
	| { state: 'fetching' }
	| { state: 'done'; base64: string; mimeType: string }
	| { state: 'error'; error: string };

/**
 * An item that has been through the service worker enrichment pipeline:
 * storage policy determined, name inferred, fetch status tracked.
 * This is what the sidebar stores and renders.
 */
export type EnrichedItem = {
	/** Stable identity — hash of the resolved image URL. */
	id: string;
	/** Resolved image URL. For url_reference/lazy_download this is what gets stored. */
	url: string;
	/** Candidate selected for import. */
	selectedCandidateId: string;
	/** Candidate set discovered on the page, including alternates. */
	candidates: ImageCandidate[];
	/** Human-readable source/provenance context. */
	source: CaptureSource;
	/** Editable import metadata inferred from page and candidate context. */
	metadata: CaptureMetadata;
	/** Visible image captured on the page. Used as a sidebar preview when canonical URL differs. */
	previewUrl: string | null;
	naturalWidth: number;
	naturalHeight: number;
	mimeType: string | null;
	altText: string | null;
	/** Editable in sidebar before import. Pre-filled from alt/title/heading. */
	suggestedName: string;
	sourceUrl: string;
	pageTitle: string;
	capturedAt: string;
	storageMode: StorageMode;
	/** Human-readable reason shown in sidebar ("Token-authenticated", etc.) */
	storageModeReason: string;
	/** Tracks the background fetch for download-mode items. */
	fetchStatus: FetchStatus;
	/** Folder override for this specific item. null = use batch default. */
	destinationFolderId: string | null;
	/** True when this URL is already present in the Pastiche library. */
	alreadyInLibrary: boolean;
};

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * The payload the sidebar sends to the service worker to trigger import.
 */
export type ImportJobPayload = {
	/** null = Unassigned inbox */
	destinationFolderId: string | null;
	/** Optional: create a new folder with this name on import */
	createFolderName?: string;
	items: EnrichedItem[];
};

/**
 * Per-item result returned from the import endpoint.
 */
export type ImportItemResult =
	| { index: number; ok: true; duplicate: boolean }
	| { index: number; ok: false; error: string };

/**
 * Full result of one import attempt, as returned to the sidebar.
 */
export type ImportResult = {
	ok: boolean;
	/** Items that succeeded. */
	imported: ImportItemResult[];
	/** Items that failed (non-blocking). */
	failed: ImportItemResult[];
	error?: string;
};

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------

/**
 * A serialised import job stored in chrome.storage.local when Pastiche is
 * offline. Replayed automatically on next successful status check.
 */
export type QueuedJob = {
	id: string;
	queuedAt: string;
	payload: ImportJobPayload;
};

// ---------------------------------------------------------------------------
// Message union — discriminated union of all messages the SW handles
// ---------------------------------------------------------------------------

/**
 * All messages the service worker's onMessage handler may receive.
 * Each variant is discriminated by `type`.
 */
export type ExtensionMessage =
	| { type: 'PASTICHE_GET_STATUS' }
	| { type: 'PASTICHE_GET_CAPTURE_TRAY' }
	| { type: 'PASTICHE_SMOKE_IMPORT' }
	| { type: 'PASTICHE_CAPTURE_TAB_IMAGE'; url: string; pageTitle: string | null }
	| {
			type: 'PASTICHE_CAPTURE_VISIBLE_TAB';
			pageUrl: string;
			pageTitle: string | null;
			windowId?: number;
	  }
	| { type: 'PASTICHE_ITEM_CAPTURED'; item: CapturedItemPayload }
	| { type: 'PASTICHE_SWEEP_RESULTS'; items: CapturedItemPayload[] }
	| { type: 'PASTICHE_LASSO_RESULTS'; items: CapturedItemPayload[] }
	| { type: 'PASTICHE_DO_IMPORT'; payload: ImportJobPayload }
	| { type: 'PASTICHE_RETRY_ITEM'; item: EnrichedItem; destinationFolderId: string | null };

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * User-configurable extension settings stored in chrome.storage.local.
 * Mirrors the fields read/written by shared/settings.ts.
 */
export type ExtensionSettings = {
	/** Port the local Pastiche server is listening on. Default: 5173. */
	pastichePort: number;
	/** Minimum natural dimension (px) for page-sweep image candidates. Default: 300. */
	sizeThreshold: number;
	/** Default destination folder id. null = Unassigned inbox. */
	defaultDestinationId: string | null;
};
