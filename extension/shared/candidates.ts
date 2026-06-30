import type { StorageMode } from './types';

export type ImageCandidateKind =
	| 'img'
	| 'srcset'
	| 'picture'
	| 'background'
	| 'pseudo_content'
	| 'data_attribute'
	| 'link'
	| 'meta'
	| 'json_ld'
	| 'video_poster'
	| 'video_frame'
	| 'canvas'
	| 'network'
	| 'screenshot';

export type CandidateConfidence = 'high' | 'medium' | 'low';

export type ImageCandidate = {
	id: string;
	url: string;
	kind: ImageCandidateKind;
	width: number | null;
	height: number | null;
	visibleWidth: number | null;
	visibleHeight: number | null;
	mimeType: string | null;
	byteSize: number | null;
	altText: string | null;
	sourceElementPath: string | null;
	detailUrl: string | null;
	inlineData: string | null;
	score: number;
	confidence: CandidateConfidence;
	rejectionReasons: string[];
	scoreReasons: string[];
};

export type CaptureSourceType =
	| 'web'
	| 'social'
	| 'gallery'
	| 'booru'
	| 'museum'
	| 'cdn'
	| 'unknown';

export type CaptureSource = {
	pageUrl: string;
	canonicalPageUrl: string | null;
	detailUrl: string | null;
	sourceLabel: string;
	sourceType: CaptureSourceType;
	pageHost: string;
	imageHost: string | null;
};

export type CaptureMetadata = {
	title: string;
	artist: string | null;
	date: string | null;
	tags: string[];
	suggestedTags: string[];
	description: string | null;
	rawPageTitle: string | null;
	rawAltText: string | null;
};

export type CaptureItem = {
	id: string;
	selectedCandidateId: string;
	candidates: ImageCandidate[];
	source: CaptureSource;
	metadata: CaptureMetadata;
	capturedAt: string;
	storageMode: StorageMode;
	storageModeReason: string;
	destinationFolderId: string | null;
	alreadyInLibrary: boolean;
};

export function candidateHost(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

export function candidateMaxDimension(candidate: Pick<ImageCandidate, 'width' | 'height'>): number {
	return Math.max(candidate.width ?? 0, candidate.height ?? 0);
}

export function candidateVisibleArea(
	candidate: Pick<ImageCandidate, 'visibleWidth' | 'visibleHeight'>
): number {
	return Math.max(0, candidate.visibleWidth ?? 0) * Math.max(0, candidate.visibleHeight ?? 0);
}
