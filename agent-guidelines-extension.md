# Agent Guidelines — Pastiche Browser Extension
## Capture, Import & Visual Design

These guidelines define implementation constraints, priorities, decisions, and visual design requirements for an AI agent working directly in the Pastiche codebase. Read this fully before writing any code related to the extension.

---

## Stack & Targets

- **Manifest V3** — single codebase targeting Chrome and Firefox. Use standard MV3 APIs; polyfill Firefox differences where needed (primarily `browser.*` vs `chrome.*` namespace — use a thin compatibility shim, not two codebases).
- **Sidebar UI** — use `chrome.sidePanel` (Chrome 114+) and `browser.sidebarAction` (Firefox). Do not use a popup. The sidebar must persist while the user interacts with the page.
- **No UI frameworks in content scripts** — content script code must be plain JS/TS with no framework dependencies. The sidebar uses Svelte (matching the main Pastiche app). Do not introduce a different framework.
- **TypeScript throughout.**

---

## Pastiche Connection Architecture

Pastiche is currently a SvelteKit app with no desktop wrapper. The extension communicates with it via HTTP to localhost. This section defines how that works now and how it changes if Tauri is added later.

### Current: SvelteKit Server Routes

The extension talks to two SvelteKit server routes:

```
GET  http://localhost:{port}/api/status
POST http://localhost:{port}/api/import
```

These must be implemented as SvelteKit `+server.ts` files using the Node adapter (not static-adapter). SSR must be enabled for these routes. The dev server (`vite dev`) serves them during development; a Node server process serves them in production until Tauri migration.

### CORS

The extension's origin is `chrome-extension://{extensionId}` — a non-standard origin that requires explicit CORS allowance. Both server routes must return:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Handle `OPTIONS` preflight requests on the import route. Without this, every import will silently fail with a CORS error.

### Future: Tauri Migration

When Pastiche migrates to Tauri, the SvelteKit frontend moves to SPA mode (static-adapter, SSR disabled). The import and status endpoints move to a lightweight Rust HTTP server embedded in the Tauri backend (axum or warp). The extension does not change — it still talks to `localhost:{port}`. Only the port and the server implementation change on the Pastiche side. The extension must never assume it is talking to a SvelteKit server specifically.

### Port

Default port is `5173` (Vite dev). Must be configurable in extension settings. Do not hardcode. Store in `chrome.storage.local` and read on every request.

### Status Endpoint

On sidebar open, make one request:

```
GET http://localhost:{port}/api/status
```

Expected response:
```json
{
  "connected": true,
  "unassigned_count": 47,
  "recent_folders": [
    { "id": "abc123", "name": "Character refs — Mira", "last_used": "2026-05-23T..." }
  ]
}
```

2 second timeout. On failure, fall back to last state cached in `chrome.storage.local`. Show "Pastiche offline" indicator. Do not block the sidebar from opening. Do not poll — check on open and on manual reconnect only.

---

## Hard Architectural Rules

**1. The sidebar is the source of truth for selection state.**
The page's visual indicators (highlight ring, selected badge) are a reflection of sidebar state, never independent state. If they disagree, the sidebar wins. Sync page indicators from the sidebar via `chrome.tabs.sendMessage`.

**2. Image fetching happens in the background service worker.**
Never fetch image bytes from the content script (memory pressure, lifecycle issues) or from Pastiche's local server (CORS failures on CDN images). The background service worker fetches, converts to base64, and holds the result until import fires.

**3. Nothing substantial is injected into the page.**
The content script injects exactly two things: a hover highlight ring and a selected badge. No panels, no UI components, no iframes. All interactive UI is in the sidebar.

**4. Capture mode must always be escapable.**
Pressing Escape must always cleanly exit capture mode, restore the cursor, and remove the overlay — on every page, including pages with aggressive event listeners. A stuck capture mode is a critical bug. Also clear on sidebar close.

**5. Deduplication before adding to list.**
Before adding any image to the selection list, hash the resolved image URL and check against: (a) items already in the current list, (b) the imported item index from `/api/status`. Surface "already in library" rather than silently blocking or duplicating.

---

## Storage Mode

