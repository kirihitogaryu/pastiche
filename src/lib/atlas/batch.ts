import { normalizeAtlasSlug } from './normalization';
import type {
	AtlasAssignmentStatus,
	AtlasClaimKind,
	AtlasConceptKind,
	AtlasEntityKind,
	AtlasEvidence
} from './types';

export const VISUAL_ROLE_VALUES = [
	'focal_point',
	'supporting_subject',
	'background_detail',
	'setting_context'
] as const;

export type VisualRoleValue = (typeof VISUAL_ROLE_VALUES)[number];

export type AtlasBatchIdentityInput = {
	title?: string;
	artist?: string;
	year?: string;
	medium?: string;
	source?: string;
	rights?: string;
	dimensions?: string;
	description?: string;
};

export type AtlasBatchConceptInput = {
	slug: string;
	evidence?: AtlasEvidence;
	status?: AtlasAssignmentStatus;
	action?: 'upsert' | 'remove';
};

export type AtlasBatchEntityInput = {
	kind: AtlasEntityKind;
	label: string;
	action?: 'upsert' | 'remove';
};

export type AtlasBatchClaimInput = {
	kind: AtlasClaimKind;
	label?: string;
	value: string;
	action?: 'upsert' | 'remove';
};

export type AtlasBatchAnnotationInput = {
	id?: string;
	label: string;
	concepts?: string[];
	removeConcepts?: string[];
	classifiers?: Record<string, string> | Array<{ type: string; value: string }>;
	action?: 'upsert' | 'remove';
};

export type AtlasWikiDraftInput = {
	slug: string;
	label: string;
	kind: AtlasConceptKind;
	category: string;
	displayGroup: string;
	shortDefinition: string;
	longDescription?: string;
	useWhen: string[];
	doNotUseWhen: string[];
	aliases?: string[];
	broader?: string[];
	narrower?: string[];
	related?: string[];
	confusable?: string[];
	automaticImplications?: string[];
	suggestedImplications?: string[];
	allowedClassifiers?: string[];
	exampleAssetIds?: string[];
	counterexampleAssetIds?: string[];
	aiGuidance: string;
	citations?: string[];
	status?: 'active' | 'suggested' | 'needs_review' | 'deprecated' | 'merged' | 'alias' | 'blocked';
	maturity?: 'stub' | 'draft' | 'usable' | 'reviewed' | 'locked';
};

export type AtlasBatchInput = {
	identity?: AtlasBatchIdentityInput;
	concepts?: AtlasBatchConceptInput[];
	entities?: AtlasBatchEntityInput[];
	claims?: AtlasBatchClaimInput[];
	annotations?: AtlasBatchAnnotationInput[];
};

export type AtlasBatchPreview = {
	input: AtlasBatchInput;
	canonicalizations: Array<{ from: string; to: string }>;
	errors: string[];
};

const EVIDENCE_VALUES = new Set<AtlasEvidence>([
	'observed',
	'metadata',
	'prompted',
	'inferred',
	'interpretive',
	'computed'
]);

const STATUS_VALUES = new Set<AtlasAssignmentStatus>([
	'approved',
	'suggested',
	'needs_review',
	'rejected',
	'deprecated'
]);

const ENTITY_KINDS = new Set<AtlasEntityKind>([
	'artist',
	'work',
	'character',
	'ip',
	'institution',
	'source',
	'place',
	'species'
]);

const CLAIM_KINDS = new Set<AtlasClaimKind>([
	'rights',
	'medium',
	'date',
	'dimensions',
	'source_metadata',
	'technical_metadata',
	'ai_generation'
]);

export function parseAtlasBatchJson(text: string): AtlasBatchPreview {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return {
			input: {},
			canonicalizations: [],
			errors: [error instanceof Error ? error.message : 'Batch JSON could not be parsed.']
		};
	}
	return normalizeAtlasBatchInput(parsed);
}

