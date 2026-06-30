import type { CapturedItemPayload } from '../shared/types';
import type { CaptureSource, CaptureSourceType, ImageCandidate } from '../shared/candidates';

type VisibleScreenshotInput = {
	dataUrl: string;
	pageUrl: string;
	pageTitle: string | null;
	width: number;
	height: number;
	capturedAt?: string;
};

export function capturedPayloadForVisibleScreenshot(
	input: VisibleScreenshotInput
): CapturedItemPayload {
	const capturedAt = input.capturedAt ?? new Date().toISOString();
	const source = sourceForPage(input.pageUrl);
	const titleBase = input.pageTitle?.trim() || source.sourceLabel || source.pageHost || 'page';
	const candidate = screenshotCandidate(input, capturedAt);

	return {
		url: input.dataUrl,
		selectedCandidateId: candidate.id,
		candidates: [candidate],
		source,
		metadata: {
			title: `Visible capture - ${titleBase}`,
			artist: null,
			date: null,
			tags: ['rendered capture'],
			acceptedConceptSlugs: [],
			suggestedTags: ['screenshot fallback'],
			sourceTags: [],
			description: 'Rendered visible viewport capture. Not an original image file.',
			rawPageTitle: input.pageTitle,
			rawAltText: null
		},
		detailUrl: input.pageUrl,
		naturalWidth: input.width,
		naturalHeight: input.height,
		mimeType: mimeTypeFromDataUrl(input.dataUrl),
		inlineData: input.dataUrl,
		altText: null,
		sourceUrl: input.pageUrl,
		pageTitle: input.pageTitle ?? input.pageUrl,
		capturedAt
	};
}

function screenshotCandidate(input: VisibleScreenshotInput, capturedAt: string): ImageCandidate {
	return {
		id: `screenshot-visible-${capturedAt}`,
		url: input.dataUrl,
		kind: 'screenshot',
		width: input.width,
		height: input.height,
		visibleWidth: input.width,
		visibleHeight: input.height,
		mimeType: mimeTypeFromDataUrl(input.dataUrl),
		byteSize: null,
		altText: null,
		sourceElementPath: null,
		detailUrl: input.pageUrl,
		inlineData: input.dataUrl,
		score: 1,
		confidence: 'low',
		rejectionReasons: [],
		scoreReasons: ['visible screenshot fallback']
	};
}

function sourceForPage(pageUrl: string): CaptureSource {
	const pageHost = hostnameFrom(pageUrl) ?? '';
	const known = knownSourceForHost(pageHost);
	return {
		pageUrl,
		canonicalPageUrl: pageUrl,
		detailUrl: pageUrl,
		sourceLabel: known?.label ?? (pageHost || 'Unknown Source'),
		sourceType: known?.type ?? (pageHost ? 'web' : 'unknown'),
		pageHost,
		imageHost: null
	};
}

function knownSourceForHost(host: string): { label: string; type: CaptureSourceType } | null {
	if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
		return { label: 'Instagram', type: 'social' };
	}
	if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
		return { label: 'Pinterest', type: 'social' };
	}
	if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com') {
		return { label: 'X', type: 'social' };
	}
	if (host === 'danbooru.donmai.us' || host.endsWith('.donmai.us')) {
		return { label: 'Danbooru', type: 'booru' };
	}
	if (host.endsWith('tumblr.com')) return { label: 'Tumblr', type: 'social' };
	if (host.endsWith('deviantart.com')) return { label: 'DeviantArt', type: 'gallery' };
	return null;
}

function hostnameFrom(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return null;
	}
}

function mimeTypeFromDataUrl(dataUrl: string): string {
	const match = dataUrl.match(/^data:([^;,]+)/);
	return match?.[1] || 'image/png';
}
