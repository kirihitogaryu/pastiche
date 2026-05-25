# Agent Guidelines — Pastiche Browser Extension
## Capture & Import Feature

These guidelines define implementation constraints, priorities, and decisions for an AI agent working directly in the Pastiche codebase. Read this fully before writing any code related to the extension.

---

## Stack & Targets

- **Manifest V3** — single codebase targeting Chrome and Firefox. Use standard MV3 APIs; polyfill Firefox differences where needed (primarily `browser.*` vs `chrome.*` namespace — use a thin compatibility shim, not two codebases).
- **Sidebar UI** — use `chrome.sidePanel` (Chrome 114+) and `browser.sidebarAction` (Firefox). Do not use a popup. The sidebar must persist while the user interacts with the page.
- **No UI frameworks in content scripts** — content script code must be plain JS/TS with no framework dependencies. The sidebar can use Svelte (matching the main Pastiche app) or plain JS — do not introduce a different framework.
- **TypeScript throughout.**

---

## Hard Architectural Rules

**1. The sidebar is the source of truth for selection state.**
The page's visual indicators (highlight ring, selected badge) are a reflection of sidebar state, never independent state. If the sidebar list and the page indicators ever disagree, the sidebar wins. Sync page indicators from the sidebar via `chrome.tabs.sendMessage`, not the other way around.

**2. Image fetching happens in the background service worker.**
Never fetch image bytes from the content script (memory pressure, lifecycle issues) or from Pastiche's local server (CORS failures on CDN-hosted images). The background service worker fetches, converts to base64, and holds the result until the import fires.

**3. Nothing substantial is injected into the page.**
The content script injects exactly two things: a hover highlight ring (absolutely positioned div, no page style modification) and a selected badge (small overlay on captured elements). No panels, no UI components, no iframes. All interactive UI is in the sidebar.

**4. Capture mode must always be escapable.**
Pressing Escape must always cleanly exit capture mode, restore the cursor, and remove the overlay — in every browser, on every page, including pages with aggressive event listeners. Test this explicitly. A stuck capture mode is a critical bug.

**5. Deduplication before adding to list.**
Before adding any image to the selection list, hash the resolved image URL and check against: (a) items already in the current list, (b) a lightweight index of already-imported Pastiche items fetched from `/api/status`. Surface a "already in library" indicator rather than silently blocking or duplicating.

---

## Capture Modes

Implement all three. They are additive — all feed the same selection list and can be combined in one session.

### Single-Click (Primary)
- Activated by clicking the extension icon.
- Cursor changes to crosshair. An invisible full-page overlay is inserted to intercept mouse events without interfering with the page's own event listeners.
- On `mousemove`: use `document.elementsFromPoint(x, y)` to find the best image target under the cursor. Render the highlight ring around it. Show resolved pixel dimensions in a small tooltip on the ring.
- On `click`: resolve the image, add to sidebar list, exit capture mode, restore cursor and remove overlay.
- On `Escape`: exit capture mode, restore cursor, remove overlay. No item added.

### Page Sweep (Multi-Select)
- Triggered from a button in the sidebar, not the extension icon.
- Scan the full DOM for all image candidates. Apply size threshold (default 300×300px natural dimensions — see Settings).
- Add all candidates to the sidebar list at once. Items already in the list are skipped (deduplicated by URL hash).
- User prunes the list before importing. Do not auto-confirm.

### Region Lasso (Multi-Select)
- Activated by holding Shift when clicking the extension icon.
- User drags a rubber-band selection rectangle (render as an absolutely positioned div with a dashed border).
- On `mouseup`: collect all image elements whose `getBoundingClientRect()` intersects the selection rectangle. Add to sidebar list. Remove the selection rectangle.
- Skips items already in the list.

---

## Image Target Resolution

Given a point or a DOM element, resolve the best image using this priority order. Do not skip steps.

1. `<img>` with `srcset` — parse all `w` descriptors, select the URL with the largest width. Do not roll a custom srcset parser; use the `srcset` npm package or the browser's native resolution via a detached `<img>` element.
2. `<img>` with `src` only — use `src` directly.
3. Element with CSS `background-image` — extract URL from `getComputedStyle(el).backgroundImage`. Strip the `url("...")` wrapper. Handle both single and double quotes.
4. `<video>` — use `video.poster` if present. If no poster, draw `video.currentFrame` to an offscreen canvas and export as PNG via `canvas.toDataURL('image/png')`.
5. `<canvas>` — export via `canvas.toDataURL('image/png')`.

**Always use `naturalWidth` / `naturalHeight`** for dimension checks and metadata. Never use the `width` / `height` HTML attributes or CSS dimensions — these reflect layout size, not image size.

**For `srcset` on Instagram and similar:** these sites layer a transparent `<div>` over images to intercept clicks. `elementsFromPoint` walks the full stack and reaches the `<img>` underneath regardless. The overlay is irrelevant to the content script.

**CDN tokens:** some sites (Instagram, Twitter) serve images with short-lived tokens in the URL. Fetch the image bytes immediately on capture in the background service worker — do not store the URL for later fetching. Tokens will expire.

---

## Selection List — Sidebar UI

Each item in the list renders:
- Thumbnail (small `<img>` — browser has it cached, this is free)
- Inferred name (see Metadata Inference below) — editable inline before import
- Pixel dimensions (`naturalWidth × naturalHeight`) — shown as secondary text
- Source domain — subtle label
- Remove button (✕)

