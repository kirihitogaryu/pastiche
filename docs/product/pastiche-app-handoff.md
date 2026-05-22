# Pastiche App Handoff Brief

Date: 2026-05-22

## Working Concept

Pastiche is a personal artist reference operating system: a local-first image archive, capture tool, color-theory suite, curated art/source browser, and simple moodboard canvas. It is not a social app, not a Pinterest clone, and not a generic discovery feed.

The core workflow is:

```text
discover or capture -> save -> enrich metadata -> analyze color -> reuse in canvas or artwork
```

The strongest product insight is vertical integration across the art workflow. Existing tools split reference collection, color analysis, palette generation, museum/art discovery, and moodboarding into separate apps. Pastiche should make those feel like one continuous studio workflow.

The app is primarily for personal use, possibly shared with friends later. It does not need enterprise auth, multi-tenant complexity, or a commercial SaaS architecture.

## Current Product Shape

The app currently has five top-level modes:

1. **Library**
   - The core of the app.
   - A personal cross-platform archive for images, references, assets, palettes, notes, and metadata.
   - Inspired by Refern, Eagle, PureRef, and Pinterest, but more file-manager-like and more metadata-aware.
   - Supports folders, tags, ratings, favorites, color labels, source info, creator info, notes, smart folders, search, and bulk editing.

2. **Explore**
   - A curated in-app capture source, not a social feed.
   - Used to search high-quality known sources: museum APIs, Wikimedia, open reference packs, possibly booru-style curated image boards.
   - The goal is "find useful reference worth saving," not "browse infinite algorithmic content."
   - Results can be saved into the Library, edited, tagged, and analyzed like any other image.

3. **Canvas**
   - A simple moodboard maker.
   - Drag images from the Library onto a canvas, resize/reposition, add basic labels, export flat images.
   - This should not become Figma. Its value is quick assembly from the archive.

4. **Colors**
   - A standalone color tool suite.
   - Supports image palette extraction, hex-based palette generation, harmonic colors, OKLCH gamut viewing, palette comparison, and approximate paint/palette matching.
   - Also appears contextually inside the Inspector for selected images.

5. **Resources**
   - A curated, searchable list of useful artist resources.
   - Categories could include poses, anatomy, color, perspective, 3D, tools, communities, and photo/reference sites.
   - Starts as a built-in JSON-like catalog, user-extendable later.

## Existing Mockup

Current HTML mockup:

```text
/home/kristoph/Documents/pokebreeder-game/pastiche_ui_v3.html
```

The mockup already establishes a strong direction:

- Warm, dark, quiet archive aesthetic.
- Dense tool UI rather than marketing/productivity SaaS UI.
- Top breadcrumb/search bar.
- Left navigation/sidebar.
- Masonry image grid.
- Right detail panel.
- Floating bulk selection bar.
- Separate Library, Explore, Canvas, Colors, and Resources modes.
- Inspector-like panel with metadata, rating, tags, source fields, notes, and extracted palette.

The design language should transfer forward, but the layout should not be treated as fixed. The current mockup is desktop-first and needs responsive modeling early.

## Key Design Principles

### Library First, Discovery Second

The main product is the personal archive and capture system. Explore is important, but it is a capture lane into the archive, not the center of gravity.

Pastiche should feel like:

```text
"Pinterest if it was not awful, had real file management, rich metadata, and useful art tools."
```

### The Inspector Is The Intelligence Layer

The right panel should become a formal **Inspector**. It should not only show metadata. It should make each image useful.

Suggested Inspector sections or tabs:

- **Info**: title, creator, source name, source URL, date, medium, description, notes.
- **Tags**: normal tags, hierarchical tags, linked tags, color-coded tag groups.
- **Color**: extracted palette, harmonies, OKLCH gamut, palette distance, nearest named colors.
- **Related**: by tag, folder, artist/source, color similarity, source collection.
- **Use**: add to canvas, copy palette, export palette, open source, copy citation.

