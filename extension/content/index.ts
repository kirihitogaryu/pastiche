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
	resolveTargetAtPoint,
	sweepPage,
	collectInRegion,
	type ResolvedImage,
	type SweepCandidate
} from './resolver';
import { deliverCapturedItem, deliverCapturedItems } from './capture-delivery';
import type { CaptureMetadata, CaptureSource, ImageCandidate } from '../shared/candidates';
import type { CapturedItemPayload } from '../shared/types';

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
const MSG_ITEM_CAPTURED = 'PASTICHE_ITEM_CAPTURED';
const MSG_SWEEP_RESULTS = 'PASTICHE_SWEEP_RESULTS';
const MSG_LASSO_RESULTS = 'PASTICHE_LASSO_RESULTS';

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

function enterLassoMode(): void {
	if (mode !== 'idle') exitCapture();
	mode = 'lasso';
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

	const candidates = collectInRegion(selectionRect, DEFAULT_MIN_DIMENSION);
	const newCandidates = candidates.filter((c) => !selectedByUrl.has(c.url));

	if (newCandidates.length > 0) {
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

function runSweep(minDimension: number): void {
	const candidates = sweepPage(minDimension);

	// Don't re-badge elements already selected.
	const newCandidates = candidates.filter((c) => !selectedByUrl.has(c.url));

	if (newCandidates.length > 0) {
		void deliverCapturedItems({
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
	}
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

// ---------------------------------------------------------------------------
// Incoming message handler
// ---------------------------------------------------------------------------

ext.runtime.onMessage.addListener(
	(message: { type?: string; url?: string; minDimension?: number }, _sender, sendResponse) => {
		switch (message.type) {
			case MSG_CONTENT_PING:
				sendResponse({ ok: true });
				break;

			case MSG_CAPTURE_ACTIVATE:
				enterSingleMode();
				sendResponse({ ok: true });
				break;

			case MSG_CAPTURE_ACTIVATE_LASSO:
				enterLassoMode();
				sendResponse({ ok: true });
				break;

			case MSG_SWEEP:
				runSweep(message.minDimension ?? DEFAULT_MIN_DIMENSION);
				// Results sent via a separate sendMessage, not via sendResponse,
				// because the sweep may take a tick and sendResponse must be
				// synchronous after returning true.
				sendResponse({ ok: true });
				break;

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

// ---------------------------------------------------------------------------
// Sidebar close / document unload — clean up everything
// ---------------------------------------------------------------------------

globalThis.addEventListener('unload', () => {
	exitCapture();
	teardown();
});
