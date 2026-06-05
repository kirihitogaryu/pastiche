# Contribution Guidelines

## Purpose

These rules define how humans and AI agents add or change Atlas vocabulary.

Atlas should allow vocabulary growth without allowing vocabulary pollution.

## Metadata Kinds

Choose the correct kind before creating anything.

- `visual_tag`: visible content, composition, style, mood, reference use, or visual analysis
- `entity`: artist, maker, work, character, IP/franchise, place, institution, source, mythological figure
- `claim`: source-backed fact about one asset
- `classifier`: controlled attribute on an entity, visual tag, annotation, or visible instance
- `computed`: machine-derived metadata
- `prompted`: AI-generation prompt metadata
- `system`: review state, workflow state, or asset utility marker

Do not create a normal visual tag when an entity, claim, classifier, or system marker is the correct model.

## Creation Gate

A new tag or entity may exist as `draft` when it has:

- canonical slug
- label
- kind
- category
- short definition
- reason for creation
- nearest existing tags or entities considered
- evidence default
- at least one source or example asset

Anything below this bar should remain an unstructured note or suggestion.

## Approval Gate

A tag or entity becomes `usable` only when it has:

- use guidance
- do-not-use guidance
- aliases
- blocked or deprecated alternatives, if relevant
- broader and narrower concepts
- related and confusable concepts
- implication review
- classifier guidance, if relevant
- AI tagging rule
- at least one example
- counterexample logic when the boundary is not obvious
- citations for historical, technical, interpretive, or extraordinary claims

`reviewed` means the page has strong examples, counterexamples, and stable relationship guidance.

## Maturity Levels

- `stub`: minimal page; useful for search, not governance
- `draft`: allowed to exist; AI may suggest but should not auto-apply
- `usable`: sufficient for normal human tagging
- `reviewed`: strong guidance; AI may follow page rules
- `locked`: stable core concept; changes should be deliberate

## Search Before Creating

Before creating a concept, check:

1. exact canonical slug
2. aliases
3. deprecated and merged tags
4. blocked tags
5. fuzzy spelling variants
6. broader and narrower concepts
7. related and confusable concepts
8. classifier alternatives
9. entity or claim alternatives

## Creation Burden

Creation burden depends on risk.

- `low`: obvious visible object or subject, such as `bow`
- `medium`: common but boundary-sensitive concept, such as `cloak`
- `high`: specialist, historical, symbolic, or technical concept, such as `mannerist_engraving`
- `expert`: requires source confirmation or domain expertise
- `blocked_without_review`: risky, sensitive, or too ambiguous for automatic creation

## Edits That Need Review

Require review for:

- automatic implications
- canonical slug changes
- merge or deprecation decisions
- artist attribution guidance
- IP/franchise and character disambiguation
- source-claim rules
- high-burden historical or technical tags
- AI auto-apply permission

## Personal Organization

Personal folders, boards, pools, and collections do not need to become canonical tags.

If a concept is personal, funny, curatorial, or vibe-based, prefer a pool or collection instead of a canonical tag.
