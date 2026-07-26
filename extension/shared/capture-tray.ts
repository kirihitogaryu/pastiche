import type { ImageCandidate, SourceTag } from './candidates';
import type { EnrichedItem } from './types';
import { normalizeArtistCandidates } from './artist-candidates';

export const CAPTURE_TRAY_STORAGE_KEY = 'pastiche_capture_tray_items';

export function captureTrayItemsFromStorage(value: unknown): EnrichedItem[] {
	const items = storedTrayArray(value);
	return items.filter(isStoredTrayItem).map(hydrateStoredTrayItem);
}

export function mergeCaptureTrayItem(items: EnrichedItem[], item: EnrichedItem): EnrichedItem[] {
	return [item, ...items.filter((entry) => entry.id !== item.id)];
}

export function mergeCaptureTrayItems(
	items: EnrichedItem[],
	incoming: EnrichedItem[]
): EnrichedItem[] {
	const incomingIds = new Set(incoming.map((item) => item.id));
	return [...incoming, ...items.filter((entry) => !incomingIds.has(entry.id))];
}

export function removeCaptureTrayItem(items: EnrichedItem[], id: string): EnrichedItem[] {
	return items.filter((entry) => entry.id !== id);
}

export function removeCaptureTrayIndexes(
	items: EnrichedItem[],
	indexes: Set<number>
): EnrichedItem[] {
	return items.filter((_, index) => !indexes.has(index));
}

export function setCaptureTrayItemStorageMode(
	items: EnrichedItem[],
	itemId: string,
	storageMode: 'download' | 'lazy_download'
): EnrichedItem[] {
	return items.map((item) => {
		if (item.id !== itemId) return item;
		if (storageMode === 'lazy_download') {
			return {
				...item,
				revision: item.revision + 1,
				storageMode,
				storageModeReason: 'Remote source only',
				fetchStatus: { state: 'idle' }
			};
		}
		return {
			...item,
			revision: item.revision + 1,
			storageMode,
			storageModeReason: 'Original not stored yet',
			fetchStatus: { state: 'fetching' }
		};
	});
}

function isStoredTrayItem(value: unknown): value is Partial<EnrichedItem> {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { id?: unknown }).id === 'string' &&
		typeof (value as { url?: unknown }).url === 'string'
	);
}

function storedTrayArray(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (typeof value !== 'object' || value === null) return [];
	return Object.keys(value)
		.filter((key) => /^\d+$/.test(key))
		.sort((left, right) => Number(left) - Number(right))
		.map((key) => (value as Record<string, unknown>)[key]);
}

function hydrateStoredTrayItem(item: Partial<EnrichedItem>): EnrichedItem {
	return {
		id: item.id ?? item.url ?? crypto.randomUUID(),
		captureKey: item.captureKey ?? item.url ?? '',
		revision: Number.isFinite(item.revision) ? Math.max(0, Number(item.revision)) : 0,
		url: item.url ?? '',
		selectedCandidateId: item.selectedCandidateId ?? '',
		candidates: storedTrayArray(item.candidates).map(hydrateCandidate),
		source: {
			pageUrl: item.source?.pageUrl ?? item.sourceUrl ?? item.url ?? '',
			canonicalPageUrl:
				item.source?.canonicalPageUrl ?? item.source?.pageUrl ?? item.sourceUrl ?? '',
			detailUrl: item.source?.detailUrl ?? null,
			sourceLabel: item.source?.sourceLabel ?? item.source?.pageHost ?? 'Unknown Source',
			sourceType: item.source?.sourceType ?? 'unknown',
			pageHost: item.source?.pageHost ?? '',
			imageHost: item.source?.imageHost ?? null
		},
		metadata: {
			title: item.metadata?.title ?? item.suggestedName ?? 'Untitled',
			artist: item.metadata?.artist ?? null,
			artistProfileUrl: item.metadata?.artistProfileUrl ?? null,
			artistUsername: item.metadata?.artistUsername ?? null,
			artistCandidates: normalizeArtistCandidates(item.metadata?.artistCandidates),
			date: item.metadata?.date ?? null,
			tags: stringArrayFromStorage(item.metadata?.tags),
			acceptedConceptSlugs: stringArrayFromStorage(item.metadata?.acceptedConceptSlugs),
			acceptedAnnotations: acceptedAnnotationsFromStorage(item.metadata?.acceptedAnnotations),
			suggestedTags: stringArrayFromStorage(item.metadata?.suggestedTags),
			sourceTags: sourceTagsFromStorage(item.metadata?.sourceTags),
			description: item.metadata?.description ?? null,
			rawPageTitle: item.metadata?.rawPageTitle ?? item.pageTitle ?? null,
			rawAltText: item.metadata?.rawAltText ?? item.altText ?? null,
			sourceRecord: sourceCaptureRecordFromStorage(item.metadata?.sourceRecord)
		},
		previewUrl: item.previewUrl ?? null,
		naturalWidth: item.naturalWidth ?? 0,
		naturalHeight: item.naturalHeight ?? 0,
		mimeType: item.mimeType ?? null,
		altText: item.altText ?? null,
		suggestedName: item.suggestedName ?? item.metadata?.title ?? 'Untitled',
		sourceUrl: item.sourceUrl ?? item.source?.pageUrl ?? item.url ?? '',
		pageTitle: item.pageTitle ?? item.metadata?.rawPageTitle ?? '',
		capturedAt: item.capturedAt ?? new Date().toISOString(),
		storageMode: item.storageMode ?? 'url_reference',
		storageModeReason: item.storageModeReason ?? 'Recovered from capture tray',
		fetchStatus: item.fetchStatus ?? { state: 'idle' },
		destinationFolderId: item.destinationFolderId ?? null,
		alreadyInLibrary: item.alreadyInLibrary ?? false,
		enrichment: metadataEnrichmentFromStorage(item.enrichment)
	};
}