export function normalizeAtlasBatchInput(value: unknown): AtlasBatchPreview {
	const errors: string[] = [];
	const canonicalizations: AtlasBatchPreview['canonicalizations'] = [];
	if (!isRecord(value)) {
		return { input: {}, canonicalizations, errors: ['Batch input must be a JSON object.'] };
	}

	const input: AtlasBatchInput = {};
	if ('identity' in value) input.identity = normalizeIdentity(value.identity, errors);
	if ('concepts' in value) {
		input.concepts = normalizeArray(value.concepts, 'concepts', errors)
			.map((item, index) => normalizeConcept(item, index, errors, canonicalizations))
			.filter((item): item is AtlasBatchConceptInput => Boolean(item));
	}
	if ('entities' in value) {
		input.entities = normalizeArray(value.entities, 'entities', errors)
			.map((item, index) => normalizeEntity(item, index, errors))
			.filter((item): item is AtlasBatchEntityInput => Boolean(item));
	}
	if ('claims' in value) {
		input.claims = normalizeArray(value.claims, 'claims', errors)
			.map((item, index) => normalizeClaim(item, index, errors))
			.filter((item): item is AtlasBatchClaimInput => Boolean(item));
	}
	if ('annotations' in value) {
		input.annotations = normalizeArray(value.annotations, 'annotations', errors)
			.map((item, index) => normalizeAnnotation(item, index, errors, canonicalizations))
			.filter((item): item is AtlasBatchAnnotationInput => Boolean(item));
	}

	return { input, canonicalizations, errors };
}

function normalizeIdentity(value: unknown, errors: string[]): AtlasBatchIdentityInput {
	if (!isRecord(value)) {
		errors.push('identity must be an object.');
		return {};
	}
	const identity: AtlasBatchIdentityInput = {};
	for (const key of [
		'title',
		'artist',
		'year',
		'medium',
		'source',
		'rights',
		'dimensions',
		'description'
	] as const) {
		const text = optionalString(value[key], `identity.${key}`, errors);
		if (text !== undefined) identity[key] = text;
	}
	return identity;
}

function normalizeConcept(
	value: unknown,
	index: number,
	errors: string[],
	canonicalizations: AtlasBatchPreview['canonicalizations']
): AtlasBatchConceptInput | null {
	if (!isRecord(value)) {
		errors.push(`concepts[${index}] must be an object.`);
		return null;
	}
	const rawSlug = requiredString(value.slug, `concepts[${index}].slug`, errors);
	if (!rawSlug) return null;
	const slug = normalizeAtlasSlug(rawSlug);
	if (slug !== rawSlug) canonicalizations.push({ from: rawSlug, to: slug });
	const evidence = optionalEnum(value.evidence, EVIDENCE_VALUES, `concepts[${index}].evidence`, errors);
	const status = optionalEnum(value.status, STATUS_VALUES, `concepts[${index}].status`, errors);
	const action = optionalAction(value.action, `concepts[${index}].action`, errors);
	return {
		slug,
		evidence: evidence ?? 'observed',
		status: status ?? 'approved',
		action: action ?? 'upsert'
	} satisfies AtlasBatchConceptInput;
}

function normalizeEntity(value: unknown, index: number, errors: string[]): AtlasBatchEntityInput | null {
	if (!isRecord(value)) {
		errors.push(`entities[${index}] must be an object.`);
		return null;
	}
	const kind = optionalEnum(value.kind, ENTITY_KINDS, `entities[${index}].kind`, errors);
	const label = requiredString(value.label, `entities[${index}].label`, errors);
	if (!kind || !label) return null;
	return {
		kind,
		label,
		action: optionalAction(value.action, `entities[${index}].action`, errors) ?? 'upsert'
	} satisfies AtlasBatchEntityInput;
}

function normalizeClaim(value: unknown, index: number, errors: string[]): AtlasBatchClaimInput | null {
	if (!isRecord(value)) {
		errors.push(`claims[${index}] must be an object.`);
		return null;
	}
	const kind = optionalEnum(value.kind, CLAIM_KINDS, `claims[${index}].kind`, errors);
	const valueText = requiredString(value.value, `claims[${index}].value`, errors);
	if (!kind || !valueText) return null;
	return {
		kind,
		label: optionalString(value.label, `claims[${index}].label`, errors),
		value: valueText,
		action: optionalAction(value.action, `claims[${index}].action`, errors) ?? 'upsert'
	} satisfies AtlasBatchClaimInput;
}

