# NovelAI Import Metadata And Drag QOL Design

## Status

Draft for user review.

This document scopes the first implementation pass for AI image import quality-of-life and NovelAI metadata preservation. It builds on `2026-06-05-ai-generation-metadata-design.md`, narrowing the work to the highest-value path now visible in the app: import a NovelAI image, preserve the original metadata, parse the useful prompt/settings fields, and make them visible in Atlas.

## Product Need

NovelAI images are unusually valuable to preserve accurately because they can carry enough embedded metadata to recreate or understand the generation: prompt, undesired content, character prompts, seed, sampler, steps, scale, model/source, and raw generator payloads. Pastiche should keep that information while still maintaining its own library and Atlas metadata.

Prompt metadata is provenance and organization context, not visual truth. Prompt-derived values should become suggestions or searchable generation context, not automatically approved visual tags.

## Current Findings

The current Pastiche import path already preserves normal downloaded image bytes. A locally imported NovelAI PNG contains readable PNG text chunks:

- `Software: NovelAI`
- `Source: NovelAI Diffusion V4.5 ...`
- `Title: AI generated image`
- `Description`: positive/base prompt text
- `Generation_time`
- `Comment`: a large JSON payload containing `prompt`, `uc`, `seed`, `steps`, `scale`, `cfg_rescale`, `sampler`, `noise_schedule`, `v4_prompt`, `v4_negative_prompt`, character captions, reference-image data, and `signed_hash`

The app already has a `LibraryAssetRecord.generation` field, but library reads currently set it to `null`, so Atlas Inspect shows a placeholder.

NovelAI’s own metadata scripts also document alpha-channel “stealth pnginfo” metadata. That layer is not part of the first implementation pass, but the parser boundaries should leave room for it.

## Goals

1. Make drag/drop import feel like Eagle-style capture:
   - Dragging or dropping an image into the extension sidebar should stage it for import.
   - Dropped local files should import as downloaded local originals.
   - Dropped image URLs should go through the service worker enrichment/fetch path.
   - Content-script page-image dragging should best-effort open or focus the sidebar and stage the dragged image when browser APIs allow it.

2. Fix noisy successful-import errors:
   - “Could not establish connection. Receiving end does not exist.” should not appear when import succeeds.
   - Post-import cleanup messages to content scripts should be best-effort maintenance, not user-visible capture failures.

3. Preserve embedded image metadata:
   - Keep original downloaded image bytes unchanged.
   - Parse normal PNG text chunks for downloaded PNGs during import/read.
   - Store parsed embedded metadata under `rawMetadata.embeddedImageMetadata`.
   - Keep raw payloads intact, including large NovelAI `Comment` JSON.

4. Populate `record.generation`:
   - Map NovelAI PNG metadata to Pastiche’s existing generation record.
   - Show provider/model/settings/prompts in Atlas Inspect.

5. Preserve prompt tags for future tagging:
   - Positive prompt tokens and character prompt tokens are the highest-value outputs.
   - Negative prompt tokens are useful, but visually secondary in the UI.
   - Prompt tokens should be kept as prompt-derived suggestions, not approved visual tags.

## Non-Goals

- No AI agent tag approval workflow in this pass.
- No automatic conversion from prompt tokens to approved Atlas tags.
- No full prompt search grammar in this pass.
- No Stable Diffusion/ComfyUI support beyond parser interfaces that do not block it.
- No NovelAI alpha-channel stealth metadata extraction in this pass.
- No claim that `artist:` prompt tokens mean the image was made by that artist.

## Data Model

Use the existing `LibraryAssetRecord.generation` shape as the read model:

- `provider`: `novelai` for recognized NovelAI metadata.
- `prompt`: primary positive prompt, preferring `v4_prompt.caption.base_caption`, falling back to `prompt` or `Description`.
- `negativePrompt`: primary undesired content, preferring `v4_negative_prompt.caption.base_caption`, falling back to `uc`.
- `model`: text from PNG `Source`, e.g. `NovelAI Diffusion V4.5 ...`.
- `seed`: `seed`.
- `sampler`: `sampler`.
- `steps`: `steps`.
- `cfgScale`: `scale`.
- `rawParameters`: complete parsed NovelAI JSON plus PNG text fields.
- `promptTagSuggestions`: normalized positive and character prompt tokens suitable for later review.

Extend the internal generation parser result, if needed, to keep richer structured prompt rows:

- token text
- normalized slug
- prompt scope: positive, character positive, negative, character negative
- role: tag, artist style reference, species/taxonomy, quality, technical, unknown
- weight, when NovelAI weighted syntax provides it
- raw segment and order

If the current public `AiGenerationMetadata` type is too small for this, add optional fields instead of replacing it wholesale.

## Artist Prompt Semantics

