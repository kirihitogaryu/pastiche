import { describe, expect, it } from 'vitest';
import {
	ATLAS_ONTOLOGY,
	defaultDisplayGroupFor,
	normalizeAtlasDisplayGroup,
	validateAtlasClassification
} from './ontology';

describe('Atlas ontology registry', () => {
	it('defines kind, category, and display group as separate concerns', () => {
		expect(defaultDisplayGroupFor('visual_tag', 'object')).toBe('Objects');
		expect(defaultDisplayGroupFor('entity', 'artist')).toBe('Artists and Makers');
		expect(ATLAS_ONTOLOGY.kinds.map((kind) => kind.id)).toEqual([
			'visual_tag',
			'entity',
			'claim',
			'classifier',
			'system'
		]);
	});

	it('normalizes only deterministic legacy display group spellings', () => {
		expect(normalizeAtlasDisplayGroup('Medium / Technique')).toBe('Medium and Technique');
		expect(normalizeAtlasDisplayGroup('Objects')).toBe('Objects');
		expect(normalizeAtlasDisplayGroup('Unknown bucket')).toBe('Unknown bucket');
	});

	it('rejects invalid combinations instead of falling back to Objects', () => {
		expect(
			validateAtlasClassification({
				kind: 'visual_tag',
				category: 'appearance',
				displayGroup: 'Objects'
			})
		).toEqual(expect.objectContaining({ ok: false }));
		expect(
			validateAtlasClassification({
				kind: 'entity',
				category: 'artist',
				displayGroup: 'Unknown bucket'
			})
		).toEqual(expect.objectContaining({ ok: false }));
	});

	it('accepts a registered combination without changing its presentation group', () => {
		expect(
			validateAtlasClassification({
				kind: 'visual_tag',
				category: 'reference_use',
				displayGroup: 'Reference Use'
			})
		).toEqual(expect.objectContaining({ ok: true, displayGroup: 'Reference Use' }));
	});
});
