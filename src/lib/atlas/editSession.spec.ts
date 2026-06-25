import { describe, expect, it } from 'vitest';
import { countAtlasEditOperations, mergeAtlasEditPatches } from './editSession';

describe('Atlas edit sessions', () => {
	it('merges queued patches without overwriting earlier staged edits', () => {
		const first = mergeAtlasEditPatches({}, { identity: { title: 'First title' } });
		const second = mergeAtlasEditPatches(first, { identity: { description: 'Source note' } });
		const third = mergeAtlasEditPatches(second, {
			concepts: [{ slug: 'dragon', evidence: 'observed' }]
		});
		const merged = mergeAtlasEditPatches(third, {
			annotations: [{ label: 'python_as_dragon', concepts: ['wing'] }]
		});

		expect(merged.identity).toEqual({
			title: 'First title',
			description: 'Source note'
		});
		expect(merged.concepts).toEqual([{ slug: 'dragon', evidence: 'observed' }]);
		expect(merged.annotations).toEqual([{ label: 'python_as_dragon', concepts: ['wing'] }]);
	});

	it('counts staged identity fields and list operations', () => {
		expect(
			countAtlasEditOperations({
				identity: { title: 'First title', description: 'Source note' },
				concepts: [{ slug: 'dragon' }, { slug: 'wing', action: 'remove' }],
				entities: [{ kind: 'artist', label: 'Hendrick Goltzius' }],
				claims: [{ kind: 'medium', value: 'Engraving' }],
				annotations: [{ label: 'python_as_dragon', concepts: ['dragon'] }]
			})
		).toBe(7);
	});
});
