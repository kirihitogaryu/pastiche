# Atlas Search UI Design

## Status

Draft for implementation planning.

This document captures the UI direction for the Atlas Search Browser after reviewing the Picasso/horse mockup, current Atlas Wiki and Inspect surfaces, and the search mechanics design.

It should be read with:

- `docs/superpowers/specs/2026-06-05-atlas-search-browser-design.md`
- `docs/superpowers/specs/2026-06-05-atlas-ui-mode-design.md`
- `docs/superpowers/specs/2026-06-25-atlas-search-mechanics-design.md`

## Product Stance

Atlas Search is the deliberate research/indexing surface. It should feel like a better local-first Danbooru/Wikipedia hybrid, but visually it should remain Pastiche: quiet, archival, image-first, and studio-minded.

The mockup's strongest ideas are:

- entity and visual-tag searches feel different
- the wiki/context banner makes tag guidance immediately useful
- the left sidebar maps useful relationships
- visual tags expose classifiers
- artist/entity searches expose movements, themes, related artists, sources, and works

The mockup's weakest traits are:

- too many borders and chips
- too much equal-weight information
- too much gold emphasis
- result cards that look like mini tagging panels
- a generic mock rail that does not match current Pastiche

The implementation should borrow the intelligence, not the visual busyness.

## Layout

Desktop Atlas Search uses:

- existing Pastiche app rail
- top command/search surface
- retractable left search/context sidebar
- main result area
- optional retractable wiki/context banner
- image result grid

The current Pastiche rail wins over the mockup rail.

The search page should use current design tokens:

- `--color-bg`
- `--color-surface`
- `--color-surface-raised`
- `--color-border`
- `--color-border-soft`
- `--color-text`
- `--color-muted`
- `--color-dim`
- `--color-accent`
- `--font-heading`
- `--font-ui`

Use Phosphor icons, consistent with the rest of Pastiche.

## Top Command Area

The search input is the primary command.

It should support:

- plain typing
- autocomplete
- canonical query pills
- accepted corrections
- copyable canonical text
- syntax/help popover

The top row should not give equal weight to filter buttons, add buttons, state switchers, and query chips. Query meaning belongs in the search input and its pill row.

The UI should not preserve the mockup's `Artist: Picasso` / `Subject: horse` state buttons. Those were useful demo toggles, not product controls.

Suggested top controls:

- search input
- syntax help icon
- clear query icon
- minimal role control
- result density/page-size control
- sort control

An add/import action can exist when relevant, but it should not compete with search.

## Search Input And Pills

The search input should display canonical clauses as pills once resolved.

Examples:

```txt
horse
exclude:tree
shirt.color:blue
ball_python.morph:enchi+albino
```

Pills should be editable. They should not become decorative tags. Their job is to show query structure.

Pill tone should communicate kind quietly:

- visual concept
- entity
- classifier
- exclusion
- role/evidence
- unresolved or warning

Do not make every pill highly colored. Use category color on text and small accents, not large backgrounds.

## Syntax Help

Add a small help affordance near the search input.

It should explain only the essentials:

```txt
horse saddle        both terms
exclude:tree        remove a concept
shirt.color:blue    classifier
enchi,albino        either value
enchi+albino        combined values
role:focal          main subject
```

The help should be concise and dismissible. It should not be a modal by default.

## Wiki / Context Banner

The large wiki/context banner is for single-concept searches only.

Show it for:

```txt
horse
Picasso
shirt.color:blue
```

Hide it by default for:

```txt
horse saddle
shirt.color:blue exclude:tree
Picasso war
ball_python.morph:enchi+albino exclude:spider
```

Multi-clause search should show a compact query explanation row instead:

```txt
3 clauses · observed matches prioritized · background roles excluded
```

Each pill can still open a small popover or side detail for wiki context.

The banner must be retractable. Its open/closed state should persist during the session.

Placeholder/example imagery in the banner should use the first approved wiki example asset when available. If no example exists, show a quiet missing-example state, not decorative stock-like imagery.

## Single-Concept Banner Content

Visual tag banner:

- label and kind
- status/maturity
- short definition
- implications
- allowed classifiers
- related tags
- confusables
- AI guidance
- link to full wiki

Artist/entity banner:

- label and entity kind
- life/context summary if available
- popular works in the library
- movements/themes
- attribution guidance
- related artists/entities
- link to full wiki

Use fewer internal vertical dividers than the mockup. Let spacing, headings, and muted labels do more of the work.

## Left Sidebar

The left sidebar is a retractable concept map and query facet panel.

It should be one of Atlas Search's signature features: a useful map of nearby tags, classifiers, themes, entities, and refinements.

It should not be a generic Library filter list.

The sidebar has two modes:

### Concept Map Mode

Used for a single dominant concept.

For visual concepts like `horse`, show:

- broader tags
- child/specialist tags
- related objects
- actions/poses
- allowed classifiers
- confusables
- see also

For artist/entity concepts like `Picasso`, show:

- style and movement
- themes
- time period
- technique and medium
- composition/form
- related artists
- works, sources, and see also

### Query Facet Mode

Used for multi-clause searches.

The sidebar should generate useful refinements from the current result set. Wiki relationships can guide ranking, but the sidebar should reflect the intersection of the query, not just one tag's wiki page.

Examples:

- `horse saddle` may surface tack, rider, galloping, side view, equestrian portrait
- `Picasso war` may surface Guernica, monochrome, suffering, 1930s, anti-war
- `ball_python.morph:enchi+albino` may surface compatible or excludable morphs

For very narrow result sets, show nearby expansions instead of only refinements.

## Sidebar Item Actions

