# Mobile Interface Plan

Date: 2026-05-22

## Purpose

This plan turns the current mobile mockups into a concrete interface model for Pastiche on phone-sized screens. It extends the responsive shell spec with mobile-specific states, navigation rules, and interaction behavior.

Mobile Pastiche should feel like a fast visual browsing tool with archival intelligence underneath. It can borrow the ease of a Pinterest-like image grid, but it should not become an algorithmic feed or social app.

## Reference Mockups

- `docs/design/mockups/mobile/library-browse.png`
- `docs/design/mockups/mobile/library-select-mode.png`
- `docs/design/mockups/mobile/add-to-library-drawer.png`
- `docs/design/mockups/mobile/image-inspect.png`
- `docs/design/mockups/mobile/explore-browse.png`

## Naming Decision

The top-level discovery mode remains **Explore**.

Avoid labels such as **For You** because they imply an algorithmic social feed. Explore should feel curated, searchable, and source-aware.

## Mobile Surface Model

The mobile app has five core states:

1. Library Browse
2. Selection Mode
3. Add To Library Drawer
4. Image Inspect
5. Explore Browse

These states share:

- dark archival visual tone
- bottom mode navigation
- Phosphor iconography
- image-first browsing
- clear search and filter access
- source/path context
- reversible actions
- keyboard and screen-reader accessible equivalents where possible

## Global Mobile Navigation

Use a bottom navigation bar for primary modes:

- Library
- Explore
- Add
- Canvas
- Resources

The center Add action opens an import drawer rather than switching to a permanent mode.

The bottom nav should respect safe-area insets and remain visually secondary when another command surface is active, such as Selection Mode.

Use Phosphor icons for mobile navigation and actions. Choose the same icon family across states so Library, Explore, Add, Canvas, Resources, filters, tags, folders, palette, import, and overflow actions do not drift into a mixed-icon system.

## Library Browse

Library Browse is the default saved-image mobile surface.

Reference: `library-browse.png`

### Layout

```text
status area
wordmark and utility actions
breadcrumb/path
search bar
filter/tuning control
tag/filter chips
image masonry grid
bottom mode navigation
```

### Behavior

- The image grid is the primary surface.
- Breadcrumb/path shows location in the archive, such as `library / refs / artworks`.
- Search supports artworks, tags, creators, colors, folders, and project names.
- Tag/filter chips provide fast narrowing without opening a full filter screen.
- Tapping an image opens Image Inspect.
- Long-pressing an image enters Selection Mode.
- Favorite or quick-status controls may appear on cards when useful.

### Design Notes

Library can show richer cards than Explore because saved assets have metadata. Titles, creators, dates, favorite state, and primary tags are appropriate when card size allows.

## Selection Mode

Selection Mode is entered by long-pressing an image in Library Browse.

Reference: `library-select-mode.png`

### Layout

```text
compact top controls
breadcrumb/path
tag/filter chips
selectable image grid
floating selection action bar
bottom mode navigation
```

### Behavior

- Long-press selects the first image and enters Selection Mode.
- Tapping additional images toggles selection.
- Selected count appears in the floating action bar.
- The action bar becomes the active command surface.
- Bottom navigation remains visible but visually secondary.
- Back or Cancel exits Selection Mode and restores browse state.

### Selection Actions

Initial actions:

- Add to
- Tag
- Move
- Palette
- More

Action meanings:

- **Add to**: add selected images to a canvas, collection, project, or moodboard.
- **Tag**: apply or remove tags from selected images.
- **Move**: move selected images to another folder/project path.
- **Palette**: extract, compare, or copy palette data for selected images.
- **More**: secondary actions such as export, favorite, delete, or metadata tools.

Destructive actions should prefer undo where safe. Confirmation is reserved for irreversible or high-cost operations.

## Add To Library Drawer

The Add button opens a bottom drawer.

Reference: `add-to-library-drawer.png`

### Layout

```text
dimmed browsing surface
bottom sheet with grab handle
title and context subtitle
import source rows
cancel action
```

### Initial Import Sources

- From Gallery
- From Gallery Folder
- From URL

### Behavior

- Drawer appears over the current Library or Explore context.
- The current folder/path should define the default import destination.
- Each source row opens a focused import flow.
- Cancel closes the drawer and restores the underlying state.
- The drawer should use native-feeling sheet motion, but never block interaction longer than necessary.

### Later Import Sources

Future additions can include:

- Paste from clipboard
- Camera
- Files app
- Browser share target
- iOS Shortcut endpoint
- Bulk import queue

Keep the first drawer simple until those flows exist.

## Image Inspect

Image Inspect is the shared detail surface for images from Library and Explore.

Reference: `image-inspect.png`

