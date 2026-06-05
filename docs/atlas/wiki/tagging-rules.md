# Tagging Rules

## Purpose

These rules define what to tag, what not to tag, and how deep to go.

The default goal is useful retrieval, not exhaustive description.

## Evidence Types

Every assignment needs an evidence basis.

- `observed`: visible in the image
- `metadata`: source-backed or user-entered factual claim
- `prompted`: present in AI generation metadata
- `inferred`: likely but not certain
- `interpretive`: theme, mood, symbolism, or art-historical reading
- `computed`: derived by machine analysis

Do not treat these as equivalent.

## Tagging Priority

### Level 0: Identity and Source

Record stable asset identity first.

Examples:

- artist or maker
- after-artist or source artist
- title
- work/entity subject
- institution
- source URL
- date
- medium
- rights
- dimensions

These are usually claims or entities, not visual tags.

### Level 1: Primary Visible Content

Tag the main visible subjects and objects.

Examples:

- `male_figure`
- `serpent`
- `bow`
- `arrow`
- `landscape`
- `inscription`

### Level 2: Actions, Poses, and Composition

Tag what makes the image useful as reference.

Examples:

- `drawing_bow`
- `shooting_arrow`
- `diagonal_composition`
- `wide_composition`

Use classifiers for pose, state, view, and position on a visible entity or annotation.

Examples:

```txt
apollo_(deity) + pose:standing
python_(mythology) + pose:reclining
python_(mythology) + state:wounded
serpent + position:right
```

Create a pose or state as a visual tag only when it is an independently useful scene-level concept and cannot be expressed clearly as an entity classifier.

### Level 3: Medium, Technique, Style, and Context

Add specialist and source-backed concepts.

Examples:

- `engraving`
- `old_master_print`
- `classical_mythology`
- `greek_mythology`
- `mannerism`

These often require source confirmation or review.

### Level 4: Annotation-Level Detail

Add region-specific details when they matter.

Examples:

- Latin inscription text
- object regions
- creature head and body
- arrow impacts
- background city
- OCR candidates

## Tags vs. Entities vs. Claims

Use a visual tag for visible content:

```txt
serpent
bow
arrow
```

Use an entity for a named thing:

```txt
apollo_(deity)
python_(mythology)
hendrick_goltzius
```

Use a claim for a source-backed fact about one asset:

```txt
artist = Hendrik Goltzius (after)
date = 1589
medium = engraving
```

## Tags vs. Classifiers

Do not create compound attribute tags when a classifier is better.

Prefer:

```txt
bow + position:left
serpent + position:right
inscription + language:latin
python_(mythology) + state:wounded
```

Avoid:

```txt
left_bow
right_serpent
latin_inscription
```

Exceptions are allowed only when the phrase has independent conventional meaning.

## Theme and Mood

Theme and mood tags are allowed.

They are usually `interpretive` evidence and need tighter review than visible-object tags.

Valid examples:

- `divine_retribution`
- `mythological_scene`
- `violence`
- `heroic_mood`
- `ominous`

Invalid examples:

- `nice`
- `bad`
- `cool`
- `weird_vibes`

Use pools or collections for personal, funny, or highly subjective groupings.

## Quality and System Tags

Quality and system tags describe asset utility or review state.

Examples:

- `ocr_needed`
- `source_conflict`
- `duplicate_candidate`
- `low_resolution_reference`
- `annotation_needed`
- `misleading_thumbnail`

These are not ordinary visual tags.

## Do Not Tag

Do not tag:

- subjective quality judgments with no workflow value
- speculative identity as fact
- exact historical or technical claims without source support
- every tiny background detail in light tagging
- prompt tokens as observed visual tags
- attributes that should be classifiers

## Depth Profiles

Use the minimum depth that serves the workflow.

- `light`: identity, source, primary visible subjects
- `reference`: useful objects, poses, composition, medium, style, source facts
- `specialist`: iconography, technique, inscriptions, narrative subject, exact relationships
- `exhaustive`: annotations, OCR, region classifiers, audit details
