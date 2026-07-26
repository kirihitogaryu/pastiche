import type { SourceConnector, SourceId } from '../types';
import { articConnector } from './artic';
import { blueskyConnector } from './bluesky';
import { danbooruConnector } from './danbooru';
import { deviantArtConnector } from './deviantart';
import { furAffinityConnector } from './furaffinity';
import { metConnector } from './met';
import { wikidataConnector } from './wikidata';

const connectors: Record<SourceId, SourceConnector> = {
	met: metConnector,
	artic: articConnector,
	wikidata: wikidataConnector,
	danbooru: danbooruConnector,
	deviantart: deviantArtConnector,
	bluesky: blueskyConnector,
	furaffinity: furAffinityConnector
};

export function isSourceId(value: string): value is SourceId {
	return (
		value === 'met' ||
		value === 'artic' ||
		value === 'wikidata' ||
		value === 'danbooru' ||
		value === 'deviantart' ||
		value === 'bluesky' ||
		value === 'furaffinity'
	);
}

export function getExploreConnector(source: SourceId = 'met'): SourceConnector {
	return connectors[source];
}

export function getExploreConnectorForItemId(id: string): SourceConnector {
	const [source] = id.split('-', 1);
	if (!source || source === id) throw new Error(`Invalid Explore item id: ${id}`);
	if (!isSourceId(source)) throw new Error(`Unsupported Explore source: ${source}`);
	return getExploreConnector(source);
}
