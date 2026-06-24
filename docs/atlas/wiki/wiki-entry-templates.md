# Wiki Entry Templates

## Purpose

Use these templates when creating new Atlas wiki pages.

Templates are checklists. Keep final pages concise.

## Canonical Markdown Shape

Every editable wiki page should use YAML frontmatter followed by Markdown sections.

```md
---
slug: serpent
label: serpent
kind: visual_tag
category: animal
display_group: Animals
status: needs_review
maturity: draft
aliases: []
broader: [animal]
narrower: []
related: [dragon, lizard, python_(mythology)]
confusable: [dragon, lizard]
automatic_implications: []
suggested_implications: []
allowed_classifiers: [pose, state, view, position, scale, visual_role]
example_assets: []
counterexample_assets: []
ai_auto_apply_allowed: true
confirmation_required: false
citations: []
---

# serpent

## Definition

Use when a snake-like creature is visibly depicted.

## Use When

- A snake or serpent-like creature is visible.

## Do Not Use When

- The image only names a mythological serpent but does not depict one.
- The creature is better identified as `dragon`, `lizard`, or `python_(mythology)`.

## Common Mistakes

- Do not use `python_(mythology)` unless source metadata, title text, inscription, or iconography identifies Python.

## AI Tagging Guidance

AI may auto-apply `serpent` when a snake-like creature is clearly visible. AI may not identify the creature as `python_(mythology)` without source or iconographic support.
```

## Visual Tag Template

```txt
slug:
label:
kind: visual_tag
category:
display_group:
maturity: stub | draft | usable | reviewed | locked
evidence_default:
creation_burden:

definition:
use_when:
do_not_use_when:
aliases:
blocked_or_deprecated_alternatives:
broader:
narrower:
related:
confusable:
automatic_implications:
suggested_implications:
allowed_classifiers:
examples:
counterexamples:
ai_auto_apply:
ai_review_rule:
citations:
```

## Artist Entity Template

```txt
slug:
label:
kind: entity
entity_type: artist
maturity:

definition:
aliases:
life_dates:
place_context:
roles:
period_context:
common_media:
common_subjects:
common_themes:
related_artists:
related_movements:
attribution_guidance:
do_not_use_when:
external_ids:
example_works:
ai_auto_apply:
ai_review_rule:
citations:
```

## Character or Mythological Entity Template

```txt
slug:
label:
kind: entity
entity_type: character | mythological_figure | mythological_creature
maturity:

definition:
aliases:
tradition_or_parent_ip:
source_confirmation_rule:
visual_indicators:
use_when:
do_not_use_when:
broader:
narrower:
related:
confusable:
suggested_visual_tags:
example_assets:
ai_auto_apply:
ai_review_rule:
citations:
```

## Series / IP / Copyrighted World Template

```txt
slug:
label:
kind: entity
entity_type: series | ip | franchise | copyrighted_world
maturity:

definition:
aliases:
creator_or_rightsholder:
source_medium:
use_when:
do_not_use_when:
characters:
works:
related_series:
visual_style_guidance:
fanart_or_adaptation_guidance:
external_ids:
ai_auto_apply:
ai_review_rule:
citations:
```

## Work or Narrative Subject Template

```txt
slug:
label:
kind: entity
entity_type: work | narrative_subject | iconographic_subject
maturity:

definition:
aliases:
creator_or_origin:
source_context:
use_when:
do_not_use_when:
depicted_entities:
common_visual_elements:
related_works:
related_narratives:
example_assets:
ai_auto_apply:
ai_review_rule:
citations:
```

## Classifier Template

```txt
slug:
label:
kind: classifier
maturity:

definition:
allowed_targets:
allowed_values:
value_normalization:
use_when:
do_not_use_when:
invalid_compound_tag_alternatives:
examples:
counterexamples:
ai_auto_apply:
citations:
```

## System or Meta Tag Template

```txt
slug:
label:
kind: system
category:
maturity:

definition:
use_when:
do_not_use_when:
workflow_effect:
who_can_apply:
auto_apply_rule:
clearance_rule:
related_review_queues:
examples:
```

## Minimum Draft

A draft page may be shorter, but it must still include:

- slug
- label
- kind
- category or entity type
- definition
- reason for creation
- use rule
- nearest alternatives
- evidence default
- example asset
