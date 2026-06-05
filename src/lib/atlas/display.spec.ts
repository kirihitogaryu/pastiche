import { describe, expect, it } from 'vitest';
import { atlasRowTone, groupAtlasRows, normalizeDisplayTag } from './display';

describe('Atlas display helpers', () => {
	it('groups rows without losing order inside groups', () => {
		const groups = groupAtlasRows([
			{ group: 'Identity', label: 'Artist', value: 'Pablo Picasso', tone: 'artist' },
			{ group: 'Identity', label: 'Work', value: 'Guernica', tone: 'work' },
			{ group: 'Source Claims', label: 'Medium', value: 'Oil on canvas', tone: 'source' }
		]);

		expect(groups).toEqual([
			{
				name: 'Identity',
				rows: [
					{ group: 'Identity', label: 'Artist', value: 'Pablo Picasso', tone: 'artist' },
					{ group: 'Identity', label: 'Work', value: 'Guernica', tone: 'work' }
				]
			},
			{
				name: 'Source Claims',
				rows: [{ group: 'Source Claims', label: 'Medium', value: 'Oil on canvas', tone: 'source' }]
			}
		]);
	});

	it('maps Atlas concept kinds to display tones', () => {
		expect(atlasRowTone({ kind: 'artist' })).toBe('artist');
		expect(atlasRowTone({ kind: 'work' })).toBe('work');
		expect(atlasRowTone({ kind: 'rights' })).toBe('source');
		expect(atlasRowTone({ kind: 'medium' })).toBe('source');
		expect(atlasRowTone({ status: 'suggested' })).toBe('prompt');
	});

	it('normalizes legacy display tags into row labels', () => {
		expect(normalizeDisplayTag('Blue Horse')).toEqual({
			label: 'Blue Horse',
			value: 'blue_horse'
		});
	});
});
