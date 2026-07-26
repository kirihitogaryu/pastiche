import { chooseBestCandidate, scoreCandidate } from '../shared/candidate-scoring';
import type { CaptureMetadata, CaptureSource, ImageCandidate } from '../shared/candidates';
import { sourceContextForPage, sourceMetadataForPage } from '../shared/source-adapters';
import { candidatesForTarget } from './candidate-scanner';
import { selectorForElement } from './metadata-adapters';

/**
 * content/resolver.ts
 *
 * Given a DOM element (or a point via elementsFromPoint), resolves the best
 * image URL and its natural dimensions. Resolution priority follows the spec:
 *   1. <img currentSrc/src>
 *   3. CSS background-image
 *   4. <video>       — poster, then current-frame canvas export
 *   5. <canvas>      — toDataURL export
 *
 * Returns null if no image can be resolved from the element.
 *
 * All functions are pure / synchronous except resolveVideoFrame which needs
 * a tick to draw. The caller (content/index.ts) awaits resolveImageTarget.
 */

export type ResolvedImage = {
	/** The URL to store or fetch. Already upsized via resolveArtsyImage. */
	url: string;
	/** Candidate selected by the candidate scanner. */
	selectedCandidateId: string;
	/** Candidate set discovered from the selected element, including alternates. */
	candidates: ImageCandidate[];
	/** Page/source context for import metadata. */
	source: CaptureSource;
	/** Editable metadata inferred in the content script. */
	metadata: CaptureMetadata;
	/** Natural pixel width of the source image. */
	naturalWidth: number;
	/** Natural pixel height of the source image. */
	naturalHeight: number;
	/** MIME type when known (canvas / video exports). null otherwise. */
	mimeType: string | null;
	/**
	 * For canvas/video exports the bytes are already available as a data URL.
	 * The service worker should use this directly rather than re-fetching.
	 */
	inlineData: string | null;
	/** The alt attribute text if available. */
	altText: string | null;
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Walk the element stack at (x, y) and return the first resolvable image, or
 * null if none of the elements in the stack yield an image.
 *
 * Pass the raw pointer-event coordinates — no scrolling adjustment needed
 * because elementsFromPoint works in viewport space.
 */
export function resolveAtPoint(x: number, y: number): ResolvedImage | null {
	return resolveTargetAtPoint(x, y)?.resolved ?? null;
}

export function resolveTargetAtPoint(
	x: number,
	y: number
): { element: Element; resolved: ResolvedImage } | null {
	const elements = document.elementsFromPoint(x, y);
	for (const el of elements) {
		const result = resolveElement(el);
		if (result) return { element: el, resolved: result };

		const child = resolvableDescendantAtPoint(el, x, y);
		if (!child) continue;
		const childResult = resolveElement(child);
		if (childResult) return { element: child, resolved: childResult };
	}
	return null;
}

/**
 * Resolve from a specific element directly (used for sweep and lasso modes
 * where we already have the element reference).
 */
export function resolveElement(el: Element): ResolvedImage | null {
	const sourceElementPath = selectorForElement(el);
	const detailUrl = detailUrlForElement(el);
	const candidates = candidatesForTarget(el, document, window.location.href).map((item) =>
		scoreCandidate(
			{
				...item,
				url: applyArtsyUpsize(item.url),
				sourceElementPath: item.sourceElementPath ?? sourceElementPath,
				detailUrl: item.detailUrl ?? detailUrl
			},
			{ minDimension: 300, directSelection: true }
		)
	);
	const candidate = chooseBestCandidate(candidates);
	if (candidate) {
		return {
			url: candidate.url,
			selectedCandidateId: candidate.id,
			candidates,
			source: sourceForResolvedCandidate(candidate),
			metadata: metadataForResolvedCandidate(candidate, el),
			naturalWidth: candidate.width ?? measuredWidthFor(el),
			naturalHeight: candidate.height ?? measuredHeightFor(el),
			mimeType: candidate.mimeType,
			inlineData: candidate.inlineData,
			altText: candidate.altText
		};
	}

	if (el instanceof HTMLImageElement) return resolveImg(el);
	if (el instanceof HTMLVideoElement) return resolveVideo(el);
	if (el instanceof HTMLCanvasElement) return resolveCanvas(el);
	return resolveCssBackground(el);
}

function resolvableDescendantAtPoint(el: Element, x: number, y: number): Element | null {
	const descendants = el.querySelectorAll(
		'img, video, canvas, div[style*="background"], figure, a[style*="background"], section[style*="background"]'
	);
	return (
		[...descendants].find((candidate) =>
			rectContainsPoint(candidate.getBoundingClientRect(), x, y)
		) ?? null
	);
}

// ---------------------------------------------------------------------------
// Sweep: collect all image candidates from the full DOM
// ---------------------------------------------------------------------------

export type SweepCandidate = ResolvedImage & { element: Element };

/**
 * Scan the full DOM for image candidates above the size threshold.
 * Deduplicates by resolved URL.
 * Used by the Page Sweep capture mode.
 */
export function sweepPage(minDimension: number): SweepCandidate[] {
	const seen = new Set<string>();
	const results: SweepCandidate[] = [];

	const candidates: Element[] = [
		...document.querySelectorAll('img'),
		...document.querySelectorAll('video'),
		...document.querySelectorAll('canvas'),
		// Generic elements may carry background-image; restrict to common containers.
		...document.querySelectorAll(
			'div[style*="background"], figure, a[style*="background"], section[style*="background"]'
		)
	];

	for (const el of candidates) {
		const resolved = resolveElement(el);
		if (!resolved) continue;
		if (resolved.naturalWidth < minDimension && resolved.naturalHeight < minDimension) continue;
		if (seen.has(resolved.url)) continue;
		seen.add(resolved.url);
		results.push({ ...resolved, element: el });
	}

	return results;
}

/**
 * Collect all image elements whose bounding rect intersects the given
 * selection rectangle. Used by the Region Lasso capture mode.
 */
export function collectInRegion(rect: DOMRect, minDimension: number): SweepCandidate[] {
	const seen = new Set<string>();
	const results: SweepCandidate[] = [];

	const candidates: Element[] = [
		...document.querySelectorAll('img'),
		...document.querySelectorAll('video'),
		...document.querySelectorAll('canvas'),
		...document.querySelectorAll(
			'div[style*="background"], figure, a[style*="background"], section[style*="background"]'
		)
	];

	for (const el of candidates) {
		const elRect = el.getBoundingClientRect();
		if (!rectsIntersect(elRect, rect)) continue;
		const resolved = resolveElement(el);
		if (!resolved) continue;
		if (resolved.naturalWidth < minDimension && resolved.naturalHeight < minDimension) continue;
		if (seen.has(resolved.url)) continue;
		seen.add(resolved.url);
		results.push({ ...resolved, element: el });
	}

	return results;
}

// ---------------------------------------------------------------------------
// Resolution strategies
// ---------------------------------------------------------------------------

function resolveImg(img: HTMLImageElement): ResolvedImage | null {
	const resolvedUrl = img.currentSrc || img.src;
	if (resolvedUrl && resolvedUrl !== window.location.href) {
		return {
			url: applyArtsyUpsize(resolvedUrl),
			selectedCandidateId: `candidate-${hashish(resolvedUrl)}`,
			candidates: [legacyCandidateForResolvedUrl(applyArtsyUpsize(resolvedUrl), 'img', img)],
			source: sourceForUrl(applyArtsyUpsize(resolvedUrl), null),
			metadata: metadataForText(img.alt || null, applyArtsyUpsize(resolvedUrl), img),
			naturalWidth: img.naturalWidth,
			naturalHeight: img.naturalHeight,
			mimeType: null,
			inlineData: null,
			altText: img.alt || null
		};
	}

	return null;
}

function resolveVideo(video: HTMLVideoElement): ResolvedImage | null {
	// Strategy 4a: poster
	if (video.poster) {
		return {
			url: applyArtsyUpsize(video.poster),
			selectedCandidateId: `candidate-${hashish(video.poster)}`,
			candidates: [
				legacyCandidateForResolvedUrl(applyArtsyUpsize(video.poster), 'video_poster', video)
			],
			source: sourceForUrl(applyArtsyUpsize(video.poster), null),
			metadata: metadataForText(null, applyArtsyUpsize(video.poster), video),
			naturalWidth: video.videoWidth || video.offsetWidth,
			naturalHeight: video.videoHeight || video.offsetHeight,
			mimeType: null,
			inlineData: null,
			altText: null
		};
	}

	// Strategy 4b: current frame via canvas
	if (video.videoWidth > 0 && video.videoHeight > 0) {
		try {
			const canvas = document.createElement('canvas');
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) return null;
			ctx.drawImage(video, 0, 0);
			const dataUrl = canvas.toDataURL('image/png');
			return {
				url: dataUrl,
				selectedCandidateId: `candidate-${hashish(dataUrl)}`,
				candidates: [legacyCandidateForResolvedUrl(dataUrl, 'video_frame', video)],
				source: sourceForUrl(dataUrl, null),
				metadata: metadataForText(null, dataUrl, video),
				naturalWidth: video.videoWidth,
				naturalHeight: video.videoHeight,
				mimeType: 'image/png',
				inlineData: dataUrl,
				altText: null
			};
		} catch {
			// Cross-origin video — can't draw to canvas.
			return null;
		}
	}

	return null;
}

