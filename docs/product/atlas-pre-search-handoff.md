# Atlas Pre-Search Handoff

Date: June 25, 2026

This handoff summarizes the Atlas work completed before starting the Atlas Search browser.

The next major task is to build the Atlas Search UI and query behavior from the existing mockups, using the metadata/wiki/editing foundation described here.

## Product Shape

Atlas is Pastiche's deep metadata and tag-wiki layer.

It coexists with Library:

- Library remains the simple archive/folder/moodboard surface.
- Atlas is the deliberate research/indexing surface for tags, wiki entries, annotations, visual roles, source claims, examples, relationships, and future search.

Atlas should feel like a better, cleaner, local-first Danbooru/Wikipedia hybrid:

- tags are first-class concepts, not loose strings
- tags should have wiki guidance
- entities and source metadata are searchable but distinct from visual tags
- annotations carry classifiers such as `visual_role`, `position`, `pose`, `state`, `color`, `value`, and `texture`
- background/context objects should not become strong search examples by accident
- AI agents may help, but Pastiche validates and governs the vocabulary

## Implemented In This Milestone

### Atlas Wiki

The Atlas Wiki now has a serious two-column documentation/wiki layout:

- left documentation/index navigation
- searchable browse index
- right article reader
- article anatomy modeled on the Dutch Angle mockup
- documentation links wired into the wiki docs
- review queue for tags that lack wiki entries or need approval
- missing wiki references shown as missing/red states
- new tag draft flow
- editable wiki fields
- searchable relationship/reference editing for related, broader, confusable, implication, alias, and classifier fields
- example cards that can point to Atlas inspect assets

Key files:

- `src/lib/components/atlas/AtlasWiki.svelte`
- `src/lib/components/atlas/AtlasWikiReferenceEditor.svelte`
- `src/lib/server/atlas/wiki.ts`
- `src/lib/server/atlas/wikiSeed.ts`
- `src/lib/server/atlas/wikiDocs.ts`
- `src/lib/server/atlas/review.ts`
- `src/routes/api/atlas/wiki/+server.ts`
- `src/routes/api/atlas/wiki/[slug]/+server.ts`
- `src/routes/api/atlas/wiki/review/+server.ts`
- `src/routes/api/atlas/wiki/[slug]/example-candidates/+server.ts`

### Atlas Inspect

Atlas inspect now has the beginnings of the full-screen inspection/editing mode:

- metadata rail
- collapsible metadata rail
- inline image stage using the best available image source
- pan and zoom behavior
- description section
- AI generation metadata section
- similar images strip
- top-bar Atlas Wiki action
- context export menu for AI agents
- edit mode
- staged edit session
- `Done editing` commits queued changes
- `Cancel edits` discards queued changes

Important behavior:

- In edit mode, child controls stage metadata changes.
- `Done editing` sends the staged batch to the Atlas patch route.
- `Cancel edits` clears the staged batch.
- Staged edits do not yet live-preview in the metadata rail before commit.

Key files:

- `src/lib/components/atlas/AtlasAssetInspect.svelte`
- `src/lib/components/atlas/AtlasMetadataPanel.svelte`
- `src/lib/components/atlas/AtlasImageStage.svelte`
- `src/lib/components/atlas/AtlasBatchEditor.svelte`
- `src/lib/components/atlas/AtlasDescriptionSection.svelte`
- `src/lib/components/atlas/AtlasSimilarImages.svelte`
- `src/lib/components/atlas/AtlasEditableRow.svelte`
- `src/lib/atlas/editSession.ts`
- `src/lib/atlas/editSession.spec.ts`

### Atlas Mutation Layer

Atlas mutation logic now lives server-side instead of in Svelte components.

Implemented routes/services include:

- patching asset identity, entities, claims, asset concepts, annotations, and classifiers
- strict batch JSON parsing/normalization
- concept autocomplete
- alias resolution for concept entry
- review-queue deletion for unused/stub concepts
- similar-assets endpoint
- asset context packet export
- vocabulary export

Key files:

