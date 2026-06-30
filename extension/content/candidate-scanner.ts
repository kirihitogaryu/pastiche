import { parseSrcset } from 'srcset';
import type { ImageCandidate, ImageCandidateKind } from '../shared/candidates';
import { applySourceAdapterCandidateHints, transformCandidateUrl } from '../shared/source-adapters';

export type SrcsetCandidate = {
	url: string;
	width: number | null;
	density: number | null;
};

export type ScanDocumentOptions = {
	document: Document;
	pageUrl: string;
};

const LAZY_IMAGE_ATTRIBUTES = [
	'data-src',
	'data-original',
	'data-lazy',
	'data-load',
	'data-image',
	'data-original-src',
	'data-hi-res-src',
	'data-lazy-src',
	'data-actual-src',
	'data-full-src',
	'data-bg',
	'data-background',
	'data-img',
	'data-zoom-image'
];

export function scanDocumentForCandidates(options: ScanDocumentOptions): ImageCandidate[] {
	const candidates: ImageCandidate[] = [];

	for (const element of options.document.querySelectorAll('*')) {
		candidates.push(...candidatesForElement(element, options.pageUrl));
	}
	candidates.push(...metadataCandidates(options.document, options.pageUrl));

	return uniqueCandidates(candidates);
}

export function candidatesForElement(element: Element, pageUrl: string): ImageCandidate[] {
	const candidates: ImageCandidate[] = [];
	const rect = safeRect(element);

	if (element instanceof HTMLImageElement) {
		if (element.currentSrc || element.src) {
			candidates.push(
				createCandidate({
					url: element.currentSrc || element.src,
					kind: 'img',
					pageUrl,
					width: positiveNumber(element.naturalWidth),
					height: positiveNumber(element.naturalHeight),
					visibleWidth: positiveNumber(rect.width),
					visibleHeight: positiveNumber(rect.height),
					altText: element.alt || null
				})
			);
		}
		for (const srcset of extractSrcsetUrls(element.srcset)) {
			candidates.push(
				createCandidate({
					url: srcset.url,
					kind: 'srcset',
					pageUrl,
					width: srcset.width,
					height: null,
					visibleWidth: positiveNumber(rect.width),
					visibleHeight: positiveNumber(rect.height),
					altText: element.alt || null
				})
			);
		}
	}

	if (element instanceof HTMLSourceElement) {
		for (const srcset of extractSrcsetUrls(element.srcset)) {
			candidates.push(
				createCandidate({
					url: srcset.url,
					kind: 'picture',
					pageUrl,
					width: srcset.width,
					height: null,
					visibleWidth: positiveNumber(rect.width),
					visibleHeight: positiveNumber(rect.height),
					altText: null
				})
			);
		}
	}

	if (element instanceof HTMLVideoElement && element.poster) {
		candidates.push(
			createCandidate({
				url: element.poster,
				kind: 'video_poster',
				pageUrl,
				width: positiveNumber(element.videoWidth),
				height: positiveNumber(element.videoHeight),
				visibleWidth: positiveNumber(rect.width),
				visibleHeight: positiveNumber(rect.height),
				altText: null
			})
		);
	}

	if (element instanceof HTMLCanvasElement && element.width > 0 && element.height > 0) {
		try {
			candidates.push(
				createCandidate({
					url: element.toDataURL('image/png'),
					kind: 'canvas',
					pageUrl,
					width: element.width,
					height: element.height,
					visibleWidth: positiveNumber(rect.width),
					visibleHeight: positiveNumber(rect.height),
					altText: null,
					inlineData: element.toDataURL('image/png'),
					mimeType: 'image/png'
				})
			);
		} catch {
			// Tainted canvases cannot be exported.
		}
	}

	for (const url of extractBackgroundUrls(element)) {
		candidates.push(
			createCandidate({
				url,
				kind: 'background',
				pageUrl,
				width: null,
				height: null,
				visibleWidth: positiveNumber(rect.width),
				visibleHeight: positiveNumber(rect.height),
				altText: null
			})
		);
	}

	for (const url of extractLazyAttributeUrls(element)) {
		candidates.push(
			createCandidate({
				url,
				kind: 'data_attribute',
				pageUrl,
				width: null,
				height: null,
				visibleWidth: positiveNumber(rect.width),
				visibleHeight: positiveNumber(rect.height),
				altText: null
			})
		);
	}

	const linkedImage = closestLinkedImageUrl(element);
	if (linkedImage) {
		candidates.push(
			createCandidate({
				url: linkedImage,
				kind: 'link',
				pageUrl,
				width: null,
				height: null,
				visibleWidth: positiveNumber(rect.width),
				visibleHeight: positiveNumber(rect.height),
				altText: null
			})
		);
	}

	return uniqueCandidates(candidates);
}

export function extractSrcsetUrls(value: string): SrcsetCandidate[] {
	if (!value.trim()) return [];
	try {
		return parseSrcset(value).map((candidate) => ({
			url: candidate.url,
			width: typeof candidate.width === 'number' ? candidate.width : null,
			density: typeof candidate.density === 'number' ? candidate.density : null
		}));
	} catch {
		return [];
	}
}

export function extractCssUrls(value: string): string[] {
	const urls: string[] = [];
	for (const match of value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
		const url = match[2]?.trim();
		if (url) urls.push(url);
	}
	return urls;
}

