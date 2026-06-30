/**
 * content/highlight.ts
 *
 * Manages the two on-page visual indicators injected during capture:
 *
 *   1. Hover highlight ring  — tracks the cursor during capture mode,
 *      outlines the best image target, shows a dimensions tooltip.
 *
 *   2. Selected badge        — a ✓ circle placed in the top-right corner
 *      of an element once it has been added to the sidebar list.
 *
 * Rules from the spec:
 *   - Ring: 2px accent-color outline, 4px border-radius, no fill, no shadow.
 *   - Tooltip: "{w} × {h}px" below the ring, does not obscure the image.
 *   - Badge: 20×20px max, accent fill, white ✓, top-right corner.
 *   - Both appear/disappear without animation lag.
 *   - Nothing injected when capture mode is inactive.
 *
 * The accent color is Pastiche's --color-accent CSS variable. We read it
 * from the host page's :root if Pastiche is the active tab, and fall back to
 * a hardcoded value otherwise — the extension's own pages don't inject
 * styles into third-party sites.
 */

// ---------------------------------------------------------------------------
// Accent color
// ---------------------------------------------------------------------------

/**
 * Pastiche accent color. If we're running in the Pastiche app tab, read the
 * CSS variable. Otherwise use the hardcoded design-system value.
 * (DESIGN.md: --color-accent: #b67aff  — Pastiche violet)
 */
const ACCENT = (() => {
	try {
		const v = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
		return v || '#b67aff';
	} catch {
		return '#b67aff';
	}
})();

// ---------------------------------------------------------------------------
// Shared container — a single absolutely-positioned div in the page that
// holds both the ring and any badges. Appended to <body> once on first use.
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
	if (container) return container;
	container = document.createElement('div');
	container.id = '__pastiche_overlay__';
	Object.assign(container.style, {
		position: 'fixed',
		top: '0',
		left: '0',
		width: '0',
		height: '0',
		// Must sit above page content but below browser chrome.
		zIndex: '2147483647',
		pointerEvents: 'none',
		overflow: 'visible'
	});
	document.body.appendChild(container);
	return container;
}

// ---------------------------------------------------------------------------
// Highlight ring
// ---------------------------------------------------------------------------

let ringEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;

