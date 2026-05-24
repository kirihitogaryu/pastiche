# Current Shell Status

Date: 2026-05-24

## Purpose

This document captures the current Pastiche app shell before the project moves from mock data into real ingestion, Explore APIs, and browser-extension capture.

The shell is now useful enough to act as the working frame for the next phase. It is still mostly static UI, but the core information architecture and responsive behavior are in place.

## Implemented Shell Features

### App Shell

- Top-level modes exist: Home, Library, Explore, Canvas, Colors, and Resources.
- Desktop uses a left rail, top command bar, central workspace, and optional right-side inspector.
- Phone uses a bottom navigation bar with Library, Explore, Add, Canvas, and Resources.
- Add opens a responsive Add to Library surface.
- Filter opens a mobile bottom drawer or desktop right panel.
- Top-bar command surfaces use Phosphor icons and the current design tokens.
- Motion has been added for drawer/panel entry, card menus, hover/focus feedback, and touch navigation states.

### Home

- Home renders a studio hub with quick actions, pinned projects, a continue block, and a needs-attention block.
- Mobile quick actions are a stable two-column grid.
- Home is currently static and does not yet route quick actions into real workflows.

### Library

- Library now opens to an organization overview instead of dumping directly into the asset grid.
- Library Overview includes:
  - title and archive stats
  - library search
  - section chips
  - View Full Library row
  - horizontally draggable pinned project cards
  - top-level folder list
  - smart folder list
- View Full Library opens a global saved-asset grid.
- Folder Contents opens a folder page with:
  - breadcrumb above the folder title on mobile and desktop
  - folder title and stats
  - search and sort row
  - direct subfolder cards
  - asset grid
- Folders default to direct contents. They do not recursively show every descendant asset by default.
- Desktop Library asset clicks open the right-side Inspector.
- Phone Library asset clicks open the separate mobile Inspect screen.
- Active Library bottom-nav taps return to Library Overview.
- Library card action buttons open a small visible action menu.
- Horizontal carousel scrollbars are hidden and project cards can be dragged horizontally on touch or pointer devices.

### Explore

- Explore still renders the masonry result grid and desktop Inspector from the earlier shell.
- Explore has search, sort, add, filter, view toggle, and mock source/result content.
- Explore is still backed entirely by mock assets.
- Explore add/save controls are only shell affordances right now.

### Inspector

- Desktop Inspector shows selected image metadata, source, dimensions, description, tags, palette, notes, and action buttons.
- Phone Inspect is a separate screen with back navigation, primary action buttons, metadata, tags, palette, and secondary actions.
- The unnecessary `1 / 1` image counter was removed from phone Inspect.

### Filters

- Mobile filter drawer exists as a static UI.
- Desktop filter panel exists as a static UI.
- Filter UI includes sort, tag search, source, artist/creator, color, medium, and match controls.
- Filter active states use a neutral light-grey treatment, not the stronger warm accent.
- Filter controls are not connected to real query state yet.

### Responsive And Interaction Behavior

- Desktop Library, folder pages, and Library Overview have working vertical scrolling.
- Mobile pages scroll through the main workspace with bottom-nav padding.
- Horizontal UI strips hide ugly default scrollbars where drag or swipe is the intended interaction.
- Asset cards preserve approximate artwork dimensions within clamps.
- Star/action controls are smaller, hover/focus revealed, and accessible through visible menus.
- The shell uses Crimson Text for headings and wordmark, Montserrat for UI/body text, and Phosphor icons.

## Static Or Nonresponsive Shell Areas

### Empty Workspace Modes

The following modes are placeholders:

- Canvas
- Colors
- Resources

They only render a placeholder panel and have no real feature surface yet.

### Nonfunctional Or Partially Functional UI

- Home quick actions do not perform imports, project creation, or canvas creation.
- Library section chips are visual only.
- Library search is not wired to real indexed results.
- Folder creation is visual only.
- Smart folders do not run real saved queries.
- Project cards do not open real project workspaces.
- Project pin and overflow actions are visual only.
- Asset action menus display choices but do not persist changes.
- Favorites, tags, move, add to canvas, and delete are not persisted.
- Filter drawer and panel controls do not alter result queries.
- Sort controls do not alter result order.
- View toggles do not switch between grid/list layouts yet.
- Add to Library drawer is static and does not import files, folders, URLs, clipboard contents, or gallery images.
- Desktop and mobile Inspect actions are static.
- Explore results are mock assets, not API data.
- No backend, database, local archive folder, thumbnail pipeline, or real file storage is connected yet.

## Data And Architecture To Pull Together Before Continuing

### Asset Contract

Before wiring APIs or extension capture, define the saved asset model that every ingestion path will create.

Required fields for the first real contract:

- stable asset id
- original source URL, if available
- page URL or collection URL, if available
- local original file path or storage key
- thumbnail path or generated thumbnail URL
- title
- creator or artist
- year or date label
- medium
- source name
- source type
- license or rights summary
- width and height
- dominant palette placeholder
- tags
- folder assignment
- project links
- notes
- favorite state
- created, imported, and modified timestamps

This contract should be shared by Explore saves, manual imports, and browser-extension captures.

### Storage And Backend Decision

Pull together the first backend/storage decision before feature work continues:

- local-first SvelteKit server API shape
- SQLite schema draft
- archive folder layout
- originals directory
- thumbnails directory
- palette cache directory
- import staging directory
- backup/export expectations

The current recommendation remains one local/server backend owning writes to SQLite and the filesystem.

### First Explore Source

Pick one real Explore source for the first integration. The first source should be stable, publicly accessible, and easy to test.

Good candidates:

- The Met Collection API
- Art Institute of Chicago API
- Wikimedia Commons API

Pull together:

- API documentation links
- sample search response
- sample detail response
- image URL rules
- license/rights fields
- pagination behavior
- rate limits
- CORS behavior
- attribution requirements

### Browser Extension Capture

Before building the capture extension, pull together:

- target browser for the first version
- Manifest V3 baseline
- extension permission list
- content script vs background/service worker responsibilities
- context-menu capture flow
- image blob capture fallback behavior
- API endpoint shape for saving a capture
- authentication or local-token story, if needed
- behavior when the Pastiche server is offline

### Test Content

Before judging visual quality with real data, collect a small reference set:

- 20 to 50 public-domain artworks with varied aspect ratios
- several web images with incomplete metadata
- a few local uploads
- a few duplicate or near-duplicate images
- at least one very tall image and one very wide image
- at least one image with no creator, no date, and no source URL

This set should be used for Explore, Library, Inspector, and later color/canvas work.

## Recommended Next Phase

1. Commit this shell baseline.
2. Write the asset contract and SQLite schema plan.
3. Implement one real Explore source end to end.
4. Save one Explore result into Library using the same asset contract.
5. Build the extension capture path against that same contract.
6. Only then begin canvas and color tools, since they depend on stable image records, dimensions, thumbnails, and asset ids.

