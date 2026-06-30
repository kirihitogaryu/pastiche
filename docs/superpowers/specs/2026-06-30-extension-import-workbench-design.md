# Pastiche Extension Import Workbench Design

Date: 2026-06-30

## Purpose

The Pastiche browser extension should become a reliable image import workbench for collecting artwork and reference images from arbitrary webpages. Its primary job is to import the highest-resolution image that is actually available from the page or source site, without upscaling, while preserving enough editable context that the item enters Pastiche as a useful library asset instead of a mystery URL.

The current extension already has useful pieces: single-click capture, page sweep, lasso capture, right-click import, background fetching, duplicate detection, offline queueing, storage policy, and a basic canonical-image resolver. The next version should keep those foundations but reorganize them around candidate discovery, source-aware resolution, editable metadata, and a Pastiche-native sidebar.

This design focuses only on the extension and import-time Library metadata. It intentionally defers deeper Atlas tagging, artist entity pages, and rich tag governance. The first implementation should expose high-value fields such as title, artist, original page URL, source site, image URL, tags, date, and folder. Later Atlas work can consume those fields more deeply.

## Product Goals

- Auto-select the best available image by default.
- Avoid icons, thumbnails, logos, avatars, sprites, tracking pixels, and low-resolution images.
- Let the user view and choose other candidate images found on the same page.
- Support direct hover/click capture, right-click image capture, page scan/batch import, area capture, visible capture, full-page capture, and a drag feature.
- Preserve provenance: source page URL, direct image URL, source site, image host, capture time, and human-readable source label.
- Provide editable import metadata: title, artist, date, tags, original link/page, source label, and folder.
- Suggest simple page-derived tags or keywords, but treat them as optional chips, not approved Atlas tags.
- Handle hostile or dynamic sites with explicit fallback tiers and clear quality labels.
- Match the Pastiche app's current visual language using shared tokens and compact tool UI patterns.
- Keep Chrome as the first functional target, then run a dedicated Firefox runtime compatibility pass.

## Non-Goals For The First Build

- Do not build full Atlas tagging automation.
- Do not create artist entity pages yet.
- Do not auto-approve page keywords as canonical tags.
- Do not promise true originals from sites that never expose original bytes to the browser.
- Do not use screenshot capture as if it were equivalent to original-file import.
- Do not replace the main Pastiche Library or Explore UI.
- Do not introduce a new frontend framework into content scripts.

## Reference Research

### Eagle Extension

Eagle's extension is the best product reference. Its extension exposes a compact command menu with Save URL, Batch Save, Capture Area, Capture Visible, Capture Page, Drag Feature, and Preferences. Eagle also supports batch save filtering and folder/tag assignment during collection.

Useful design lessons:

- Capture actions should be explicit and fast.
- Batch capture should have filtering and destination assignment before import.
- Drag capture should be toggleable.
- Capture area, visible viewport, and full page are separate tools from image extraction.
- The extension should feel like a tool palette, not a webpage.

References:

- https://en.eagle.cool/extensions
- https://chromewebstore.google.com/detail/eagle-for-chrome/lieogkinebikhdchceieedcigeafdkid
- https://en.eagle.cool/blog/post/eagle-extension-v3.1.0

### PicPicker

`flesler/picpicker` is the best extraction-breadth reference. It scans every element and pulls candidates from standard images, `srcset`, `<source>`, CSS backgrounds, pseudo-element content, data attributes, video posters/frames, SVG, and canvas. It then displays a filterable results grid.

Useful implementation lessons:

- Collect many raw candidates before deciding what to show or import.
- Track source type, dimensions, format, alt text, and viewport visibility.
- Use a real `srcset` parser rather than custom splitting.
- Keep extraction bounded by image count and timeout.

References:

- https://github.com/flesler/picpicker
- https://raw.githubusercontent.com/flesler/picpicker/main/src/content.ts

### Pic-Grabber

`venopyX/pic-grabber` is rougher but useful for dynamic and protected pages. It recursively scans accessible shadow DOM and iframes, watches DOM mutations, checks lazy attributes, processes base64/canvas/SVG sources, and fetches from extension background context when page fetch fails.

