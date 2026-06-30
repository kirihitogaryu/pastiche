import type { CaptureMetadata } from '../shared/candidates';
import type { EnrichedItem, FetchStatus } from '../shared/types';

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
	candidateId: string
): EnrichedItem[] {
	return items.map((item) => {
		if (item.id !== itemId) return item;
		const candidate = item.candidates.find((entry) => entry.id === candidateId);
		if (!candidate) return item;
		const width = candidate.width ?? item.naturalWidth;
		const height = candidate.height ?? item.naturalHeight;
		const fetchStatus = fetchStatusAfterCandidateChange(item, candidate.url);

		return {
			...item,
			url: candidate.url,
			selectedCandidateId: candidate.id,
			previewUrl: item.url === candidate.url ? item.previewUrl : item.url,
			naturalWidth: width,
			naturalHeight: height,
			mimeType: candidate.mimeType ?? item.mimeType,
			altText: candidate.altText ?? item.altText,
			fetchStatus,
			source: {
				...item.source,
				detailUrl: candidate.detailUrl ?? item.source.detailUrl,
				imageHost: hostnameFrom(candidate.url) ?? item.source.imageHost
			}
		};
	});
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
			suggestedTags: patch.suggestedTags
				? normalizeTags(patch.suggestedTags)
				: item.metadata.suggestedTags
		};

		return {
			...item,
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

function normalizeTags(tags: string[]): string[] {
	return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function hostnameFrom(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}
