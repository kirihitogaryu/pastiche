import type {
	AiGenerationMetadata,
	PromptToken,
	PromptTokenScope
} from '$lib/library/types';

import type { EmbeddedImageMetadata } from './embeddedImageMetadata';

type JsonObject = Record<string, unknown>;

export function parseNovelAiGeneration(
	metadata: EmbeddedImageMetadata
): AiGenerationMetadata | null {
	if (!isNovelAiMetadata(metadata)) return null;

	const rawParameters = parseJsonObject(metadata.pngText.Comment);
	const prompt = firstString(
		stringAt(rawParameters, ['v4_prompt', 'caption', 'base_caption']),
		stringAt(rawParameters, ['prompt']),
		metadata.pngText.Description
	);
	const negativePrompt = firstString(
		stringAt(rawParameters, ['v4_negative_prompt', 'caption', 'base_caption']),
		stringAt(rawParameters, ['uc'])
	);
	const characterPrompts = extractCharacterPrompts(rawParameters);
	const promptTokens = [
		...parsePromptTokens(prompt ?? '', 'positive'),
		...parsePromptTokens(negativePrompt ?? '', 'negative'),
		...characterPrompts.flatMap((character) => [
			...parsePromptTokens(character.prompt, 'character_positive'),
			...parsePromptTokens(character.negativePrompt ?? '', 'character_negative')
		])
	];

	return {
		provider: 'novelai',
		prompt,
		negativePrompt,
		model: firstString(metadata.pngText.Source),
		seed: numberOrString(rawParameters.seed),
		sampler: firstString(rawParameters.sampler),
		steps: numberOrNull(rawParameters.steps),
		cfgScale: numberOrNull(rawParameters.scale),
		rawParameters,
		promptTagSuggestions: unique(
			promptTokens
				.filter(
					(token) =>
						token.role === 'tag' &&
						(token.scope === 'positive' || token.scope === 'character_positive')
				)
				.map((token) => token.normalized)
				.filter(Boolean)
		),
		promptTokens,
		characterPrompts,
		settings: generationSettings(rawParameters)
	};
}

export function parsePromptTokens(prompt: string, scope: PromptTokenScope): PromptToken[] {
	return parsePromptTokenSegments(prompt, scope, null);
}

function isNovelAiMetadata(metadata: EmbeddedImageMetadata): boolean {
	return (
		/novelai/i.test(metadata.pngText.Software ?? '') ||
		/novelai/i.test(metadata.pngText.Source ?? '') ||
		metadata.pngText.Comment?.includes('"v4_prompt"') === true
	);
}

function parsePromptTokenSegments(
	prompt: string,
	scope: PromptTokenScope,
	weight: number | null
): PromptToken[] {
	return splitPromptSegments(prompt).flatMap((segment) => {
		const trimmedSegment = segment.trim();
		const weighted = trimmedSegment.match(/^([+-]?\d+(?:\.\d+)?)::([\s\S]+)::$/);
		if (weighted) {
			return parsePromptTokenSegments(weighted[2], scope, Number(weighted[1]));
		}

		const text = cleanToken(trimmedSegment);
		if (!text) return [];
		const artistStyle = /^artist\s*:/i.test(text);
		return [
			{
				text,
				normalized: normalizeToken(text, artistStyle),
				scope,
				role: artistStyle ? 'artist_style_reference' : 'tag',
				weight
			}
		];
	});
}

function splitPromptSegments(prompt: string): string[] {
	const segments: string[] = [];
	let current = '';
	let insideWeightedBlock = false;

	for (let index = 0; index < prompt.length; index += 1) {
		const char = prompt[index];
		const next = prompt[index + 1];
		if (char === ':' && next === ':') {
			insideWeightedBlock = !insideWeightedBlock;
			current += '::';
			index += 1;
			continue;
		}
		if (char === ',' && !insideWeightedBlock) {
			segments.push(current);
			current = '';
			continue;
		}
		current += char;
	}

	segments.push(current);
	return segments;
}

function cleanToken(token: string): string {
	return token
		.trim()
		.replace(/^[{}[\]()]+/, '')
		.replace(/[{}[\]()]+$/, '')
		.trim();
}

function normalizeToken(token: string, artistStyle: boolean): string {
	const normalized = artistStyle ? token.replace(/^artist\s*:\s*/i, '') : token;
	return normalized.replace(/\s+/g, ' ').trim();
}

function extractCharacterPrompts(rawParameters: JsonObject) {
	const positive = arrayAt(rawParameters, ['v4_prompt', 'caption', 'char_captions']);
	const negative = arrayAt(rawParameters, ['v4_negative_prompt', 'caption', 'char_captions']);
	const count = Math.max(positive.length, negative.length);

	return Array.from({ length: count }, (_, index) => {
		const positiveCaption = objectOrNull(positive[index]);
		const negativeCaption = objectOrNull(negative[index]);
		return {
			label: `character ${index + 1}`,
			prompt: firstString(stringAt(positiveCaption, ['char_caption'])) ?? '',
			negativePrompt: firstString(stringAt(negativeCaption, ['char_caption']))
		};
	}).filter((character) => character.prompt || character.negativePrompt);
}

function generationSettings(rawParameters: JsonObject): Record<string, string | number | boolean | null> {
	const settings: Record<string, string | number | boolean | null> = {};
	for (const key of [
		'width',
		'height',
		'version',
		'uncond_scale',
		'cfg_rescale',
		'noise_schedule',
		'request_type',
		'signed_hash'
	]) {
		const value = rawParameters[key];
		if (
			value === null ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			settings[key] = value;
		}
	}
	return settings;
}

function parseJsonObject(value: string | undefined): JsonObject {
	if (!value) return {};
	try {
		const parsed = JSON.parse(value);
		return objectOrNull(parsed) ?? {};
	} catch {
		return {};
	}
}

function stringAt(value: unknown, path: string[]): string | null {
	let current = value;
	for (const key of path) {
		const object = objectOrNull(current);
		if (!object) return null;
		current = object[key];
	}
	return typeof current === 'string' && current.trim() ? current : null;
}

function arrayAt(value: unknown, path: string[]): unknown[] {
	let current = value;
	for (const key of path) {
		const object = objectOrNull(current);
		if (!object) return [];
		current = object[key];
	}
	return Array.isArray(current) ? current : [];
}

function objectOrNull(value: unknown): JsonObject | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null;
}

function firstString(...values: Array<unknown>): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value;
	}
	return null;
}

function numberOrString(value: unknown): string | number | null {
	if (typeof value === 'number' || typeof value === 'string') return value;
	return null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}
