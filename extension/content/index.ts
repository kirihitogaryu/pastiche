/**
 * content/index.ts
 *
 * Injected into every page at document_idle.
 *
 * Responsibilities:
 *   - Receive activation messages from the sidebar / service worker.
 *   - Run single-click capture mode (crosshair cursor, hover ring, click to capture).
 *   - Run region lasso mode (Shift+activate → rubber-band rect → collect).
 *   - Trigger page sweep on request and return candidates to the sidebar.
 *   - Maintain the set of selected elements and keep their badges in sync.
 *   - Forward captured item data to the service worker for fetching/importing.
 *   - Handle scroll/resize so fixed-position badges stay on their elements.
 *   - Escape always cleanly exits any active mode.
 *
 * Message protocol (all via ext.runtime.sendMessage / onMessage):
 *
 *   Incoming (from sidebar / service worker):
 *     PASTICHE_CAPTURE_ACTIVATE          — enter single-click capture mode
 *     PASTICHE_CAPTURE_ACTIVATE_LASSO    — enter lasso capture mode
 *     PASTICHE_SWEEP                     — run page sweep, return candidates
 *     PASTICHE_DESELECT_ITEM { url }     — remove badge for a URL
 *     PASTICHE_CLEAR_SELECTION           — remove all badges
 *
 *   Outgoing (to service worker, which forwards to sidebar):
 *     PASTICHE_ITEM_CAPTURED { item }    — user clicked an image
 *     PASTICHE_SWEEP_RESULTS { items }   — sweep completed
 *     PASTICHE_LASSO_RESULTS { items }   — lasso completed
 */

import {
	showRing,
	hideRing,
	addBadge,
	updateBadge,
	removeBadge,
	repositionBadge,
	showLasso,
	hideLasso,
	teardown
} from './highlight';
import {
	resolveElement,
	resolveTargetAtPoint,
	sweepPage,
	collectInRegion,
	type ResolvedImage,
	type SweepCandidate
} from './resolver';
import { deliverCapturedItem, deliverCapturedItems } from './capture-delivery';
import type { CapturedItemPayload } from '../shared/types';
import { extractLiveMetadata } from './metadata-adapters';

// ---------------------------------------------------------------------------
// Browser compatibility shim
// Chrome exposes chrome.*, Firefox exposes browser.* (Promise-based).
// Firefox 109+ also injects a chrome.* compatibility layer, but it is
// incomplete in content script contexts. Using the shim below means we
// always get the native namespace and never depend on that layer.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ext: typeof chrome = (globalThis as any).browser ?? (globalThis as any).chrome;

// ---------------------------------------------------------------------------
// Message type constants
// (mirrors shared/messages.ts — duplicated here to keep content script
//  self-contained and avoid importing from the extension's shared bundle)
// ---------------------------------------------------------------------------

const MSG_CAPTURE_ACTIVATE = 'PASTICHE_CAPTURE_ACTIVATE';
const MSG_CAPTURE_ACTIVATE_LASSO = 'PASTICHE_CAPTURE_ACTIVATE_LASSO';
const MSG_CONTENT_PING = 'PASTICHE_CONTENT_PING';
const MSG_SWEEP = 'PASTICHE_SWEEP';
const MSG_DESELECT_ITEM = 'PASTICHE_DESELECT_ITEM';
const MSG_CLEAR_SELECTION = 'PASTICHE_CLEAR_SELECTION';
const MSG_SWEEP_RESULTS = 'PASTICHE_SWEEP_RESULTS';
const MSG_LASSO_RESULTS = 'PASTICHE_LASSO_RESULTS';
const MSG_CAPTURE_FAILED = 'PASTICHE_CAPTURE_FAILED';
const MSG_OPEN_CAPTURE_PANEL_FOR_DRAG = 'PASTICHE_OPEN_CAPTURE_PANEL_FOR_DRAG';
const MSG_SHOW_CAPTURE_PANEL = 'PASTICHE_SHOW_CAPTURE_PANEL';
const MSG_STAGE_PENDING_DRAG = 'PASTICHE_STAGE_PENDING_DRAG';
const MSG_EXTRACT_PAGE_METADATA = 'PASTICHE_EXTRACT_PAGE_METADATA';

// Default size threshold — overridden by PASTICHE_SWEEP message payload.
const DEFAULT_MIN_DIMENSION = 300;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type CaptureMode = 'idle' | 'single' | 'lasso';