function normalizeAnnotation(
	value: unknown,
	index: number,
	errors: string[],
	canonicalizations: AtlasBatchPreview['canonicalizations']
): AtlasBatchAnnotationInput | null {
	if (!isRecord(value)) {
		errors.push(`annotations[${index}] must be an object.`);
		return null;
	}
	const label = requiredString(value.label, `annotations[${index}].label`, errors);
	if (!label) return null;
	const concepts = normalizeArray(value.concepts, `annotations[${index}].concepts`, errors)
		.map((concept) => {
			if (typeof concept !== 'string') {
				errors.push(`annotations[${index}].concepts must contain strings.`);
				return null;
			}
			const slug = normalizeAtlasSlug(concept);
			if (slug !== concept) canonicalizations.push({ from: concept, to: slug });
			return slug;
		})
		.filter((item): item is string => Boolean(item));
	const removeConcepts = normalizeArray(
		value.removeConcepts,
		`annotations[${index}].removeConcepts`,
		errors
	)
		.map((concept) => {
			if (typeof concept !== 'string') {
				errors.push(`annotations[${index}].removeConcepts must contain strings.`);
				return null;
			}
			const slug = normalizeAtlasSlug(concept);
			if (slug !== concept) canonicalizations.push({ from: concept, to: slug });
			return slug;
		})
		.filter((item): item is string => Boolean(item));
	const classifiers = normalizeClassifiers(value.classifiers, `annotations[${index}].classifiers`, errors);
	return {
		id: optionalString(value.id, `annotations[${index}].id`, errors),
		label,
		concepts,
		removeConcepts,
		classifiers,
		action: optionalAction(value.action, `annotations[${index}].action`, errors) ?? 'upsert'
	} satisfies AtlasBatchAnnotationInput;
}

function normalizeClassifiers(value: unknown, path: string, errors: string[]) {
	if (value === undefined) return {};
	if (isRecord(value)) {
		const output: Record<string, string> = {};
		for (const [key, classifierValue] of Object.entries(value)) {
			if (typeof classifierValue !== 'string') {
				errors.push(`${path}.${key} must be a string.`);
				continue;
			}
			output[normalizeAtlasSlug(key)] = classifierValue.trim();
		}
		validateVisualRole(output.visual_role, path, errors);
		return output;
	}
	if (Array.isArray(value)) {
		const output: Record<string, string> = {};
		for (const [index, item] of value.entries()) {
			if (!isRecord(item)) {
				errors.push(`${path}[${index}] must be an object.`);
				continue;
			}
			const type = requiredString(item.type, `${path}[${index}].type`, errors);
			const classifierValue = requiredString(item.value, `${path}[${index}].value`, errors);
			if (type && classifierValue) output[normalizeAtlasSlug(type)] = classifierValue;
		}
		validateVisualRole(output.visual_role, path, errors);
		return output;
	}
	errors.push(`${path} must be an object or array.`);
	return {};
}

function validateVisualRole(value: string | undefined, path: string, errors: string[]) {
	if (!value) return;
	if (!VISUAL_ROLE_VALUES.includes(value as VisualRoleValue)) {
		errors.push(`${path}.visual_role must be one of ${VISUAL_ROLE_VALUES.join(', ')}.`);
	}
}

function normalizeArray(value: unknown, path: string, errors: string[]) {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		errors.push(`${path} must be an array.`);
		return [];
	}
	return value;
}

function optionalAction(value: unknown, path: string, errors: string[]) {
	if (value === undefined) return undefined;
	if (value === 'upsert' || value === 'remove') return value;
	errors.push(`${path} must be "upsert" or "remove".`);
	return undefined;
}

function optionalEnum<T extends string>(
	value: unknown,
	allowed: Set<T>,
	path: string,
	errors: string[]
) {
	if (value === undefined) return undefined;
	if (typeof value === 'string' && allowed.has(value as T)) return value as T;
	errors.push(`${path} is not supported.`);
	return undefined;
}

function requiredString(value: unknown, path: string, errors: string[]) {
	if (typeof value === 'string' && value.trim()) return value.trim();
	errors.push(`${path} is required.`);
	return null;
}

function optionalString(value: unknown, path: string, errors: string[]) {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'string') return value.trim();
	errors.push(`${path} must be a string.`);
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
