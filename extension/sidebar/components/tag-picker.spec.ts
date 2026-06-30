import { describe, expect, it } from 'vitest';
import { addConceptSlug, normalizeConceptSlugInput, removeConceptSlug } from './tag-picker';

describe('tag picker helpers', () => {
	it('normalizes typed labels to Atlas-style slugs', () => {
		expect.assertions(2);

		expect(normalizeConceptSlugInput('Black Hair')).toBe('black_hair');
		expect(normalizeConceptSlugInput("Painter's hands & sleeves")).toBe(
			'painters_hands_and_sleeves'
		);
	});

	it('adds concept slugs once', () => {
		expect.assertions(2);

		expect(addConceptSlug([], 'dragon')).toEqual(['dragon']);
		expect(addConceptSlug(['dragon'], ' dragon ')).toEqual(['dragon']);
	});

	it('removes concept slugs by normalized value', () => {
		expect.assertions(1);

		expect(removeConceptSlug(['dragon', 'flower'], ' Dragon ')).toEqual(['flower']);
	});
});