let mode: CaptureMode = 'idle';

// All elements the user has added to the selection list this session.
// Maps resolved URL → element, so we can remove badges by URL.
const selectedByUrl = new Map<string, Element>();

// Lasso start coordinates (viewport space).
let lassoStart: { x: number; y: number } | null = null;
let lassoPointerId: number | null = null;
let lassoMinDimension = DEFAULT_MIN_DIMENSION;
let lastExternalDragOpenAt = 0;
let embeddedCaptureHost: HTMLElement | null = null;
let embeddedDropTarget: HTMLElement | null = null;
let recentPointerDragTarget: {
	element: Element;
	resolved: ResolvedImage;
	capturedAt: number;
} | null = null;

const EMBEDDED_CAPTURE_HOST_ID = '__pastiche_drag_capture_panel__';
const DRAG_CAPTURE_SETTING_KEY = 'dragCaptureEnabled';
// Start closed until the stored preference is known so an opted-out user never
// gets a capture panel during extension/page startup.
let dragCaptureEnabled = false;

void ext.storage.local
	.get({ [DRAG_CAPTURE_SETTING_KEY]: true })
	.then((stored) => {
		dragCaptureEnabled = stored[DRAG_CAPTURE_SETTING_KEY] !== false;
	})
	.catch(() => {
		dragCaptureEnabled = true;
	});

ext.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local' || !(DRAG_CAPTURE_SETTING_KEY in changes)) return;
	dragCaptureEnabled = changes[DRAG_CAPTURE_SETTING_KEY].newValue !== false;
	if (!dragCaptureAllowed() && embeddedDropTarget?.isConnected) {
		hideEmbeddedCapturePanel();
	}
});

// Invisible overlay div used during capture modes so we receive all pointer
// events even on pages with aggressive event listeners.
let overlay: HTMLDivElement | null = null;

// ---------------------------------------------------------------------------
// Overlay management
// ---------------------------------------------------------------------------

function createOverlay(): HTMLDivElement {
	const el = document.createElement('div');
	el.id = '__pastiche_capture_overlay__';
	Object.assign(el.style, {
		position: 'fixed',
		inset: '0',
		zIndex: '2147483646', // one below highlight container
		background: 'transparent',
		cursor: 'crosshair'
	});
	document.body.appendChild(el);
	return el;
}

function removeOverlay(): void {
	overlay?.remove();
	overlay = null;
}

// ---------------------------------------------------------------------------
// Capture mode entry / exit
// ---------------------------------------------------------------------------

function enterSingleMode(): void {
	if (mode !== 'idle') exitCapture();
	mode = 'single';
	overlay = createOverlay();
	overlay.addEventListener('mousemove', onSingleMouseMove);
	overlay.addEventListener('click', onSingleClick);
}

function enterLassoMode(minDimension = DEFAULT_MIN_DIMENSION): void {
	if (mode !== 'idle') exitCapture();
	mode = 'lasso';
	lassoMinDimension = minDimension;
	overlay = createOverlay();
	overlay.addEventListener('pointerdown', onLassoPointerDown);
}

/**
 * Clean exit from any capture mode. Always safe to call even when idle.
 * Per spec rule 4: must always work, even on pages with aggressive listeners.
 */
function exitCapture(): void {
	mode = 'idle';
	lassoStart = null;
	cleanupLassoDrag();

	hideRing();
	hideLasso();
	removeOverlay();
}

// ---------------------------------------------------------------------------
// Single-click capture
// ---------------------------------------------------------------------------

function onSingleMouseMove(event: MouseEvent): void {
	// elementsFromPoint skips the overlay (it's under pointer-events:all but we
	// call it on the overlay's own coordinates, so we need the document stack).
	// We suspend pointer events on the overlay briefly to let elementsFromPoint
	// see through to the page — then restore immediately.
	overlay!.style.pointerEvents = 'none';
	const target = resolveTargetAtPoint(event.clientX, event.clientY);
	overlay!.style.pointerEvents = 'all';

	if (!target) {
		hideRing();
		return;
	}

	showRing(target.element, target.resolved.naturalWidth, target.resolved.naturalHeight);
}

function onSingleClick(event: MouseEvent): void {
	event.preventDefault();
	event.stopPropagation();

	overlay!.style.pointerEvents = 'none';
	const target = resolveTargetAtPoint(event.clientX, event.clientY);
	overlay!.style.pointerEvents = 'all';

	exitCapture();

	if (!target) return;

	captureItem(target.resolved, target.element);
}