Useful implementation lessons:

- Dynamic pages need an explicit rescan and/or observer path.
- Accessible shadow roots and same-origin frames matter.
- Background fetch can bypass page-level CORS limitations, but it is not a universal bypass.
- Some "protected image" claims should be treated carefully and verified per site.

References:

- https://github.com/venopyX/pic-grabber
- https://raw.githubusercontent.com/venopyX/pic-grabber/main/js/content.js
- https://raw.githubusercontent.com/venopyX/pic-grabber/main/js/utils.js

### Image Picka

`eight04/image-picka` is a mature Firefox-friendly reference for power-user image collection. It supports drag-and-drop capture, hover download buttons, batch filtering by width/height/file size/URL, filename templates, URL transform rules, retry and fetch-delay rules, child-frame collection, and optional request/cache-oriented download paths.

Useful implementation lessons:

- Thumbnail-to-original upgrades should be a rule system, not scattered regexes.
- Referrer handling matters for some image hosts.
- Request observation or cache-based download can help when an image loaded in the page is difficult to fetch directly.
- Mature Firefox support needs runtime API handling, not just a successful build.

References:

- https://github.com/eight04/image-picka
- https://raw.githubusercontent.com/eight04/image-picka/master/src/lib/image-util.js
- https://raw.githubusercontent.com/eight04/image-picka/master/src/lib/url-map.js
- https://raw.githubusercontent.com/eight04/image-picka/master/src/lib/request-observer.js

## Current Pastiche Extension Baseline

Current source surfaces:

- `extension/content/index.ts`: single-click capture, lasso, page sweep, selected badges, Escape cleanup.
- `extension/content/resolver.ts`: resolves images from `<img>`, video, canvas, and CSS background images.
- `extension/background/canonical-image.ts`: fetches detail pages and scores common metadata candidates.
- `extension/background/service-worker.ts`: Pastiche status, import posting, offline queue, background image fetch, storage policy, context-menu import.
- `extension/background/context-menu.ts`: maps right-click image events into capture sources.
- `extension/sidebar/App.svelte` and `extension/sidebar/components/*`: current sidebar UI.
- `extension/shared/types.ts`: current capture/import data model.
- `src/routes/api/import/+server.ts`: import endpoint.
- `src/lib/server/library/import.ts`: stores imports and already accepts optional metadata.
- `src/lib/server/atlas/ingest.ts`: can ingest metadata into Atlas suggestions, but this spec does not require deeper Atlas behavior yet.

Current problems:

- The resolver returns one selected URL too early.
- Alternates are not preserved.
- Candidate scoring is heuristic and opaque.
- Page/source metadata is thin.
- Editable metadata is limited to the item filename.
- The import payload does not currently carry extension-side metadata.
- The sidebar does not expose quality, alternates, source identity, artist, date, or tags.
- The sidebar uses hardcoded colors and spacing instead of Pastiche's app tokens.
- Firefox builds, but runtime behavior is not considered reliable.

## Core Architecture

The next extension should be candidate-first:

```text
User action
-> content candidate scan
-> candidate clustering
-> source adapter enrichment
-> quality scoring and auto-selection
-> sidebar import tray
-> editable metadata and folder assignment
-> /api/import metadata payload
-> Library asset record
```

### Candidate Scanner

The content script should produce many candidates and enough context to score them later.

Candidate sources:

- `<img src>`
- `<img currentSrc>`
- full `srcset`
- `<picture>` and `<source>`
- `input[type=image]`
- CSS `background-image`
- CSS `image-set`
- pseudo-element `content: url(...)`
- lazy attributes such as `data-src`, `data-original`, `data-full-src`, `data-hi-res-src`, `data-zoom-image`, `data-srcset`, `data-bg`, and `data-background`
- linked image URLs from nearest `<a href>`
- OpenGraph and Twitter image metadata
- JSON-LD `image`, `contentUrl`, and `thumbnailUrl`
- preload/image links
- video posters
- current video frame when allowed
- canvas export when allowed
- substantial base64 data URLs
- accessible same-origin iframes
- accessible shadow roots

