# 2026-07-06 AI Import + Extension Handoff

## Branch And State

- Branch: `codex/atlas-search-v1`
- Remote: pushed to `origin/codex/atlas-search-v1`
- Worktree at handoff: clean when this document was created
- Relevant recent commits:
  - `9c43e03 docs: plan novelai import metadata`
  - `ba4a13f docs: plan novelai metadata implementation`
  - `23881a3 fix: suppress cleanup content script errors`
  - `29fdd78 feat: parse novelai image metadata`
  - `f35653e feat: populate ai generation metadata`
  - `b9130b7 feat: show ai generation metadata in atlas`
  - `4a57a5e feat: stage sidebar drag and drop imports`
  - `0705c8e fix: handle browser image drag payloads`
  - `d17fa6f feat: add ai prompt tag suggestions`

## What Was Built

### Extension Import Reliability

The extension sidebar import flow was made substantially more functional:

- Suppressed false post-import cleanup errors like `Could not establish connection. Receiving end does not exist.`
- Kept real capture activation errors visible.
- Added sidebar drag/drop staging for image files and image URLs.
- Added support for native browser image drag payloads:
  - `text/uri-list`
  - `text/html` image `src`
  - protocol-relative image URLs such as `//cdn.example.com/work.webp`
  - Chromium `DownloadURL`
- Added best-effort sidebar opening during page image drag:
  - Chrome: `sidePanel.open`
  - Firefox: `sidebarAction.open`

Important files:

- `extension/sidebar/capture-maintenance.ts`
- `extension/sidebar/drop-import.ts`
- `extension/background/sidebar-panel.ts`
- `extension/background/service-worker.ts`
- `extension/content/index.ts`
- `extension/shared/messages.ts`
- `extension/shared/types.ts`
- `extension/shared/browser.ts`
- `extension/sidebar/App.svelte`

Tests:

- `extension/sidebar/capture-maintenance.spec.ts`
- `extension/sidebar/drop-import.spec.ts`
- `extension/background/sidebar-panel.spec.ts`

### NovelAI Metadata Parsing

NovelAI metadata is now read from PNG text chunks and mapped into the library read model.

Implemented:

- Generic PNG text chunk extraction, including `tEXt`, `zTXt`, and `iTXt`.
- NovelAI detection from PNG fields like `Software`, `Source`, `Description`, and JSON `Comment`.
- Parsing of:
  - positive prompt
  - negative prompt
  - character prompts
  - seed
  - sampler
  - steps
  - cfg scale
  - model/source string
  - raw NovelAI parameters
- Weighted NovelAI prompt syntax is normalized into usable prompt tokens.
- `artist:` prompt tokens are classified as `artist_style_reference`, not creator attribution.
- Embedded metadata is preserved under `metadata.rawMetadata.embeddedImageMetadata`.
- New downloaded imports persist embedded metadata during import.
- Older local originals can still produce `record.generation` through fallback parsing from `.pastiche/originals`.

Important files:

- `src/lib/server/library/embeddedImageMetadata.ts`
- `src/lib/server/library/novelAiGeneration.ts`
- `src/lib/library/types.ts`
- `src/lib/server/library/import.ts`
- `src/lib/server/library/read.ts`

Tests:

- `src/lib/server/library/embeddedImageMetadata.spec.ts`
- `src/lib/server/library/novelAiGeneration.spec.ts`
- `src/lib/server/library/read.spec.ts`

### Atlas AI Metadata UI

The Atlas inspect panel no longer shows a placeholder for AI metadata. It now renders real parsed generation metadata.

Visible in Atlas inspect:

- Generator/provider summary
- Model/settings chips
- Prompt
- Character prompts
- Negative prompt
- Artist style references
- AI suggested tags
- Raw payload collapsible section

Important files:

- `src/lib/components/atlas/AtlasAiMetadataSection.svelte`
- `src/lib/components/atlas/AtlasAssetInspect.svelte`

### AI Prompt Tag Suggestions

NovelAI positive prompt tags and character-positive prompt tags are now actionable suggestions in Atlas inspect.

Behavior:

- Positive and character-positive prompt tokens become `AI Suggested Tags`.
- Negative prompt tokens are excluded.
- `artist:` prompt tokens are excluded from normal tag suggestions.
- Clicking a pill adds that tag as an approved Atlas concept with `evidence: 'prompted'`.
- `Add all` adds every remaining AI suggested tag.
- Accepted concepts disappear from the suggestion list.
- Prompt syntax is stripped before display:
  - Example: `1.3::1boy::` becomes `1boy`.
