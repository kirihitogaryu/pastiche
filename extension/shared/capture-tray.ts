import type { ImageCandidate } from './candidates';
import type { EnrichedItem } from './types';

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
			date: item.metadata?.date ?? null,
			tags: stringArrayFromStorage(item.metadata?.tags),
			suggestedTags: stringArrayFromStorage(item.metadata?.suggestedTags),
			description: item.metadata?.description ?? null,
			rawPageTitle: item.metadata?.rawPageTitle ?? item.pageTitle ?? null,
			rawAltText: item.metadata?.rawAltText ?? item.altText ?? null
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
		alreadyInLibrary: item.alreadyInLibrary ?? false
	};
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
