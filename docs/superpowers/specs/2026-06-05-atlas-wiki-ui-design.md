# Atlas Wiki UI Design

## Status

Draft for user review.

This document defines the full Atlas wiki interface for tag, entity, classifier, and contribution documentation.

## Purpose

The wiki is the source of truth for Atlas vocabulary. It exists for humans and AI agents.

It should answer:

- what a concept means
- when to use it
- when not to use it
- what it implies
- what classifiers it allows
- what it is related to or confused with
- whether AI can apply it automatically
- what examples and counterexamples prove the rule

## Two-Column Layout

The wiki uses two columns:

- left column: pinned navigation and search
- right column: selected entry

The left column is not the ontology truth. It is a browse index. The right entry is the canonical truth.

## Left Column

Top links:

- Contribution Guidelines
- Tagging Rules
- Classifier Style Guide
- Agent Rules

Pinned search:

- always visible while scrolling
- searches wiki titles, aliases, categories, group labels, and entry text
- reserves `Ctrl+K` / `Cmd+K` style focus behavior for implementation
- avoids forcing users to use browser find

Expandable tag groups:

- Objects
- Composition
- Subjects
- Animals
- Clothing
- Architecture
- Color / Light / Value
- Style / Movement
- Medium / Technique
- Theme / Mood
- Reference Use
- Artists
- Works
- Characters / IP
- Institutions
- Sources
- Rights

Groups should be arranged by usefulness and broadness, not strict ontology. Keep nesting shallow, ideally two to three levels.

## Multi-Parent Concepts

Tags are graph concepts, not folders.

Use primary home plus cross-listed paths:

```txt
Animals
  Mammals
    horse
```

The `horse` page can also list:

- broader: animal, mammal, equine, domesticated animal
- narrower: pony, foal, draft_horse
- related: saddle, bridle, rider
- confusable: donkey, mule, zebra

If `horse` appears under another useful browse group, it should open the same canonical page. The sidebar is navigation; the entry is truth.

## Right Entry

Visual tag entries include:

- title
- aliases
- short definition
- long description
- examples and counterexamples
- automatic implications
- related tags
- confusable tags
- broader concepts
- narrower/specific tags
- allowed classifiers
- tagging guidance
- AI tagging guidance
- metadata: creator, review status, usage count, last reviewed

Entity entries adapt to entity type.

Artist entity entries include:

- canonical name and aliases
- brief biography/context
- external IDs
- notable/example works
- movements
- themes
- techniques
- related/similar artists
- attribution guidance
- source confirmation guidance

Character/IP entries include:

- canonical name and aliases
- parent IP/franchise
- source confirmation requirements
- visual descriptors when useful
- related characters
- source-context guidance for fanart, cosplay, studies, and imported metadata

Classifier entries include:

- allowed values
- allowed target tags/entities
- examples
- invalid compound-tag alternatives
- value normalization rules

## Color And Hierarchy

The wiki can be more editorial than the workbench, but it still belongs to product UI.

Use:

- Crimson Text for major article headings
- Montserrat for navigation, metadata, controls, and lists
- warm accent sparingly for active item, text links, and current breadcrumb
- neutral section headings for most blocks

Avoid making every heading gold.

## First Implementation Scope

Included:

- top-level wiki route
- two-column shell
- pinned search field
- expandable group navigation
- seeded `dutch_angle` visual tag entry
- seeded `horse` visual tag entry
- seeded `pablo_picasso` artist entity entry

Deferred:

- editing wiki pages
- history/diff
- markdown/rich text authoring
- full search index
- custom user wiki export/import