### Files Must Stay Real

Avoid proprietary blob storage. The archive should remain inspectable and durable:

```text
Pastiche/
  workspace.sqlite
  originals/
  thumbnails/
  palettes-cache/
  moodboards/
  imports/
  exports/
```

The user's 1TB external hard drive is likely the main archive home.

### One Adaptive App Shell

Do not design a desktop app and then squeeze it onto iPad. The same product model should adapt across layouts:

- Same modes.
- Same design tokens.
- Same Inspector content.
- Different placement depending on viewport.

## Recommended Architecture

### Strong Recommendation

Use a **SvelteKit app with a local/server backend**, with files stored on the external drive and metadata stored in SQLite.

The app runs on a Linux machine, mini PC, NAS, or home server that can access the external drive. Desktop browsers, iPad, Android, and browser extensions all talk to that app over HTTP.

This avoids relying on browser filesystem APIs as the source of truth.

### Why This Is Better Than Browser-Only Storage

Browser storage is not a great primary home for a 1TB image archive. iPad/Safari filesystem capabilities are especially not reliable enough for this. Current compatibility data shows Safari and iOS Safari do not support the native File System Access API.

Useful references:

- [MDN File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [Can I Use: File System Access API](https://caniuse.com/native-filesystem-api)

### Recommended Storage Model

```text
External Drive/
  Pastiche/
    workspace.sqlite
    originals/
      refs/
      projects/
      imports/
      fine-art/
    thumbnails/
    palettes-cache/
    moodboards/
    exports/
```

SQLite owns:

- image records
- source records
- tags
- hierarchical tag structure
- ratings/favorites/color labels
- notes
- palette metadata
- source attribution
- smart folders
- canvas documents
- resource catalog additions

The filesystem owns:

- original images
- thumbnails
- exported moodboards
- backup/export artifacts

### Sync And Cross-Platform Persistence

Best initial model:

```text
One central Pastiche server + one central archive folder.
```

All devices talk to the same server. Captures from desktop, iPad, Android, and Explore all persist immediately into the same archive.

For remote access:

- Tailscale
- WireGuard
- private Cloudflare Tunnel

For backup/mirroring:

- Syncthing
- rsync
- restic
- external drive clone

Avoid making synced SQLite files the active multi-device source of truth unless absolutely necessary. SQLite is excellent when one server owns writes; it becomes annoying when several devices mutate separate copies.

## Capture Strategy

Desktop capture:

- Browser extension with right-click "Save to Pastiche."
- Sends image URL, page URL, page title, selected image blob if available, and optional tags/folder.
- Calls a local/server API endpoint.

iPad capture:

- iOS Shortcut using Share Sheet: "Save to Pastiche."
- Accepts image or URL and POSTs to the Pastiche server.
- PWA import screen for paste URL, upload file, drag/drop, or photo import.

Android capture:

- PWA upload/share target if supported.
- Browser share to app endpoint or shortcut-like workflow.

In-app capture:

- Explore result -> Save to Library.
- Manual URL import.
- Drag/drop image upload.
- Bulk import from folder.

## Public/Curated Source APIs

Good first sources:

- [The Met Collection API](https://metmuseum.github.io/)
  - No API key currently required.
  - Open collection data.
  - Public-domain images where available.
  - Rate guidance: 80 requests per second.

- [Art Institute of Chicago API](https://api.artic.edu/docs/)
  - Rich search endpoints.
  - Strong image infrastructure.
  - Good candidate for early Explore integration.

- [Europeana APIs](https://api.europeana.eu/)
  - Search and record APIs for European cultural heritage.
  - Broader and messier than a single museum, but valuable.

- [Harvard Art Museums API](https://github.com/harvardartmuseums/api-docs)
  - Rich metadata.
  - Requires an API key.

- [MediaWiki REST API](https://www.mediawiki.org/wiki/API:REST_API/Reference)
  - Useful for Wikimedia/Wikipedia long-tail search and metadata.

Google Arts & Culture should be treated as inspiration, not a primary integration target. There does not appear to be an official public developer API for the product itself. Many useful museum examples point back to museum-owned open APIs instead.

Possible later sources:

- Rijksmuseum
- Cleveland Museum of Art
- Smithsonian
- Library of Congress
- Getty vocabularies/ULAN/AAT for enrichment
- Danbooru or other booru-style APIs where allowed
- open pose/reference packs
- Sketchfab or 3D model sources if terms allow

## Color Tools

The color suite should be one of the app's identity features.

Important capabilities:

- Extract palette from image.
- Generate palette from hex.
- Generate complementary, split-complementary, triadic, tetradic, analogous, monochrome, and shade/tint sets.
- Use perceptual color spaces, especially OKLCH/OKLAB, rather than naive HSL.
- Show palette gamut.
- Compare two images or palettes by color distance.
- Find similar images in the library by palette/gamut.
- Export palettes for use in other art apps.

Libraries to evaluate:

- `culori` for OKLCH/OKLAB and color conversions.
- `chroma.js` for general color operations.
- `node-vibrant` or similar for palette extraction.
- `meodai/color-names` or related libraries for human-readable color labels.

Potential killer feature:

- **Gamut Viewer**
  - OKLCH polar plot: hue as angle, chroma as radius, lightness encoded separately.
  - 3D OKLAB convex hull later using Three.js.
  - Show the "possibility space" of a palette.

Palette matching:

- Approximate nearest Pantone is technically possible but Pantone data is proprietary.
- Community datasets exist but should be treated carefully.
- RAL may be cleaner because it is more public and practical for paint-like contexts.
- Use OKLAB/Delta E style nearest-neighbor comparisons.

## Responsive UI Plan

This is one of the most important next design tasks.

### Wide Desktop

```text
topbar
sidebar | main grid/canvas | inspector
```

Use for:

- full folder tree
- persistent Inspector
- dense masonry grid
- keyboard shortcuts
- bulk editing

### iPad Landscape

```text
topbar
compact nav/drawer | main grid/canvas
inspector as slide-over drawer
```

Use for:

- touch-first selection
- collapsible sidebar
- no hover-only actions
- Inspector appears on demand

### iPad Portrait

```text
topbar
main grid/list
bottom or side sheet Inspector
```

Use for:

- one main surface at a time
- larger tap targets
- sheet-based metadata editing
- bottom navigation or compact mode switcher

### Phone/Narrow

Not necessarily the primary target, but should remain usable:

```text
mode switcher
search/filter
grid/list
full-screen detail sheet
```

Minimum principle:

No feature should depend entirely on hover, right-click, or a three-panel layout.

## Design Tokens To Establish Early

Define these before implementing features deeply:

- viewport breakpoints
- spacing scale
- tap target sizes
- sidebar widths
- Inspector widths/sheet heights
- card thumbnail sizing rules
- typography scale
- color tokens in OKLCH if possible
- elevation/border rules
- icon sizes
- chip/tag styles
- source badge styles
- palette swatch sizes
- grid density presets

The existing mockup's tone is good, but its fixed widths should become tokens that adapt per layout.

## Metadata Schema Direction

Early image record shape:

```ts
type ImageAsset = {
  id: string;
  workspaceId: string;
  filePath: string;
  thumbnailPath?: string;
  sourceUrl?: string;
  sourceName?: string;
  sourceProvider?: string;
  sourceId?: string;
  title?: string;
  creator?: string;
  year?: string;
  medium?: string;
  description?: string;
  notes?: string;
  tags: string[];
  rating?: number;
  favorite?: boolean;
  nsfw?: boolean;
  colorLabel?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  fileSize?: number;
  checksum?: string;
  palette?: PaletteSummary;
  dateAdded: string;
  dateModified: string;
};
```

Likely separate tables:

- assets
- files
- folders
- tags
- tag_links
- tag_hierarchy
- sources
- palettes
- colors
- smart_folders
- canvases
- resources

## Feature Order Recommendation

Recommended MVP order:

1. **Responsive shell spec**
   - Model desktop, iPad landscape, iPad portrait, and narrow/mobile.
   - Define navigation, Inspector behavior, grid behavior, and touch interactions.

2. **Workspace library**
   - External-drive archive root.
   - Import images.
   - Folders.
   - Tags.
   - Search.
   - Inspector metadata editing.

3. **Palette extraction in Inspector**
   - Every saved image becomes more useful immediately.
   - Extract palette, store derived color metadata, show swatches.

4. **Capture pipeline**
   - Upload.
   - Paste URL.
   - Save remote image URL.
   - Desktop extension endpoint.
   - iPad Shortcut endpoint.

5. **Explore MVP**
   - Start with The Met and Art Institute of Chicago.
   - Search, preview, view source metadata, save to Library.

6. **Standalone Colors mode**
   - Hex input.
   - Harmonies.
   - Gamut viewer.
   - Palette comparison.

7. **Moodboard canvas**
   - Drag from Library.
   - Resize/reposition.
   - Text labels.
   - Export PNG/JPG.

8. **Resources list**
   - Built-in searchable catalog.
   - User additions.
   - Categories and tags.

9. **Browser extension**
   - Right-click save.
   - Bulk save images from page.
   - Folder/tag selection.

## Most Important Next Steps

1. **Create the real project workspace**
   - Use SvelteKit unless a better reason appears.
   - Keep the app web/PWA-first.
   - Plan for a local/server backend from the beginning.

2. **Write the responsive shell spec**
   - This is the next big design step.
   - Decide exactly how the sidebar, mode switcher, grid, Inspector, and bulk actions behave at desktop, iPad landscape, iPad portrait, and narrow/mobile widths.

3. **Convert the HTML mockup into design tokens**
   - Preserve the mood and hierarchy.
   - Replace fixed assumptions with adaptable tokens.
   - Avoid hover-only controls.

4. **Define the archive/storage model**
   - External drive as archive home.
   - SQLite as metadata database.
   - Normal files for images.
   - Thumbnails/cache are rebuildable.

5. **Define the first metadata schema**
   - Get image, source, tag, folder, palette, and canvas records correct early.
   - This is the foundation for search, smart folders, Explore saves, and color intelligence.

6. **Build Library before deep Explore**
   - The app succeeds if capture and organization feel good.
   - Explore is exciting, but it should feed into a strong Library rather than compensate for a weak one.

7. **Prototype iPad capture early**
   - Test the Share Sheet/Shortcut route early.
   - Do not assume Safari can directly manage the archive filesystem.

## Open Questions

- Should v1 assume one active workspace folder, or support multiple named workspaces/projects from day one?
- Should moodboards be files in the workspace, database records, or both?
- Should "projects" be special folders, smart folders, or first-class records?
- How much offline capability is actually needed on iPad?
- Will friends access the same server, or should sharing be export-based at first?
- Should NSFW filtering be included from the beginning because some reference sources may need it?
- Should the app include booru integrations early, or keep v1 focused on museum/open-access collections?

## Current Recommendation Summary

Build Pastiche as a SvelteKit local/server web app with a SQLite metadata database and normal image files stored on the 1TB external drive. Treat the iPad as a first-class client, not as the storage authority. Start with the responsive shell and Library/Inspector architecture, then add color intelligence, capture, curated Explore sources, canvas, and resources.

The app's current shape is:

```text
Local artist archive + metadata manager
  + curated source capture
  + color analysis and palette tools
  + simple moodboard canvas
  + artist resource catalog
```

The most important design decision is preserving the core loop:

```text
save image -> understand it -> organize it -> reuse it
```

