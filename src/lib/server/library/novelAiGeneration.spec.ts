import { describe, expect, it } from 'vitest';

import { parseNovelAiGeneration, parsePromptTokens } from './novelAiGeneration';
import type { EmbeddedImageMetadata } from './embeddedImageMetadata';

describe('NovelAI generation metadata', () => {
	it('maps NovelAI PNG text metadata to generation fields', () => {
		const generation = parseNovelAiGeneration(novelAiMetadata());

		expect(generation).toMatchObject({
			provider: 'novelai',
			model: 'NovelAI Diffusion V4.5 4BDE2A90',
			prompt: '1.5::1boy, solo::, 1.5::simple background::, artist:nightcrow, western dragon',
			negativePrompt: 'lowres, bad anatomy',
			seed: 3468250285,
			sampler: 'k_euler_ancestral',
			steps: 25,
			cfgScale: 6
		});
		expect(generation?.settings).toMatchObject({
			width: 1216,
			height: 832,
			version: 1
		});
	});

	it('extracts positive, character, and negative prompt tokens separately', () => {
		const generation = parseNovelAiGeneration(novelAiMetadata());

		expect(generation?.characterPrompts).toEqual([
			{
				label: 'character 1',
				prompt: 'white dragon, opal scales, artist:alphonse mucha',
				negativePrompt: 'human, blurry'
			}
		]);
		expect(generation?.promptTagSuggestions).toEqual(
			expect.arrayContaining([
				'1boy',
				'solo',
				'simple background',
				'western dragon',
				'white dragon'
			])
		);
		expect(generation?.promptTagSuggestions).not.toContain('lowres');
		expect(generation?.promptTagSuggestions).not.toContain('artist:nightcrow');
	});

	it('marks artist prompt tags as style references rather than creator attribution', () => {
		const tokens = parsePromptTokens(
			'artist:nightcrow, 1.3::luli_(crocowolf333), faux traditional media::',
			'positive'
		);

		expect(tokens).toContainEqual({
			text: 'artist:nightcrow',
			normalized: 'nightcrow',
			scope: 'positive',
			role: 'artist_style_reference',
			weight: null
		});
		expect(tokens).toContainEqual({
			text: 'faux traditional media',
			normalized: 'faux traditional media',
			scope: 'positive',
			role: 'tag',
			weight: 1.3
		});
	});
});

function novelAiMetadata(): EmbeddedImageMetadata {
	return {
		kind: 'png',
		warnings: [],
		pngText: {
			Software: 'NovelAI',
			Source: 'NovelAI Diffusion V4.5 4BDE2A90',
			Description: '1.5::1boy, solo::, 1.5::simple background::, artist:nightcrow, western dragon',
			Comment: JSON.stringify({
				prompt: '1.5::1boy, solo::, 1.5::simple background::, artist:nightcrow, western dragon',
				uc: 'lowres, bad anatomy',
				steps: 25,
				width: 1216,
				height: 832,
				scale: 6,
				seed: 3468250285,
				sampler: 'k_euler_ancestral',
				version: 1,
				v4_prompt: {
					caption: {
						base_caption:
							'1.5::1boy, solo::, 1.5::simple background::, artist:nightcrow, western dragon',
						char_captions: [
							{
								char_caption: 'white dragon, opal scales, artist:alphonse mucha'
							}
						]
					}
				},
				v4_negative_prompt: {
					caption: {
						base_caption: 'lowres, bad anatomy',
						char_captions: [
							{
								char_caption: 'human, blurry'
							}
						]
					}
				}
			})
		}
	};
}
