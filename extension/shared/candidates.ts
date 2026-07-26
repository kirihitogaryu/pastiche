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

export type ArtistCandidate = {
	label: string;
	username: string | null;
	profileUrl: string | null;
	confidence: CandidateConfidence;
	reason: string;
};

export type MetadataProvenance =
	| 'manual'
	| 'dom'
	| 'embedded_json'
	| 'json_ld'
	| 'official_api'
	| 'generic';

export type ProvenancedValue<T> = {
	value: T;
	provenance: MetadataProvenance;
	evidence: string | null;
};

export type SourceCreatorRole =
	| 'artist'
	| 'uploader'
	| 'coauthor'
	| 'reblogged_from'
	| 'character_owner'
	| 'unknown';

export type SourceCreator = {
	role: SourceCreatorRole;
	displayName: string;
	username: string | null;
	profileUrl: string | null;
	sourceId: string | null;
	confidence: CandidateConfidence;
	provenance: MetadataProvenance;
	evidence: string | null;
};

export type SourceMedia = {
	sourceMediaId: string | null;
	ordinal: number;
	originalUrl: string | null;
	previewUrl: string | null;
	width: number | null;
	height: number | null;
	mimeType: string | null;
	altText: string | null;
	kind: 'image' | 'animation' | 'video' | 'unknown';
	referrer: string | null;
	provenance: MetadataProvenance;
};

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

export type SourceTag = {
	source:
		| 'danbooru'
		| 'deviantart'
		| 'tumblr'
		| 'x'
		| 'bluesky'
		| 'instagram'
		| 'pixiv'
		| 'toyhouse'
		| 'furaffinity'
		| 'lofter'
		| 'vk'
		| 'weibo'
		| 'generic';
	category: 'tag' | 'artist' | 'character' | 'copyright' | 'meta' | 'hashtag' | 'unknown';
	label: string;
	slug: string;
	url: string | null;
	confidence: 'high' | 'medium' | 'low';
	selectorHint: string;
	deprecated?: boolean;
	count?: number | null;
};

export type SourceSensitivity = {
	level: 'general' | 'sensitive' | 'mature' | 'explicit' | 'unknown';
	label: string | null;
	provenance: MetadataProvenance;
};

export type SourceRights = {
	label: string;
	url: string | null;
	provenance: MetadataProvenance;
};

export type SourceCaptureRecord = {
	adapterId: string;
	canonicalPostUrl: string;
	sourcePostId: string | null;
	title: ProvenancedValue<string> | null;
	description: ProvenancedValue<string> | null;
	publishedAt: ProvenancedValue<string> | null;
	creators: SourceCreator[];
	media: SourceMedia[];
	sourceTags: SourceTag[];
	sensitivity: SourceSensitivity | null;
	rights: SourceRights | null;
	extractedAt: string;
};

export type MetadataEnrichmentState =
	| { state: 'idle' }
	| { state: 'loading'; requestId: string; startedAt: string }
	| {
			state: 'success' | 'partial';
			requestId: string;
			completedAt: string;
			summary: string;
			adapterId: string;
	  }
	| { state: 'error'; requestId: string; completedAt: string; error: string };

export type AcceptedAnnotation = {
	label: string;
	concepts: string[];
	classifiers: Record<string, string>;
};

export type CaptureMetadata = {
	title: string;
	artist: string | null;
	artistProfileUrl: string | null;
	artistUsername: string | null;
	artistCandidates?: ArtistCandidate[];
	date: string | null;
	tags: string[];
	acceptedConceptSlugs: string[];
	acceptedAnnotations?: AcceptedAnnotation[];
	suggestedTags: string[];
	sourceTags: SourceTag[];
	description: string | null;
	rawPageTitle: string | null;
	rawAltText: string | null;
	/** Optional rich metadata collected only after the user chooses Add metadata. */
	sourceRecord?: SourceCaptureRecord | null;
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