### Layout

```text
back button
more/actions button
large image preview
primary action row
title and core metadata
source and description
tags
palette
details
rating
secondary actions
bottom mode navigation
```

### Behavior

- Opens as a separate screen on phone.
- Back returns to the exact previous browse state.
- Browse state includes mode, path, query, filters, selected source, scroll position, and selection context.
- The same inspect structure should work for Library and Explore images.
- Available actions change based on whether the image is already saved.

### Primary Actions

For unsaved Explore images:

- Favorite, if favorites can exist before saving
- Add to Library
- Download, if allowed by source/license
- More

For saved Library images:

- Favorite
- Add to Canvas
- Move
- Export
- More

Avoid showing both **Save** and **Add to Library** as separate primary actions unless their distinction is explicit and valuable. Prefer **Add to Library** for Explore captures.

### Content Sections

Initial sections:

- Source
- Description
- Tags
- Palette
- Details
- Rating
- Actions

The first screenful should emphasize preview, title, source, description, tags, and palette. Deeper file details can be lower on the screen or collapsed when space is tight.

### Palette Integration

The palette row is a signature Pastiche feature.

It should support:

- visible swatches
- copy palette
- open in Colors
- compare later
- palette extraction state if not yet computed

## Explore Browse

Explore is for curated and searchable discovery, not a social feed.

Reference: `explore-browse.png`

### Layout

```text
status area
wordmark
search bar
filter/tuning control
source/category chips
result count and sort
image masonry grid
quick add buttons
bottom mode navigation
```

### Behavior

- Search supports artworks, collections, artists, styles, sources, and tags.
- Chips should use labels like Curated, Trending, New, Photography, Illustration, Painting, Architecture, or source names.
- Do not use For You.
- Result count and sorting are visible when useful.
- Tapping an image opens Image Inspect.
- Tapping the quick add button saves or stages the image for Library import.
- Source and license constraints should influence whether Download or Add actions are enabled.

### Library Difference

Explore can use a tighter, more image-forward grid than Library.

Library is metadata-aware. Explore is scan-and-capture oriented.

## Search, Filters, And Breadcrumbs

Mobile browsing should make location and search easy to understand.

Rules:

- Breadcrumb/path appears above search when the user is browsing inside Library.
- Explore may omit breadcrumb when global search is the primary context.
- Search fields should use visible labels or accessible names, not placeholder-only meaning.
- Filter controls should be consistent across Library and Explore.
- Chips represent active scopes or quick refinements.

## State Preservation

Preserve mobile browsing state aggressively.

State includes:

- mode
- path or source
- query
- filters
- selected chips
- sort
- scroll position
- selected assets
- add drawer context
- previous inspect origin

This is required for phone because inspection is a separate screen.

## Accessibility And Input

Mobile design must support:

- touch targets of at least 44 by 44 px for primary actions
- visible focus states for hardware keyboard navigation
- accessible names for icon buttons
- reduced-motion behavior for drawers and screen transitions
- non-color selection indicators
- non-gesture alternatives for long-press selection
- semantic headings for inspect sections
- bottom sheet focus management

Long-press is acceptable as a shortcut, but there must also be an accessible way to enter Selection Mode through menus or keyboard commands.

## Motion

Use motion to explain state:

- Add drawer rises from the bottom.
- Inspect pushes onto the stack.
- Back reverses the inspect transition.
- Selection action bar enters from the bottom and becomes the active command surface.

Keep transitions short and direct. Avoid decorative choreography.

## Open Questions

- Should mobile Library default to two-column metadata cards or a tighter masonry grid at smaller widths?
- Should Explore quick add immediately save, or stage items in an import queue?
- Can favorites exist for unsaved Explore images?
- Does Add to mean add to Library, Canvas, Collection, or all of these depending on context?
- Which actions belong in More for Selection Mode?
- How should source licensing appear on Explore and Inspect?

## Implementation Notes

When this becomes code, build the mobile shell as stateful navigation rather than separate disconnected pages.

Important states:

- `browse`
- `selecting`
- `adding`
- `inspecting`
- `exploring`

Important UI primitives:

- bottom navigation
- bottom sheet
- action bar
- Phosphor icon button
- image masonry grid
- image card
- tag chip
- breadcrumb/path bar
- search/filter header
- inspect section
- palette swatch row

## Success Criteria

- Library browsing is fast and image-first.
- Explore feels curated and searchable, not algorithmic.
- Selection Mode supports batch management without losing place.
- Add drawer gives obvious import paths without becoming a full screen.
- Image Inspect is shared across Library and Explore.
- Back from Inspect restores prior browse state exactly.
- Mobile navigation remains usable with touch, keyboard, and assistive tech.
