import { createHash } from 'node:crypto';

export const ATLAS_AGENT_POLICY_VERSION = '2026-07-24.1';

const SHARED_RULES = [
	'Atlas is a controlled retrieval vocabulary. Prefer existing canonical concepts and aliases.',
	'Approval is vocabulary state, not model confidence.',
	'Only a pre-existing active canonical concept supplied in context may be called approved.',
	'New concepts remain needs_review and draft until a human reviews their wiki entry.',
	'Before proposing a concept, check aliases, deprecated and merged concepts, nearby concepts, confusables, and classifier alternatives.',
	'Do not create compound attribute tags when a subject plus allowed classifier expresses the same meaning.',
	'Keep observed, metadata, inferred, interpretive, prompted, and computed evidence distinct.',
	'Source tags and model labels are hints, not proof of canonical Atlas vocabulary.',
	'Do not infer identity, gender identity, artist, provenance, or historical meaning from appearance alone.',
	'Do not tag signatures, watermarks, or incidental text unless text analysis is requested or the text is focal.',
	'Return strict JSON only. Never wrap output in Markdown or commentary.'
];

const TAG_RULES = [
	'Describe visible subjects, objects, actions, positions, roles, colors, materials, patterns, states, and views.',
	'Use annotations for visible subjects and attach classifiers to those annotations.',
	'Use allowed classifier names and controlled values exactly as supplied.',
	'Do not add broad parents when Atlas implications already provide them.',
	'New concepts require a clear definition, reason, nearest alternatives, classifier-alternative check, and example asset.',
	'If context is insufficient, return an uncertain suggestion rather than inventing a canonical match.'
];

const WIKI_RULES = [
	'Write concise, factual, retrieval-oriented wiki prose.',
	'Define the visible boundary: when to use the concept and when not to use it.',
	'Explain confusable concepts and classifier alternatives where relevant.',
	'Do not overwrite supplied human-authored content.',
	'Do not invent citations. If no citation is supplied, leave citations empty.',
	'Keep status needs_review and maturity draft unless the existing entry already has another value.',
	'Use canonical underscore slugs when referring to Atlas concepts.'
];

export const ATLAS_AGENT_POLICY = {
	version: ATLAS_AGENT_POLICY_VERSION,
	shared: SHARED_RULES,
	tagging: TAG_RULES,
	wiki: WIKI_RULES
};

export const ATLAS_AGENT_POLICY_HASH = createHash('sha256')
	.update(JSON.stringify(ATLAS_AGENT_POLICY))
	.digest('hex');

export function agentPolicyText(job: 'tag_suggestions' | 'wiki_draft') {
	return [
		`Atlas policy version: ${ATLAS_AGENT_POLICY_VERSION}`,
		`Atlas policy hash: ${ATLAS_AGENT_POLICY_HASH}`,
		...SHARED_RULES.map((rule) => `- ${rule}`),
		...(job === 'tag_suggestions' ? TAG_RULES : WIKI_RULES).map((rule) => `- ${rule}`)
	].join('\n');
}