Every captured image has a `storageMode` that determines whether Pastiche downloads the bytes or stores a URL reference. This is determined at capture time by checking the image's source domain against a policy table.

```typescript
type StorageMode = "download" | "url_reference" | "lazy_download"

type StoragePolicy = {
  mode: StorageMode
  reason: string   // shown in sidebar UI as a label
}
```

### Source Policy Table

Check the image URL's hostname against this table. Match on suffix (e.g. `cloudfront.net` matches `d32dm0rphc51dk.cloudfront.net`).

```typescript
const SOURCE_POLICY: Record<string, StoragePolicy> = {
  // Permanent institutional URLs — reference safe
  "metmuseum.org":          { mode: "url_reference", reason: "Met permanent URL" },
  "artic.edu":              { mode: "url_reference", reason: "ARTIC IIIF permanent" },
  "rijksmuseum.nl":         { mode: "url_reference", reason: "Rijksmuseum permanent" },
  "clevelandart.org":       { mode: "url_reference", reason: "CMA permanent URL" },
  "commons.wikimedia.org":  { mode: "url_reference", reason: "Wikimedia permanent" },
  "upload.wikimedia.org":   { mode: "url_reference", reason: "Wikimedia permanent" },
  "cloudfront.net":         { mode: "url_reference", reason: "Stable CDN" },  // Artsy + others

  // Ephemeral — always download immediately
  "instagram.com":          { mode: "download", reason: "Token-authenticated" },
  "cdninstagram.com":       { mode: "download", reason: "Token-authenticated" },
  "pbs.twimg.com":          { mode: "download", reason: "Ephemeral" },
  "video.twimg.com":        { mode: "download", reason: "Ephemeral" },
  "toyhou.se":              { mode: "download", reason: "May be taken down" },
  "tumblr.com":             { mode: "download", reason: "May be taken down" },
  "media.tumblr.com":       { mode: "download", reason: "May be taken down" },
  "cara.app":               { mode: "download", reason: "May be taken down" },
  "wikiart.org":            { mode: "download", reason: "Unstable CDN URLs" },

  // Unknown sources — lazy download (reference first, download in background)
  // DEFAULT for anything not in the above lists
}
```

**Default for unknown domains:** `lazy_download` — store the URL reference immediately for fast import, queue a background download job to obtain a local copy within the hour.

### Artsy CDN Upsizing

