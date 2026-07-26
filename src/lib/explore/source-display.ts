import type { ExploreItem } from './types';

export function exploreSourceLabel(item: ExploreItem): string {
	if (isCommonsReferenceItem(item)) return 'Wikimedia Commons';
	if (item.source === 'artic') return 'Art Institute';
	if (item.source === 'wikidata') return 'Wikidata';
	if (item.source === 'danbooru') return 'Danbooru';
	if (item.source === 'deviantart') return 'DeviantArt';
	if (item.source === 'bluesky') return 'Bluesky';
	if (item.source === 'furaffinity') return 'Fur Affinity';
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
