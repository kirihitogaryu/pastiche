import { describe, expect, it } from 'vitest';
import { getExploreConnector, getExploreConnectorForItemId, isSourceId } from './index';

describe('Explore connector registry', () => {
	it('recognizes supported source ids', () => {
		expect(isSourceId('met')).toBe(true);
		expect(isSourceId('artic')).toBe(true);
		expect(isSourceId('wikiart')).toBe(false);
	});

	it('resolves connectors by source id and namespaced item id', () => {
		expect(getExploreConnector('met').id).toBe('met');
		expect(getExploreConnector('artic').id).toBe('artic');
		expect(getExploreConnectorForItemId('met-437133').id).toBe('met');
		expect(getExploreConnectorForItemId('artic-27992').id).toBe('artic');
	});

	it('rejects invalid namespaced item ids', () => {
		expect(() => getExploreConnectorForItemId('nope-1')).toThrow('Unsupported Explore source');
		expect(() => getExploreConnectorForItemId('badid')).toThrow('Invalid Explore item id');
	});
});