- Prompt labels are normalized to Atlas-style slugs:
  - `simple background` -> `simple_background`
  - `luli_(crocowolf333)` -> `luli_crocowolf333`

Important files:

- `src/lib/atlas/aiPromptSuggestions.ts`
- `src/lib/components/atlas/AtlasAiMetadataSection.svelte`
- `src/lib/components/atlas/AtlasAssetInspect.svelte`

Tests:

- `src/lib/atlas/aiPromptSuggestions.spec.ts`

### Artist Style References

AI prompt `artist:` tokens are treated as style references, not as work authorship.

Behavior:

- Parsed `artist:nightcrow` becomes an artist style reference suggestion.
- The accepted Atlas concept slug is currently `artist_style_nightcrow`.
- Users can also manually assign an artist style in the AI metadata section via `Assign Artist Style`.
- Manual artist style assignments use the same `artist_style_<slug>` convention and `evidence: 'prompted'`.

This is intentionally lightweight. It gives us real searchable Atlas assignments now without prematurely designing the final artist-style ontology.

## What Was Verified

Commands run successfully during the session:

```bash
npm run test:unit -- --run
npm run test:unit -- --run extension/background/sidebar-panel.spec.ts extension/sidebar/drop-import.spec.ts
npm run test:unit -- --run src/lib/atlas/aiPromptSuggestions.spec.ts src/lib/server/library/novelAiGeneration.spec.ts
npm run check
npm run build:extension
npm run build
```

Notes:

- `npm run build` emits the existing large chunk warning; it is not a failure.
- `npm run build:extension` writes `extension/dist`, but the tracked source files are the important artifacts.
- If testing the browser extension manually, rebuild and reload the unpacked extension.

## Known Limitations / Next Work

### Metadata

- NovelAI "stealth PNG info" encoded in alpha-channel pixels is not implemented.
- Current metadata extraction focuses on PNG text chunks.
- Broader EXIF/IPTC/XMP preservation and display is still future work.

### AI Tag Translation Layer

The current AI prompt tag normalization is intentionally simple. It strips syntax and normalizes labels to slugs, but does not yet translate prompt/source tags into Pastiche's richer ontology.

Future layer should handle mappings like:

- `blue_bow` -> a canonical object/tag plus classifier-style structure, e.g. `bow.color:blue`
- Danbooru source tags -> Atlas concepts/classifiers/entities
- NovelAI tags -> Atlas concepts/classifiers/entities
- artist style references -> final artist-style ontology

This should likely be shared between AI prompt suggestions and page/source tag ingestion rather than being NovelAI-specific.

### Artist Styles

Current artist style references are stored as stub Atlas concepts like `artist_style_nightcrow`.

Future decisions needed:

- Whether artist styles should remain concepts or become a distinct entity/relationship type.
- Whether an artist page should list both authored works and AI works that reference that artist's style.
- How to distinguish "work by artist" from "AI image in artist style" in search results and profile pages.

### Extension Drag-To-Open

The content script now sends a best-effort request to open the sidebar during image drag. Browser support/user-gesture rules vary:

- Chrome should use `sidePanel.open`.
- Firefox should use `sidebarAction.open`.
- If the browser refuses programmatic opening, dropping still works when the sidebar is already open.

Manual testing after extension reload is still recommended on both Chrome and Firefox.

### UX

The AI suggestions are currently inside the `AI Generation Metadata` collapsible section in Atlas inspect. They do not appear in the original extension import sidebar yet.

Likely next UX improvements:

- Promote accepted AI suggestions visually into the normal Atlas concept list immediately.
- Add clearer "added" feedback after clicking a pill.
- Decide whether AI suggestions should also appear during import before the asset reaches Atlas inspect.

## Useful Entry Points For Next Agent

- Spec: `docs/superpowers/specs/2026-07-01-novelai-import-metadata-design.md`
- Plan: `docs/superpowers/plans/2026-07-01-novelai-import-metadata.md`
- Plan: `docs/superpowers/plans/2026-07-02-ai-prompt-tag-suggestions.md`
- AI metadata UI: `src/lib/components/atlas/AtlasAiMetadataSection.svelte`
- AI suggestion helper: `src/lib/atlas/aiPromptSuggestions.ts`
- NovelAI parser: `src/lib/server/library/novelAiGeneration.ts`
- PNG metadata parser: `src/lib/server/library/embeddedImageMetadata.ts`
- Extension sidebar: `extension/sidebar/App.svelte`
- Extension drag/drop helper: `extension/sidebar/drop-import.ts`
- Extension service worker: `extension/background/service-worker.ts`
