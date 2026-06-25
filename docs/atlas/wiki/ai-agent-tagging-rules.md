# AI Agent Tagging Rules

## Purpose

AI agents should reduce tagging labor without polluting the vocabulary.

The tag database decides what becomes canonical. Agents propose.

Agents should not treat every new tag as a failure. The Atlas vocabulary is expected to grow.

The failure mode is creating undocumented, duplicate, vague, or classifier-replaceable tags. A useful new concept with clear boundaries is allowed when it is marked for review and documented.

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

## New Tag Addendum

Agents must prefer existing canonical vocabulary, but they must not avoid useful new tags merely because the vocabulary is young.

Create or propose a new draft tag when all of these are true:

- no canonical tag, alias, deprecated replacement, or merged tag already fits
- no broader/narrower, related, or confusable concept covers the intended meaning
- the concept is useful for future retrieval, review, annotation, or wiki navigation
- the concept cannot be represented more cleanly as a classifier on an existing tag
- the concept can be defined clearly enough for humans and agents to apply consistently

New agent-created tags must use `status: needs_review` or `status: suggested`. Agents must not mark a new tag `approved`.

Agents may use `status: approved` only when the exact slug is already present in the supplied vocabulary/context packet as an approved or active canonical concept. If the packet does not prove that the slug already exists, use `needs_review`.

Approval is vocabulary state, not model confidence. A model can be highly confident that a new concept is useful and still must mark it `needs_review`.

If the packet does not include an explicit `Relevant Vocabulary` section, agents must not use `approved` for any concept or entity.

Source metadata tags, current image labels, vision-model labels, and museum keyword lists are not proof that a concept exists canonically in Atlas.

If a visible object or figure role is obvious and independently useful, proposing it is allowed.

Examples:

```txt
bed
cat
curtain
bouquet
direct_gaze
```

These are valid new-tag candidates if no equivalent already exists.

Do not create a new tag for an attribute that belongs as a classifier.

Avoid:

```txt
black_cat
reclining_woman
left_bed
```

Prefer:

```txt
cat + color:black
female_figure + pose:reclining
bed + position:left
```

If the agent drafts a new tag because the asset needs it, it should use that tag in the batch JSON with `status: needs_review`, unless it explicitly explains why the tag was deferred.

## Entity Relevance Gate

Do not convert every named person, artwork, event, institution, or movement in source prose into an entity.

Create entity records for:

- the creator/maker
- the source or holding institution
- depicted named subjects
- named fictional or mythological characters
- rights/source entities when useful
- context entities explicitly requested by the user

Put other names in source prose into claims only when they are useful context.

Do not promote source-description context into entities just because it is named. The entity layer is for reusable identity/search anchors, not every proper noun in a museum paragraph.

Example:

```txt
Olympia source prose mentions Titian, Goya, Ingres, Claude Monet, and Zola.
Default: create Edouard Manet and Musee d'Orsay as entities.
Use Titian/Goya/Ingres as iconographic-reference claims unless the task asks for related-artist entity linking.
Use Claude Monet/Zola as acquisition/reception claims unless the task asks for provenance/reception entity linking.
```

## Text And Signature Gate

Do not tag signatures, watermarks, labels, inscriptions, or visible text unless:

- OCR/text analysis is explicitly requested
- the text is a focal subject of the image
- the inscription materially changes interpretation or identification

Do not create `text_region` merely because a signature-like mark is visible.

If OCR is not requested, visible text should usually be ignored unless the text is a focal object, a major inscription, or the user is specifically studying typography, manuscripts, labels, or marginalia.

## Background Handling

Do not create compound tags such as `dark_background` or leave background annotations without a concept.

Prefer:

```txt
concept: background
classifiers:
  visual_role: setting_context
  color: black
  value: dark
  state: shadowed
```

Use `background_detail` for specific objects in the background. Use `setting_context` for the background field or environment itself.

