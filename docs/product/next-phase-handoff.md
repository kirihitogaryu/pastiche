# Next Phase Handoff

Date: 2026-05-24

## Current State

The current shell baseline is committed as:

```text
d827697 Build responsive library shell baseline
```

Branch:

```text
codex/project-organization
```

The branch is currently ahead of `origin/codex/project-organization`. Push when the next session is ready to preserve the latest handoff/doc changes remotely.

## Product Direction

Pastiche is moving from a responsive mock shell into the first real product layer: image ingestion, real Explore sources, local Library persistence, and browser-extension capture.

The app should stay oriented around this core loop:

```text
discover or capture -> save -> enrich metadata -> analyze color -> reuse in canvas or project
```

The next phase should not start with Canvas or Color tools. Those depend on stable image records, dimensions, local thumbnails, source metadata, and saved asset ids. The obvious next step is to make real images enter the system in a consistent way.

## Decisions To Preserve

- Pastiche is library-first. Explore is an ingestion/discovery lane into the archive, not the center of gravity.
- Library is the global archive of every saved asset, including assets not assigned to folders and assets only linked to projects.
- Folders are structural archive containers. Projects are creative workspaces. Do not model projects as top-level folders.
- An asset can belong to multiple projects.
- Tags are global by default.
- View Full Library must show every saved/imported asset, with intelligent loading later.
- Folder pages should not recursively dump every descendant asset by default. Folders can show direct subfolders and direct contents first, then offer explicit ways to include descendants if needed.
- Mobile should avoid deep tree navigation. Prefer Library Overview, breadcrumb, current folder contents, and direct child folders.
- Desktop can support richer file-management surfaces later, but the mobile model should remain the constraint that keeps the IA clean.
- Use Phosphor icons.
- Use Crimson Text for headings and wordmark, Montserrat for UI/body text.
- Keep the visual language warm, dark, archival, restrained, and studio-minded. Avoid strong gold accents except where a later design pass intentionally introduces them.

## Current Shell Features

The committed shell includes:

- App modes: Home, Library, Explore, Canvas, Colors, Resources.
- Desktop rail, top command bar, central workspace, and retractable right Inspector.
- Mobile bottom nav with Library, Explore, Add, Canvas, Resources.
- Library Overview as the mobile and desktop entry point for archive organization.
- View Full Library route/state.
- Folder Contents view with breadcrumb above title.
- Direct subfolder cards.
- Responsive asset grid with approximate artwork proportions.
- Desktop Library image click opens the right Inspector.
- Mobile Library image click opens a full Inspect screen with back navigation.
- Static Add to Library sheet/popover.
- Static mobile filter drawer and desktop filter panel.
- Horizontal pinned project cards with touch/pointer dragging.
- Neutralized filter active states and lighter interaction motion.

See the full status inventory in:

```text
docs/product/current-shell-status.md
```

## Known Shell-Only Areas

These are not wired to real behavior yet:

- Explore APIs
- local Library persistence
- file import
- folder import
- URL import
- clipboard import
- browser extension capture
- real filters
- real sort
- real search
- smart folder queries
- project workspaces
- project pins and menus
- folder creation
- favorite/tag/move/delete persistence
- add-to-canvas behavior
- Canvas mode
- Colors mode
- Resources mode
- thumbnail generation
- palette extraction
- duplicate detection

The current UI is good enough to host the next implementation, but it is still mostly static shell.

## Immediate Next Build Goal

Define one shared asset ingestion contract, then wire one real source into it.

Recommended order:

1. Define the saved `Asset` contract.
2. Draft the SQLite schema and archive filesystem layout.
3. Implement one real Explore provider.
4. Save one Explore result into Library using the same asset contract.
5. Build browser-extension capture against that same save endpoint.
6. Use real saved images to refine Library, Inspect, Filters, and later Canvas/Colors.

## Asset Contract Needed First

Every ingestion path should create the same normalized record.

Minimum first contract:

- stable asset id
- title
- creator or artist
- year or date label
- medium
- source name
- source type
- source URL, if available
- page or collection URL, if available
- license or rights summary
- original image URL, if available
- local original path or storage key
- thumbnail path or storage key
- width and height
- tags
- folder assignment
- linked project ids
- notes
- favorite state
- palette placeholder or cached palette id
- imported timestamp
- modified timestamp

