import type { ExploreItem } from './types';

export function uniqueExploreItemsById(items: ExploreItem[]): ExploreItem[] {
	const seen = new Set<string>();
	const unique: ExploreItem[] = [];
	for (const item of items) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		unique.push(item);
	}
	return unique;
}