- `src/lib/atlas/batch.ts`
- `src/lib/server/atlas/mutate.ts`
- `src/lib/server/atlas/export.ts`
- `src/routes/api/library/assets/[id]/atlas/+server.ts`
- `src/routes/api/atlas/concepts/+server.ts`
- `src/routes/api/atlas/assets/[id]/similar/+server.ts`
- `src/routes/api/atlas/assets/[id]/context-packet/+server.ts`
- `src/routes/api/atlas/export/vocabulary/+server.ts`

### Batch Editor

The Atlas batch editor accepts strict JSON only.

It exists so external AI agents can hand Pastiche structured metadata without direct database access.

It supports:

- identity updates
- asset concepts
- entities
- claims
- annotations
- annotation classifiers
- removing asset concepts
- removing annotation concepts

Guide:

- `docs/atlas/wiki/batch-editor-guide.md`

Important rule:

- AI agents must not create or approve canonical tags silently.
- User-created tags may be rough/stubbed.
- Agent-created new tags should be `needs_review` or `suggested` unless the provided vocabulary packet proves the exact concept already exists.

### AI Agent Harness

There is now a local NanoGPT harness for testing external models against Atlas packets.

It does not apply changes automatically.

It can:

- list models
- run asset-tagging jobs
- run vocabulary audits
- run wiki-draft jobs
- export raw responses
- extract JSON when possible
- track token estimates/reported usage
- refuse paid/subscription models by default
- use model tiers instead of random model choice

Key files:

- `scripts/atlas-agent.mjs`
- `docs/atlas/agent-harness.md`
- `package.json` script: `npm run atlas:agent`

Local setup:

```txt
NANOGPT_API_KEY=...
```

Store this in `.env.local`. Do not commit it.

## AI Agent Lessons So Far

### Olympia

The first tests showed that general chat models can produce useful structure, but they need narrow prompts and explicit rules.

Rules added/clarified:

- `approved` means existing approved vocabulary, not model confidence
- source prose should not promote every named person/artwork into an entity
- text/signature regions should not be tagged unless OCR or text analysis is requested
- background color/value belongs as classifiers on `background`
- source keywords are suggestions, not assignments
- annotations require concepts and `visual_role`

### Heraldry Failure

The first model-generated `Heraldry` pass was bad.

The model appeared to tag what it expected from the title/source keywords instead of what was visible:

- invented `shield`
- invented `helmet`
- invented `lion`
- invented `crest`
- invented `heraldic_supporter`
- invented literal heraldic composition

The local `.pastiche/workspace.sqlite` asset was corrected manually.

The corrected read treats the work as abstract/formal:

- `abstract_art`
- `biomorphic_abstraction`
- `abstract_shapes`
- `biomorphic_forms`
- `curvilinear_shapes`
- `ribbon_like_forms`
- `overlapping_forms`
- `central_composition`
- `high_contrast`
- `monochrome`
- `oil_painting`
- `modern_art`
- `surrealism`
- `heraldry` as metadata/title-theme, not as literal visible heraldic objects

Corrected annotations:

- `central biomorphic mass`
  - concepts: `abstract_shapes`, `biomorphic_forms`
  - classifiers: `visual_role:focal_point`, `position:center`, `shape:organic`, `value:light`, `scale:large`
- `sweeping ribbon form`
  - concepts: `curvilinear_shapes`, `ribbon_like_forms`
  - classifiers: `visual_role:focal_point`, `position:center`, `direction:diagonal`, `shape:broad_curve`, `value:light`
- `dark textured background`
  - concepts: `background`
  - classifiers: `visual_role:setting_context`, `color:black`, `value:dark`, `texture:scratched`
- `striped vertical form`
  - concepts: `abstract_shapes`
  - classifiers: `visual_role:supporting_subject`, `position:right_center`, `pattern:striped`, `shape:vertical_bar`
- `repeated oval chain`
  - concepts: `abstract_shapes`, `curvilinear_shapes`
  - classifiers: `visual_role:supporting_subject`, `position:lower_center`, `pattern:repeated_ovals`, `shape:chain_like`
- `curling upper forms`
  - concepts: `biomorphic_forms`, `curvilinear_shapes`
  - classifiers: `visual_role:supporting_subject`, `position:upper_half`, `shape:curling`

