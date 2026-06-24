import { describe, expect, it } from 'vitest';
import { normalizeAtlasSlug, normalizeKnownAtlasValue } from './normalization';

describe('Atlas normalization', () => {
	it('normalizes labels into stable lowercase slugs', () => {
		expect(normalizeAtlasSlug(' Pablo Picasso ')).toBe('pablo_picasso');
		expect(normalizeAtlasSlug('Oil on canvas')).toBe('oil_on_canvas');
		expect(normalizeAtlasSlug('The Metropolitan Museum of Art')).toBe(
			'the_metropolitan_museum_of_art'
		);
		expect(normalizeAtlasSlug('1860s–70s')).toBe('1860s_70s');
		expect(normalizeAtlasSlug('B&W')).toBe('b_and_w');
	});

	it('uses known mappings for common source values', () => {
		expect(normalizeKnownAtlasValue('institution', 'The Metropolitan Museum of Art')).toEqual({
			label: 'The Met',
			slug: 'the_met'
		});
		expect(normalizeKnownAtlasValue('institution', 'Metropolitan Museum')).toEqual({
			label: 'The Met',
			slug: 'the_met'
		});
		expect(normalizeKnownAtlasValue('source', 'Wikimedia Commons')).toEqual({
			label: 'Wikimedia Commons',
			slug: 'wikimedia_commons'
		});
		expect(normalizeKnownAtlasValue('rights', 'Public domain image according to The Met.')).toEqual({
			label: 'Public Domain',
			slug: 'public_domain'
		});
		expect(normalizeKnownAtlasValue('medium', 'Oil on canvas')).toEqual({
			label: 'Oil on canvas',
			slug: 'oil_on_canvas'
		});
	});
});
