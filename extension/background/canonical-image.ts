export type ResolveCanonicalImageOptions = {
	imageUrl: string;
	detailUrl: string | null;
	fetchHtml?: (url: string) => Promise<string>;
};

export type CanonicalImageResult = {
	url: string;
	detailUrl: string | null;
	candidates: string[];
};

const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;
const STRONG_TERMS = [
	'original',
	'/orig/',
	'orig',
	'full',
	'fullsize',
	'large',
	'larger',
	'master'
];
const WEAK_TERMS = [
	'thumb',
	'thumbnail',
	'preview',
	'sample',
	'small',
	'medium',
	'card',
	'crop',
	'cropped'
];

export async function resolveCanonicalImage(
	options: ResolveCanonicalImageOptions
): Promise<CanonicalImageResult> {
	const visibleUrl = normalizeImageQualityUrl(options.imageUrl);
	const detailUrl = options.detailUrl;
	const candidates = [visibleUrl];

	if (detailUrl) {
		try {
			const html = options.fetchHtml
				? await options.fetchHtml(detailUrl)
				: await fetchDetailPageHtml(detailUrl);
			candidates.push(...extractImageCandidates(html, detailUrl));
		} catch {
			// Detail pages can fail due to auth, blocking, or transient network errors.
			// The visible image URL remains a valid fallback.
		}
	}

	const uniqueCandidates = unique(candidates.map(normalizeImageQualityUrl));
	return {
		url: chooseCanonicalImageUrl(visibleUrl, uniqueCandidates),
		detailUrl,
		candidates: uniqueCandidates
	};
}

export function normalizeImageQualityUrl(value: string): string {
	try {
		const url = new URL(value);
		if (url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/')) {
			url.searchParams.set('name', 'orig');
		}
		return url.toString();
	} catch {
		return value;
	}
}

export function chooseCanonicalImageUrl(visibleUrl: string, candidates: string[]): string {
	const normalizedVisible = normalizeImageQualityUrl(visibleUrl);
	const allCandidates = unique([normalizedVisible, ...candidates.map(normalizeImageQualityUrl)]);

	return allCandidates.reduce((best, candidate) =>
		scoreCandidate(candidate, normalizedVisible) > scoreCandidate(best, normalizedVisible)
			? candidate
			: best
	);
}

export function extractImageCandidates(html: string, baseUrl: string): string[] {
	const candidates: string[] = [];

	for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attrs = attributesFor(tag[0]);
		const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
		if (
			(key === 'og:image' || key === 'twitter:image' || key === 'og:image:url') &&
			attrs.content
		) {
			addCandidate(candidates, attrs.content, baseUrl);
		}
	}

	for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
		const attrs = attributesFor(tag[0]);
		const rel = (attrs.rel ?? '').toLowerCase();
		if ((rel.includes('image_src') || rel.includes('preload')) && attrs.href) {
			addCandidate(candidates, attrs.href, baseUrl);
		}
	}

	for (const tag of html.matchAll(/<(?:a|img|source)\b[^>]*>/gi)) {
		const attrs = attributesFor(tag[0]);
		for (const value of [attrs.href, attrs.src, attrs.srcset]) {
			if (!value) continue;
			for (const url of imageUrlsFromAttribute(value)) {
				addCandidate(candidates, url, baseUrl);
			}
		}
	}

	for (const script of html.matchAll(
		/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
	)) {
		for (const url of imageUrlsFromJson(script[1])) {
			addCandidate(candidates, url, baseUrl);
		}
	}

	return unique(candidates.map(normalizeImageQualityUrl));
}

function scoreCandidate(candidate: string, visibleUrl: string) {
	const lower = candidate.toLowerCase();
	let score = candidate === visibleUrl ? 1 : 0;

	if (IMAGE_EXTENSION_PATTERN.test(candidate)) score += 10;
	if (lower.includes('/original/')) score += 80;
	for (const term of STRONG_TERMS) {
		if (lower.includes(term)) score += 20;
	}
	for (const term of WEAK_TERMS) {
		if (lower.includes(term)) score -= 30;
	}
	if (lower.includes('pbs.twimg.com/media/') && lower.includes('name=orig')) score += 70;

	try {
		const url = new URL(candidate);
		const visible = new URL(visibleUrl);
		if (url.hostname === visible.hostname) score += 3;
	} catch {
		// Ignore malformed candidates; they still remain fallback strings.
	}

	return score;
}

async function fetchDetailPageHtml(url: string) {
	const response = await fetch(url, {
		headers: { accept: 'text/html,application/xhtml+xml' },
		credentials: 'include',
		signal: AbortSignal.timeout(5000)
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.text();
}

function attributesFor(tag: string) {
	const attrs: Record<string, string> = {};
	for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
		attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attrs;
}

function imageUrlsFromAttribute(value: string) {
	if (!value.includes(',')) return [value.trim()];
	return value
		.split(',')
		.map((entry) => entry.trim().split(/\s+/)[0])
		.filter(Boolean);
}

function imageUrlsFromJson(value: string) {
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
	const direct = object.image ?? object.thumbnailUrl ?? object.contentUrl;
	const nested = Object.values(object).flatMap((entry) => {
		if (entry === direct) return [];
		return imageValues(entry);
	});
	return [...imageValues(direct), ...nested];
}

function addCandidate(candidates: string[], value: string, baseUrl: string) {
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return;

	try {
		const url = new URL(trimmed, baseUrl).toString();
		if (isImageCandidate(url)) candidates.push(url);
	} catch {
		// Ignore values that are not URLs.
	}
}

function isImageCandidate(url: string) {
	const lower = url.toLowerCase();
	return (
		IMAGE_EXTENSION_PATTERN.test(lower) ||
		lower.includes('/media/') ||
		lower.includes('/original/') ||
		lower.includes('/sample/') ||
		lower.includes('/full/')
	);
}

function decodeHtml(value: string) {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

function unique<T>(values: T[]) {
	return [...new Set(values)];
}
