import type { AcceptedAnnotation, CaptureMetadata, SourceTag } from '../shared/candidates';
import type { EnrichedItem, FetchStatus, ImportedSource } from '../shared/types';
import { instagramLargeMediaUrl } from '../shared/source-adapters';
import { normalizeSource, sourceKeyForUrls } from '../shared/source-hash';
import { normalizeArtistCandidates } from '../shared/artist-candidates';

export function updateSelectedItemId(
	selectedItemId: string | null,
	items: EnrichedItem[]
): string | null {
	if (items.length === 0) return null;
	if (selectedItemId && items.some((item) => item.id === selectedItemId)) return selectedItemId;
	return items[0]?.id ?? null;
}

export function selectCandidateForItem(
	items: EnrichedItem[],
	itemId: string,
	candidateId: string,
	importedSources: ImportedSource[] = []
): EnrichedItem[] {
	return items.map((item) => {
		if (item.id !== itemId) return item;
		const candidate = item.candidates.find((entry) => entry.id === candidateId);
		if (!candidate) return item;
		const width = candidate.width ?? item.naturalWidth;
		const height = candidate.height ?? item.naturalHeight;
		const fetchStatus = fetchStatusAfterCandidateChange(item, candidate.url);
		const sourceUrl = item.source.canonicalPageUrl ?? item.source.pageUrl ?? item.sourceUrl;
		const alreadyInLibrary =
			item.url === candidate.url
				? item.alreadyInLibrary
				: importedSourceMatches(candidate.url, sourceUrl, importedSources);

		return {
			...item,
			revision: item.revision + 1,
			id: sourceHashForItemUrl(candidate.url, sourceUrl),
			captureKey: item.captureKey ?? item.url,
			url: candidate.url,
			selectedCandidateId: candidate.id,
			previewUrl: item.url === candidate.url ? item.previewUrl : item.url,
			naturalWidth: width,
			naturalHeight: height,
			mimeType: candidate.mimeType ?? item.mimeType,
			altText: candidate.altText ?? item.altText,
			fetchStatus,
			alreadyInLibrary,
			source: {
				...item.source,
				detailUrl: candidate.detailUrl ?? item.source.detailUrl,
				imageHost: hostnameFrom(candidate.url) ?? item.source.imageHost
			}
		};
	});
}

export function sourceHashForItemUrl(url: string, sourceUrl: string): string {
	return `source:${normalizeSource(sourceKeyForUrls(url, sourceUrl))}`;
}

export function selectInstagramLargeCandidateForItem(
	items: EnrichedItem[],
	itemId: string,
	importedSources: ImportedSource[] = []
): EnrichedItem[] {
	let candidateId: string | null = null;
	const withCandidate = items.map((item) => {
		if (item.id !== itemId) return item;
		const largeUrl = instagramLargeMediaUrl(
			item.source.detailUrl ?? item.source.canonicalPageUrl ?? item.source.pageUrl ?? item.sourceUrl
		);
		if (!largeUrl) return item;

		const existing = item.candidates.find((candidate) => candidate.url === largeUrl);
		candidateId = existing?.id ?? `instagram-large:${largeUrl}`;
		if (existing) return item;

		return {
			...item,
			candidates: [
				...item.candidates,
				{
					id: candidateId,
					url: largeUrl,
					kind: 'network' as const,
					width: null,
					height: null,
					visibleWidth: null,
					visibleHeight: null,
					mimeType: 'image/jpeg',
					byteSize: null,
					altText: item.altText,
					sourceElementPath: null,
					detailUrl: item.source.detailUrl ?? item.source.canonicalPageUrl ?? item.source.pageUrl,
					inlineData: null,
					score: 110,
					confidence: 'high' as const,
					rejectionReasons: [],
					scoreReasons: ['Instagram large media endpoint']
				}
			]
		};
	});

	return candidateId
		? selectCandidateForItem(withCandidate, itemId, candidateId, importedSources)
		: items;
}

