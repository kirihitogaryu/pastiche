import type {
	CaptureMetadata,
	CaptureSource,
	CaptureSourceType,
	ImageCandidate,
	SourceTag
} from './candidates';

export type SourceAdapterContext = {
	pageUrl: string;
	imageUrl?: string | null;
	altText?: string | null;
};

export function sourceContextForPage(
	pageUrl: string,
	imageUrl: string | null = null
): CaptureSource {
	const pageHost = hostnameFrom(pageUrl) ?? '';
	const imageHost = hostnameFrom(imageUrl);
	const source = knownSourceForHost(pageHost);

	return {
		pageUrl,
		canonicalPageUrl: pageUrl,
		detailUrl: pageUrl,
		sourceLabel: source?.label ?? readableHost(pageHost || imageHost) ?? 'Unknown Source',
		sourceType: source?.type ?? (pageHost ? 'web' : imageHost ? 'cdn' : 'unknown'),
		pageHost,
		imageHost
	};
}

export function sourceMetadataForPage(
	document: Document,
	context: SourceAdapterContext
): CaptureMetadata {
	const pageHost = hostnameFrom(context.pageUrl) ?? '';
	const ogTitle = metaContent(document, 'property', 'og:title') ?? document.title ?? null;
	const altTitle = context.altText?.trim() || null;
	const title =
		titleForHost(pageHost, ogTitle) ?? altTitle ?? titleFromUrl(context.imageUrl) ?? 'Untitled';
	const artist = artistForHost(document, pageHost);
	const sourceTags = sourceTagsForHost(document, pageHost);
	const suggestedTags = sourceTags.map((tag) => tag.label);

	return {
		title,
		artist,
		date: null,
		tags: [],
		acceptedConceptSlugs: [],
		suggestedTags,
		sourceTags,
		description: metaContent(document, 'name', 'description'),
		rawPageTitle: document.title || ogTitle,
		rawAltText: context.altText ?? null
	};
}

export function transformCandidateUrl(url: string, context: SourceAdapterContext): string {
	const pageHost = hostnameFrom(context.pageUrl) ?? '';
	if (isXHost(pageHost) || hostnameFrom(url) === 'pbs.twimg.com') {
		return twitterOriginalUrl(url);
	}
	return url;
}

export function instagramLargeMediaUrl(pageUrl: string): string | null {
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

export function applySourceAdapterCandidateHints(
	candidate: ImageCandidate,
	context: SourceAdapterContext
): ImageCandidate {
	const pageHost = hostnameFrom(context.pageUrl) ?? '';
	const transformed = transformCandidateUrl(candidate.url, context);
	let score = candidate.score;
	const scoreReasons = [...candidate.scoreReasons];

	if (isDanbooruHost(pageHost)) {
		const lower = transformed.toLowerCase();
		if (lower.includes('/original/')) {
			score += 45;
			scoreReasons.push('Danbooru original file');
		}
		if (lower.includes('/sample/')) {
			score -= 35;
			scoreReasons.push('Danbooru sample file');
		}
	}

	return {
		...candidate,
		url: transformed,
		id: candidate.url === transformed ? candidate.id : `${candidate.kind}:${transformed}`,
		score,
		scoreReasons
	};
}

function knownSourceForHost(host: string): { label: string; type: CaptureSourceType } | null {
	if (isXHost(host)) return { label: 'X', type: 'social' };
	if (isDanbooruHost(host)) return { label: 'Danbooru', type: 'booru' };
	if (host.endsWith('tumblr.com')) return { label: 'Tumblr', type: 'social' };
	if (host.endsWith('deviantart.com')) return { label: 'DeviantArt', type: 'gallery' };
	if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
		return { label: 'Pinterest', type: 'social' };
	}
	if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
		return { label: 'Instagram', type: 'social' };
	}
	return null;
}

function titleForHost(host: string, title: string | null): string | null {
	const clean = title?.trim();
	if (!clean) return null;
	if (host.endsWith('deviantart.com')) {
		return clean.replace(/\s+by\s+.+?\s+on\s+DeviantArt$/i, '').trim() || clean;
	}
	return clean;
}

function artistForHost(document: Document, host: string): string | null {
	if (host.endsWith('deviantart.com')) {
		const creator = metaContent(document, 'name', 'twitter:creator');
		return creator?.replace(/^@/, '').trim() || null;
	}
	return null;
}

