# Extension metadata normalization

The capture extension does not execute gallery-dl. It uses the same useful architectural idea:
small, source-specific extractors feed one bounded Pastiche record instead of allowing each site
to define import storage.

## User flow

- Capture, Pick, Drag, and Batch stage an image immediately with lightweight page metadata.
- Drag capture is enabled by default and can be disabled in extension settings without affecting
  the other capture modes. It is always disabled inside the Pastiche web app.
- **Add metadata** is optional. It reads the currently open source page and merges richer fields
  without replacing title, artist, date, or description values the user edited while it ran.
- **Save original** stores image bytes. **Bookmark** stores the remote source without downloading
  bytes. A failed original never blocks another staged item from importing.
- Source tags have separate add and outbound-link actions. Adding one stages a normalized tag for
  Atlas review; it does not navigate away from the capture panel.

## Normalized record

`SourceCaptureRecord` preserves:

- canonical post identity and source post ID;
- title, description, and publication time with provenance;
- creators with role, username, profile URL, source ID, confidence, and evidence;
- ordered media with original/preview URLs, dimensions, MIME type, alt text, referrer, and
  provenance;
- source-native tags, sensitivity, and rights.

The complete record is stored in imported raw metadata. Pastiche's ordinary title, artist,
artist-profile, date, tag, annotation, and source fields remain the searchable normalization layer.

## Adapter tiers

- First tier: Pixiv, Toyhouse, and Fur Affinity.
- Second tier: Instagram, Tumblr, and X.
- Best-effort third tier: Lofter, VK, and Weibo.
- Unknown or changed pages use bounded generic DOM and JSON-LD extraction.

Adapters use only the live page DOM and embedded page data already available to the signed-in user.
They do not call private APIs, bypass access controls, or turn extractor failure into an import
failure.

## Reliability boundaries

- The service worker owns the durable capture tray.
- Asynchronous fetches are scoped to item ID, capture time, and current URL so stale work cannot
  restore a removed item or overwrite a newly selected original.
- One page-local capture panel is the only active surface in Chrome and Firefox. Browser-native
  sidebars are intentionally not registered because an active page drag cannot cross that browser
  chrome boundary reliably.
- Page-drag handoffs are preferred over browser thumbnail flavors; external files and raw URLs are
  fallbacks.
- Metadata extraction is bounded by script count, JSON size, traversal depth, media count, creator
  count, and source-tag count.