Important persistence note:

- The Heraldry correction above was applied to the local `.pastiche/workspace.sqlite`.
- `.pastiche/` is ignored by Git, so this asset-level data is local runtime data, not committed source.
- The lesson was added to `docs/atlas/wiki/ai-agent-tagging-rules.md` under the abstract/formal-element gate.

## Wiki/Vocabulary Seeds

The wiki seed now includes a starter set of Apollo/Python and formal vocabulary, artist/entity tags, visual-role governance, aliases, and basic relationships.

The Apollo/Python exercise remains useful because it stresses:

- same named subject across different works
- different visual forms for Python
- metadata vs observed subject matter
- background details
- named mythological characters
- medium/style differences
- annotations and visual roles

Relevant docs:

- `docs/atlas/wiki/apollo-killing-python-seed-tag-plan.md`
- `docs/atlas/wiki/ai-agent-tagging-rules.md`
- `docs/atlas/wiki/tagging-rules.md`
- `docs/atlas/wiki/implication-rules.md`
- `docs/atlas/wiki/wiki-entry-templates.md`

## Known Issues / Watch List

- Atlas UI still needs visual polish against the HTML mockups.
- Search is intentionally not implemented yet.
- Staged edit mode does not yet live-preview queued edits.
- Some new formal wiki entries were created in local runtime data during Heraldry correction; seed/source coverage should be reviewed later if those concepts should ship by default.
- The image-stage and inspect layout are better but still need comparison against the Guernica inspect mockup.
- The review queue is useful, but bulk cleanup and stronger empty-stub tooling will probably be needed.
- The batch editor should eventually show canonicalization and queued edits more clearly.
- The user-facing AI harness is still terminal-only; future app integration should come after the search/edit foundations are stable.
- External AI output should never be applied blindly. Always inspect, repair, and validate the JSON first.

## Next: Atlas Search

Start the next chat by reviewing these mockups/specs:

- `docs/design/mockups/atlas/atlas-search-browser-picasso-horse-v2.html`
- `docs/superpowers/specs/2026-06-05-atlas-search-browser-design.md`
- `docs/superpowers/specs/2026-06-05-atlas-ui-mode-design.md`
- `docs/superpowers/specs/2026-06-05-atlas-metadata-wiki-design.md`

The search UI should not be a generic Library grid.

It should support two major search modes:

1. Entity/artist/source style pages, like Picasso
2. Visual tag/concept pages, like horse

Search should make the difference visible:

- artist/entity pages show works, movements, related artists, themes, sources, and entity-specific wiki guidance
- visual tag pages show broader/narrower tags, classifiers, related objects, confusables, AI guidance, and tagged assets
- tag groups should use visual differentiation similar to Danbooru, but cleaner and less loud
- direct slug/label matches must rank above related/confusable matches
- aliases should resolve cleanly
- missing wiki entries should show as missing/red, not block normal user actions
- visual_role should affect result strength and example eligibility

Suggested implementation order:

1. Implement a real Atlas query parser/service for local assets.
2. Add ranked concept search:
   - exact slug/label
   - aliases
   - prefix/fuzzy
   - related/confusable only as lower-weight suggestions
3. Add asset result scoring:
   - focal annotation matches highest
   - supporting subject next
   - asset-level concepts next
   - background_detail and setting_context lower
   - source metadata separate from observed visual matches
4. Build the Atlas Search Browser page from the HTML mockup.
5. Wire search bar submit/enter to the Atlas browser rather than doing nothing.
6. Add result explanations:
   - observed tag match
   - annotation classifier match
   - source/entity/claim match
   - alias resolution
7. Add tests for ranking and visual_role weighting.

## Verification From This Milestone

The following passed during the final work:

```bash
PATH=/usr/bin:$PATH npm run test:unit -- --run 'src/routes/api/library/assets/[id]/atlas/server.spec.ts' src/routes/api/atlas/wiki/server.spec.ts src/lib/atlas/editSession.spec.ts
PATH=/usr/bin:$PATH npm run check
git diff --check
```

Run these again before starting search if the dev server or generated types look stale.

