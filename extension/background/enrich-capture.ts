import type { CanonicalImageResult, ResolveCanonicalImageOptions } from './canonical-image';
import { sourceKeyForUrls } from '../shared/source-hash';
import type {
	AcceptedAnnotation,
	ImageCandidate,
	CaptureMetadata,
	CaptureSource
} from '../shared/candidates';
import type { CapturedItemPayload, EnrichedItem, FetchStatus, StorageMode } from '../shared/types';
import { hydrateItemForImport, type ImageDataLoader } from '../shared/fetch-status';
import { normalizeArtistCandidates } from '../shared/artist-candidates';

type StoragePolicy = {
	mode: StorageMode;
	reason: string;
};

export type EnrichCapturedItemDependencies = {
	resolveCanonicalImage: (options: ResolveCanonicalImageOptions) => Promise<CanonicalImageResult>;
	policyForSource: (url: string) => StoragePolicy;
	computeSourceHash: (source: string) => Promise<string>;
	checkDuplicate: (urlHash: string) => Promise<boolean>;
};

type WireImportItem = {
	filename: string;
	storage_mode: StorageMode;
	image_data: string | null;
	source_image_url: string | null;
	mime_type: string | null;
	natural_width: number;
	natural_height: number;
	source_url: string;
	page_title: string | null;
	alt_text: string | null;
	captured_at: string;
	metadata: {
		sourceName: string | null;
		sourceType: CaptureSource['sourceType'];
		detailUrl: string | null;
		creator: string | null;
		artistProfileUrl: string | null;
		artistUsername: string | null;
		dateDisplay: string | null;
		tags: string[];
		acceptedConceptSlugs: string[];
		acceptedAnnotations: AcceptedAnnotation[];
		rawMetadata: Record<string, unknown>;
	};
};

export async function enrichCapturedItem(
	captured: CapturedItemPayload,
	deps: EnrichCapturedItemDependencies
): Promise<EnrichedItem> {
	const selectedCandidate = selectedCandidateForCapture(captured);
	const canonical =
		captured.inlineData || !captured.detailUrl || isAuthoritativeOriginal(selectedCandidate)
			? {
					url: selectedCandidate?.url ?? captured.url,
					detailUrl: selectedCandidate?.detailUrl ?? captured.detailUrl,
					candidates: captured.candidates?.map((candidate) => candidate.url) ?? [captured.url]
				}
			: await deps.resolveCanonicalImage({
					imageUrl: captured.url,
					detailUrl: captured.detailUrl
				});
	const resolvedUrl = canonical.url;
	const candidates = candidateListForCapture(captured, canonical, selectedCandidate);
	const selected = selectedCandidateForUrl(candidates, resolvedUrl) ?? candidates[0];
	const selectedCandidateId = selected?.id ?? captured.selectedCandidateId ?? resolvedUrl;
	const previewUrl = resolvedUrl === captured.url ? null : captured.url;
	const policy = deps.policyForSource(resolvedUrl);
	const storageMode = captured.inlineData ? 'download' : policy.mode;
	const storageModeReason = captured.inlineData ? 'Captured image bytes' : policy.reason;
	const sourceHash = await deps.computeSourceHash(
		sourceKeyForUrls(resolvedUrl, captured.sourceUrl)
	);
	const alreadyInLibrary = await deps.checkDuplicate(sourceHash);
	const metadata = metadataForCapture(captured, selected, resolvedUrl);
	const source = sourceForCapture(captured, selected, resolvedUrl);
	const dimensions = dimensionsForCapture(captured, selected);

	return {
		id: sourceHash,
		captureKey: captured.url,
		revision: 0,
		url: resolvedUrl,
		selectedCandidateId,
		candidates,
		source,
		metadata,
		previewUrl,
		naturalWidth: dimensions.width,
		naturalHeight: dimensions.height,
		mimeType: selected?.mimeType ?? captured.mimeType,
		altText: selected?.altText ?? captured.altText,
		suggestedName: metadata.title,
		sourceUrl: source.canonicalPageUrl ?? source.pageUrl,
		pageTitle: captured.pageTitle,
		capturedAt: captured.capturedAt,
		storageMode,
		storageModeReason,
		fetchStatus: fetchStatusForCapture(captured, storageMode),
		destinationFolderId: null,
		alreadyInLibrary,
		enrichment: { state: 'idle' }
	};
}

function isAuthoritativeOriginal(candidate: ImageCandidate | null): boolean {
	return Boolean(
		candidate?.scoreReasons.some(
			(reason) => reason === 'Instagram large media endpoint' || reason === 'Danbooru original file'
		)
	);
}