The scanner should not fetch image bytes in the content script. It may read DOM dimensions and metadata, but background service worker remains responsible for network fetches.

### Candidate Model

```ts
type ImageCandidateKind =
	| 'img'
	| 'srcset'
	| 'picture'
	| 'background'
	| 'pseudo_content'
	| 'data_attribute'
	| 'link'
	| 'meta'
	| 'json_ld'
	| 'video_poster'
	| 'video_frame'
	| 'canvas'
	| 'network'
	| 'screenshot';

type ImageCandidate = {
	id: string;
	url: string;
	kind: ImageCandidateKind;
	width: number | null;
	height: number | null;
	visibleWidth: number | null;
	visibleHeight: number | null;
	mimeType: string | null;
	byteSize: number | null;
	altText: string | null;
	sourceElementPath: string | null;
	detailUrl: string | null;
	score: number;
	confidence: 'high' | 'medium' | 'low';
	rejectionReasons: string[];
	scoreReasons: string[];
};
```

### Capture Item Model

```ts
type CaptureItem = {
	id: string;
	selectedCandidateId: string;
	candidates: ImageCandidate[];
	source: CaptureSource;
	metadata: CaptureMetadata;
	capturedAt: string;
	storageMode: StorageMode;
	storageModeReason: string;
	fetchStatus: FetchStatus;
	destinationFolderId: string | null;
	alreadyInLibrary: boolean;
};

type CaptureSource = {
	pageUrl: string;
	canonicalPageUrl: string | null;
	detailUrl: string | null;
	sourceLabel: string;
	sourceType: 'web' | 'social' | 'gallery' | 'booru' | 'museum' | 'cdn' | 'unknown';
	pageHost: string;
	imageHost: string | null;
};

type CaptureMetadata = {
	title: string;
	artist: string | null;
	date: string | null;
	tags: string[];
	suggestedTags: string[];
	description: string | null;
	rawPageTitle: string | null;
	rawAltText: string | null;
};
```

`title` should always have a usable initial value. The first version should infer it from, in order:

1. source adapter title hint
2. image alt text
3. nearest heading or figure caption
4. page title
5. filename stem from the selected image URL
6. source host fallback

The title is editable before import.

### Scoring And Rejection

Hard reject candidates when they are clearly not useful:

- max dimension below a configurable minimum for page scan
- tiny data URLs
- favicons, icons, sprites, logos, UI glyphs, emojis, tracking pixels
- extension UI assets
- blank or failed canvas/video exports
- SVG UI symbols, unless directly selected or explicitly included

Do not hard-reject directly hovered/right-clicked images only because they are small. A user can intentionally capture small images, but the UI should label them as low quality.

Score positively for:

- large known dimensions
- large visible area
- current hover/right-click/drag target
- `srcset` largest descriptor
- source metadata candidate from detail page
- known original/full URL terms
- source adapter confidence
- same artwork/detail page cluster
- direct linked image from nearest anchor

Score negatively for:

- thumbnail words such as `thumb`, `thumbnail`, `small`, `preview`, `sample`, `crop`, `avatar`, `icon`, `logo`, `sprite`, `badge`
- very small visible size
- CDN parameters known to indicate low quality
- low-confidence background/pseudo-element assets

The sidebar should show a short reason for the selected candidate, such as:

- `Selected 2400 x 3200 original image`
- `Selected largest srcset candidate`
- `Selected source-page original`
- `Only screenshot fallback available`

### Candidate Clustering

Candidates should be grouped into item clusters before display. A cluster represents one likely artwork/reference image, not every URL found on the page.

Cluster signals:

- same DOM element
- same nearest anchor/detail URL
- same normalized filename stem
- same source adapter post/work ID
- same visible bounding rectangle
- metadata relation such as thumbnail and original from the same detail page

The selected item uses the highest-scoring candidate in its cluster by default. Other candidates remain visible in an alternates drawer.

## Capture Modes

### Pick Image

The primary mode. User opens the sidebar or clicks the extension action, hovers over an image, sees a clean highlight, and clicks to add it. The extension auto-selects the best candidate for that visual target and stores alternates.

### Right-Click Save To Pastiche