**Ordering:** newest captures at the top.

**On remove:** immediately send a message to the content script to clear the selected badge on that page element. That element becomes re-selectable.

**Empty state:** show a clear prompt explaining the three capture modes. Do not show an empty list with no guidance.

---

## Metadata Inference

At capture time, attempt to extract the following from the page. Attach to each item. All fields are editable in the sidebar before import.

| Field | Source priority |
|---|---|
| `suggested_name` | `img.alt` → nearest `<h1>` or `<h2>` ancestor → `document.title` |
| `source_url` | `window.location.href` — never editable, always preserved |
| `page_title` | `document.title` |
| `captured_at` | ISO 8601 timestamp at moment of capture — never editable, always preserved |
| `natural_width` | `img.naturalWidth` |
| `natural_height` | `img.naturalHeight` |

Do not attempt OCR, AI tagging, or any inference beyond what the DOM provides. Keep this simple.

---

## Folder Assignment

The sidebar includes an "Import to" dropdown above the confirm button. This is not a full folder tree picker.

**Dropdown contents (in order):**
1. Unassigned — always present, always the default
2. Recent destinations — last 5–8 folders imported into, most recent first
3. Create new — inline text input; creates the folder in Pastiche on import

**Storage:** recent destination list is stored in `chrome.storage.local` (extension storage), not in Pastiche. It must be available when Pastiche is offline.

**Per-item override:** each list item shows its destination folder as small secondary text below the filename. Clicking it opens a minimal picker for just that item. The batch dropdown sets the default for all items; per-item overrides are independent. Do not make per-item override prominent — most users will never use it.

---

## Pastiche Connection

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

**Port:** default is Pastiche's dev/prod port. Must be configurable in extension settings — do not hardcode.

**Offline fallback:** if the request fails or times out (2s timeout), fall back to the last state cached in `chrome.storage.local`. Show a clear "Pastiche offline" indicator. Do not block the sidebar from opening.

**Offline queue:** if the user confirms an import while Pastiche is offline, serialize the full payload (base64 image data + metadata + folder assignment) to `chrome.storage.local` as a pending job. Replay automatically when the next `/api/status` call succeeds. Show queued job count in the sidebar.

**Do not poll.** Check on sidebar open only. Add a manual "reconnect" button for when the user starts Pastiche after opening the sidebar.

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
      "image_data": "<base64 string>",
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

`destination_folder_id` is `null` for Unassigned. The endpoint must return per-item success/failure. Partial failures must not block the rest of the batch. Surface failed items in the sidebar with a retry option — do not silently discard them.

---

## Settings Page

Implement a minimal extension settings page (accessible from the sidebar header). Required settings:

| Setting | Default | Notes |
|---|---|---|
| Size threshold | 300px | Minimum natural dimension for page sweep |
| Pastiche port | 5173 | Configurable in case of port conflict |
| Default destination | Unassigned | Can be set to a specific folder |
| Keyboard shortcut | (display only) | Show the registered shortcut; link to browser shortcut settings |

Register a keyboard shortcut for activation via the manifest `commands` API. Do not hardcode `Ctrl+Shift+S` — declare it in the manifest and let the browser/user override it.

---

## Error States

Every error state must be explicitly handled. Do not let errors fail silently.

| Situation | Behaviour |
|---|---|
| Pastiche offline on sidebar open | Show cached state + "Pastiche offline" indicator + manual reconnect button |
| Image fetch failed | Show broken thumbnail in list with error label. Allow remove or retry. Do not block other items. |
| Partial import failure | Show per-item status after import. Failed items remain in list with retry option. |
| Capture mode gets stuck | Escape always clears it. Also clear on sidebar close. |
| No images found (page sweep) | Show explicit empty state message — do not show an empty list. |
| Item already in library | Show "already in library" badge on the list item. Allow import anyway (user may want a duplicate intentionally). |

---

## What Not To Do

- Do not inject any UI panels, modals, or interactive components into the page.
- Do not fetch images from the content script or from Pastiche's local server.
- Do not use `width` / `height` HTML attributes for dimension checks — always `naturalWidth` / `naturalHeight`.
- Do not poll Pastiche — check on open and on user-initiated reconnect only.
- Do not make the import button available directly from the grid card in Pastiche's Explore feature (separate concern, but worth noting here for consistency).
- Do not introduce a UI framework into the content script.
- Do not hardcode the Pastiche port.
- Do not store base64 image data in `chrome.storage.local` beyond what is needed for offline queuing — it fills up fast. Clear successfully imported items from the queue immediately.
- Do not attempt to work around site-specific restrictions (Instagram overlays, right-click blocks) with hacks — the extension's DOM access already bypasses them cleanly without special casing.

---

## File Structure (Suggested)

```
extension/
  manifest.json
  background/
    service-worker.ts      # image fetching, import queue, Pastiche communication
  content/
    index.ts               # injected into pages — capture mode, overlay, indicators
    highlight.ts           # highlight ring + selected badge rendering
    resolver.ts            # image target resolution logic
  sidebar/
    index.html
    sidebar.ts             # or sidebar.svelte
    components/
      SelectionList.ts
      FolderDropdown.ts
      StatusBar.ts
  settings/
    settings.html
    settings.ts
  shared/
    types.ts               # shared TypeScript types
    storage.ts             # chrome.storage wrapper
    messages.ts            # message type constants for sendMessage
```