export function wireImportItemForEnrichedItem(item: EnrichedItem): WireImportItem {
	const isDone = item.fetchStatus.state === 'done';
	const done = item.fetchStatus as {
		state: 'done';
		base64?: string;
		blobKey?: string;
		mimeType: string;
	};

	return {
		filename: item.metadata.title || item.suggestedName,
		storage_mode: item.storageMode,
		image_data: isDone ? (done.base64 ?? null) : null,
		source_image_url: /^https?:/i.test(item.url) ? item.url : null,
		mime_type: isDone ? done.mimeType : item.mimeType,
		natural_width: item.naturalWidth,
		natural_height: item.naturalHeight,
		source_url: item.source.canonicalPageUrl ?? item.source.pageUrl ?? item.sourceUrl,
		page_title: item.pageTitle,
		alt_text: item.altText,
		captured_at: item.capturedAt,
		metadata: {
			sourceName: item.source.sourceLabel,
			sourceType: item.source.sourceType,
			detailUrl: item.source.detailUrl ?? item.source.canonicalPageUrl ?? item.source.pageUrl,
			creator: item.metadata.artist,
			artistProfileUrl: item.metadata.artistProfileUrl,
			artistUsername: item.metadata.artistUsername,
			dateDisplay: item.metadata.date,
			tags: item.metadata.tags,
			acceptedConceptSlugs: item.metadata.acceptedConceptSlugs,
			acceptedAnnotations: item.metadata.acceptedAnnotations ?? [],
			rawMetadata: {
				description: item.metadata.description,
				imageHost: item.source.imageHost,
				pageHost: item.source.pageHost,
				rawAltText: item.metadata.rawAltText,
				rawPageTitle: item.metadata.rawPageTitle,
				selectedCandidateId: item.selectedCandidateId,
				suggestedTags: item.metadata.suggestedTags,
				sourceTags: item.metadata.sourceTags,
				artistCandidates: item.metadata.artistCandidates ?? [],
				sourceRecord: item.metadata.sourceRecord ?? null,
				creators: item.metadata.sourceRecord?.creators ?? [],
				media: item.metadata.sourceRecord?.media ?? [],
				sensitivity: item.metadata.sourceRecord?.sensitivity ?? null,
				rights: item.metadata.sourceRecord?.rights ?? null
			}
		}
	};
}

export async function wireImportItemForEnrichedItemAsync(
	item: EnrichedItem,
	loadImageData: ImageDataLoader
): Promise<WireImportItem> {
	return wireImportItemForEnrichedItem(await hydrateItemForImport(item, loadImageData));
}

function selectedCandidateForCapture(captured: CapturedItemPayload): ImageCandidate | null {
	return (
		captured.candidates?.find((candidate) => candidate.id === captured.selectedCandidateId) ??
		captured.candidates?.find((candidate) => candidate.url === captured.url) ??
		null
	);
}

function selectedCandidateForUrl(
	candidates: ImageCandidate[],
	url: string
): ImageCandidate | undefined {
	return candidates.find((candidate) => candidate.url === url);
}

function candidateListForCapture(
	captured: CapturedItemPayload,
	canonical: CanonicalImageResult,
	selectedCandidate: ImageCandidate | null
): ImageCandidate[] {
	const byUrl = new Map<string, ImageCandidate>();
	for (const candidate of captured.candidates ?? []) {
		byUrl.set(candidate.url, candidate);
	}

	for (const url of canonical.candidates) {
		if (byUrl.has(url)) continue;
		byUrl.set(url, legacyCandidateForCapture(captured, url, selectedCandidate));
	}

	if (!byUrl.has(canonical.url)) {
		byUrl.set(canonical.url, legacyCandidateForCapture(captured, canonical.url, selectedCandidate));
	}

	return [...byUrl.values()];
}

function legacyCandidateForCapture(
	captured: CapturedItemPayload,
	url: string,
	selectedCandidate: ImageCandidate | null
): ImageCandidate {
	const selected = selectedCandidate?.url === url ? selectedCandidate : null;
	return {
		id: selected?.id ?? `candidate-${hashish(url)}`,
		url,
		kind: selected?.kind ?? 'network',
		width: selected?.width ?? captured.naturalWidth,
		height: selected?.height ?? captured.naturalHeight,
		visibleWidth: selected?.visibleWidth ?? null,
		visibleHeight: selected?.visibleHeight ?? null,
		mimeType: selected?.mimeType ?? captured.mimeType,
		byteSize: selected?.byteSize ?? null,
		altText: selected?.altText ?? captured.altText,
		sourceElementPath: selected?.sourceElementPath ?? null,
		detailUrl: selected?.detailUrl ?? captured.detailUrl,
		inlineData: selected?.inlineData ?? captured.inlineData,
		score: selected?.score ?? 0,
		confidence: selected?.confidence ?? 'medium',
		rejectionReasons: selected?.rejectionReasons ?? [],
		scoreReasons: selected?.scoreReasons ?? []
	};
}