/** Show the hover ring around the bounding rect of the given element. */
export function showRing(el: Element, naturalWidth: number, naturalHeight: number): void {
	const rect = el.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		hideRing();
		return;
	}

	const c = getContainer();

	if (!ringEl) {
		ringEl = document.createElement('div');
		ringEl.id = '__pastiche_ring__';
		c.appendChild(ringEl);
	}

	if (!tooltipEl) {
		tooltipEl = document.createElement('div');
		tooltipEl.id = '__pastiche_tooltip__';
		c.appendChild(tooltipEl);
	}

	Object.assign(ringEl.style, {
		display: 'block',
		position: 'fixed',
		top: `${rect.top}px`,
		left: `${rect.left}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		outline: `2px solid ${ACCENT}`,
		outlineOffset: '1px',
		borderRadius: '4px',
		background: 'transparent',
		boxShadow: 'none',
		pointerEvents: 'none',
		boxSizing: 'border-box'
	});

	// Tooltip: dimensions label below the ring, shifted right if it would clip
	// the bottom of the viewport.
	const label = `${naturalWidth} × ${naturalHeight}px`;
	tooltipEl.textContent = label;
	Object.assign(tooltipEl.style, {
		display: 'block',
		position: 'fixed',
		fontFamily: 'system-ui, sans-serif',
		fontSize: '11px',
		lineHeight: '1',
		color: '#fff',
		background: ACCENT,
		borderRadius: '3px',
		padding: '2px 5px',
		whiteSpace: 'nowrap',
		pointerEvents: 'none',
		// Position below the ring; flip above if too close to bottom.
		top: `${rect.bottom + 6 < window.innerHeight - 20 ? rect.bottom + 6 : rect.top - 20}px`,
		left: `${rect.left}px`
	});
}

/** Hide and detach the ring and tooltip. */
export function hideRing(): void {
	if (ringEl) ringEl.style.display = 'none';
	if (tooltipEl) tooltipEl.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Selected badges
// ---------------------------------------------------------------------------

export type BadgeState = 'pending' | 'confirmed' | 'error';

// Maps a DOM element to its badge div so we can remove it precisely.
const badges = new WeakMap<Element, HTMLDivElement>();

/**
 * Place a ✓ badge on the element's top-right corner.
 * Idempotent — calling twice on the same element is a no-op.
 */
export function addBadge(el: Element, state: BadgeState = 'confirmed'): void {
	if (badges.has(el)) {
		updateBadge(el, state);
		return;
	}

	const rect = el.getBoundingClientRect();
	const c = getContainer();

	const badge = document.createElement('div');
	badge.setAttribute('aria-hidden', 'true');
	badge.dataset.pasticheBadge = 'true';

	Object.assign(badge.style, {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'fixed',
		// Top-right corner of the element, inset slightly so it sits on the image.
		top: `${rect.top + 4}px`,
		left: `${rect.right - 24}px`,
		width: '20px',
		height: '20px',
		borderRadius: '50%',
		pointerEvents: 'none',
		boxSizing: 'border-box'
	});

	// SVG checkmark — clean and crisp at small sizes.
	badge.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <polyline points="2,6 5,9 10,3" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();

	c.appendChild(badge);
	badges.set(el, badge);
	updateBadge(el, state);
}

export function updateBadge(el: Element, state: BadgeState): void {
	const badge = badges.get(el);
	if (!badge) return;
	badge.dataset.pasticheState = state;
	badge.title =
		state === 'pending'
			? 'Sending to Pastiche'
			: state === 'error'
				? 'Capture failed'
				: 'Selected for Pastiche';
	badge.style.background = state === 'pending' ? '#d0a85c' : state === 'error' ? '#e06c75' : ACCENT;
	badge.style.opacity = state === 'pending' ? '0.82' : '1';
	badge.innerHTML =
		state === 'pending'
			? `<span style="width:8px;height:8px;border-radius:999px;background:#fff;opacity:.95"></span>`
			: state === 'error'
				? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" stroke="#fff" stroke-width="1.75" stroke-linecap="round"/></svg>`
				: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><polyline points="2,6 5,9 10,3" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * Remove the ✓ badge from an element (e.g. when the user removes it from the
 * sidebar list). Safe to call when no badge exists.
 */
export function removeBadge(el: Element): void {
	const badge = badges.get(el);
	if (!badge) return;
	badge.remove();
	badges.delete(el);
}

/**
 * Remove all badges (called on capture mode exit / sidebar close).
 */
export function clearAllBadges(): void {
	// WeakMap doesn't have an iterator; track elements separately.
	// We remove badge children directly from the container.
	if (!container) return;
	const allBadges = container.querySelectorAll<HTMLDivElement>('[data-pastiche-badge]');
	allBadges.forEach((b) => b.remove());
}

/**
 * Reposition all visible badges after a scroll or resize. Badges are fixed-
 * positioned relative to the viewport so they need to be nudged on scroll.
 * Call this from a scroll/resize listener in the content script.
 *
 * NOTE: badges track their element via WeakMap — we can't iterate it. Instead
 * each badge stores the element reference as a dataset attribute at attach time.
 * This function is registered but the badge repositioning is driven from
 * content/index.ts which holds the selectedElements set.
 */
export function repositionBadge(el: Element): void {
	const badge = badges.get(el);
	if (!badge) return;
	const rect = el.getBoundingClientRect();
	badge.style.top = `${rect.top + 4}px`;
	badge.style.left = `${rect.right - 24}px`;
}

// ---------------------------------------------------------------------------
// Lasso rectangle
// ---------------------------------------------------------------------------

let lassoEl: HTMLDivElement | null = null;

/** Show or update the lasso rubber-band rectangle. */
export function showLasso(startX: number, startY: number, endX: number, endY: number): void {
	const c = getContainer();

	if (!lassoEl) {
		lassoEl = document.createElement('div');
		lassoEl.id = '__pastiche_lasso__';
		Object.assign(lassoEl.style, {
			position: 'fixed',
			border: `2px dashed ${ACCENT}`,
			borderRadius: '2px',
			background: `${ACCENT}1a`, // ~10% opacity fill
			pointerEvents: 'none',
			boxSizing: 'border-box'
		});
		c.appendChild(lassoEl);
	}

	const x = Math.min(startX, endX);
	const y = Math.min(startY, endY);
	const w = Math.abs(endX - startX);
	const h = Math.abs(endY - startY);

	Object.assign(lassoEl.style, {
		display: 'block',
		left: `${x}px`,
		top: `${y}px`,
		width: `${w}px`,
		height: `${h}px`
	});
}

/** Remove the lasso rectangle from the page. */
export function hideLasso(): void {
	if (lassoEl) lassoEl.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Full cleanup (sidebar close / tab navigation)
// ---------------------------------------------------------------------------

/** Remove all Pastiche overlay elements from the DOM. */
export function teardown(): void {
	hideRing();
	hideLasso();
	container?.remove();
	container = null;
	ringEl = null;
	tooltipEl = null;
	lassoEl = null;
}