Use controlled classifier values for backgrounds. Prefer `color: black` with `value: dark` over prose values such as `dark brown`.

## Source Keyword Gate

Source-provided tags and keyword lists are suggestions, not assignments.

Include a source keyword as an Atlas concept only when at least one of these is true:

- it is visibly present
- it names the creator, work, depicted subject, source, institution, rights status, medium, movement, or period
- it is clearly useful for retrieval in this specific asset
- the user explicitly asked to preserve it as a searchable concept

Otherwise, preserve source keyword data as a source claim or ignore it for the Atlas batch.

Example:

```txt
Source keywords include knights and flags.
Image contains no clear knight or flag.
Do not create concepts: knights, flags.
```

## Abstract And Formal-Element Gate

If an image is abstract, semi-abstract, or visually ambiguous, describe the visible formal elements before trying to identify literal subjects.

Formal elements include:

- color
- value
- line
- shape
- contour
- texture
- pattern
- scale
- direction
- composition
- layering
- visual rhythm

Do not invent recognizable objects to make an abstract image easier to tag.

Prefer:

```txt
abstract_art
biomorphic_abstraction
curvilinear_shapes
ribbon_like_forms
overlapping_forms
background + color:black + value:dark + texture:scratched
```

Avoid:

```txt
shield
helmet
lion
crest
heraldic_supporter
```

unless those things are clearly visible or source-confirmed as metadata/context.

Titles and source keywords can justify metadata tags, but they do not automatically justify visual tags.

Example:

```txt
Title: Heraldry
Visible image: abstract biomorphic forms on a dark textured background
Use: heraldry as metadata/title-theme; abstract_art and formal-shape tags as observed visual tags.
Do not use: shield, crest, helmet, lion, banner, flag unless they are actually visible.
```

When in doubt, use a broad formal concept with classifiers instead of a speculative entity.

## Annotation Quality Gate

Every annotation must have:

- a readable label
- at least one concept
- a `visual_role` classifier
- any relevant position, pose, state, color, material, action, or view classifiers

If the visible thing cannot be identified specifically, use a broader concept with a note.

Prefer:

```txt
label: winged creature
concepts: mythological_creature
classifiers:
  visual_role: focal_point
  position: right
```

Avoid:

```txt
label: dark background
concepts: []
classifiers:
  color: dark brown
```

Broad parent tags should normally be implications, not manually added.

Avoid:

```txt
cat + animal
oil_painting + painting
```

Prefer:

```txt
cat
oil_painting
```

Then propose implications separately:

```txt
cat -> animal
oil_painting -> painting
```

Implications remain suggestions unless the task explicitly asks the agent to draft implication changes.

## Required Draft Format

Agents must write wiki drafts as Markdown with YAML frontmatter.

The frontmatter must contain machine-readable relationships and policy fields. The Markdown body must contain concise usage guidance.

Required frontmatter fields:

- `slug`
- `label`
- `kind`
- `category` or `entity_type`
- `display_group`
- `status`
- `maturity`
- `aliases`
- `broader`
- `narrower`
- `related`
- `confusable`
- `automatic_implications`
- `suggested_implications`
- `allowed_classifiers`
- `example_assets`
- `counterexample_assets`
- `ai_auto_apply_allowed`
- `confirmation_required`
- `citations`

Required Markdown headings:

- `Definition`
- `Use When`
- `Do Not Use When`
- `Common Mistakes`
- `AI Tagging Guidance`

Agent writing rules:

- Use one claim per bullet.
- Use canonical slugs in backticks when referring to tags or entities.
- Do not invent prose-only relationships. Put relationships in frontmatter.
- Do not bury AI permissions in prose only. Use explicit frontmatter policy fields.
- If a field is unknown, use an empty array or `false`, not a vague sentence.

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

In agent output, `approved` is valid only for exact pre-existing canonical vocabulary supplied in the context packet.

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