// ---------------------------------------------------------------------------
// Lasso capture
// ---------------------------------------------------------------------------

function onLassoPointerDown(event: PointerEvent): void {
	if (event.button !== 0) return;
	event.preventDefault();
	event.stopPropagation();
	lassoStart = { x: event.clientX, y: event.clientY };
	lassoPointerId = event.pointerId;

	overlay?.setPointerCapture(event.pointerId);
	overlay?.addEventListener('pointermove', onLassoPointerMove);
	overlay?.addEventListener('pointerup', onLassoPointerUp);
	overlay?.addEventListener('pointercancel', onLassoPointerCancel);
}

function onLassoPointerMove(event: PointerEvent): void {
	if (!lassoStart) return;
	event.preventDefault();
	showLasso(lassoStart.x, lassoStart.y, event.clientX, event.clientY);
}

function onLassoPointerUp(event: PointerEvent): void {
	if (!lassoStart) return;
	event.preventDefault();
	event.stopPropagation();

	const start = lassoStart;
	const end = { x: event.clientX, y: event.clientY };

	cleanupLassoDrag();
	exitCapture();

	const selectionRect = new DOMRect(
		Math.min(start.x, end.x),
		Math.min(start.y, end.y),
		Math.abs(end.x - start.x),
		Math.abs(end.y - start.y)
	);

	// Ignore tiny accidental drags.
	if (selectionRect.width < 10 || selectionRect.height < 10) return;

	const candidates = collectInRegion(selectionRect, lassoMinDimension);
	const newCandidates = candidates.filter((c) => !selectedByUrl.has(c.url));

	if (newCandidates.length === 0) {
		void notifyCaptureFailed(
			candidates.length > 0
				? 'All images in that area are already selected.'
				: 'No images found in that area.'
		);
		return;
	}

	void deliverCapturedItems({
		type: MSG_LASSO_RESULTS,
		items: newCandidates.map((candidate) => ({
			element: candidate.element,
			payload: candidateToPayload(candidate)
		})),
		selectedByUrl,
		sendMessage: (message) => ext.runtime.sendMessage(message),
		addBadge,
		updateBadge,
		removeBadge
	});
}

function onLassoPointerCancel(): void {
	exitCapture();
}

function cleanupLassoDrag(): void {
	if (lassoPointerId !== null && overlay?.hasPointerCapture(lassoPointerId)) {
		overlay.releasePointerCapture(lassoPointerId);
	}
	lassoPointerId = null;
	overlay?.removeEventListener('pointermove', onLassoPointerMove);
	overlay?.removeEventListener('pointerup', onLassoPointerUp);
	overlay?.removeEventListener('pointercancel', onLassoPointerCancel);
}

// ---------------------------------------------------------------------------
// Page sweep
// ---------------------------------------------------------------------------

async function runSweep(
	minDimension: number
): Promise<{ ok: boolean; found: number; delivered: number; error?: string }> {
	const candidates = sweepPage(minDimension);

	// Don't re-badge elements already selected.
	const newCandidates = candidates.filter((c) => !selectedByUrl.has(c.url));

	if (newCandidates.length === 0) {
		return { ok: true, found: candidates.length, delivered: 0 };
	}

	const result = await deliverCapturedItems({
		type: MSG_SWEEP_RESULTS,
		items: newCandidates.map((candidate) => ({
			element: candidate.element,
			payload: candidateToPayload(candidate)
		})),
		selectedByUrl,
		sendMessage: (message) => ext.runtime.sendMessage(message),
		addBadge,
		updateBadge,
		removeBadge
	});

	if (!result.ok) {
		await notifyCaptureFailed(result.error);
		return { ok: false, found: candidates.length, delivered: 0, error: result.error };
	}

	return {
		ok: true,
		found: candidates.length,
		delivered: result.delivered ?? newCandidates.length
	};
}

// ---------------------------------------------------------------------------
// Item capture (shared by single-click and sweep/lasso helpers)
// ---------------------------------------------------------------------------

function captureItem(resolved: ResolvedImage, element: Element): void {
	void deliverCapturedItem({
		element,
		payload: resolvedToPayload(resolved, element),
		selectedByUrl,
		sendMessage: (message) => ext.runtime.sendMessage(message),
		addBadge,
		updateBadge,
		removeBadge
	});
}