Sidebar items should not have one hard-coded action by group name.

Each item has an inferred intent:

- refine
- navigate
- specialize
- context
- ambiguous

Primary click uses the inferred action when confidence is high.

Every item should expose a shared action menu:

- Search this tag/entity
- Add to query
- Exclude from query
- Open wiki

If intent confidence is low, open the action menu instead of guessing.

Examples:

- `horse.coat_color:bay`: add/refine current query
- `pony`: navigate to specialist tag by default, with add/exclude in menu
- `saddle`: add to current `horse` query by default
- `Georges Braque` under Picasso: navigate to artist by default
- `War` under Picasso themes: add to current query by default
- `Guernica` under Picasso see also: navigate to work by default

## Classifier UI

Classifier sections are strongest on visual tag pages.

For `horse`, classifier groups such as `coat_color`, `markings`, `gait`, `pose`, `view`, `tack`, `position`, and `quantity` should feel like practical query refinements.

Clicking `bay` under `coat_color` should add:

```txt
horse.coat_color:bay
```

Classifier rows should be clear and compact. They can be more table-like than pill-heavy because counts matter.

For artist/entity pages, do not force classifier-like UI unless the entity actually has entity-relevant classifier dimensions. Picasso should show movements, periods, themes, media, works, source/attribution context, and related entities instead.

## Result Cards

Search result cards should be calmer than the mockup.

Default card content:

- image thumbnail
- title
- creator/source/year if available
- medium/source line if useful
- one compact match explanation

Do not show dense tag piles by default.

Avoid using `Tagged`, `Untagged`, or large tag counts as default browsing metadata. Those belong in review or mass-tagging modes.

Good card explanations:

```txt
Matched horse as focal annotation
Matched shirt.color:blue
Matched Picasso as source artist
Alias: equine -> horse
Excluded background roles
```

Expanded overlays can show more:

- all match explanations
- visual role
- evidence type
- source/claim match
- related classifiers

## Result Toolbar

The result toolbar should be compact.

Show:

- result count
- sort
- role setting
- page size or infinite scroll setting
- view mode if needed

Avoid persistent overlay controls unless overlays exist and are useful.

Recommended role control:

```txt
Role: Any | Main subject | Exclude background
```

This can compile to query role clauses.

Pagination default should be stable, probably 50 results. Infinite scroll can be a setting.

## Tag Color Grammar

Pastiche should borrow the useful part of Danbooru tag colors, not the loudness.

Use color mostly on text:

- visual/general tags
- classifier values
- artist/entity references
- work/IP references
- theme/mood references
- source/claim references
- review/warning states

Avoid large colored backgrounds. Avoid making every tag equally loud.

Gold accent is reserved for:

- active concept
- selected tab/control
- primary action
- review/warning emphasis when no more specific semantic color exists

## Tabs And Navigation

Do not use a broad `Search | Wiki` tab pair as the main page model.

Search and Wiki are Atlas destinations. The search page can show wiki context, but the full wiki remains a separate Atlas surface.

Concept pages may use local tabs or section controls later, such as:

- Images
- Classifiers
- Related
- Guidance
- Wiki

But the first implementation should avoid unnecessary tab chrome. A retractable banner plus `Open full wiki` is enough.

## Empty, Missing, And Ambiguous States

Missing wiki entries should not block search.

Show:

- missing/red concept state
- option to draft wiki entry
- normal search results when assets exist

Unresolved query tokens should produce suggestions:

```txt
No exact tag found for blue_shirt.
Use shirt.color:blue
Search literal text
Draft blue_shirt tag
```

Drafting a compound tag should be discouraged if classifier alternatives exist.

No-result states should suggest:

- remove one clause
- include supporting/background roles
- search related broader concepts
- search source metadata instead of observed visual tags

## Responsive Behavior

Desktop:

- full search shell
- retractable sidebar
- retractable banner
- grid results

Tablet landscape:

- similar to desktop with narrower sidebar

iPad portrait:

- sidebar becomes drawer
- query pills remain reachable
- result grid stays primary
- banner starts collapsed

Phone:

- simplified read/search mode
- sidebar becomes a filter/refine sheet
- heavy Atlas editing remains deferred

Core search should not rely on hover. Sidebar item menus must be reachable by keyboard and touch.

## Accessibility

Requirements:

- search input has visible focus and keyboard autocomplete
- pills are keyboard reachable and removable
- sidebar sections use proper disclosure semantics
- item action menus are keyboard and touch accessible
- status is text plus color, never color alone
- role filters and result counts are announced clearly
- reduced motion is respected

## First Implementation Scope

Included:

- Atlas Search shell using current Pastiche rail/tokens
- search input with canonical query text and basic pills
- single-concept wiki/context banner
- compact multi-clause query explanation row
- retractable sidebar
- concept map mode for single concepts
- query facet mode scaffolding for multi-clause search
- classifier UI for visual concepts
- calm result cards with identity metadata and one match explanation
- role, sort, and page-size controls

Deferred:

- fully polished mobile search
- dense review/mass-tagging overlays
- saved searches
- advanced visual overlays
- full prompt metadata UI
- agent-facing search UI

## Visual Quality Bar

Before shipping:

- compare against Atlas Wiki and Atlas Inspect surfaces
- reduce borders until panels feel structured but not boxed-in
- remove tag piles from default cards
- verify result cards scan as images first
- verify category colors help recognition without dominating
- verify single-concept and multi-clause searches feel intentionally different
- test with `horse`, `Picasso`, `shirt.color:blue`, `horse saddle`, and `ball_python.morph:enchi+albino exclude:spider`
