# Atlas Asset Inspect Workbench Design

## Status

Draft for user review.

This document defines the full-screen Atlas page for one asset. It is the in-depth metadata authoring and review surface, not a replacement for the lightweight Library inspector.

## Purpose

The Atlas asset inspect page answers:

- What is this image?
- What source claims do we have?
- What is visibly present?
- Which tags are approved, suggested, or disputed?
- Which classifiers and annotations apply to visible entities?
- What AI generation metadata exists?
- What images are related or similar?
- What needs review?

## Layout

Desktop layout:

- top bar: back to results, title, position in result set, navigation arrows, primary actions
- left panel: organized metadata and editable tag lists
- main panel: large image preview and image tools
- below image: AI generation metadata dropdown, then similar/related images

The main image should remain visually dominant. Metadata is dense, but it should not make the page feel like a spreadsheet wrapped around a thumbnail.

## Left Metadata Panel

The left panel uses list rows, not tag pills.

Top groups:

- Identity
- Canonical Visual Tags
- Suggested Tags Needing Review
- Source Entities and Claims
- Classifiers by Visible Entity
- Annotations / Regions
- Relationships
- Similar By
- Audit Trail

Tag and entity labels should use category-colored text in this full-screen view. The color should identify the metadata group, similar to Danbooru's artist/copyright/character/general/meta distinction, but adapted to Atlas categories.

Initial color roles:

- artist/entity
- work/IP/character
- visual tag
- classifier
- source/rights/system metadata
- prompt-derived candidate
- warning/review

The color is a scanning aid. It should not replace text labels, group headings, or status copy.

Canonical visual tags should be grouped by display group:

```txt
Canonical Visual Tags
  Composition
    wide_composition          approved   user
    crowded_composition       approved   agent reviewed
  Subjects
    horse                     approved   observed
    fallen_soldier            suggested  prompted/agent
```

Rows reserve fields for:

- tag/entity label
- status
- evidence
- source
- confidence
- quick actions
- warning markers

## Tag Interaction

Selecting or focusing a tag row should show a compact wiki popover or side hint with:

- short definition
- category
- implications
- allowed classifiers
- confusable tags
- `View full tag wiki`

Typing or adding tags should normalize:

- `horses` resolves to `horse`
- known aliases resolve to canonical tags
- deprecated tags show replacement guidance
- compound attribute tags suggest classifier alternatives

## Image Tools

Initial image tools:

- zoom in/out
- fit
- actual size
- fullscreen/focused preview
- annotation overlay toggle
- disabled palette/color overlay control that points to the future color analysis layer

Annotation editing can come later, but the image region should reserve room for overlays and region selection.

## AI Generation Metadata Placement

If present, AI generation metadata appears under the image and above related/similar images.

Collapsed summary:

- generator/source
- model
- seed
- sampler
- prompt token count

Expanded tabs or sections:

- Summary
- Prompt Tokens
- Positive Prompt
- Negative Prompt
- Character Prompts
- Raw Payload

Prompt tokens should be list rows, not pills.

Full prompts should open inline in the AI metadata section, not navigate to a separate page. Use an expandable scrollable text box with copy controls. A modal is acceptable for raw JSON or very large payloads, but the default interaction should keep the user on the inspect page.

## Related And Similar Images

Below the image:

- similar images based on tag overlap
- same work or variant relationships
- detail crops
- higher/lower resolution versions
- reference-used-for relationships

Cards can show a small image, title, source, and a few shared tags. They should stay subordinate to the inspected asset.

## Audit Trail And Edit History

Atlas should eventually expose a Danbooru-like edit history for each asset.

The audit trail should show:

- version or event number
- actor
- timestamp
- changed fields
- tags/entities/claims before and after
- undo or revert affordances when safe
- source of change, such as user, import, agent, parser, or migration

The first implementation can show a collapsed audit section with imported/created metadata only. A full history table is useful but not required for the first UI slice.

## Library Inspector Projection

The ordinary Library inspector should show only a calm slice of Atlas metadata:

- identity/source facts
- approved visual tags
- collapsed suggestions count
- AI metadata available indicator

Deep editing belongs in Atlas.

## First Implementation Scope

Included:

- route shell for asset inspect
- read-only identity/source claim display
- read-only Atlas entity and claim groups
- suggested visual tags as rows
- deep link from Library inspector
- AI generation metadata section that shows an empty state until parser support lands

Deferred:

- annotation editing
- full tag add/edit controls
- batch operations
- visual diff of source-vs-user claims
- ranked similar images beyond simple shared-tag or seeded data