// ---------------------------------------------------------------------------
// Payload serialisation
// ---------------------------------------------------------------------------

function resolvedToPayload(resolved: ResolvedImage, element: Element): CapturedItemPayload {
	return {
		url: resolved.url,
		selectedCandidateId: resolved.selectedCandidateId,
		candidates: resolved.candidates,
		source: resolved.source,
		metadata: resolved.metadata,
		detailUrl: detailUrlForElement(element),
		naturalWidth: resolved.naturalWidth,
		naturalHeight: resolved.naturalHeight,
		mimeType: resolved.mimeType,
		inlineData: resolved.inlineData,
		altText: resolved.altText,
		sourceUrl: window.location.href,
		pageTitle: document.title,
		capturedAt: new Date().toISOString()
	};
}

function candidateToPayload(c: SweepCandidate): CapturedItemPayload {
	return resolvedToPayload(c, c.element);
}

function detailUrlForElement(element: Element): string | null {
	const link = element.closest<HTMLAnchorElement>('a[href]');
	const href = link?.href;
	if (!href) return null;
	if (href.startsWith('javascript:') || href.startsWith('mailto:')) return null;
	try {
		return new URL(href, window.location.href).toString();
	} catch {
		return null;
	}
}

async function notifyCaptureFailed(error: string): Promise<void> {
	try {
		await ext.runtime.sendMessage({ type: MSG_CAPTURE_FAILED, error });
	} catch {
		// Best effort; the sidebar also updates from command responses when possible.
	}
}

// ---------------------------------------------------------------------------
// Keyboard handler — Escape always exits
// ---------------------------------------------------------------------------

globalThis.addEventListener(
	'keydown',
	(event) => {
		if (event.key === 'Escape' && mode !== 'idle') {
			exitCapture();
		}
	},
	// Use capture phase so aggressive sites can't stop propagation before us.
	true
);

// ---------------------------------------------------------------------------
// Scroll / resize — reposition badges
// ---------------------------------------------------------------------------

function onScrollOrResize(): void {
	for (const [, element] of selectedByUrl) {
		repositionBadge(element);
	}
}

globalThis.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
globalThis.addEventListener('resize', onScrollOrResize, { passive: true });

globalThis.addEventListener(
	'pointerdown',
	(event) => {
		if (!dragCaptureAllowed()) {
			recentPointerDragTarget = null;
			return;
		}
		if (event.button !== 0) return;
		const target = resolvedDragTarget(event);
		recentPointerDragTarget = target
			? { ...target, capturedAt: Date.now() }
			: null;
	},
	true
);

globalThis.addEventListener(
	'dragstart',
	(event) => {
		if (!dragCaptureAllowed()) return;
		const directTarget = resolvedDragTarget(event);
		const cachedTarget =
			recentPointerDragTarget &&
			Date.now() - recentPointerDragTarget.capturedAt < 3_000 &&
			recentPointerDragTarget.element.isConnected
				? recentPointerDragTarget
				: null;
		const target = directTarget ?? cachedTarget;
		if (!target && !looksLikeImageDrag(event)) return;
		try {
			if (target) {
				event.dataTransfer?.setData('application/x-pastiche-image-url', target.resolved.url);
			}
		} catch {
			// Some pages or browser drag implementations make DataTransfer read-only.
		}
		openCaptureSurfaceForDrag(
			target ? resolvedToPayload(target.resolved, target.element) : undefined
		);
	},
	true
);

globalThis.addEventListener(
	'dragenter',
	(event) => {
		if (!dragCaptureAllowed()) return;
		const types = Array.from(event.dataTransfer?.types ?? []);
		const externalImageFile =
			types.includes('Files') ||
			types.some((type) => type === 'application/x-moz-file' || type.startsWith('image/'));
		if (!externalImageFile || Date.now() - lastExternalDragOpenAt < 2_000) return;
		lastExternalDragOpenAt = Date.now();
		openCaptureSurfaceForDrag();
	},
	true
);