Right-clicking an image or image-like background should open/focus the sidebar and add the selected image. The same candidate scan and high-resolution resolution pipeline should run. If browser APIs do not expose page context, fall back to the image URL and label source context as incomplete.

### Scan Page

Scan the page for importable images, filter out low-value assets, auto-select likely primary images, and show candidates in the sidebar. The user can import all selected items, remove items, or open alternates per item.

### Capture Area

Capture a user-selected rectangle as a screenshot fallback. This is useful for hostile pages, but the UI must label it as a rendered capture, not original file import.

### Capture Visible

Capture the visible viewport as a screenshot fallback. Label clearly as visible screenshot.

### Capture Page

Capture the full page where browser APIs allow it. Label clearly as full-page screenshot.

### Drag Feature

When enabled, dragging an image should open/focus the Pastiche import target behavior. In the first build, this can add the hovered image to the sidebar; later it can support dropping directly onto a folder in the sidebar. The drag feature should be toggleable like Eagle.

## Source Adapters

Source adapters should be pure, testable modules that provide source identity, metadata extraction, candidate URL transforms, and scoring boosts.

```ts
type SourceAdapter = {
	id: string;
	matches(url: URL): boolean;
	normalizeSource(context: PageContext): CaptureSource;
	extractMetadata(document: Document, context: PageContext): Partial<CaptureMetadata>;
	transformCandidateUrl(url: string, context: PageContext): string[];
	scoreCandidate(candidate: ImageCandidate, context: PageContext): number;
};
```

Initial adapters:

- Generic Web
- X/Twitter
- Danbooru
- Tumblr
- DeviantArt
- Pinterest
- Instagram

### Generic Web

Use DOM, metadata, JSON-LD, link relations, and common lazy image attributes. This adapter must remain useful on unknown sites.

### X/Twitter

Normalize `pbs.twimg.com` image hosts to source label `X/Twitter`. Prefer original media variants such as `name=orig` or equivalent URL form. Preserve the tweet/page URL as the original page link.

### Danbooru

Prefer `/original/` candidates over `/sample/`. Extract post tags as suggested chips. Preserve the post URL and source URL separately when available.

### Tumblr

Extract post tags as suggested chips. Prefer largest media variants when visible in DOM or metadata. Default storage policy should lean toward download or lazy download because posts and media can disappear.

### DeviantArt

Extract artist, title, and date from obvious page metadata when available. Prefer original/download/full candidates when the page exposes them. Preserve DeviantArt as the source even when pixels are hosted on a CDN.

### Pinterest

Treat as a hostile/lazy source. Use DOM, metadata, and network-observed candidates. Preserve Pinterest page URL as source, and preserve outbound original source URL only when discoverable. Expect that true originals may not be available.

### Instagram

Treat as a hostile/logged-in source. Use DOM, metadata, credentialed/background fetch, network-observed candidates, and screenshot fallback. Preserve Instagram page URL as source. Clearly label when only rendered fallback quality is available.

## Protected Site Strategy

Protected site support should be explicit tiers:

1. **Normal background fetch**: service worker fetches selected image URL.
2. **Credential-aware fetch**: use extension context where cookies and host permissions allow it.
3. **Referrer-aware fetch**: include referrer behavior when required and allowed.
4. **Loaded media observation**: later advanced mode using request observation or browser cache style techniques where browser APIs permit.
5. **Blob/data/canvas path**: use already-available data URLs or canvas/video exports when legal and untainted.
6. **Screenshot fallback**: capture area/visible/page when original bytes are unavailable.
7. **Manual alternate selection**: show all plausible candidates and explain why the best file could not be fetched.

The UI must never pretend a screenshot is the original. It should say `Rendered capture` or `Screenshot fallback`.

## Import Metadata Contract

The extension should use the existing optional `metadata` shape accepted by `src/lib/server/library/types.ts` and `src/lib/server/library/import.ts`, with small additions only if needed.

Wire payload per item:

```ts
type ExtensionImportMetadata = {
	sourceId?: string | null;
	sourceName?: string | null;
	sourceType?: 'web' | 'social' | 'gallery' | 'booru' | 'museum' | 'collection' | 'cdn' | null;
	detailUrl?: string | null;
	creator?: string | null;
	dateDisplay?: string | null;
	tags?: string[];
	rawMetadata?: Record<string, unknown>;
};
```

