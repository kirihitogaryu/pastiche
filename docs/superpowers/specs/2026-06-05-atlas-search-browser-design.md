# Atlas Search Browser Design

## Status

Draft for user review.

This document defines the full-screen Atlas search and browse surface inspired by Danbooru-style precision, adapted for Pastiche.

## Purpose

Atlas search is for deliberately finding images by tags, entities, claims, classifiers, prompt metadata, relationships, and computed metadata.

It should support:

- visual tag browsing
- artist/entity searches
- classifier queries
- prompt-token searches
- review states
- related tags and wiki previews
- a future batch review mode

## Concept-Adaptive Search

The search surface must adapt to what the user is searching.

Examples:

- `horse` opens a visual tag lens.
- `Picasso` opens an artist/entity lens.
- `shirt.color:blue` opens a classifier query lens.
- `prompt:feral` opens a prompt metadata lens.
- `needs:review` opens a review lens.

The same search shell can handle all of these, but the preview panel and facets should change by concept type.

## Top Area

Top command surface:

- Atlas search input
- filter button
- add/import button where relevant
- local tabs under the search input

Tabs should be concept-aware.

Visual tag example:

- Info
- Images
- Classifiers
- Related Tags
- Confusables
- Tag Wiki

Artist entity example:

- Info
- Artworks
- Artists Like
- Movements
- Themes
- Techniques
- Tags
- Sources

## Retractable Wiki Preview

The info panel under search is retractable.

For visual tags, show:

- definition
- status
- implications
- allowed classifiers
- related tags
- confusables
- AI guidance

For artist entities, show:

- brief context
- example works
- movements
- common themes
- related artists
- attribution guidance

The preview is a quick explanation layer. The full wiki remains the documentation source.

## Left Facet Rail

The left facet rail changes by query type.

Visual tag searches:

- broader tags
- child/specialist tags
- related objects
- actions/poses
- confusable tags
- classifiers

Artist searches:

- style and movement
- themes
- time period
- technique and medium
- composition/form
- artists like this artist

Prompt searches:

- generator
- model
- prompt token roles
- style reference tokens
- negative prompt tokens
- seed/settings

Labels should be precise. Do not call artist facets `similar tags`; use concept-appropriate language such as facets, context, related artists, or metadata.

## Results Grid

Image cards should show:

- thumbnail
- title
- creator/source/year if available
- tag status summary
- compact tags or shared-match highlights
- review status when relevant

Grid cards may use small chips because they are previews. Full editing happens on the asset page.

## Search Syntax Direction

Future syntax:

```txt
tag:horse
artist:pablo_picasso
work:guernica
shirt.color:blue
prompt:feral
prompt_artist:nightcrow
negative_prompt:human
model:novelai
seed:201933412
needs:review
has:ai_metadata
same_work:asset_123
```

Simple search should remain forgiving, but result explanations should disclose what matched:

- visual tag
- prompt token
- source claim
- title text
- wiki alias
- classifier

## First Implementation Scope

Included:

- top-level Atlas search route shell
- concept-adaptive mock/seeded states for `horse` and `Picasso`
- result cards using existing asset data where possible
- wiki preview component structure

Deferred:

- full parser
- ranking
- batch edit
- vector similarity
- live wiki-backed facets
- prompt metadata search until parser/index exists