function resolveCanvas(canvas: HTMLCanvasElement): ResolvedImage | null {
	if (canvas.width === 0 || canvas.height === 0) return null;
	try {
		const dataUrl = canvas.toDataURL('image/png');
		return {
			url: dataUrl,
			selectedCandidateId: `candidate-${hashish(dataUrl)}`,
			candidates: [legacyCandidateForResolvedUrl(dataUrl, 'canvas', canvas)],
			source: sourceForUrl(dataUrl, null),
			metadata: metadataForText(null, dataUrl, canvas),
			naturalWidth: canvas.width,
			naturalHeight: canvas.height,
			mimeType: 'image/png',
			inlineData: dataUrl,
			altText: null
		};
	} catch {
		// Cross-origin canvas (tainted).
		return null;
	}
}

function resolveCssBackground(el: Element): ResolvedImage | null {
	const style = window.getComputedStyle(el);
	const bg = style.backgroundImage;
	if (!bg || bg === 'none') return null;

	const url = extractCssUrl(bg);
	if (!url) return null;

	// We don't have naturalWidth/naturalHeight for CSS backgrounds without
	// loading the image. Use a best-effort measurement from the element size,
	// then let the import service store whatever the real dimensions are.
	return {
		url: applyArtsyUpsize(url),
		selectedCandidateId: `candidate-${hashish(url)}`,
		candidates: [legacyCandidateForResolvedUrl(applyArtsyUpsize(url), 'background', el)],
		source: sourceForUrl(applyArtsyUpsize(url), null),
		metadata: metadataForText(null, applyArtsyUpsize(url), el),
		naturalWidth: (el as HTMLElement).offsetWidth,
		naturalHeight: (el as HTMLElement).offsetHeight,
		mimeType: null,
		inlineData: null,
		altText: null
	};
}

