# AI Agent Tagging Rules

## Purpose

AI agents should reduce tagging labor without polluting the vocabulary.

The tag database decides what becomes canonical. Agents propose.

## Required Resolution Pass

Before proposing a new tag or entity, an agent must check:

1. canonical slugs
2. aliases
3. deprecated tags
4. merged tags
5. blocked tags
6. fuzzy matches
7. broader and narrower concepts
8. related and confusable concepts
9. classifier alternatives
10. entity or claim alternatives

## Evidence Separation

Agents must label evidence.

Examples:

```txt
serpent
evidence: observed

python_(mythology)
evidence: metadata
source: LACMA title / Commons filename

divine_retribution
evidence: interpretive
status: suggested

prompt:feral
evidence: prompted
status: prompt_metadata
```

## Agent Creation Gate

An agent may create a draft tag or entity only when it provides:

- slug
- label
- kind
- category
- short definition
- reason for creation
- evidence default
- nearest existing concepts considered
- "tags like this" list
- "similar but not quite" list
- classifier alternative check
- example asset

## Agent Approval Limits

Agents may not auto-approve:

- artist identification from style alone
- exact mythological or historical identity without source support
- specialist technique without source support or strong visual evidence
- theme or mood tags unless rules explicitly allow it
- sensitive or personal attributes
- broad implications
- new canonical tags without draft wiki pages

## Compound Tags

Agents must not create compound attribute tags when classifiers work.

Avoid:

```txt
right_serpent
latin_inscription
large_bow
```

Prefer:

```txt
serpent + position:right
inscription + language:latin
bow + scale:large
```

## Suggested Output Shape

Agents should emit structured suggestions.

```ts
type AtlasAgentSuggestion = {
	slug: string;
	label: string;
	kind: 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'system';
	category: string;
	evidence: 'observed' | 'metadata' | 'prompted' | 'inferred' | 'interpretive' | 'computed';
	confidence: number;
	status: 'suggested' | 'needs_review' | 'approved';
	reason: string;
	source?: string;
	classifierAlternative?: {
		target: string;
		classifier: string;
		value: string;
	};
	nearbyRejected?: string[];
};
```

## AI Wiki Draft Checklist

An AI-created draft wiki page must include:

- definition
- use when
- do not use when
- nearby concepts considered
- distinctness argument
- broader concepts
- related concepts
- confusable concepts
- implication proposal
- classifier guidance
- AI auto-apply rule
- example asset

If the agent cannot explain the tag, it should not create it.
