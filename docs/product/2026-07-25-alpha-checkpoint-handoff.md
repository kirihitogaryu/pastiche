# Pastiche Alpha Checkpoint Handoff

## Checkpoint

This commit is the handoff point before a new Codex session. It gathers the current
Atlas, Library, Explore, extension, responsive-shell, and media-preview work onto
`main`.

The product target remains a local-first reference-image system whose dependable
core loop is:

1. capture or bookmark the best available image;
2. preserve useful source and artist metadata;
3. organize images into folders;
4. tag them with a coherent Atlas vocabulary;
5. retrieve and download them comfortably from desktop, iPad, or phone.

## Current working shape

### Atlas

- Responsive browse, search, Inspect, and Wiki surfaces are in place.
- Inspect supports metadata review, Atlas-aware tag suggestions, tag correction,
  download/source/favorite/move actions, and desktop/mobile image viewing.
- Atlas ontology, resolver, governance, agent-run, deletion, restore, merge, and
  Wiki-draft foundations are present.
- Human Wiki/concept editing is intentionally less restrictive than AI promotion.
- The next pass must connect the existing result windows to shared pagination and
  bulk-selection semantics.

### Library

- The Library is now an image-first file browser rather than a project dashboard.
- Folder navigation, compact breadcrumbs, folder drawer/sidebar, search, filters,
  edit selection, move/remove behavior, and optional Inspect are present.
- The main Library view represents all Pastiche images; folders are organizational
  membership, not the source of truth for whether an asset exists.
- Saved images and bookmark/lazy imports remain distinct storage states.
- The current move picker and selection model need to be replaced by the bounded,
  responsive batch workflow described below.

### Explore

- The Met, Art Institute of Chicago, Wikimedia, Danbooru, DeviantArt, Bluesky, and
  Fur Affinity connectors share the current Explore shell.
- Saved searches, common filtering, source-specific filtering, caching, rate-limit
  handling, multi-image post handling, and import/bookmark actions are present.
- Explore sources expose different paging primitives. This is the main reason the
  pagination work must define a shared UI contract without pretending every remote
  API supports arbitrary page jumps.

### Browser extension

- Chrome and Firefox builds share the capture panel.
- Drag-to-open capture, optional drag capture, Pastiche-page exclusion, image
  selection, direct download versus bookmark storage, metadata enrichment, artist
  candidates, Atlas tag entry/resolution, and folder destination selection are
  present.
- Secrets and private cookies remain in ignored `.env.local`; `.env.example`
  contains names only.

### Media and responsive behavior

- Bottom navigation hides on downward mobile scrolling and returns on upward
  intent across the shared shell.
- Animated GIFs are identified across Library, Atlas, and Explore. Cards show a GIF
  badge and use motion-on-hover/focus while avoiding a duplicate static frame
  behind the animation.
- Image preview sizing, zoom, pan, and high-quality source selection have had a
  shared accessibility pass.

## Last confirmed state

- The user confirmed the duplicated-frame GIF visual bug was fixed.
- No pagination or new bulk-operation implementation began after that confirmation.
- The next session should start with Phases 2 and 3 of
  `docs/plans/2026-07-25-alpha-readiness-phases.md` as one coordinated change.

## Next session: pagination and batch operations

### Agreed product behavior

- Every image result surface offers **Infinite** and **Pages** modes:
  - Library root and folders;
  - Atlas browse and Atlas search;
  - every Explore source/mode.
- Paged mode supports 25, 50, or 100 results.
- Library and Atlas may use numbered pages because Pastiche owns the result set and
  total count.
- Explore uses Previous/Next at both the top and bottom. A displayed “Page N” may
  be derived from visited cursor history, but remote sources must not be presented
  as supporting arbitrary page jumps when they do not.
- Changing query, filter, sort, folder, source, or page size resets to the first
  result window.
- Returning from Inspect should restore the in-session result collection, but exact
  scroll position should not survive closing the app.

### Recommended shared result contract