function openCaptureSurfaceForDrag(item?: CapturedItemPayload): void {
	if (!dragCaptureAllowed()) return;
	// The page-local panel is the single capture surface in both browsers.
	// Creating it synchronously during dragstart keeps the active drag in the
	// page's event space; native browser sidebars cannot guarantee that handoff.
	showEmbeddedCapturePanel(true);
	void ext.runtime
		.sendMessage({
			type: MSG_OPEN_CAPTURE_PANEL_FOR_DRAG,
			...(item ? { item } : {})
		})
		.catch(() => {
			// The panel still accepts ordinary URL/file drops if the resolved
			// pending-image handoff could not be persisted.
		});
}

function dragCaptureAllowed(): boolean {
	return dragCaptureEnabled && !isPasticheDocument();
}

function isPasticheDocument(): boolean {
	return Boolean(document.querySelector('meta[name="pastiche-app"][content="true"]'));
}

function showEmbeddedCapturePanel(forDrag = false): void {
	if (embeddedCaptureHost?.isConnected) {
		if (!forDrag || embeddedDropTarget?.isConnected) return;
		// A completed prior drag removes its temporary drop shield so the framed
		// workbench is usable. Rebuild when a new drag starts to arm it again.
		hideEmbeddedCapturePanel();
	}

	const host = document.createElement('div');
	host.id = EMBEDDED_CAPTURE_HOST_ID;
	host.setAttribute('data-pastiche-capture-panel', 'open');
	const shadow = host.attachShadow({ mode: 'closed' });

	const style = document.createElement('style');
	style.textContent = `
		:host {
			all: initial;
		}
		.pastiche-panel {
			position: fixed;
			inset-block: 8px;
			inset-inline-end: 8px;
			z-index: 2147483647;
			width: min(420px, calc(100vw - 16px));
			display: grid;
			grid-template-rows: 48px minmax(0, 1fr);
			overflow: hidden;
			color: oklch(90% 0.01 75);
			background: oklch(13% 0.01 70);
			border: 1px solid oklch(100% 0 0 / 0.16);
			border-radius: 10px;
			box-shadow: 0 18px 52px oklch(5% 0.01 70 / 0.48);
			opacity: 0;
			transform: translate3d(16px, 0, 0);
			transition:
				opacity 160ms cubic-bezier(0.16, 1, 0.3, 1),
				transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
			font-family: Montserrat, system-ui, sans-serif;
			pointer-events: auto;
		}
		.pastiche-panel[data-visible='true'] {
			opacity: 1;
			transform: translate3d(0, 0, 0);
		}
		.pastiche-panel__bar {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 0 10px 0 14px;
			background: oklch(16% 0.01 70);
			border-bottom: 1px solid oklch(100% 0 0 / 0.1);
		}
		.pastiche-panel__mark {
			display: grid;
			place-items: center;
			width: 24px;
			height: 24px;
			border: 1px solid oklch(78% 0.08 78 / 0.42);
			border-radius: 6px;
			color: oklch(83% 0.1 78);
			font: 700 13px/1 Montserrat, system-ui, sans-serif;
		}
		.pastiche-panel__title {
			flex: 1;
			margin: 0;
			color: oklch(90% 0.01 75);
			font: 600 13px/1.2 Montserrat, system-ui, sans-serif;
			letter-spacing: 0.01em;
		}
		.pastiche-panel__close {
			display: grid;
			place-items: center;
			width: 34px;
			height: 34px;
			padding: 0;
			color: oklch(70% 0.012 75);
			background: transparent;
			border: 1px solid transparent;
			border-radius: 7px;
			font: 400 22px/1 system-ui, sans-serif;
			cursor: pointer;
		}
		.pastiche-panel__close:hover {
			color: oklch(90% 0.01 75);
			background: oklch(100% 0 0 / 0.06);
			border-color: oklch(100% 0 0 / 0.1);
		}
		.pastiche-panel__close:focus-visible {
			outline: 2px solid oklch(78% 0.08 78);
			outline-offset: -2px;
		}
		.pastiche-panel__frame {
			width: 100%;
			height: 100%;
			background: oklch(13% 0.01 70);
			border: 0;
		}
		.pastiche-panel__body {
			position: relative;
			min-height: 0;
		}
		.pastiche-panel__drop-target {
			position: absolute;
			inset: 0;
			z-index: 2;
			display: grid;
			place-content: center;
			gap: 8px;
			padding: 28px;
			text-align: center;
			background: oklch(13% 0.01 70 / 0.96);
			border: 1px dashed oklch(78% 0.08 78 / 0.48);
			border-radius: 8px;
			margin: 10px;
		}
		.pastiche-panel__drop-target[data-state='active'] {
			background: oklch(18% 0.018 74 / 0.98);
			border-color: oklch(83% 0.1 78);
		}
		.pastiche-panel__drop-target[data-state='added'] {
			background: oklch(16% 0.025 150 / 0.98);
			border-color: oklch(72% 0.12 150);
		}
		.pastiche-panel__drop-target[data-state='error'] {
			background: oklch(16% 0.025 28 / 0.98);
			border-color: oklch(62% 0.18 28);
		}
		.pastiche-panel__drop-title {
			margin: 0;
			color: oklch(90% 0.01 75);
			font: 600 16px/1.25 Montserrat, system-ui, sans-serif;
		}
		.pastiche-panel__drop-detail {
			max-width: 30ch;
			margin: 0;
			color: oklch(70% 0.012 75);
			font: 400 12px/1.5 Montserrat, system-ui, sans-serif;
		}
		@media (max-width: 480px) {
			.pastiche-panel {
				inset: 0;
				width: 100vw;
				border: 0;
				border-radius: 0;
			}
		}
		@media (prefers-reduced-motion: reduce) {
			.pastiche-panel {
				transition: none;
			}
		}
	`;

	const panel = document.createElement('aside');
	panel.className = 'pastiche-panel';
	panel.setAttribute('role', 'complementary');
	panel.setAttribute('aria-label', 'Pastiche Capture');

	const bar = document.createElement('header');
	bar.className = 'pastiche-panel__bar';

	const mark = document.createElement('span');
	mark.className = 'pastiche-panel__mark';
	mark.textContent = 'P';
	mark.setAttribute('aria-hidden', 'true');

	const title = document.createElement('p');
	title.className = 'pastiche-panel__title';
	title.textContent = 'Pastiche Capture';

	const close = document.createElement('button');
	close.className = 'pastiche-panel__close';
	close.type = 'button';
	close.textContent = '×';
	close.setAttribute('aria-label', 'Close Pastiche Capture');
	close.addEventListener('click', hideEmbeddedCapturePanel);

	const frame = document.createElement('iframe');
	frame.className = 'pastiche-panel__frame';
	frame.title = 'Pastiche Capture';
	const frameUrl = new URL(ext.runtime.getURL('sidebar/index.html'));
	frameUrl.searchParams.set('embedded', '1');
	frameUrl.searchParams.set('sourceUrl', window.location.href);
	frame.src = frameUrl.toString();
	frame.setAttribute('allow', 'clipboard-read; clipboard-write');

	const body = document.createElement('div');
	body.className = 'pastiche-panel__body';

	const dropTarget = document.createElement('div');
	dropTarget.className = 'pastiche-panel__drop-target';
	dropTarget.dataset.state = 'ready';
	dropTarget.setAttribute('role', 'status');
	dropTarget.setAttribute('aria-live', 'polite');

	const dropTitle = document.createElement('p');
	dropTitle.className = 'pastiche-panel__drop-title';
	dropTitle.textContent = 'Drop to Pastiche';

	const dropDetail = document.createElement('p');
	dropDetail.className = 'pastiche-panel__drop-detail';
	dropDetail.textContent = 'The best available image will be staged for review.';

	let dropInFlight = false;
	const handlePanelDragOver = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		if (!dropInFlight) dropTarget.dataset.state = 'active';
	};
	const handlePanelDragLeave = (event: DragEvent) => {
		event.preventDefault();
		if (!dropInFlight) dropTarget.dataset.state = 'ready';
	};
	const handlePanelDrop = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (dropInFlight) return;
		const fallbackImageUrl = droppedImageUrlFromTransfer(event.dataTransfer);
		dropInFlight = true;
		host.setAttribute('data-pastiche-drop-state', 'staging');
		dropTarget.dataset.state = 'active';
		dropTitle.textContent = 'Adding image…';
		dropDetail.textContent = 'Preserving the resolved original and source information.';

		void (async () => {
			const pending = (await ext.runtime.sendMessage({
				type: MSG_STAGE_PENDING_DRAG
			})) as { ok?: boolean; error?: string } | undefined;
			if (pending?.ok) return;
			if (!fallbackImageUrl) {
				throw new Error(pending?.error ?? 'The dragged image could not be staged.');
			}
			const fallback = (await ext.runtime.sendMessage({
				type: 'PASTICHE_STAGE_DROPPED_URL',
				imageUrl: fallbackImageUrl,
				sourceUrl: window.location.href,
				pageTitle: document.title
			})) as { ok?: boolean; error?: string } | undefined;
			if (!fallback?.ok) {
				throw new Error(fallback?.error ?? 'The dragged image URL could not be staged.');
			}
		})()
			.then(() => {
				host.setAttribute('data-pastiche-drop-state', 'added');
				dropTarget.dataset.state = 'added';
				dropTitle.textContent = 'Image added';
				dropDetail.textContent = 'It is ready in the capture tray.';
				setTimeout(() => {
					dropTarget.remove();
					embeddedDropTarget = null;
				}, 650);
			})
			.catch((error) => {
				dropInFlight = false;
				host.setAttribute('data-pastiche-drop-state', 'error');
				dropTarget.dataset.state = 'error';
				dropTitle.textContent = 'Could not add image';
				dropDetail.textContent =
					error instanceof Error ? error.message : 'The dragged image could not be staged.';
			});
	};

	bar.append(mark, title, close);
	body.append(frame);
	if (forDrag) {
		dropTarget.append(dropTitle, dropDetail);
		dropTarget.addEventListener('dragover', handlePanelDragOver);
		dropTarget.addEventListener('dragleave', handlePanelDragLeave);
		dropTarget.addEventListener('drop', handlePanelDrop);
		// Keeping the same listeners on the host covers browsers retargeting a
		// composed drag event at the closed shadow boundary.
		host.addEventListener('dragover', handlePanelDragOver);
		host.addEventListener('dragleave', handlePanelDragLeave);
		host.addEventListener('drop', handlePanelDrop);
		body.append(dropTarget);
		embeddedDropTarget = dropTarget;
	}
	panel.append(bar, body);
	shadow.append(style, panel);
	document.documentElement.append(host);
	embeddedCaptureHost = host;

	requestAnimationFrame(() => {
		if (host.isConnected) panel.dataset.visible = 'true';
	});
}