Important: Explore saves, manual imports, and browser-extension captures should all use this contract.

## Storage Shape To Decide

The recommended first storage model remains local-first:

```text
Pastiche/
  workspace.sqlite
  originals/
  thumbnails/
  palettes-cache/
  imports/
  exports/
```

The SvelteKit app/server should own writes to SQLite and the filesystem. Browser clients, iPad, and the extension should talk to that server through HTTP endpoints.

SQLite should own metadata, relationships, tags, folders, projects, notes, smart folder definitions, source records, and canvas documents.

The filesystem should own originals, thumbnails, generated palette caches, import staging, exports, and backups.

## First Explore Provider

Pick one source first. Do not build a general provider framework before one source works end to end.

Good first candidates:

- The Met Collection API
- Art Institute of Chicago API
- Wikimedia Commons API

For whichever provider is chosen, pull together:

- search endpoint
- detail endpoint
- image URL rules
- pagination behavior
- rights/license fields
- creator/date/medium fields
- attribution requirements
- rate limits
- CORS behavior
- sample result fixtures for tests

The first target should support:

```text
search -> render results -> inspect result -> save to Library -> reopen in Library
```

## Browser Extension Capture

The extension should be the second ingestion lane after one Explore source works.

First version assumptions to verify:

- Manifest V3
- Chromium first unless the user chooses otherwise
- context menu action: Save to Pastiche
- sends image URL, page URL, page title, selected image blob when available, and optional alt text
- calls a local Pastiche server endpoint
- handles server-offline state gracefully
- uses the same save endpoint and asset contract as Explore

Open questions for the next session:

- Which browser should be first?
- Does capture save immediately, or open a small extension popup for folder/project/tag choices?
- Does the extension attempt blob capture first, URL capture first, or both?
- Is a local token needed before network exposure?

## Folder Model Notes

The user is uncertain about treating subfolders only as filters. Preserve this nuance.

Folder pages should probably distinguish:

- direct assets in this folder
- direct child folders
- optional descendant/include-subfolders behavior

Do not force a parent folder like `assets` to immediately load thousands of descendant images without an explicit interaction or intelligent loading.

Possible later model:

- default: direct folder contents
- visible child folders
- optional "Include subfolders" toggle
- optional "Browse all descendants" row
- search can include descendants when explicitly selected

## Test Content Needed

Before serious visual QA, collect or import:

- 20 to 50 public-domain artworks with varied aspect ratios
- several images with missing metadata
- a few local upload files
- duplicate or near-duplicate images
- one very tall image
- one very wide image
- one image with no creator, no date, and no source URL

This set should become the early fixture library for Library, Explore, Inspect, Filters, and later Colors/Canvas.

## Files To Read First

Start with:

```text
docs/product/current-shell-status.md
docs/product/pastiche-app-handoff.md
docs/product/information-architecture-home-hub.md
docs/design/mobile-interface-plan.md
docs/design/tablet-desktop-interface-plan.md
```

Then inspect:

```text
src/lib/types.ts
src/lib/state/app-state.svelte.ts
src/lib/data/mock-assets.ts
src/lib/data/library-organization.ts
src/lib/components/library/
src/lib/components/browse/
src/lib/components/filters/
src/lib/components/inspector/
src/lib/components/shell/
tests/pastiche.e2e.ts
```

## Verification Commands

Use these before claiming the shell is still healthy:

```bash
npm run check
npm run test:unit -- --run
npm run test:e2e
git diff --check
```

Playwright may print a host dependency warning in this environment while still passing.

## Recommended First Implementation Plan For Next Session

1. Review the current shell and status docs.
2. Add or refine TypeScript types for normalized assets, sources, folders, projects, and ingestion drafts.
3. Draft SQLite schema in docs before wiring code.
4. Add a thin data/service boundary so components stop depending directly on mock arrays.
5. Implement the first provider as a service with fixture-backed tests.
6. Add a save-to-library endpoint or action that creates a normalized local asset record.
7. Update Explore's Add button to save one real result.
8. Update Library's global view to read from the same source of truth.
9. Only after that, begin extension capture.

The next session should avoid rebuilding the shell unless a real ingestion need exposes a structural problem.
