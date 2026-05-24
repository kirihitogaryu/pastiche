# Tablet And Desktop Interface Plan

Date: 2026-05-22

## Purpose

This plan captures the iPad landscape, desktop, and non-mobile interface direction for Pastiche. It complements the mobile interface plan by defining how Explore, Library, Inspector, focused preview, folder navigation, and Add to Library behave when there is enough screen width for rails, sidebars, and persistent panels.

The overall rule is: **Explore and Library share the same app shell, but differ in information density and navigation emphasis.**

## Reference Mockups

- `docs/design/mockups/tablet-desktop/explore-portrait.png`
- `docs/design/mockups/tablet-desktop/explore-landscape-inspector.png`
- `docs/design/mockups/tablet-desktop/focused-art-preview-overlay.png`
- `docs/design/mockups/tablet-desktop/library-full-sidebar-folder-view.png`
- `docs/design/mockups/tablet-desktop/add-to-library-popover.png`

## Shared Non-Mobile Shell

The non-mobile shell uses:

- left icon rail for primary app modes
- optional expanded sidebar for Library organization
- top bar with wordmark, mode selector, search, filter, sort, view controls, and Add
- main visual browsing workspace
- right Inspector when an image is selected
- Phosphor icons throughout

The shell should preserve the quiet, archival studio tone while allowing higher density than phone.

## Explore

Explore is source/search oriented.

Reference: `explore-landscape-inspector.png`

### Layout

```text
left mode rail
top search and controls
source row
category/style chips
image grid
right Inspector when selected
```

### Behavior

- Explore uses source controls such as The Met, MoMA, Wikimedia, Europeana, and Artvee.
- Category chips narrow by medium or reference type, such as Painting, Drawing, Print, Photography, Digital Art, Sculpture, and Architecture.
- Quick Add buttons appear on result cards.
- Selecting an image opens the shared Inspector on the right.
- Search, source, category, sort, and view state should be preserved when moving into Inspect or focused preview.

### Density

Explore can use a tighter, more image-forward grid than Library. The user is scanning external or curated sources and deciding what is worth saving.

### Portrait iPad

Reference: `explore-portrait.png`

iPad portrait Explore can keep the same mood and major controls, but it does not need to be the primary optimized surface. If space is constrained, it should borrow behavior from the mobile plan: search-first, image-first, with drawers for secondary controls.

## Library

Library is archive/folder oriented.

Reference: `library-full-sidebar-folder-view.png`

Desktop Library should converge with the same information architecture as mobile: Overview, Full Library, Folder Contents, Smart Folders, Tags, and Projects. The desktop sidebar becomes an accelerator for these destinations, not the only way to understand the archive.

### Layout

```text
left mode rail
expanded Library sidebar
breadcrumb path
search
filter/sort/view controls
image grid
right Inspector
selection action bar when selecting
```

### Sidebar Content

The expanded Library sidebar should support:

- All Images
- Favorites
- Recent
- Trash
- folder tree
- smart folders
- storage/archive status
- collapse control

Folder counts are useful because this is an archive tool. The folder tree can be denser on desktop than on touch-first layouts.

### Sidebar Behavior

Desktop:

- full sidebar can remain persistent
- folder tree supports expansion, collapse, and quick switching
- collapsed rail remains available for focused browsing

iPad landscape:

- rail can be default
- expanded Library sidebar can appear as a drawer or pinned panel when space allows
- folder switching should remain fast, but not at the expense of the image grid

iPad portrait:

- use breadcrumb and folder drawer rather than a full persistent tree

Phone:

- no full tree; use breadcrumb, search, chips, and drawers

## Inspector

The Inspector is shared across Library and Explore.

On non-mobile layouts, it can be persistent on the right. It should include:

- selected image preview
- title and creator/source metadata
- source link
- date, medium, dimensions, added date
- description
- tags
- palette
- notes
- action buttons

Actions differ by asset state:

- Explore unsaved asset: Add to Library, Add to Canvas if allowed, Open in Colors, Copy Palette, Open Source, Share.
- Library saved asset: Add to Canvas, Open in Colors, Copy Palette, Move, Open Source, Delete.

Avoid separate **Save** and **Add to Library** actions unless their difference is explicit.

## Focused Art Preview

Reference: `focused-art-preview-overlay.png`

The focused art preview is not a generic modal. It is a visual inspection overlay for viewing artwork at a larger size while preserving context behind it.

### Behavior

- Opens from image preview or selected card.
- Keeps the underlying grid and Inspector dimly visible behind the overlay.
- Supports close, favorite, previous, next, palette visibility, and copy palette.
- Should support Escape to close and arrow keys for previous/next.
- Focus is trapped while the overlay is open.
- Reduced-motion mode should skip or simplify overlay transitions.

### Purpose

Use focused preview when the user wants to visually inspect the image itself, not edit metadata. Metadata editing stays in Inspector.

## Add To Library On Non-Mobile

Reference: `add-to-library-popover.png`

On desktop and iPad landscape, Add should live near view/sort controls and open a popover or drawer anchored near the Add button.

Initial Add sources:

- From Gallery
- From Folder
- From URL
- Paste from Clipboard

Phone keeps the central bottom Add button and bottom drawer from the mobile plan.

## Selection Mode

Non-mobile Selection Mode uses a floating action bar over the grid.

Initial actions:

- Add to
- Tag
- Move
- Favorite
- Palette
- More
- Delete, when appropriate

Selection should not hide the Inspector. The selected image or most recently selected image can remain visible in the Inspector while the selection count is shown in the action bar.

## Home Rail Entry

The left rail should include Home as a primary entry. Home leads to the workspace hub described in `docs/product/information-architecture-home-hub.md`.

Home is not a marketing page. It is the user's studio hub for pinned Projects, recent work, imports, canvases, and archive orientation.

## Success Criteria

- Explore feels source-aware and scan-focused.
- Library feels archive-aware and folder-capable.
- Desktop supports a full Library folder sidebar.
- iPad landscape supports fast browsing without forcing the full sidebar.
- The Inspector remains shared across Library and Explore.
- Focused preview supports visual inspection without losing context.
- Add to Library has a clear non-mobile placement near view/sort controls.
- Phosphor icons remain the planned icon system.