function hideEmbeddedCapturePanel(): void {
	embeddedCaptureHost?.remove();
	embeddedCaptureHost = null;
	embeddedDropTarget = null;
}

function resolvedDragTarget(
	event: Pick<MouseEvent, 'target' | 'clientX' | 'clientY'> & {
		composedPath?(): EventTarget[];
	}
): { element: Element; resolved: ResolvedImage } | null {
	const eventElements = [
		event.target,
		...(typeof event.composedPath === 'function' ? event.composedPath() : [])
	].filter((target): target is Element => target instanceof Element);
	for (const eventElement of eventElements) {
		const direct = resolveElement(eventElement);
		if (direct) return { element: eventElement, resolved: direct };
		const imageElement = eventElement.closest(
			'img, picture, video, canvas, [style*="background-image"]'
		);
		if (imageElement) {
			const resolved = resolveElement(imageElement);
			if (resolved) return { element: imageElement, resolved };
		}
	}
	return resolveTargetAtPoint(event.clientX, event.clientY);
}

function looksLikeImageDrag(event: DragEvent): boolean {
	const types = Array.from(event.dataTransfer?.types ?? []);
	if (
		types.includes('Files') ||
		types.includes('DownloadURL') ||
		types.includes('application/x-pastiche-image-url')
	) {
		return true;
	}
	return /<img\b/i.test(readTransferValue(event.dataTransfer, 'text/html'));
}