Initial field mapping:

- `filename`: editable title
- `metadata.creator`: editable artist
- `metadata.dateDisplay`: editable date
- `metadata.tags`: editable/suggested tag chips accepted by the user
- `metadata.sourceName`: source label such as `DeviantArt`, `X/Twitter`, `Danbooru`, `Tumblr`, `Pinterest`, or host fallback
- `metadata.detailUrl`: canonical page/detail URL
- `source_url`: original page URL
- `source_image_url`: selected direct image URL
- `page_title`: raw page title
- `alt_text`: raw alt text

Artist linking is deferred. The first build stores artist as text. Later, artist settings/pages can resolve these strings into artist entities.

Tag governance is deferred. The first build stores user-accepted chips as import metadata/source suggestions. It does not auto-create canonical Atlas tags.

## Sidebar UI Design

The sidebar should use Pastiche app design tokens from `src/lib/styles/tokens.css` and global patterns from `src/lib/styles/global.css`. Avoid the current isolated hardcoded mini-theme.

The sidebar is a compact tool surface, not a webpage.

### Layout

```text
Status row
Command strip
Import tray / selected item list
Selected item inspector
Alternates drawer
Metadata editor
Suggested tag chips
Folder row
Import action
```

### Status Row

- connection dot and label
- queued count
- unassigned count
- settings icon

### Command Strip

Commands inspired by Eagle but named for Pastiche:

- Pick Image
- Scan Page
- Capture Area
- Capture Visible
- Capture Page
- Drag Capture toggle

The icon-click menu shown in the user's Eagle screenshot should inform command grouping. Pastiche can present these commands in a sidebar strip rather than a popup menu because the existing architecture uses side panel/sidebar.

### Import Tray

Each captured item row:

- thumbnail
- editable title summary
- selected candidate dimensions
- source label
- quality/confidence label
- remove button
- duplicate badge when known

Rows should stay compact, but not as cramped as the current sidebar.

### Selected Item Inspector

When an item is selected:

- larger preview
- selected candidate dimensions and type
- direct image URL host
- original page/source URL
- reason selected
- fetch/storage status
- button to view alternates

### Alternates Drawer

List alternate candidates sorted by score:

- preview
- dimensions
- source kind
- score reason
- direct URL host
- select button

Rejected candidates can be hidden by default behind `Show rejected` for debugging.

### Metadata Editor

Editable fields:

- Title
- Artist
- Date
- Original page URL
- Source label
- Tags
- Notes or description, optional if space allows

The first version can keep source URL editing conservative: allow the user to edit original page URL, but preserve the raw captured page URL in metadata.

### Suggested Tags

Suggested tags come from page hints:

- meta keywords
- visible tag lists
- Danbooru/Tumblr tags
- hashtags
- alt text terms
- obvious category labels

They appear as optional chips. Clicking a chip adds it to the editable import tags. Nothing is auto-approved as a canonical tag.

### Folder Assignment

Keep existing batch folder assignment, but make it feel app-native:

- Unassigned
- recent folders
- create new folder
- later: per-item override

## Settings

Initial settings:

- Pastiche port
- minimum page-scan dimension
- drag capture enabled
- include screenshot fallback
- include SVG/canvas candidates
- show rejected candidates
- default destination folder

Later settings:

- custom URL transform rules
- per-domain transform rules
- per-domain denylist
- retry/fetch delay rules
- protected-site advanced capture permissions

## Error And Edge States

| Situation | Behavior |
|---|---|
| No images found | Show a clear message and suggest Capture Visible / Capture Area. |
| Only thumbnails found | Show alternates, label low confidence, do not import silently as if high quality. |
| Fetch blocked | Keep candidate visible, show blocked reason, offer screenshot fallback. |
| Auth required | Explain that the page may require browser-loaded media or screenshot fallback. |
| Candidate dimensions unknown | Allow selection but show unknown quality until fetch/probe resolves. |
| Duplicate found | Show duplicate badge but allow import anyway. |
| Pastiche offline | Queue import if possible; warn before queueing large downloaded base64 payloads. |
| Storage full | Do not silently drop queued imports. |
| Firefox sidebar unavailable | Show a runtime-specific error and fallback instructions. |

