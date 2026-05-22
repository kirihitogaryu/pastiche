# Pastiche Responsive Shell Design

Date: 2026-05-22

## Purpose

This spec defines the first responsive app shell model for Pastiche before application scaffolding begins. It turns the current desktop HTML mockup and product handoff brief into durable layout rules for desktop, iPad, and phone.

The shell should support the same product model across devices: Library, Explore, Canvas, Colors, Resources, search, folder/project navigation, image browsing, and Inspector. Placement changes by viewport, but the workflow concepts stay recognizable.

## Design Register

Pastiche is a product UI. Design serves the creative reference workflow.

The guiding personality is elegant, archival, studio-minded, and artistic. The shell should feel like a serious creative studio tool: quiet, dense when useful, and built for long sessions of browsing, sorting, and thinking.

The physical scene for this surface is: an artist browsing references on an iPad or desktop in a studio or evening workspace, moving between folders, saved images, and color information while staying in a focused creative flow.

## Core Shell Model

Use a hybrid of the current desktop mockup and a workspace-first touch model.

The shared shell includes:

- top navigation area
- breadcrumb or file/project path
- search and filter controls
- collapsible primary navigation
- main workspace
- Inspector
- contextual bulk actions

Desktop can show more of this at once. iPad and phone keep the same concepts but move navigation and inspection into rails, drawers, or screens.

## Primary Modes

The shell supports five top-level modes:

- Library
- Explore
- Canvas
- Colors
- Resources

Modes should remain stable across viewport sizes. The location of mode controls can change, but the user should not feel that different devices expose different products.

## Navigation Rules

### Collapsible Navigation

The sidebar should be retractable across modes.

Expanded state:

- shows mode labels
- can show folder tree, smart folders, tags, and saved views when relevant
- works best on desktop and large landscape screens

Collapsed rail state:

- shows recognizable icons for modes
- keeps navigation available without stealing workspace width
- can be the default on iPad portrait and narrower layouts
- should be keyboard reachable and screen-reader labeled

The collapsed rail is not only a mobile fallback. It should be available on desktop too, because users may want a more focused workspace.

### Breadcrumb And Search

Browsing surfaces should use a breadcrumb or path bar above search and filters.

The breadcrumb answers: where am I?

Examples:

```text
Library / Projects / Figure Drawing / Hands
Explore / The Met / Search results
Resources / Anatomy / 3D
```

The search bar answers: what am I looking for here?

Search and filters should stay easy to reach in Library and Explore. On phone, the top browsing stack should usually be:

```text
breadcrumb/path
search and filter controls
pinterest-style image grid
bottom mode navigation
```

Folder logic can evolve later, but the shell should reserve room for path, folder, and project navigation from the beginning.

## Viewport Behavior

### Wide Desktop

Desktop keeps the strong archive-tool shape from the current mockup.

```text
topbar
sidebar or rail | main workspace | inspector
```

Behavior:

- sidebar can be expanded or collapsed to rail
- Inspector can remain persistent
- Library can use a dense masonry grid
- folder tree and saved views can stay visible
- keyboard navigation and shortcuts should be first-class
- bulk selection can use a floating or bottom contextual bar

Desktop should feel powerful, not precious. Density is allowed because the user is managing many references.

### iPad Landscape

iPad landscape should prioritize the workspace but can keep compact navigation visible.

```text
topbar
rail or compact sidebar | main workspace
right-entry inspector drawer when selected
```

Behavior:

- collapsed rail is likely the default
- expanded sidebar can appear as a drawer
- Inspector enters from the right
- opening Inspector compresses the grid/workspace when there is room
- controls must not depend on hover
- tap targets should be comfortable for touch

### iPad Portrait

iPad portrait is the baseline touch browsing model.

Most use here is selecting images as references, scrolling through saved material, searching, and inspecting.

```text
topbar or compact header
breadcrumb/path
search and filters
rail | image browsing workspace
right-entry inspector drawer when selected
```

Behavior:

- image browsing remains the primary surface
- search must be easy to access near the top
- breadcrumb/path stays above search/filter controls
- selecting an image opens the Inspector from the right
- Inspector squeezes the image grid left instead of replacing it when available width allows
- the grid should remain scrollable and understandable while Inspector is open
- collapsed rail stays available for mode switching

This layout should not feel like a squeezed desktop layout. It is a first-class reference browsing surface.

