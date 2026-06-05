# Pastiche

Pastiche is a local-first artist reference operating system: a durable image archive, capture tool, curated source browser, metadata/inspection surface, color-analysis foundation, and future moodboard canvas.

The product is for artists and visual creators who collect references, source images, palettes, study material, and moodboard fragments as part of studio work. It should feel like a serious archive and creative tool, not a social feed, Pinterest clone, generic SaaS dashboard, or imageboard.

## Current State

Pastiche is a SvelteKit app with a local SQLite-backed library sidecar, responsive Library and Explore surfaces, an Inspector, browser-extension import plumbing, and real museum/source browsing work in progress.

Implemented or actively in progress:

- Responsive app shell with Home, Library, Explore, Canvas, Colors, and Resources modes.
- Library overview, full-library view, folder contents, folder/project/tag organization, favorites, and move/tag actions.
- Local-first archive sidecar at `.pastiche/` by default, or `PASTICHE_LIBRARY_DIR` when configured.
- SQLite metadata storage through `better-sqlite3`.
- Explore connectors and APIs for public-domain/reference browsing, including The Met, Art Institute of Chicago, Wikidata, and Wikimedia Commons-oriented reference search.
- Add-to-Library/import flow that can save Explore results and extension captures into the local Library.
- Browser extension build and local server API path for capture/import work.
- Responsive Inspector surfaces for desktop and mobile.
- Filter/search work for Library and Explore, including richer source/reference filter UI.
- Atlas metadata and tag wiki design spec for the next canonical metadata layer.

Still early or placeholder:

- Canvas, Colors, and Resources are not full product surfaces yet.
- Atlas is designed but not implemented.
- Color analysis, duplicate detection, image relationship graphs, and advanced Atlas search are future layers.
- AI assistance is planned as structured guidance/export first, not direct in-app AI automation.

## Mental Model

Pastiche is organized around this loop:

```text
discover or capture -> save -> enrich metadata -> analyze color -> reuse in projects or moodboards
```

The main product surfaces are:

- **Library**: where saved images live. Folders, projects, local organization, and practical archive management.
- **Explore**: where public-domain and source images are discovered before saving.
- **Inspector**: the intelligence surface for a selected image: source, metadata, tags, palette, notes, and future relationships.
- **Atlas**: the planned canonical metadata/tag wiki layer. Atlas will define what images mean, contain, imply, and connect to.
- **Canvas**: future moodboard/reference-board workspace.
- **Colors**: future color analysis and palette tooling.

Long term, Library should display a calm projection of Atlas metadata rather than maintain a separate simplistic tag system.

## Atlas Direction

Atlas is the next major metadata system. Its source-of-truth design lives at:

```text
docs/superpowers/specs/2026-06-05-atlas-metadata-wiki-design.md
```

Atlas is inspired by Danbooru's precision and wiki/tag governance, but should avoid public-imageboard culture and old booru limitations.

Core Atlas principles:

- A canonical tag is a reusable research concept with documented usage rules.
- Wiki pages are governance records, not decoration.
- AI agents may suggest tags, but the vocabulary decides what becomes canonical.
- AI-created tags must include draft wiki pages and distinctness arguments.
- Aliases are for same-concept redirects.
- Implications are for strict always-true broader relationships.
- Ambiguous relationships should be suggestions or browsing links, not automatic implications.
- Tags name concepts; classifiers describe attributes.
- Prefer `shirt + color:blue` over `blue_shirt`.
- Evidence matters: observed, metadata, inferred, interpretive, and computed claims are different.
- Assignment status matters separately from tag status.

Atlas should eventually power Library tags, Inspector display, search, filters, review queues, AI guidance exports, color search, duplicate prevention, and image relationships.

## Important Docs For Agents

Start here before making product or architecture changes:

```text
PRODUCT.md
DESIGN.md
docs/project-organization.md
docs/architecture/local-library-sidecar.md
docs/superpowers/specs/2026-06-05-atlas-metadata-wiki-design.md
```

Useful product/design handoffs:

```text
docs/product/pastiche-app-handoff.md
docs/product/information-architecture-home-hub.md
docs/product/current-shell-status.md
docs/product/next-phase-handoff.md
docs/design/mobile-interface-plan.md
docs/design/tablet-desktop-interface-plan.md
```

Planning artifacts:

```text
docs/superpowers/specs/
docs/superpowers/plans/
```

Design mockups:

```text
docs/design/mockups/
```

## Architecture Notes

The current app uses:

- SvelteKit and Svelte 5.
- Vite.
- Node adapter for production server builds.
- `better-sqlite3` for local metadata persistence.
- `idb-keyval` for client-side Explore/cache support.
- `sharp` for image processing.
- Phosphor icons.
- Crimson Text for headings/wordmark and Montserrat for UI/body text.

Local archive sidecar:

```text
.pastiche/
  workspace.sqlite
  originals/
  thumbnails/
  imports/
  lazy-downloads/
  palettes-cache/
  exports/
```

The sidecar can be moved with:

```sh
PASTICHE_LIBRARY_DIR=/path/to/Pastiche npm run dev
```

The browser extension talks to local SvelteKit server routes. The current Node server owns writes to SQLite and the filesystem. If Pastiche later moves to Tauri, preserve the local HTTP contract for extension compatibility.

## Development

Install dependencies:

```sh
npm install
```

Start the app:

```sh
npm run dev
```

For everyday extension work, install the local `pastiche` command once:

```sh
npm run install:pastiche
```

Then run:

```sh
pastiche
```

This starts the local Pastiche server at `http://127.0.0.1:5173` and watches the Chrome extension build at `extension/dist/`. Reload the unpacked extension in Chrome after extension source changes.

For Firefox extension work:

```sh
pastiche --firefox
```

Run checks and tests:

```sh
npm run check
npm run test
```

Build the app:

```sh
npm run build
```

Build the extension:

```sh
npm run build:extension
```

## Working Guidelines

- Preserve the local-first model. Files should remain real and backup-friendly.
- Do not couple Explore client caches directly to Library storage.
- Keep metadata logic in services, not Svelte components.
- Do not turn Canvas into a Figma clone.
- Do not start with in-app AI automation for Atlas. Start with strict guidance exports and structured suggestion imports.
- Do not make public/social booru features: voting, scores, public moderation, comment threads, or imageboard-style UI.
- Keep the interface quiet, archival, studio-minded, and useful for long browsing sessions.

## Near-Term Direction

1. Commit the current Library/Explore/filter/import worktree.
2. Review and refine the Atlas metadata/wiki design spec.
3. Write an implementation plan for Atlas foundations.
4. Build Atlas as a bridge-first canonical layer that Library can read from.
5. Migrate new tag creation/display toward Atlas-backed services after the bridge is stable.
6. Add classifiers, review queues, explicit search syntax, color profiles, and image relationships in later phases.
