import { describe, expect, it } from 'vitest';
import { getExploreConnector, getExploreConnectorForItemId, isSourceId } from './index';

describe('Explore connector registry', () => {
	it('recognizes supported source ids', () => {
		expect(isSourceId('met')).toBe(true);
		expect(isSourceId('artic')).toBe(true);
		expect(isSourceId('wikidata')).toBe(true);
		expect(isSourceId('danbooru')).toBe(true);
		expect(isSourceId('deviantart')).toBe(true);
		expect(isSourceId('bluesky')).toBe(true);
		expect(isSourceId('furaffinity')).toBe(true);
		expect(isSourceId('wikiart')).toBe(false);
	});

	it('resolves connectors by source id and namespaced item id', () => {
		expect(getExploreConnector('met').id).toBe('met');
		expect(getExploreConnector('artic').id).toBe('artic');
		expect(getExploreConnector('wikidata').id).toBe('wikidata');
		expect(getExploreConnector('danbooru').id).toBe('danbooru');
		expect(getExploreConnector('deviantart').id).toBe('deviantart');
		expect(getExploreConnector('bluesky').id).toBe('bluesky');
		expect(getExploreConnector('furaffinity').id).toBe('furaffinity');
		expect(getExploreConnectorForItemId('met-437133').id).toBe('met');
		expect(getExploreConnectorForItemId('artic-27992').id).toBe('artic');
		expect(getExploreConnectorForItemId('wikidata-Q12418').id).toBe('wikidata');
		expect(getExploreConnectorForItemId('danbooru-42').id).toBe('danbooru');
		expect(getExploreConnectorForItemId('bluesky-YXQ6Ly90ZXN0').id).toBe('bluesky');
		expect(getExploreConnectorForItemId('furaffinity-42').id).toBe('furaffinity');
	});

	it('rejects invalid namespaced item ids', () => {
		expect(() => getExploreConnectorForItemId('nope-1')).toThrow('Unsupported Explore source');
		expect(() => getExploreConnectorForItemId('badid')).toThrow('Invalid Explore item id');
	});
});
