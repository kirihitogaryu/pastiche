import type { EnrichedItem } from './types';

export const CAPTURE_TRAY_STORAGE_KEY = 'pastiche_capture_tray_items';

export function captureTrayItemsFromStorage(value: unknown): EnrichedItem[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isStoredTrayItem) as EnrichedItem[];
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