- One UI state model:
  - `mode: "paged" | "infinite"`;
  - `pageSize: 25 | 50 | 100`;
  - stable sort and query/filter fingerprint;
  - total when the provider exposes one;
  - loading, partial-error, retry, and exhausted states.
- Two navigation adapters:
  - offset/page adapter for Library and Atlas;
  - cursor adapter for Explore with a visited-cursor stack for Back/Next.
- Infinite mode must not keep an unbounded rendered DOM. Use a bounded result
  window/virtualization and a small per-query page cache so long Explore sessions
  do not consume memory indefinitely.
- Use the same visible control component everywhere. The full control belongs above
  results; a compact navigation copy belongs below paged results.

### Recommended selection contract

Selection scope must be explicit rather than represented only as a growing array of
client-side IDs:

- individual assets;
- this page in paged mode;
- loaded assets in infinite mode;
- all matching results, only through a server-owned query snapshot/token.

After “Select this page,” offer “Select all N matching” when the backend can execute
that query scope safely. Track explicit exclusions so a user can select all matching
and then deselect a few cards without enumerating every ID in the browser.

Clear selection when the query fingerprint changes. Keep selection while a batch
sheet is open and after recoverable validation errors. Every destructive or
wide-scope action must restate its scope and count before commit.

### Batch organization

- Use the same edit/selection language in Library and Atlas.
- The folder destination picker must be:
  - height-bounded and searchable on desktop;
  - an internally scrolling bottom sheet on phone and iPad;
  - path-aware without infinite visual indentation.
- **Move to folder** changes Library folder membership.
- **Remove from folder** moves to the parent, or Library root when there is no
  parent. It never deletes the asset from Pastiche or Atlas.
- Smart views are dynamic queries and cannot be move destinations.

### Batch tagging and replacement

- “Tag selected” accepts multiple comma-separated entries, resolves them together,
  and groups established, corrected, ambiguous, and new concepts before one
  transactional commit.
- Support adding and removing assignments across the selected scope.
- A true tag replacement is governance, not merely a batch edit:
  - choose old and replacement concepts;
  - preview affected assets/annotations/relations;
  - migrate assignments transactionally;
  - deprecate or merge the old concept with an explicit `replaced_by`;
  - let the resolver autocorrect later stragglers.
- Reuse the existing ontology and governance service rather than creating a second
  replacement path in the result UI.

### Smart-view cleanup

- Keep smart views only when they are actionable:
  - Favorites;
  - Bookmarks;
  - Untagged or Needs tag review;
  - Recently added with a clearly defined rolling window.
- Remove “Missing source” unless it is reframed as an intentional review queue.
- Smart-view counts and membership must be live query results, not folder records.

## Decisions to settle at the start of the next session

1. Remember browsing mode and page size globally, per workspace, or per
   Explore source? Recommended: per workspace, with Explore remembered per source.
2. Define “Recently added” as a fixed rolling window or a configurable preference.
   Recommended first pass: 30 days.
3. Decide whether “all matching” is in the first implementation for both Library
   and Atlas, or lands after page/loaded selection. The API should support it from
   the start even if the first UI exposes it incrementally.

## Suggested implementation order

1. Define result-window, query-fingerprint, selection-scope, and cursor-history
   types with focused unit tests.
2. Add server-side Library/Atlas windows and query-scoped bulk tokens.
3. Build the shared paging controls and selection controller.
4. Wire Library, then Atlas.
5. Add the Explore cursor adapter and bounded infinite cache.
6. Replace move UI with the responsive destination picker.
7. Add transactional bulk tag add/remove.
8. Add the governance-backed replacement flow.
9. Audit smart views.
10. Run focused unit/component checks, then manual desktop, iPad, and phone smoke
    passes.

## Verification for this checkpoint

The checkpoint commit should record the exact commands and outcomes in its final
handoff message. Do not assume live provider credentials are available in automated
tests, and never commit `.env.local`, extension build output, downloaded assets, or
cookies.