function droppedImageUrlFromTransfer(dataTransfer: DataTransfer | null): string | null {
	if (!dataTransfer) return null;
	for (const value of [
		readTransferValue(dataTransfer, 'application/x-pastiche-image-url'),
		urlFromDownloadTransfer(readTransferValue(dataTransfer, 'DownloadURL')),
		firstTransferLine(readTransferValue(dataTransfer, 'text/uri-list')),
		firstTransferLine(readTransferValue(dataTransfer, 'text/x-moz-url-data')),
		firstTransferLine(readTransferValue(dataTransfer, 'application/x-moz-file-promise-url')),
		firstTransferLine(readTransferValue(dataTransfer, 'text/x-moz-url')),
		imageUrlFromTransferHtml(readTransferValue(dataTransfer, 'text/html')),
		readTransferValue(dataTransfer, 'text/plain')
	]) {
		const url = validTransferImageUrl(value);
		if (url) return url;
	}
	return null;
}

function readTransferValue(dataTransfer: DataTransfer | null, type: string): string {
	try {
		return dataTransfer?.getData(type)?.trim() ?? '';
	} catch {
		return '';
	}
}

function firstTransferLine(value: string): string {
	return (
		value
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find((line) => line && !line.startsWith('#')) ?? ''
	);
}

function urlFromDownloadTransfer(value: string): string {
	const parts = value.split(':');
	return parts.length >= 3 ? parts.slice(2).join(':') : '';
}