function metadataCandidates(document: Document, pageUrl: string): ImageCandidate[] {
	const candidates: ImageCandidate[] = [];
	const instagramMediaUrl = instagramMediaCandidateUrl(pageUrl);

	if (instagramMediaUrl) {
		candidates.push(
			createCandidate({
				url: instagramMediaUrl,
				kind: 'meta',
				pageUrl,
				width: null,
				height: null,
				visibleWidth: null,
				visibleHeight: null,
				altText: null
			})
		);
	}

	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[property], meta[name]')) {
		const key = (meta.getAttribute('property') ?? meta.getAttribute('name') ?? '').toLowerCase();
		if ((key === 'og:image' || key === 'og:image:url' || key === 'twitter:image') && meta.content) {
			candidates.push(
				createCandidate({
					url: meta.content,
					kind: 'meta',
					pageUrl,
					width: null,
					height: null,
					visibleWidth: null,
					visibleHeight: null,
					altText: null
				})
			);
		}
	}

	for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel][href]')) {
		const rel = link.rel.toLowerCase();
		if (rel.includes('image_src') || rel.includes('preload')) {
			candidates.push(
				createCandidate({
					url: link.href,
					kind: 'meta',
					pageUrl,
					width: null,
					height: null,
					visibleWidth: null,
					visibleHeight: null,
					altText: null
				})
			);
		}
	}

	for (const script of document.querySelectorAll<HTMLScriptElement>(
		'script[type="application/ld+json"]'
	)) {
		for (const url of imageValuesFromJson(script.textContent ?? '')) {
			candidates.push(
				createCandidate({
					url,
					kind: 'json_ld',
					pageUrl,
					width: null,
					height: null,
					visibleWidth: null,
					visibleHeight: null,
					altText: null
				})
			);
		}
	}

	return candidates;
}

function instagramMediaCandidateUrl(pageUrl: string): string | null {
	try {
		const url = new URL(pageUrl);
		const host = url.hostname.replace(/^www\./, '').toLowerCase();
		if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return null;
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts.length < 2 || !['p', 'reel', 'tv'].includes(parts[0] ?? '')) return null;
		return new URL(`/${parts[0]}/${parts[1]}/media?size=l`, url.origin).toString();
	} catch {
		return null;
	}
}

function extractBackgroundUrls(element: Element): string[] {
	const values: string[] = [];
	if (element instanceof HTMLElement && element.style.backgroundImage) {
		values.push(element.style.backgroundImage);
	}
	try {
		const computed = getComputedStyle(element);
		if (computed.backgroundImage && computed.backgroundImage !== 'none') {
			values.push(computed.backgroundImage);
		}
	} catch {
		// getComputedStyle is unavailable in some test or extension contexts.
	}
	return [...new Set(values.flatMap(extractCssUrls))];
}

function extractLazyAttributeUrls(element: Element): string[] {
	const urls: string[] = [];
	for (const attribute of LAZY_IMAGE_ATTRIBUTES) {
		const value = element.getAttribute(attribute);
		if (!value) continue;
		if (attribute === 'data-srcset') {
			urls.push(...extractSrcsetUrls(value).map((candidate) => candidate.url));
			continue;
		}
		urls.push(value);
	}
	return urls;
}

function closestLinkedImageUrl(element: Element): string | null {
	const link = element.closest<HTMLAnchorElement>('a[href]');
	if (!link?.href) return null;
	return /\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(link.href) ? link.href : null;
}

function createCandidate(input: {
	url: string;
	kind: ImageCandidateKind;
	pageUrl: string;
	width: number | null;
	height: number | null;
	visibleWidth: number | null;
	visibleHeight: number | null;
	altText: string | null;
	inlineData?: string | null;
	mimeType?: string | null;
}): ImageCandidate {
	const url = transformCandidateUrl(absolutizeUrl(input.url, input.pageUrl), {
		pageUrl: input.pageUrl
	});
	return applySourceAdapterCandidateHints(
		{
			id: `${input.kind}:${url}`,
			url,
			kind: input.kind,
			width: input.width,
			height: input.height,
			visibleWidth: input.visibleWidth,
			visibleHeight: input.visibleHeight,
			mimeType: input.mimeType ?? null,
			byteSize: null,
			altText: input.altText,
			sourceElementPath: null,
			detailUrl: null,
			inlineData: input.inlineData ?? null,
			score: 0,
			confidence: 'medium',
			rejectionReasons: [],
			scoreReasons: []
		},
		{
			pageUrl: input.pageUrl
		}
	);
}

function imageValuesFromJson(value: string): string[] {
	try {
		return imageValues(JSON.parse(value));
	} catch {
		return [];
	}
}

function imageValues(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(imageValues);
	if (!value || typeof value !== 'object') return [];

	const object = value as Record<string, unknown>;
	const direct = object.image ?? object.thumbnailUrl ?? object.contentUrl ?? object.url;
	const nested = Object.values(object).flatMap((entry) =>
		entry === direct ? [] : imageValues(entry)
	);
	return [...imageValues(direct), ...nested];
}

function uniqueCandidates(candidates: ImageCandidate[]): ImageCandidate[] {
	const seen = new Set<string>();
	const unique: ImageCandidate[] = [];
	for (const candidate of candidates) {
		const key = candidate.url;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(candidate);
	}
	return unique;
}

function absolutizeUrl(value: string, pageUrl: string): string {
	if (value.startsWith('data:') || value.startsWith('blob:')) return value;
	try {
		return new URL(value, pageUrl).toString();
	} catch {
		return value;
	}
}

function safeRect(element: Element): DOMRect {
	try {
		return element.getBoundingClientRect();
	} catch {
		return new DOMRect();
	}
}

function positiveNumber(value: number): number | null {
	return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}
