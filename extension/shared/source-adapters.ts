import type {
	CaptureMetadata,
	CaptureSource,
	CaptureSourceType,
	ImageCandidate
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
	const suggestedTags = tagsForHost(document, pageHost);

	return {
		title,
		artist,
		date: null,
		tags: [],
		suggestedTags,
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

function tagsForHost(document: Document, host: string): string[] {
	if (isDanbooruHost(host)) {
		return unique(
			[...document.querySelectorAll<HTMLAnchorElement>('#tag-list a.search-tag, a.search-tag')]
				.map((tag) => tag.textContent?.trim())
				.filter(Boolean)
				.map((tag) => tag.replace(/\s+/g, ' '))
		);
	}
	if (host.endsWith('tumblr.com')) {
		return unique(
			[...document.querySelectorAll<HTMLMetaElement>('meta[property="article:tag"]')]
				.map((tag) => tag.content.trim())
				.filter(Boolean)
		);
	}
	return [];
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

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