function imageUrlFromTransferHtml(value: string): string {
	const match = value.match(/<img\b[^>]*\bsrc=(["']?)([^"'\s>]+)\1/i);
	return match?.[2]?.replace(/&amp;/gi, '&') ?? '';
}

function validTransferImageUrl(value: string): string | null {
	if (!value) return null;
	try {
		const url = new URL(value.startsWith('//') ? `https:${value}` : value, window.location.href);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Incoming message handler
// ---------------------------------------------------------------------------

ext.runtime.onMessage.addListener(
	(
		message: {
			type?: string;
			url?: string;
			minDimension?: number;
			captureKey?: string;
			imageUrl?: string;
			sourceElementPath?: string | null;
			pageUrl?: string;
		},
		_sender,
		sendResponse
	) => {
		switch (message.type) {
			case MSG_CONTENT_PING:
				sendResponse({ ok: true });
				break;

			case MSG_CAPTURE_ACTIVATE:
				enterSingleMode();
				sendResponse({ ok: true });
				break;

			case MSG_SHOW_CAPTURE_PANEL:
				if (isPasticheDocument()) {
					sendResponse({ ok: false, error: 'Capture is disabled inside Pastiche.' });
					break;
				}
				showEmbeddedCapturePanel(false);
				sendResponse({ ok: true });
				break;

			case MSG_CAPTURE_ACTIVATE_LASSO:
				enterLassoMode(message.minDimension ?? DEFAULT_MIN_DIMENSION);
				sendResponse({ ok: true });
				break;

			case MSG_SWEEP:
				void runSweep(message.minDimension ?? DEFAULT_MIN_DIMENSION).then(sendResponse);
				return true;

			case MSG_EXTRACT_PAGE_METADATA: {
				const target = targetForMetadataExtraction(message);
				try {
					const record = extractLiveMetadata(document, {
						pageUrl: message.pageUrl ?? window.location.href,
						imageUrl: message.imageUrl ?? message.captureKey ?? window.location.href,
						targetElement: target
					});
					sendResponse({ ok: true, record });
				} catch (error) {
					sendResponse({
						ok: false,
						error:
							error instanceof Error ? error.message : 'Metadata could not be read from this page.'
					});
				}
				break;
			}

			case MSG_DESELECT_ITEM: {
				const url = message.url;
				if (url) {
					const element = selectedByUrl.get(url);
					if (element) {
						removeBadge(element);
						selectedByUrl.delete(url);
					}
				}
				sendResponse({ ok: true });
				break;
			}

			case MSG_CLEAR_SELECTION:
				for (const [, element] of selectedByUrl) {
					removeBadge(element);
				}
				selectedByUrl.clear();
				sendResponse({ ok: true });
				break;

			default:
				// Not ours — don't call sendResponse, let other listeners handle it.
				return false;
		}

		return true;
	}
);

function targetForMetadataExtraction(message: {
	captureKey?: string;
	imageUrl?: string;
	sourceElementPath?: string | null;
}): Element | null {
	if (message.sourceElementPath) {
		try {
			const selected = document.querySelector(message.sourceElementPath);
			if (selected) return selected;
		} catch {
			// Continue with captured element and URL lookup.
		}
	}
	for (const key of [message.captureKey, message.imageUrl]) {
		if (!key) continue;
		const selected = selectedByUrl.get(key);
		if (selected?.isConnected) return selected;
	}
	const urls = new Set([message.captureKey, message.imageUrl].filter(Boolean));
	return (
		[...document.images].find((image) =>
			[image.currentSrc, image.src, image.dataset.original, image.dataset.fullSrc].some((url) =>
				urls.has(url)
			)
		) ?? null
	);
}

// ---------------------------------------------------------------------------
// Sidebar close / document unload — clean up everything
// ---------------------------------------------------------------------------

globalThis.addEventListener('unload', () => {
	exitCapture();
	teardown();
});