function metadataForCapture(
	captured: CapturedItemPayload,
	selected: ImageCandidate | undefined,
	resolvedUrl: string
): CaptureMetadata {
	const rawTitle = captured.metadata?.title?.trim();
	const title =
		rawTitle ||
		titleFromFilename(resolvedUrl) ||
		selected?.altText?.trim() ||
		captured.altText?.trim() ||
		captured.pageTitle?.trim() ||
		hostnameFrom(captured.sourceUrl) ||
		'Untitled';

	return {
		title,
		artist: cleanString(captured.metadata?.artist),
		artistProfileUrl: cleanString(captured.metadata?.artistProfileUrl),
		artistUsername: cleanString(captured.metadata?.artistUsername),
		artistCandidates: normalizeArtistCandidates(captured.metadata?.artistCandidates),
		date: cleanString(captured.metadata?.date),
		tags: normalizeTags(captured.metadata?.tags),
		acceptedConceptSlugs: normalizeConceptSlugs(captured.metadata?.acceptedConceptSlugs),
		acceptedAnnotations: normalizeAcceptedAnnotations(captured.metadata?.acceptedAnnotations),
		suggestedTags: normalizeTags(captured.metadata?.suggestedTags),
		sourceTags: captured.metadata?.sourceTags ?? [],
		description: cleanString(captured.metadata?.description),
		rawPageTitle: cleanString(captured.metadata?.rawPageTitle) ?? captured.pageTitle ?? null,
		rawAltText: cleanString(captured.metadata?.rawAltText) ?? selected?.altText ?? captured.altText,
		sourceRecord: captured.metadata?.sourceRecord ?? null
	};
}

function normalizeAcceptedAnnotations(
	annotations: CaptureMetadata['acceptedAnnotations']
): AcceptedAnnotation[] {
	if (!annotations) return [];
	return annotations
		.map((annotation) => ({
			label: annotation.label.trim(),
			concepts: normalizeConceptSlugs(annotation.concepts),
			classifiers: Object.fromEntries(
				Object.entries(annotation.classifiers)
					.map(([key, value]) => [normalizeConceptSlug(key), normalizeConceptSlug(value)])
					.filter(([key, value]) => Boolean(key && value))
			)
		}))
		.filter((annotation) => annotation.label && annotation.concepts.length > 0);
}

function normalizeConceptSlug(value: string): string {
	return normalizeConceptSlugs([value])[0] ?? '';
}

function sourceForCapture(
	captured: CapturedItemPayload,
	selected: ImageCandidate | undefined,
	resolvedUrl: string
): CaptureSource {
	const pageUrl = captured.source?.pageUrl ?? captured.sourceUrl;
	const canonicalPageUrl = captured.source?.canonicalPageUrl ?? captured.sourceUrl;
	const detailUrl = selected?.detailUrl ?? captured.source?.detailUrl ?? captured.detailUrl;
	const pageHost = captured.source?.pageHost ?? hostnameFrom(pageUrl);
	const imageHost = captured.source?.imageHost ?? hostnameFrom(resolvedUrl);

	return {
		pageUrl,
		canonicalPageUrl,
		detailUrl,
		sourceLabel: captured.source?.sourceLabel ?? pageHost ?? imageHost ?? 'Unknown Source',
		sourceType: captured.source?.sourceType ?? (pageHost ? 'web' : imageHost ? 'cdn' : 'unknown'),
		pageHost: pageHost ?? '',
		imageHost
	};
}

function dimensionsForCapture(
	captured: CapturedItemPayload,
	selected: ImageCandidate | undefined
): { width: number; height: number } {
	return {
		width: selected?.width ?? captured.naturalWidth,
		height: selected?.height ?? captured.naturalHeight
	};
}

function fetchStatusForCapture(
	captured: CapturedItemPayload,
	storageMode: StorageMode
): FetchStatus {
	if (captured.inlineData) {
		const mimeType = captured.mimeType ?? 'image/png';
		return {
			state: 'done',
			base64: captured.inlineData.replace(/^data:[^;]+;base64,/, ''),
			mimeType
		};
	}
	if (captured.storedBlobKey) {
		return {
			state: 'done',
			blobKey: captured.storedBlobKey,
			mimeType: captured.mimeType ?? 'application/octet-stream'
		};
	}
	if (storageMode === 'download') return { state: 'fetching' };
	return { state: 'idle' };
}

function titleFromFilename(url: string): string | null {
	try {
		const pathname = new URL(url).pathname;
		const file = pathname.split('/').filter(Boolean).at(-1);
		if (!file) return null;
		return decodeURIComponent(file)
			.replace(/\.[a-z0-9]{2,5}$/i, '')
			.replace(/[-_]+/g, ' ')
			.trim();
	} catch {
		return null;
	}
}

function hostnameFrom(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

function cleanString(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function normalizeTags(tags: string[] | undefined): string[] {
	return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeConceptSlugs(slugs: string[] | undefined): string[] {
	return [
		...new Set(
			(slugs ?? [])
				.map((slug) =>
					slug
						.trim()
						.toLowerCase()
						.replace(/&/g, ' and ')
						.replace(/['"]/g, '')
						.replace(/[^a-z0-9]+/g, '_')
						.replace(/_+/g, '_')
						.replace(/^_|_$/g, '')
				)
				.filter(Boolean)
		)
	];
}

function hashish(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0;
	}
	return Math.abs(hash).toString(36);
}
