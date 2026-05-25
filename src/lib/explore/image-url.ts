import { buildIiifImageUrl } from './iiif';
import type { ExploreItem } from './types';

export function getExploreDisplayImageUrl(item: ExploreItem): string {
	return getSizedExploreImageUrl(item, '1200,');
}

export function getExplorePreviewImageUrl(item: ExploreItem): string {
	return getSizedExploreImageUrl(item, '1600,');
}

function getSizedExploreImageUrl(item: ExploreItem, size: string): string {
	if (!item.isIIIF) return item.imageUrl;
	return buildIiifImageUrl(item.imageUrl, size);
}