function metadataEnrichmentFromStorage(value: unknown): EnrichedItem['enrichment'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return { state: 'idle' };
	const entry = value as Record<string, unknown>;
	if (entry.state === 'loading' && typeof entry.requestId === 'string') {
		return {
			state: 'loading',
			requestId: entry.requestId,
			startedAt: typeof entry.startedAt === 'string' ? entry.startedAt : new Date().toISOString()
		};
	}
	if (
		(entry.state === 'success' || entry.state === 'partial') &&
		typeof entry.requestId === 'string' &&
		typeof entry.summary === 'string' &&
		typeof entry.adapterId === 'string'
	) {
		return {
			state: entry.state,
			requestId: entry.requestId,
			completedAt:
				typeof entry.completedAt === 'string' ? entry.completedAt : new Date().toISOString(),
			summary: entry.summary,
			adapterId: entry.adapterId
		};
	}
	if (
		entry.state === 'error' &&
		typeof entry.requestId === 'string' &&
		typeof entry.error === 'string'
	) {
		return {
			state: 'error',
			requestId: entry.requestId,
			completedAt:
				typeof entry.completedAt === 'string' ? entry.completedAt : new Date().toISOString(),
			error: entry.error
		};
	}
	return { state: 'idle' };
}

function sourceCaptureRecordFromStorage(value: unknown): EnrichedItem['metadata']['sourceRecord'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	if (
		typeof record.adapterId !== 'string' ||
		typeof record.canonicalPostUrl !== 'string' ||
		!Array.isArray(record.creators) ||
		!Array.isArray(record.media) ||
		!Array.isArray(record.sourceTags)
	) {
		return null;
	}
	return value as NonNullable<EnrichedItem['metadata']['sourceRecord']>;
}

function acceptedAnnotationsFromStorage(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
		const record = entry as Record<string, unknown>;
		if (
			typeof record.label !== 'string' ||
			!Array.isArray(record.concepts) ||
			!record.classifiers ||
			typeof record.classifiers !== 'object' ||
			Array.isArray(record.classifiers)
		) {
			return [];
		}
		const concepts = record.concepts.filter((item): item is string => typeof item === 'string');
		const classifiers = Object.fromEntries(
			Object.entries(record.classifiers).filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string'
			)
		);
		return [{ label: record.label, concepts, classifiers }];
	});
}

function hydrateCandidate(candidate: unknown): ImageCandidate {
	const stored = typeof candidate === 'object' && candidate !== null ? candidate : {};
	const partial = stored as Partial<ImageCandidate>;
	return {
		id: partial.id ?? partial.url ?? crypto.randomUUID(),
		url: partial.url ?? '',
		kind: partial.kind ?? 'network',
		width: partial.width ?? null,
		height: partial.height ?? null,
		visibleWidth: partial.visibleWidth ?? null,
		visibleHeight: partial.visibleHeight ?? null,
		mimeType: partial.mimeType ?? null,
		byteSize: partial.byteSize ?? null,
		altText: partial.altText ?? null,
		sourceElementPath: partial.sourceElementPath ?? null,
		detailUrl: partial.detailUrl ?? null,
		inlineData: partial.inlineData ?? null,
		score: partial.score ?? 0,
		confidence: partial.confidence ?? 'medium',
		rejectionReasons: stringArrayFromStorage(partial.rejectionReasons),
		scoreReasons: stringArrayFromStorage(partial.scoreReasons)
	};
}

function stringArrayFromStorage(value: unknown): string[] {
	return storedTrayArray(value).filter((entry): entry is string => typeof entry === 'string');
}

function sourceTagsFromStorage(value: unknown): SourceTag[] {
	return storedTrayArray(value).filter(isSourceTagFromStorage);
}

function isSourceTagFromStorage(value: unknown): value is SourceTag {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Partial<SourceTag>;
	return (
		isSourceTagSource(entry.source) &&
		isSourceTagCategory(entry.category) &&
		typeof entry.label === 'string' &&
		typeof entry.slug === 'string' &&
		(entry.url === null || typeof entry.url === 'string') &&
		isSourceTagConfidence(entry.confidence) &&
		typeof entry.selectorHint === 'string'
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