function sourceTagsForHost(document: Document, host: string): SourceTag[] {
	if (isDanbooruHost(host)) {
		return uniqueSourceTags(danbooruSourceTags(document));
	}
	if (host.endsWith('deviantart.com')) return uniqueSourceTags(deviantArtSourceTags(document));
	if (host.endsWith('tumblr.com')) {
		return uniqueSourceTags([...tumblrSourceTags(document), ...genericSourceTags(document, 'tumblr')]);
	}
	if (isXHost(host)) {
		return uniqueSourceTags([...genericSourceTags(document, 'x'), ...hashtagSourceTags(document, 'x')]);
	}
	if (host === 'bsky.app' || host.endsWith('.bsky.app')) {
		return uniqueSourceTags([
			...genericSourceTags(document, 'bluesky'),
			...hashtagSourceTags(document, 'bluesky')
		]);
	}
	if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
		return uniqueSourceTags([
			...genericSourceTags(document, 'instagram'),
			...hashtagSourceTags(document, 'instagram')
		]);
	}
	return uniqueSourceTags(genericSourceTags(document, 'generic'));
}

function danbooruSourceTags(document: Document): SourceTag[] {
	return [
		...document.querySelectorAll<HTMLElement>('.tag-list.categorized-tag-list li[data-tag-name]')
	].flatMap((item) => {
		const slug = item.dataset.tagName?.trim();
		const searchTag = item.querySelector<HTMLAnchorElement>('a.search-tag');
		const label = searchTag?.textContent?.trim().replace(/\s+/g, ' ') || displaySourceTag(slug);
		if (!slug || !label) return [];
		return [
			{
				source: 'danbooru',
				category: danbooruTagCategory(item),
				label,
				slug,
				url: searchTag?.href ?? null,
				confidence: 'high',
				selectorHint: '.tag-list.categorized-tag-list li[data-tag-name]',
				deprecated: item.dataset.isDeprecated === 'true',
				count: numberFromPostCount(item.querySelector<HTMLElement>('.post-count'))
			}
		];
	});
}

function danbooruTagCategory(item: HTMLElement): SourceTag['category'] {
	const list = item.closest('ul');
	if (list?.classList.contains('artist-tag-list')) return 'artist';
	if (list?.classList.contains('copyright-tag-list')) return 'copyright';
	if (list?.classList.contains('character-tag-list')) return 'character';
	if (list?.classList.contains('meta-tag-list')) return 'meta';
	if (list?.classList.contains('general-tag-list')) return 'tag';
	return 'unknown';
}

function deviantArtSourceTags(document: Document): SourceTag[] {
	return [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/tag/"]')].flatMap((anchor) => {
		const tagName = anchor.dataset.tagname?.trim() || tagFromPath(anchor.href, '/tag/');
		if (!tagName) return [];
		return [
			{
				source: 'deviantart',
				category: 'tag',
				label: tagName,
				slug: normalizeSourceTag(tagName),
				url: anchor.href,
				confidence: anchor.dataset.tagname ? 'high' : 'medium',
				selectorHint: anchor.dataset.tagname
					? 'a[data-tagname][href*="/tag/"]'
					: 'a[href*="/tag/"]'
			}
		];
	});
}

function tumblrSourceTags(document: Document): SourceTag[] {
	return [
		...document.querySelectorAll<HTMLAnchorElement>('a[data-testid="tag-link"][href*="/tagged/"]')
	].flatMap((anchor) => {
		const tagName = tagFromPath(anchor.href, '/tagged/') || anchor.textContent?.trim();
		if (!tagName) return [];
		return [
			{
				source: 'tumblr',
				category: 'tag',
				label: tagName,
				slug: normalizeSourceTag(tagName),
				url: anchor.href,
				confidence: 'high',
				selectorHint: 'a[data-testid="tag-link"][href*="/tagged/"]'
			}
		];
	});
}

function genericSourceTags(document: Document, source: SourceTag['source']): SourceTag[] {
	const metaTags = [...document.querySelectorAll<HTMLMetaElement>('meta[property="article:tag"]')]
		.map((tag) => tag.content.trim())
		.filter(Boolean)
		.map((tag): SourceTag => sourceTagForGenericValue(tag, source, 'meta[property="article:tag"]'));
	const relTags = [...document.querySelectorAll<HTMLAnchorElement>('a[rel~="tag"]')]
		.map((anchor): SourceTag | null => {
			const label = anchor.textContent?.trim() || tagFromPath(anchor.href, '/tag/') || null;
			if (!label) return null;
			return {
				...sourceTagForGenericValue(label, source, 'a[rel~="tag"]'),
				url: anchor.href
			};
		})
		.filter((tag): tag is SourceTag => Boolean(tag));
	return [...metaTags, ...relTags];
}