export function updateItemMetadata(
	items: EnrichedItem[],
	itemId: string,
	patch: Partial<CaptureMetadata>
): EnrichedItem[] {
	return items.map((item) => {
		if (item.id !== itemId) return item;
		const metadata = {
			...item.metadata,
			...patch,
			tags: patch.tags ? normalizeTags(patch.tags) : item.metadata.tags,
			acceptedConceptSlugs: patch.acceptedConceptSlugs
				? normalizeConceptSlugs(patch.acceptedConceptSlugs)
				: item.metadata.acceptedConceptSlugs,
			acceptedAnnotations: patch.acceptedAnnotations
				? normalizeAcceptedAnnotations(patch.acceptedAnnotations)
				: item.metadata.acceptedAnnotations,
			artistCandidates: patch.artistCandidates
				? normalizeArtistCandidates(patch.artistCandidates)
				: item.metadata.artistCandidates,
			suggestedTags: patch.suggestedTags
				? normalizeTags(patch.suggestedTags)
				: item.metadata.suggestedTags,
			sourceTags: patch.sourceTags
				? normalizeSourceTags(patch.sourceTags)
				: item.metadata.sourceTags
		};

		return {
			...item,
			revision: item.revision + 1,
			metadata,
			suggestedName: metadata.title || item.suggestedName
		};
	});
}

export function tagsFromInput(input: string): string[] {
	return normalizeTags(input.split(/[,\n]/));
}

function fetchStatusAfterCandidateChange(item: EnrichedItem, candidateUrl: string): FetchStatus {
	if (item.url === candidateUrl) return item.fetchStatus;
	if (item.storageMode === 'download') return { state: 'fetching' };
	return { state: 'idle' };
}

function importedSourceMatches(
	imageUrl: string,
	sourceUrl: string,
	importedSources: ImportedSource[]
): boolean {
	const key = normalizeSource(sourceKeyForUrls(imageUrl, sourceUrl));
	return importedSources.some((source) => {
		const importedKey = normalizeSource(
			sourceKeyForUrls(source.source_image_url, source.source_url)
		);
		return importedKey === key;
	});
}

function normalizeTags(tags: string[]): string[] {
	return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeConceptSlugs(slugs: string[]): string[] {
	return [
		...new Set(
			slugs
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

function normalizeAcceptedAnnotations(annotations: AcceptedAnnotation[]): AcceptedAnnotation[] {
	return annotations
		.map((annotation) => ({
			label: annotation.label.trim(),
			concepts: normalizeConceptSlugs(annotation.concepts),
			classifiers: Object.fromEntries(
				Object.entries(annotation.classifiers)
					.map(([key, value]) => [
						normalizeConceptSlugs([key])[0] ?? '',
						normalizeConceptSlugs([value])[0] ?? ''
					])
					.filter(([key, value]) => Boolean(key && value))
			)
		}))
		.filter((annotation) => annotation.label && annotation.concepts.length > 0);
}

function normalizeSourceTags(tags: SourceTag[]): SourceTag[] {
	const seen = new Set<string>();
	const normalized: SourceTag[] = [];
	for (const tag of tags) {
		if (!isSourceTag(tag)) continue;
		const slug = tag.slug.trim();
		const label = tag.label.trim();
		const selectorHint = tag.selectorHint.trim();
		if (!slug || !label || !selectorHint) continue;
		const key = `${tag.source}:${tag.category}:${slug}`;
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push({
			...tag,
			label,
			slug,
			url: tag.url?.trim() || null,
			selectorHint
		});
	}
	return normalized;
}

function isSourceTag(value: unknown): value is SourceTag {
	if (typeof value !== 'object' || value === null) return false;
	const tag = value as Partial<SourceTag>;
	return (
		isSourceTagSource(tag.source) &&
		isSourceTagCategory(tag.category) &&
		typeof tag.label === 'string' &&
		typeof tag.slug === 'string' &&
		(tag.url === null || typeof tag.url === 'string') &&
		isSourceTagConfidence(tag.confidence) &&
		typeof tag.selectorHint === 'string'
	);
}

function isSourceTagSource(value: unknown): value is SourceTag['source'] {
	return (
		value === 'danbooru' ||
		value === 'deviantart' ||
		value === 'tumblr' ||
		value === 'x' ||
		value === 'bluesky' ||
		value === 'instagram' ||
		value === 'pixiv' ||
		value === 'toyhouse' ||
		value === 'furaffinity' ||
		value === 'lofter' ||
		value === 'vk' ||
		value === 'weibo' ||
		value === 'generic'
	);
}

function isSourceTagCategory(value: unknown): value is SourceTag['category'] {
	return (
		value === 'tag' ||
		value === 'artist' ||
		value === 'character' ||
		value === 'copyright' ||
		value === 'meta' ||
		value === 'hashtag' ||
		value === 'unknown'
	);
}

function isSourceTagConfidence(value: unknown): value is SourceTag['confidence'] {
	return value === 'high' || value === 'medium' || value === 'low';
}

function hostnameFrom(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}