### Phone

Phone has the strongest divergence.

Phone uses a simplified Pinterest-like browsing view for both discovery and folder browsing.

Browse state:

```text
breadcrumb/path
search and filters
two-column or adaptive masonry grid
bottom mode navigation
```

Inspect state:

```text
back button
image title/actions
selected image
Inspector sections
bottom mode navigation or contextual action bar
```

Behavior:

- tapping an image pushes a separate inspect screen
- inspect screen has a clear back button
- back restores the exact prior browse state
- restored state includes mode, folder/path, search query, filters, scroll position, and selection context
- sidebars are replaced by drawers or separate screens
- bottom navigation exposes primary modes
- filters and folder/project navigation can use drawers

Phone should feel closer to a mobile visual browsing app than a desktop file manager.

## Inspector Behavior

The Inspector is a formal product surface, not just a detail panel.

Initial sections:

- Info
- Tags
- Color
- Related
- Use

Desktop:

- persistent right panel is allowed
- can be toggled closed
- can support denser editing

iPad:

- right-entry drawer
- compresses the browsing grid/workspace where possible
- can become a sheet if width is constrained

Phone:

- separate inspect screen
- back restores previous browse state
- sections can use stacked accordions or tabs

Inspector content should remain conceptually consistent across devices even when layout changes.

## Main Workspace Behavior

The main workspace changes by mode.

Library:

- image grid or list
- folder/project browsing
- search, tags, filters, ratings, favorites
- Inspector selection flow

Explore:

- similar visual browsing pattern to Library
- source-aware results
- save-to-library actions
- can reuse the phone Pinterest-like grid

Canvas:

- can diverge more strongly later
- likely needs a focused canvas workspace
- should still retain mode navigation and Inspector concepts where useful

Colors:

- can diverge into a tool workbench
- should support contextual entry from image Inspector
- standalone Colors mode can use panels suited to palette generation and comparison

Resources:

- searchable catalog
- can use list, category, or compact card layouts
- does not need the same masonry emphasis as Library and Explore

Mode-specific divergence is allowed when the task demands it, but shared navigation, search conventions, shell tokens, and accessibility rules should stay consistent.

## State Preservation

The shell must preserve browsing state across inspection and navigation.

State to preserve:

- current mode
- folder/project path
- search query
- active filters
- sort order
- grid density
- scroll position
- selected image or selection set

This is especially important on phone, where inspect opens as a separate screen.

## Accessibility Requirements

The shell should target WCAG AA where practical without forcing an extremely high-contrast visual style.

Baseline requirements:

- keyboard navigation from the beginning
- visible focus states
- predictable tab order
- non-pointer access to primary actions
- labeled icon buttons
- reduced-motion support
- touch targets sized for iPad and phone
- color states backed by text, icons, or shape
- no core workflow depending only on hover, right-click, or a three-panel desktop layout

## Motion Rules

Motion should communicate state, not decorate the app.

Use short transitions for:

- sidebar expansion and collapse
- Inspector entry and exit
- selection state
- sheet or drawer movement
- mode changes where continuity helps orientation

Avoid:

- page-load choreography
- bounce or elastic effects
- animations that delay browsing
- layout animations that make dense grids feel unstable

## Open Questions

Folder and project navigation needs a dedicated follow-up spec.

Questions to answer later:

- How do folders, projects, smart folders, and tags relate?
- Does breadcrumb navigation represent filesystem folders, virtual collections, or both?
- How should folder drawers behave on phone?
- How much of the Library folder tree should appear in the collapsed rail?
- Which mode owns global search versus mode-scoped search?

These questions should not block the basic shell. The shell only needs to reserve clear places for breadcrumb, search, filters, and folder/project navigation.

## Success Criteria

- Desktop preserves the strong archive-tool feeling of the existing mockup.
- iPad portrait is treated as a first-class browsing surface.
- The sidebar can collapse to a rail across modes.
- Search and breadcrumb navigation stay prominent for browsing.
- iPad selection opens a right-entry Inspector that compresses the grid where possible.
- Phone uses a bottom-nav, Pinterest-like browsing flow and a separate inspect screen.
- Back from phone inspect restores the exact previous browsing state.
- Core workflows do not depend on hover, right-click, or desktop-only layout.
- Keyboard navigation is part of the shell from the start.