## Testing Strategy

### Unit Tests

- `srcset` parsing and largest-candidate selection
- background and `image-set` parsing
- lazy data attribute extraction
- metadata extraction from OpenGraph, Twitter cards, JSON-LD, and preload links
- candidate hard rejection
- candidate scoring
- clustering
- source adapter matching
- URL transforms
- metadata import payload mapping

### Fixture Pages

Create local fixture pages for:

- simple image
- `srcset`
- `<picture>`
- CSS background
- CSS `image-set`
- lazy data attributes
- OpenGraph and JSON-LD image metadata
- gallery thumbnail linked to full image
- SVG and icon-heavy page
- canvas and tainted canvas
- video poster
- same-origin iframe
- shadow DOM
- dynamic mutation/lazy loading

### Manual Site QA

Manual test matrix:

- X/Twitter
- Danbooru
- Tumblr
- DeviantArt
- Pinterest
- Instagram
- generic portfolio site
- generic ecommerce/gallery page
- direct image tab

For each site:

- Pick Image
- Right-click Save to Pastiche
- Scan Page
- alternates drawer
- metadata extraction
- import into Pastiche
- duplicate detection
- offline queue behavior

### Browser QA

Chrome first:

- side panel opens from action
- context menu opens/focuses sidebar or imports with notification
- background fetch works
- screenshot capture works where implemented

Firefox second:

- sidebar opens from action/command
- content script injection works
- context menu works
- permissions and host access behave as expected
- no reliance on Chrome-only `sidePanel` APIs

## Implementation Phases

### Phase 1: Candidate Core

- Add candidate/session types.
- Extract scanner logic from current resolver.
- Add generic scanner support for DOM, `srcset`, picture/source, background, lazy data attributes, metadata, video, canvas.
- Add candidate hard rejection and scoring.
- Preserve alternates on captured items.
- Keep current import behavior working.

### Phase 2: Sidebar Import Workbench

- Rework sidebar around Pastiche tokens.
- Add command strip.
- Add selected item inspector.
- Add alternates drawer.
- Add editable title, artist, date, source label, original page URL, and tags.
- Keep folder assignment and import button.

### Phase 3: Metadata Payload

- Extend extension import payload to send metadata.
- Map editable fields into existing Library import metadata.
- Store accepted tag chips as metadata tags.
- Keep artist as text for now.
- Preserve raw captured URL and raw page title.

### Phase 4: Source Adapter Pack 1

- Generic Web
- X/Twitter
- Danbooru
- Tumblr
- DeviantArt

### Phase 5: Protected Source Pack

- Pinterest
- Instagram
- referrer-aware fetch
- mutation/lazy refresh
- screenshot fallback labeling
- optional request-observation research spike

### Phase 6: Firefox Runtime Pass

- Audit actual Firefox APIs.
- Fix sidebar/action behavior.
- Verify context menu and command dispatch.
- Keep build scripts passing.

### Phase 7: Polish And Hardening

- Add settings.
- Add fixture pages.
- Add manual QA checklist.
- Improve failure states.
- Ensure generated `extension/dist*` output is handled intentionally.

## Recommended First Implementation Slice

The first implementation slice should be:

- generic candidate scanner
- candidate scoring and hard rejection
- alternates stored on item
- sidebar alternates drawer
- editable title, artist, date, source label, original page URL, and tags
- import metadata passthrough

This slice turns the extension from a URL capture queue into a useful import workbench. Site-specific adapters can then improve accuracy incrementally.

## Approval Checklist

Before implementation starts, confirm:

- Chrome is the first runtime target.
- Firefox is a later compatibility pass.
- First metadata fields are title, artist, date, tags, source label, original page URL, and direct image URL.
- Page-derived tags are optional import chips only.
- Deep Atlas integration is deferred.
- Screenshot capture is a fallback and must be labeled as such.
- The UI should follow Pastiche app tokens rather than Eagle's visual style directly.