NovelAI `artist:` prompt tokens are style references. They must not populate creator fields, artist entities as authors, or “drawn by” claims.

Example:

```txt
artist:nightcrow
```

Should become:

- prompt role: `artist_style_reference`
- evidence: `prompted`
- status: suggestion/search context
- not creator
- not an artist profile attribution

Later, these can power a separate “style reference” suggestion surface and possibly a different Atlas relationship, but they should not mingle with true imported artist attribution.

## Parser Architecture

Create parser layers with small, testable boundaries:

1. `embeddedImageMetadata`
   - Reads image bytes or stored local original path.
   - Extracts generic PNG text chunks.
   - Returns raw chunk fields without interpreting generator-specific meaning.

2. `novelAiGeneration`
   - Detects NovelAI via `Software`, `Source`, or parseable NovelAI `Comment` JSON.
   - Parses settings and prompt structures.
   - Extracts prompt token suggestions.

3. `generationMetadata`
   - Chooses the best parser result.
   - Maps to `LibraryAssetRecord.generation`.

This makes alpha-channel NovelAI extraction a future additional reader, not a rewrite.

## Import And Storage Flow

Downloaded imports already write originals to `originals/<asset-id>.<ext>`. During import, parse embedded metadata from the incoming image bytes or from the just-written original file. Persist the parsed result in `metadata_json.rawMetadata.embeddedImageMetadata`.

For existing downloaded local PNGs, library reads should also be able to derive generation data from the original file if `metadata_json` lacks parsed embedded metadata. This lets already-imported NovelAI images show metadata after the feature lands without reimporting.

Remote `url_reference` imports should not claim embedded metadata unless bytes are actually available. If a user wants metadata preservation for NovelAI/blob/CDN images, storage mode should be `download`.

NovelAI pages and `blob:https://novelai.net/...` imports should prefer `download` storage because the blob/image data is the authoritative metadata carrier.

## Atlas Inspect UI

Replace the placeholder `AtlasAiMetadataSection` with real data from `asset.record.generation`.

Collapsed summary:

- provider
- model/source, if known
- seed
- sampler/steps/scale
- prompt token count

Expanded layout:

- Positive prompt first and most visually prominent.
- Character prompts next, when present.
- Suggested prompt tags/chips from positive and character prompts.
- Negative prompt in a separate, visually secondary section.
- Settings table: seed, sampler, steps, scale, cfg rescale, size, noise schedule, generation time.
- Raw payload collapsible section for the complete JSON/text metadata.

The UI should label prompt-derived tags as prompted/suggested context. They are not approved visual tags.

## Extension Drag And Drop

Sidebar drop handling should accept:

- local image files from the OS
- image URLs
- HTML drops containing an `<img>` source
- page image drags when the content script can provide candidate context

Dropped local files become capture-tray items with:

- `storageMode: download`
- `inlineData`/fetch status done
- source label `Local file`
- raw metadata fields for filename, size, MIME type, and later embedded metadata

Dropped URLs go through service worker staging so CORS-sensitive fetches still happen in the extension background context.

The content script can add dragstart metadata for page images, but the sidebar must still handle plain `DataTransfer` data because not every page/browser will cooperate.

## Error Handling

Content-script communication errors should be separated:

- Capture command failures are user-visible.
- Maintenance cleanup failures are silent or logged only.
- Import success should not be followed by a red connection error just because the active page no longer has a receiving content script.

Metadata parser failures should never block import. They should preserve the raw file and add a warning under `rawMetadata.embeddedImageMetadata.warnings`.

Large raw payloads should be truncated only in UI display, never in stored metadata.

## Testing

Add focused tests for:

- PNG text chunk extraction from a small fixture PNG.
- NovelAI JSON mapping to generation metadata.
- Prompt token parsing, including weighted syntax and `artist:` style-reference semantics.
- Negative prompt separation.
- Library read populating `record.generation` from metadata/raw original file.
- Existing NovelAI local PNG import showing generation data without reimport when an original file is available.
- Extension drop payload helpers for local file and URL drops.
- The false “receiving end does not exist” case being suppressed for cleanup messages.

Run:

- focused Vitest suites for parsers/import/library/extension helpers
- `npm run check`
- `npm run test:unit -- --run`
- `npm run build:extension`
- `/api/status` smoke after server-side changes

## First Implementation Order

1. Fix the noisy post-import content-script cleanup error.
2. Add parser tests and implement PNG text chunk extraction.
3. Add NovelAI parser tests and map prompt/settings fields.
4. Populate library `record.generation` and raw embedded metadata.
5. Replace the Atlas AI metadata placeholder with real display.
6. Add sidebar drag/drop staging for files and URLs.

This order makes the imported NovelAI metadata visible before expanding the capture surface.
