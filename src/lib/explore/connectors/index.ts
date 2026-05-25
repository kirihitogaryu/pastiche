import type { SourceConnector, SourceId } from '../types';
import { articConnector } from './artic';
import { metConnector } from './met';

const connectors: Record<SourceId, SourceConnector> = {
	met: metConnector,
	artic: articConnector
};

export function isSourceId(value: string): value is SourceId {
	return value === 'met' || value === 'artic';
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
