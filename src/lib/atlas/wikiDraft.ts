import type { AtlasWikiDraftInput } from './batch';

const WIKI_DRAFT_KEYS = new Set<keyof AtlasWikiDraftInput>([
	'slug',
	'label',
	'kind',
	'category',
	'displayGroup',
	'shortDefinition',
	'longDescription',
	'useWhen',
	'doNotUseWhen',
	'aliases',
	'broader',
	'narrower',
	'related',
	'confusable',
	'automaticImplications',
	'suggestedImplications',
	'allowedClassifiers',
	'exampleAssetIds',
	'counterexampleAssetIds',
	'aiGuidance',
	'citations',
	'status',
	'maturity'
]);
const REQUIRED_KEYS = new Set<keyof AtlasWikiDraftInput>([
	'slug',
	'label',
	'kind',
	'category',
	'displayGroup',
	'shortDefinition',
	'useWhen',
	'doNotUseWhen',
	'aiGuidance'
]);
const STRING_LIMITS: Partial<Record<keyof AtlasWikiDraftInput, number>> = {
	slug: 200,
	label: 300,
	category: 200,
	displayGroup: 200,
	shortDefinition: 5_000,
	longDescription: 100_000,
	aiGuidance: 20_000
};
const LIST_KEYS = new Set<keyof AtlasWikiDraftInput>([
	'useWhen',
	'doNotUseWhen',
	'aliases',
	'broader',
	'narrower',
	'related',
	'confusable',
	'automaticImplications',
	'suggestedImplications',
	'allowedClassifiers',
	'exampleAssetIds',
	'counterexampleAssetIds',
	'citations'
]);
const CONCEPT_KINDS = new Set(['visual_tag', 'entity', 'claim', 'classifier', 'system']);
const CONCEPT_STATUSES = new Set([
	'active',
	'suggested',
	'needs_review',
	'deprecated',
	'merged',
	'alias',
	'blocked'
]);
const CONCEPT_MATURITIES = new Set(['stub', 'draft', 'usable', 'reviewed', 'locked']);

export type WikiDraftParseResult =
	| { ok: true; value: AtlasWikiDraftInput | Partial<AtlasWikiDraftInput> }
	| { ok: false; error: string };

export function parseAtlasWikiDraft(
	input: unknown,
	options: { partial?: boolean; allowIncompleteContent?: boolean } = {}
): WikiDraftParseResult {
	if (!isRecord(input)) return { ok: false, error: 'Wiki entry must be a JSON object.' };
	const unknownKeys = Object.keys(input).filter(
		(key) => !WIKI_DRAFT_KEYS.has(key as keyof AtlasWikiDraftInput)
	);
	if (unknownKeys.length) {
		return { ok: false, error: `Unknown wiki fields: ${unknownKeys.join(', ')}` };
	}
	if (!options.partial) {
		const requiredKeys = options.allowIncompleteContent
			? (['slug', 'label', 'kind', 'category', 'displayGroup'] as const)
			: [...REQUIRED_KEYS];
		const missing = requiredKeys.filter((key) => !(key in input));
		if (missing.length) return { ok: false, error: `Missing wiki fields: ${missing.join(', ')}` };
	}

	const result: Record<string, unknown> = {};
	for (const [key, rawValue] of Object.entries(input)) {
		const typedKey = key as keyof AtlasWikiDraftInput;
		if (LIST_KEYS.has(typedKey)) {
			const parsed = parseStringList(rawValue, typedKey === 'citations' ? 2_000 : 500);
			if ('error' in parsed) return { ok: false, error: `${key}: ${parsed.error}` };
			result[key] = parsed.value;
			continue;
		}
		if (typedKey === 'kind') {
			if (typeof rawValue !== 'string' || !CONCEPT_KINDS.has(rawValue)) {
				return { ok: false, error: 'kind is invalid.' };
			}
			result[key] = rawValue;
			continue;
		}
		if (typedKey === 'status') {
			if (typeof rawValue !== 'string' || !CONCEPT_STATUSES.has(rawValue)) {
				return { ok: false, error: 'status is invalid.' };
			}
			result[key] = rawValue;
			continue;
		}
		if (typedKey === 'maturity') {
			if (typeof rawValue !== 'string' || !CONCEPT_MATURITIES.has(rawValue)) {
				return { ok: false, error: 'maturity is invalid.' };
			}
			result[key] = rawValue;
			continue;
		}

		const limit = STRING_LIMITS[typedKey];
		if (typeof rawValue !== 'string') return { ok: false, error: `${key} must be a string.` };
		const value = rawValue.trim();
		const structurallyRequired = ['slug', 'label', 'kind', 'category', 'displayGroup'].includes(
			typedKey
		);
		if (
			REQUIRED_KEYS.has(typedKey) &&
			!value &&
			(!options.allowIncompleteContent || structurallyRequired)
		) {
			return { ok: false, error: `${key} cannot be empty.` };
		}
		if (limit && value.length > limit) {
			return { ok: false, error: `${key} is limited to ${limit} characters.` };
		}
		result[key] = value;
	}

	return { ok: true, value: result as Partial<AtlasWikiDraftInput> };
}

function parseStringList(value: unknown, itemLimit: number) {
	if (!Array.isArray(value)) return { error: 'must be an array of strings.' } as const;
	if (value.length > 500) return { error: 'is limited to 500 items.' } as const;
	const items: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') return { error: 'must contain only strings.' } as const;
		const clean = item.trim();
		if (!clean) return { error: 'cannot contain empty values.' } as const;
		if (clean.length > itemLimit) {
			return { error: `items are limited to ${itemLimit} characters.` } as const;
		}
		items.push(clean);
	}
	return { value: items } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