function hashtagSourceTags(document: Document, source: SourceTag['source']): SourceTag[] {
	return [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
		.map((anchor): SourceTag | null => {
			const tagName = hashtagFromAnchor(anchor);
			if (!tagName) return null;
			return {
				source,
				category: 'hashtag',
				label: tagName.startsWith('#') ? tagName : `#${tagName}`,
				slug: normalizeSourceTag(tagName),
				url: anchor.href,
				confidence: 'medium',
				selectorHint: 'a[href] hashtag link'
			};
		})
		.filter((tag): tag is SourceTag => Boolean(tag));
}

function hashtagFromAnchor(anchor: HTMLAnchorElement): string | null {
	const text = anchor.textContent?.trim();
	if (text?.startsWith('#') && text.length > 1) return text.slice(1);
	const fromPath = tagFromAnyPath(anchor.href, ['/hashtag/', '/explore/tags/', '/tags/']);
	if (fromPath) return fromPath;
	try {
		const url = new URL(anchor.href, 'https://example.com');
		const query = url.searchParams.get('q') ?? url.searchParams.get('tag');
		if (query?.trim().startsWith('#')) return query.trim().slice(1);
	} catch {
		// Leave malformed hrefs out of fallback hashtag extraction.
	}
	return null;
}

function sourceTagForGenericValue(
	value: string,
	source: SourceTag['source'],
	selectorHint: string
): SourceTag {
	return {
		source,
		category: 'tag',
		label: value,
		slug: normalizeSourceTag(value),
		url: null,
		confidence: 'medium',
		selectorHint
	};
}

function uniqueSourceTags(tags: SourceTag[]): SourceTag[] {
	const seen = new Set<string>();
	const uniqueTags: SourceTag[] = [];
	for (const tag of tags) {
		const key = `${tag.source}:${tag.category}:${tag.slug}`;
		if (!tag.slug || seen.has(key)) continue;
		seen.add(key);
		uniqueTags.push(tag);
	}
	return uniqueTags;
}

function normalizeSourceTag(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^#+/, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

function displaySourceTag(value: string | null | undefined): string | null {
	return value?.replace(/_/g, ' ') ?? null;
}

function tagFromPath(url: string, marker: string): string | null {
	try {
		const parsed = new URL(url, 'https://example.com');
		const index = parsed.pathname.indexOf(marker);
		if (index === -1) return null;
		const raw = parsed.pathname.slice(index + marker.length).split('/')[0];
		return raw ? decodeURIComponent(raw).trim() : null;
	} catch {
		return null;
	}
}

function tagFromAnyPath(url: string, markers: string[]): string | null {
	for (const marker of markers) {
		const tag = tagFromPath(url, marker);
		if (tag) return tag;
	}
	return null;
}

function numberFromPostCount(element: HTMLElement | null): number | null {
	const value = element?.getAttribute('title') ?? element?.textContent ?? null;
	if (!value) return null;
	const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function twitterOriginalUrl(value: string): string {
	try {
		const url = new URL(value);
		if (url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/')) {
			url.searchParams.set('name', 'orig');
			return url.toString();
		}
	} catch {
		// Leave non-URL values untouched.
	}
	return value;
}

function metaContent(
	document: Document,
	attribute: 'name' | 'property',
	key: string
): string | null {
	const value = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)?.content;
	return value?.trim() || null;
}

function hostnameFrom(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return null;
	}
}

function readableHost(host: string | null): string | null {
	if (!host) return null;
	return host.replace(/^www\./, '');
}

function isXHost(host: string): boolean {
	return (
		host === 'x.com' ||
		host.endsWith('.x.com') ||
		host === 'twitter.com' ||
		host.endsWith('.twitter.com')
	);
}

function isDanbooruHost(host: string): boolean {
	return host === 'danbooru.donmai.us' || host.endsWith('.donmai.us');
}

function titleFromUrl(url: string | null | undefined): string | null {
	if (!url) return null;
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