// ---------------------------------------------------------------------------
// CSS url() extractor
// ---------------------------------------------------------------------------

/**
 * Extract the first URL from a CSS `background-image` value.
 * Handles both quote styles: url("..."), url('...'), url(...)
 * Ignores gradient() values.
 */
function extractCssUrl(value: string): string | null {
	// Match url( ... ) — non-greedy, handle optional quotes
	const match = value.match(/url\(\s*(['"]?)([^'"()]+)\1\s*\)/);
	if (!match) return null;
	const url = match[2].trim();
	if (!url || url.startsWith('data:')) return url || null;
	return url;
}

// ---------------------------------------------------------------------------
// Artsy CDN upsizing (spec §Storage Mode / Artsy CDN Upsizing)
// ---------------------------------------------------------------------------

function applyArtsyUpsize(url: string): string {
	if (!url.includes('d32dm0rphc51dk.cloudfront.net')) return url;
	return url.replace(/\/(square|small|medium|large|normalized|tall)\.jpg$/, '/larger.jpg');
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
	return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function rectContainsPoint(rect: DOMRect, x: number, y: number): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function measuredWidthFor(el: Element): number {
	if (el instanceof HTMLImageElement) return el.naturalWidth || el.width || el.offsetWidth;
	if (el instanceof HTMLVideoElement) return el.videoWidth || el.offsetWidth;
	if (el instanceof HTMLCanvasElement) return el.width;
	return (el as HTMLElement).offsetWidth || 0;
}

function measuredHeightFor(el: Element): number {
	if (el instanceof HTMLImageElement) return el.naturalHeight || el.height || el.offsetHeight;
	if (el instanceof HTMLVideoElement) return el.videoHeight || el.offsetHeight;
	if (el instanceof HTMLCanvasElement) return el.height;
	return (el as HTMLElement).offsetHeight || 0;
}

function legacyCandidateForResolvedUrl(
	url: string,
	kind: ImageCandidate['kind'],
	element: Element
): ImageCandidate {
	const rect = element.getBoundingClientRect();
	const altText = element instanceof HTMLImageElement ? element.alt || null : null;
	return {
		id: `candidate-${hashish(url)}`,
		url,
		kind,
		width: measuredWidthFor(element),
		height: measuredHeightFor(element),
		visibleWidth: rect.width || null,
		visibleHeight: rect.height || null,
		mimeType: null,
		byteSize: null,
		altText,
		sourceElementPath: selectorForElement(element),
		detailUrl: detailUrlForElement(element),
		inlineData: url.startsWith('data:') ? url : null,
		score: 0,
		confidence: 'medium',
		rejectionReasons: [],
		scoreReasons: []
	};
}

function detailUrlForElement(element: Element): string | null {
	const href = element.closest<HTMLAnchorElement>('a[href]')?.href;
	if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return null;
	try {
		return new URL(href, window.location.href).toString();
	} catch {
		return null;
	}
}

function sourceForResolvedCandidate(candidate: ImageCandidate): CaptureSource {
	return sourceForUrl(candidate.url, candidate.detailUrl);
}

function sourceForUrl(url: string, detailUrl: string | null): CaptureSource {
	return {
		...sourceContextForPage(window.location.href, url),
		detailUrl
	};
}

function metadataForResolvedCandidate(
	candidate: ImageCandidate,
	targetElement: Element
): CaptureMetadata {
	return metadataForText(candidate.altText, candidate.url, targetElement);
}

function metadataForText(
	text: string | null,
	url: string,
	targetElement: Element | null = null
): CaptureMetadata {
	const adapterMetadata = sourceMetadataForPage(document, {
		pageUrl: window.location.href,
		imageUrl: url,
		altText: text,
		targetElement
	});
	return {
		...adapterMetadata,
		title: adapterMetadata.title || text?.trim() || titleFromFilename(url) || 'Untitled'
	};
}

function titleFromFilename(url: string): string | null {
	try {
		const file = new URL(url).pathname.split('/').filter(Boolean).at(-1);
		if (!file) return null;
		const title = decodeURIComponent(file)
			.replace(/\.[a-z0-9]{2,5}$/i, '')
			.replace(/[-_]+/g, ' ')
			.trim();
		return title || null;
	} catch {
		return null;
	}
}

function hashish(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0;
	}
	return Math.abs(hash).toString(36);
}
