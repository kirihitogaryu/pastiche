# Atlas Top-Level Mode UI Design

## Status

Draft for user review.

This document defines Atlas as a first-class application mode in Pastiche. It coordinates the full-screen Atlas surfaces: asset inspect, search, wiki, review queues, and future annotation/tag management.

## Product Position

Atlas is the deliberate metadata workbench. Library remains the casual archive surface; Atlas is where the user opens the hood and edits meaning.

The distinction:

- Library: browse, organize, save, and lightly inspect images.
- Atlas: describe, govern, annotate, review, relate, and document images.
- Wiki: define the controlled vocabulary that humans and AI agents use.

Atlas should feel dense and powerful, but not like a public imageboard or generic admin dashboard. The visual tone remains archival, quiet, and studio-minded.

## Top-Level Navigation

Atlas should become a top-level mode in the app shell immediately.

Initial Atlas sections:

- Asset Inspect
- Search
- Wiki
- Review

Only Asset Inspect and Wiki need to become useful first. Search and Review can start as limited shells if needed, but the navigation should establish the long-term product shape.

## Entry Points

Users should reach Atlas from:

- main app rail Atlas icon
- `Open in Atlas` from Library inspector
- `View full tag wiki` from tag previews
- `Open tag in Atlas` from wiki pages
- search result cards
- review queues

Deep links should preserve context where possible. Opening an asset from search should keep enough state for `Back to results`.

## Shared Atlas Layout

Desktop Atlas pages use:

- existing app rail at far left
- mode-local top command area when useful
- full-height workspace
- dense but restrained panels
- stable right or left detail regions depending on page type

The product should avoid nested card stacks. Use panels, dividers, list rows, and table-like metadata blocks instead.

## Visual Hierarchy Rules

Atlas should reduce the amount of gold used in the mockups.

Use the warm accent for:

- current mode or selected tab
- primary actions
- active search concept
- warnings or review states when no semantic warning color exists
- important text links

Do not use the accent for every section heading. Most headings should be muted neutral text with hierarchy from spacing, weight, indentation, and border rhythm.

Atlas should support category-colored tag text in dense metadata contexts. This borrows the useful part of Danbooru's tag lists: color communicates what kind of metadata a row is before the user reads it.

Use category color for tag/entity text, not for large backgrounds:

- artist/entity references
- work/IP/character references
- visual/general tags
- metadata/system tags
- prompt-derived tags
- review or warning states

Less important metadata should receive less visual emphasis through muted color, smaller secondary text, or lower row priority. Avoid making every tag equally loud.

## Metadata Display Grammar

Pills are for previews and summaries. Rows are for governance.

Use pills for:

- Library inspector summaries
- compact search result cards
- wiki preview chips
- small read-only glimpses

Use rows or table-like lists for:

- full-screen Atlas asset inspect
- tag review queues
- prompt token review
- aliases, implications, and classifier management
- source claims with provenance

Rows can still be compact and text-heavy. The goal is fast scanning, not decorative table chrome.

## Reading Mode And Editing Mode

Atlas pages should distinguish reading from editing.

Reading mode:

- clean grouped metadata
- minimal controls
- optimized for understanding and navigation
- no unnecessary buttons per row

Editing/review mode:

- row controls
- status, source, evidence, confidence, and notes
- accept/reject/merge/deprecate actions
- inline conflict and duplicate warnings

The first implementation can ship mostly reading mode, but layouts should not block later row-level editing.

## Responsive Direction

Desktop and tablet landscape get the full Atlas workbench.

iPad portrait can keep the same conceptual surfaces but stack or collapse panels:

- left rail remains available
- search or navigation panels become drawers
- asset image remains prominent
- editing controls avoid hover-only behavior

Phone should not attempt to expose the full Atlas workbench at first. Phone can deep-link to simplified read-only Atlas summaries and wiki entries, with heavy editing deferred.

## Accessibility

Atlas is a keyboard-heavy surface. Requirements:

- visible focus states for all rows, links, and controls
- landmarks for navigation, main content, and supplementary panels
- tabs use proper tab semantics when they switch local page sections
- row actions are reachable without hover
- status is represented by text and icon, not color alone
- full prompt/raw metadata blocks support copy actions

## Implementation Sequence

1. Add Atlas as a top-level mode and route shell.
2. Add deep-link plumbing from Library inspector to Atlas asset inspect.
3. Build the first asset inspect read view.
4. Build wiki shell and one seeded concept entry.
5. Add AI generation metadata readout under the asset image.
6. Add search/browser shell once real concept data is available.
7. Add review queues after suggestions and prompt-derived candidates are visible.

## Open Design Principles

The Atlas UI should make correctness ergonomic:

- aliases resolve while typing
- compound tag mistakes suggest classifier alternatives
- source metadata stays separate from visual tags
- prompted metadata stays separate from observed metadata
- risky implications appear as reviewable suggestions before approval
- new canonical tags require draft wiki documentation
