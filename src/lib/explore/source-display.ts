import type { ExploreItem } from './types';

export function exploreSourceLabel(item: ExploreItem): string {
	if (isCommonsReferenceItem(item)) return 'Wikimedia Commons';
	if (item.source === 'artic') return 'Art Institute';
	if (item.source === 'wikidata') return 'Wikidata';
	return 'The Met';
}

export function isCommonsReferenceItem(item: ExploreItem): boolean {
	const reference = item.rawMetadata.wikimediaReference;
	return (
		item.source === 'wikidata' &&
		typeof item.detailUrl === 'string' &&
		item.detailUrl.includes('commons.wikimedia.org/wiki/') &&
		typeof reference === 'object' &&
		reference !== null
	);
}
