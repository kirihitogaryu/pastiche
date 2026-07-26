import { describe, expect, it } from 'vitest';

import {
	aiPromptTagSuggestions,
	artistStyleReferenceSuggestions,
	artistStyleSlug,
	slugForPromptTag
} from './aiPromptSuggestions';
import type { AiGenerationMetadata } from '$lib/library/types';

describe('AI prompt suggestions', () => {
	it('uses positive and character prompt tags as addable suggestions', () => {
		const suggestions = aiPromptTagSuggestions(generation(), new Set());

		expect(suggestions).toEqual([
			{ label: '1boy', slug: '1boy', source: 'positive' },
			{ label: 'simple background', slug: 'simple_background', source: 'positive' },
			{ label: 'white dragon', slug: 'white_dragon', source: 'character_positive' },
			{ label: 'opal scales', slug: 'opal_scales', source: 'character_positive' }
		]);
	});

	it('excludes accepted concepts and negative prompt tags', () => {
		const suggestions = aiPromptTagSuggestions(generation(), new Set(['white_dragon']));

		expect(suggestions.map((suggestion) => suggestion.slug)).toEqual([
			'1boy',
			'simple_background',
			'opal_scales'
		]);
		expect(suggestions.map((suggestion) => suggestion.slug)).not.toContain('lowres');
	});

	it('keeps artist prompt tokens as artist-style references', () => {
		const suggestions = artistStyleReferenceSuggestions(
			generation(),
			new Set([artistStyleSlug('nightcrow')])
		);

		expect(suggestions).toEqual([
			{
				label: 'alphonse mucha',
				slug: 'artist_style_alphonse_mucha',
				artistName: 'alphonse mucha',
				source: 'character_positive'
			}
		]);
	});

	it('normalizes prompt labels into Atlas-style slugs', () => {
		expect(slugForPromptTag('blue bow')).toBe('blue_bow');
		expect(slugForPromptTag('luli_(crocowolf333)')).toBe('luli_crocowolf333');
	});
});

function generation(): AiGenerationMetadata {
	return {
		provider: 'novelai',
		prompt: null,
		negativePrompt: null,
		model: null,
		seed: null,
		sampler: null,
		steps: null,
		cfgScale: null,
		rawParameters: {},
		promptTagSuggestions: [],
		promptTokens: [
			{
				text: '1boy',
				normalized: '1boy',
				scope: 'positive',
				role: 'tag',
				weight: 1.3
			},
			{
				text: 'simple background',
				normalized: 'simple background',
				scope: 'positive',
				role: 'tag',
				weight: null
			},
			{
				text: 'artist:nightcrow',
				normalized: 'nightcrow',
				scope: 'positive',
				role: 'artist_style_reference',
				weight: null
			},
			{
				text: 'lowres',
				normalized: 'lowres',
				scope: 'negative',
				role: 'tag',
				weight: null
			},
			{
				text: 'white dragon',
				normalized: 'white dragon',
				scope: 'character_positive',
				role: 'tag',
				weight: null
			},
			{
				text: 'artist:alphonse mucha',
				normalized: 'alphonse mucha',
				scope: 'character_positive',
				role: 'artist_style_reference',
				weight: null
			},
			{
				text: 'opal scales',
				normalized: 'opal scales',
				scope: 'character_positive',
				role: 'tag',
				weight: null
			}
		]
	};
}