When the resolved image URL matches `d32dm0rphc51dk.cloudfront.net` (Artsy's Gemini CDN), upsize it before storing:

```typescript
function resolveArtsyImage(url: string): string {
  if (url.includes("d32dm0rphc51dk.cloudfront.net")) {
    return url.replace(
      /\/(square|small|medium|large|normalized|tall)\.jpg$/,
      "/larger.jpg"
    )
  }
  return url
}
```

Apply this in the image resolver after the DOM target is identified, before the URL is stored or fetched.

### UI Display of Storage Mode

The sidebar list item shows the storage mode as a small label beneath the source domain:
- `url_reference` → "Stored as reference link"
- `download` → "Downloading" (during fetch) / "Downloaded" (complete)
- `lazy_download` → "Reference + background copy"

For `url_reference` items from commercial gallery or listing sites (Artsy, Saatchi, Christie's, Sotheby's — detectable by domain), also show: "Artwork may be sold or removed." Not a warning, just an honest label.

The user can override the storage mode per item before import. A small toggle in the item row ("Reference / Download") allows this. The batch default from the source policy table is pre-filled; the user can always force a download.

### Storing URL References

URL reference items are sent to the import endpoint with `image_data: null` and `source_image_url` populated instead:

```json
{
  "storage_mode": "url_reference",
  "image_data": null,
  "source_image_url": "https://d32dm0rphc51dk.cloudfront.net/{hash}/larger.jpg",
  ...
}
```

Pastiche stores the URL and renders it directly via `<img src>`. No bytes are stored on disk for these items until the user explicitly requests a download or the lazy_download background job completes.

---

## Capture Modes

Implement all three. They are additive — all feed the same selection list and can be combined in one session.

### Single-Click (Primary)
- Activated by clicking the extension icon or keyboard shortcut.
- Cursor changes to crosshair. An invisible full-page overlay intercepts mouse events without interfering with the page's own event listeners.
- On `mousemove`: use `document.elementsFromPoint(x, y)` to find the best image target under the cursor. Render the highlight ring around it. Show resolved pixel dimensions in a small tooltip on the ring.
- On `click`: resolve the image, determine storage mode, add to sidebar list, exit capture mode, restore cursor, remove overlay.
- On `Escape`: exit capture mode cleanly. No item added.

### Page Sweep (Multi-Select)
- Triggered from a button in the sidebar, not the extension icon.
- Scan the full DOM for all image candidates. Apply size threshold (default 300×300px natural dimensions).
- Add all candidates to the sidebar list at once. Deduplicate by URL hash.
- User prunes the list before importing. Do not auto-confirm.

### Region Lasso (Multi-Select)
- Activated by holding Shift when clicking the extension icon.
- User drags a rubber-band selection rectangle (absolutely positioned div with dashed border).
- On `mouseup`: collect all image elements whose `getBoundingClientRect()` intersects the selection. Add to sidebar list. Remove the rectangle.
- Skips items already in the list.

---

## Image Target Resolution

Given a point or DOM element, resolve the best image in this priority order. Do not skip steps.

1. `<img>` with `srcset` — parse all `w` descriptors, select the largest width URL. Use the `srcset` npm package or browser-native resolution. Do not write a custom parser.
2. `<img>` with `src` only — use `src` directly.
3. Element with CSS `background-image` — extract from `getComputedStyle(el).backgroundImage`. Strip `url("...")` wrapper. Handle both quote styles.
4. `<video>` — use `video.poster` if present; otherwise draw `video.currentFrame` to offscreen canvas and export as PNG.
5. `<canvas>` — export via `canvas.toDataURL('image/png')`.

**Always use `naturalWidth` / `naturalHeight`** — never `width`/`height` attributes or CSS dimensions.

**Instagram and overlay sites:** `elementsFromPoint` walks the full stack and reaches the `<img>` underneath transparent overlay divs. No special casing needed.

**CDN token expiry:** for `download` mode images, fetch bytes immediately on capture in the background service worker. Do not store the URL for later fetching — tokens expire.

**After resolution, apply `resolveArtsyImage()` to upsize Artsy CDN URLs before any further processing.**

---

## Selection List — Sidebar UI

Each item in the list renders:
- **Thumbnail** — small `<img>` (browser has it cached, free). For `url_reference` items, render directly from source URL. For `download` items, show a loading spinner until the background fetch resolves, then the fetched thumbnail.
- **Inferred name** — editable inline before import
- **Pixel dimensions** — `naturalWidth × naturalHeight` as secondary text. Acts as a passive quality filter.
- **Source domain** — subtle label
- **Storage mode label** — "Reference link" / "Downloading..." / "Downloaded" (see Storage Mode above)
- **Remove button (✕)** — removes from list, clears selected badge on the page element, makes that element re-selectable
- **Per-item folder override** — small folder name below the filename, tappable (see Folder Assignment)

**Ordering:** newest captures at the top.

**Empty state:** show a clear prompt explaining the three capture modes and the keyboard shortcut. Do not show an empty list with no guidance.

---

## Metadata Inference

At capture time, extract the following from the page DOM. Attach to each item. All fields except `source_url` and `captured_at` are editable in the sidebar before import.

| Field | Source priority |
|---|---|
| `suggested_name` | `img.alt` → nearest `<h1>` or `<h2>` ancestor → `document.title` |
| `source_url` | `window.location.href` — never editable, always preserved |
| `page_title` | `document.title` |
| `captured_at` | ISO 8601 timestamp at capture — never editable, always preserved |
| `natural_width` | `img.naturalWidth` |
| `natural_height` | `img.naturalHeight` |
| `storage_mode` | Determined by source policy table |

Do not attempt OCR, AI tagging, or any inference beyond what the DOM provides.

---

## Folder Assignment

The sidebar includes an "Import to" dropdown above the confirm button.

**Dropdown contents (in order):**
1. **Unassigned** — always present, always the default
2. **Recent destinations** — last 5–8 folders, most recent first
3. **Create new** — inline text input; creates the folder in Pastiche on import

**Storage:** recent destination list stored in `chrome.storage.local` — must be available when Pastiche is offline.

**Per-item override:** each list item shows its assigned destination as small text below the filename. Clicking it opens a minimal per-item picker. The batch dropdown sets the default; per-item overrides are independent. Do not make this prominent — most users will never need it.

**Offline queue:** if Pastiche is offline when the user confirms import, serialize the full payload to `chrome.storage.local` as a pending job. Replay automatically when the next `/api/status` call succeeds. Show queued job count in the sidebar. Clear successfully imported items from the queue immediately — base64 data is large and will fill storage fast.

**Unassigned inbox:** the status endpoint returns `unassigned_count`. Show this count in the sidebar as a subtle nudge ("47 unassigned") when it is non-zero. This encourages the user to sort their inbox without being intrusive.

---

## Import Payload

```
POST http://localhost:{port}/api/import
Content-Type: application/json
```

```json
{
  "destination_folder_id": "abc123",
  "items": [
    {
      "filename": "Mira character ref",
      "storage_mode": "download",
      "image_data": "<base64 string>",
      "source_image_url": null,
      "mime_type": "image/jpeg",
      "natural_width": 1200,
      "natural_height": 1800,
      "source_url": "https://toyhou.se/...",
      "page_title": "Mira | Toyhouse",
      "alt_text": "Full-body reference sheet",
      "captured_at": "2026-05-23T14:32:00Z"
    }
  ]
}
```

For `url_reference` items: `image_data` is `null`, `source_image_url` is populated.
For `download` items: `image_data` is the base64 blob, `source_image_url` is the original URL for provenance.
`destination_folder_id` is `null` for Unassigned.

The endpoint returns per-item success/failure. Partial failures must not block the batch. Surface failed items in the sidebar with a retry option.

---

## Visual Design

The extension sidebar is a companion to the Pastiche desktop app. Its visual design must be consistent with Pastiche's design language. Read `DESIGN.md` in the Pastiche repo before implementing any sidebar UI.

### General Principles
- The sidebar is a tool, not a webpage. It should feel compact, calm, and functional — not like a modal or a settings panel.
- No decorative elements. Every visible element should either convey information or enable an action.
- The visual weight hierarchy is: thumbnail > name > metadata. Metadata (dimensions, source, storage mode) should recede visually.
- The sidebar should never feel cluttered. If it starts to feel cluttered, something is wrong with the information hierarchy, not the spacing.

### Layout

The sidebar has four zones from top to bottom:

**1. Status bar (top, compact)**
- Pastiche connection indicator — small dot, green/amber/red + label ("Connected" / "Offline — 2 queued")
- Settings gear icon — right-aligned, opens settings page
- Unassigned count badge — shown when non-zero, subtle

**2. Selection list (scrollable, fills available space)**
- Each item is a horizontal row: thumbnail left, metadata right, remove button far right
- Thumbnail: fixed size, square crop with object-fit: cover
- Rows are compact but not cramped — enough breathing room to read the name without scrolling
- Selected badge ring on page elements uses Pastiche's accent color

**3. Folder assignment (above import button)**
- "Import to" label + dropdown control
- Single line, compact

**4. Import button (bottom, fixed)**
- Full width
- Shows item count: "Import 4 images"
- Disabled and greyed when list is empty
- Shows loading state during import

### Highlight Ring (On-Page)

The hover highlight ring injected into pages must be:
- A clean outline only — no fill, no shadow, no backdrop. The image must remain fully visible.
- Accent color from Pastiche's design system (read from DESIGN.md)
- 2px border, 4px border-radius
- A small tooltip below the ring showing `{width} × {height}px` — positioned so it does not obscure the image
- The ring should feel like a selection tool, not an intrusion. It should appear and disappear cleanly with no animation lag.

### Selected Badge (On-Page)

Once an image is added to the list, its on-page element gets a selected badge:
- Small checkmark in a filled circle, positioned in the top-right corner of the image element
- Accent color fill, white checkmark
- Does not obscure the image content — keep it small (20×20px max)
- Disappears immediately when the item is removed from the sidebar list

### Capture Mode Overlay

The invisible full-page overlay during single-click capture mode:
- Truly invisible — `background: transparent`, `pointer-events: all`
- The cursor changes to crosshair. This is the only visible indication capture mode is active.
- Do not add a banner, modal, or any other visible indication. The crosshair cursor is sufficient.
- The highlight ring appearing on hover is the confirmation that the mode is working.

### Storage Mode Labels

Storage mode labels in the sidebar list are secondary metadata — they should be the least visually prominent thing on each row. Use a muted text color, small font size. They inform without demanding attention.

Commercial listing site warning ("artwork may be sold or removed") uses the same muted style — not a warning color, not an icon. It is informational, not alarming.

---

## Settings Page

Accessible from the status bar settings icon. Minimal — do not over-engineer.

| Setting | Default | Notes |
|---|---|---|
| Size threshold | 300px | Minimum natural dimension for page sweep |
| Pastiche port | 5173 | Configurable for port conflicts |
| Default destination | Unassigned | Pre-fills the folder dropdown |
| Keyboard shortcut | (display only) | Shows registered shortcut; links to browser shortcut settings |

Register keyboard shortcut via manifest `commands` API. Do not hardcode the key combination — declare it in the manifest and let the browser/user override.

---

## Error States

Every error state must be explicitly handled. Do not fail silently.

| Situation | Behaviour |
|---|---|
| Pastiche offline on open | Cached state + "Pastiche offline" indicator + reconnect button |
| Image fetch failed | Broken thumbnail with error label. Allow remove or retry. Does not block other items. |
| Partial import failure | Per-item status shown after import. Failed items remain with retry option. |
| Capture mode stuck | Escape clears it. Also clear on sidebar close. |
| No images found (sweep) | Explicit empty state message — not a blank list. |
| Already in library | "Already in library" badge. Allow import anyway (user may want a duplicate). |
| Storage full (extension) | If `chrome.storage.local` is full, warn before accepting new offline queue items. Do not silently drop them. |
| URL reference broken | If a `url_reference` item's URL is unreachable at import time, surface as a warning — not a failure. The URL is stored as-is; the user decides whether to force a download. |

---

## What Not To Do

- Do not inject any UI panels, modals, or interactive components into the page.
- Do not fetch images from the content script or from Pastiche's local server.
- Do not use `width` / `height` HTML attributes — always `naturalWidth` / `naturalHeight`.
- Do not poll Pastiche — check on open and on manual reconnect only.
- Do not introduce a UI framework into the content script.
- Do not hardcode the Pastiche port.
- Do not store base64 image data in `chrome.storage.local` beyond offline queuing — clear it immediately after successful import.
- Do not attempt to work around site-specific restrictions (Instagram overlays, right-click blocks) with hacks — DOM access already bypasses them cleanly.
- Do not add a fill or backdrop to the highlight ring — the image must remain visible.
- Do not add visual indicators of capture mode other than the crosshair cursor.
- Do not show storage mode labels in warning colors — they are informational, not alarming.
- Do not forget CORS headers on the SvelteKit API routes — without them, every import silently fails.
- Do not assume the Pastiche server is SvelteKit — the extension talks to an HTTP endpoint, nothing more.
- Do not apply the Artsy CDN upsizing regex to non-Artsy CloudFront URLs — check for the specific subdomain `d32dm0rphc51dk.cloudfront.net`.

---

## File Structure (Suggested)

```
extension/
  manifest.json
  background/
    service-worker.ts       # image fetching, import queue, Pastiche communication
    storage-policy.ts       # source policy table + resolveArtsyImage()
  content/
    index.ts                # injected into pages — capture mode, overlay, indicators
    highlight.ts            # highlight ring + selected badge rendering
    resolver.ts             # image target resolution logic
  sidebar/
    index.html
    App.svelte              # root sidebar component
    components/
      SelectionList.svelte
      SelectionItem.svelte
      FolderDropdown.svelte
      StatusBar.svelte
      StorageModeLabel.svelte
      EmptyState.svelte
  settings/
    settings.html
    Settings.svelte
  shared/
    types.ts                # shared TypeScript types
    storage.ts              # chrome.storage wrapper
    messages.ts             # message type constants for sendMessage
    constants.ts            # default port, size threshold, etc.
```
