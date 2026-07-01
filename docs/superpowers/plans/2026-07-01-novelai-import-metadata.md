# NovelAI Import Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and display NovelAI generation metadata while adding Eagle-style drag/drop import quality-of-life and suppressing false extension connection errors after successful imports.

**Architecture:** Keep image metadata parsing server-side in focused library modules, map parsed NovelAI payloads into the existing `LibraryAssetRecord.generation` read model, and keep extension drop/capture helpers isolated from Svelte UI state. Content-script cleanup failures become best-effort maintenance errors rather than user-visible capture failures.

**Tech Stack:** SvelteKit, TypeScript, Vitest, sharp, better-sqlite3, Chrome/Firefox extension APIs, Svelte 5.

---

## File Map

- Create `src/lib/server/library/embeddedImageMetadata.ts`: generic PNG text chunk extraction from buffers/local files.
- Create `src/lib/server/library/embeddedImageMetadata.spec.ts`: PNG text extraction tests with generated fixture PNGs.
- Create `src/lib/server/library/novelAiGeneration.ts`: NovelAI detector, prompt token parser, and generation read-model mapper.
- Create `src/lib/server/library/novelAiGeneration.spec.ts`: mapping/token tests, including `artist:` style-reference semantics.
- Modify `src/lib/library/types.ts`: add optional structured prompt rows/settings fields to `AiGenerationMetadata`.
- Modify `src/lib/server/library/import.ts`: parse embedded metadata during downloaded imports and persist under `rawMetadata.embeddedImageMetadata`.
- Modify `src/lib/server/library/read.ts`: derive `record.generation` from stored raw metadata or local original file fallback.
- Modify `src/lib/server/library/read.spec.ts` and/or `src/routes/api/library/server.spec.ts`: library read integration tests.
- Modify `src/lib/components/atlas/AtlasAiMetadataSection.svelte`: render real generation metadata.
- Modify `src/lib/components/atlas/AtlasAssetInspect.svelte`: pass `visibleAsset.record?.generation`.
- Create `extension/sidebar/drop-import.ts`: parse drop payloads and build local-file captured items.
- Create `extension/sidebar/drop-import.spec.ts`: local file and URL drop helper tests.
- Modify `extension/shared/types.ts` and `extension/shared/messages.ts`: add URL/file staging message types if needed.
- Modify `extension/background/service-worker.ts`: stage dropped URL/file payloads and expose a silent broadcast helper or maintenance cleanup path.
- Modify `extension/background/enrich-capture.ts`: preserve embedded/raw drop metadata in wire import payloads.
- Modify `extension/sidebar/App.svelte`: handle drop events, call drop helper, suppress cleanup errors.
- Modify `extension/content/index.ts`: best-effort page-image `dragstart` metadata for sidebar drops.

## Task 1: Suppress False Post-Import Cleanup Errors

**Files:**
- Modify: `extension/sidebar/App.svelte`
- Test: `extension/sidebar/capture-maintenance.spec.ts`

- [ ] Write failing tests in `extension/sidebar/capture-maintenance.spec.ts`.

```ts
import { describe, expect, it } from 'vitest';
import { shouldSurfaceContentScriptError } from './capture-maintenance';

describe('capture maintenance errors', () => {
	it('does not surface receiving-end errors for cleanup messages', () => {
		expect(
			shouldSurfaceContentScriptError({
				messageType: 'PASTICHE_CLEAR_SELECTION',
				error: new Error('Could not establish connection. Receiving end does not exist.')
			})
		).toBe(false);
	});

	it('does surface receiving-end errors for capture activation messages', () => {
		expect(
			shouldSurfaceContentScriptError({
				messageType: 'PASTICHE_CAPTURE_ACTIVATE',
				error: new Error('Could not establish connection. Receiving end does not exist.')
			})
		).toBe(true);
	});
});
```

- [ ] Run `npm run test:unit -- --run extension/sidebar/capture-maintenance.spec.ts`.

Expected: FAIL because `extension/sidebar/capture-maintenance.ts` does not exist.

- [ ] Create `extension/sidebar/capture-maintenance.ts`.

```ts
const MAINTENANCE_MESSAGES = new Set(['PASTICHE_CLEAR_SELECTION', 'PASTICHE_DESELECT_ITEM']);

export function shouldSurfaceContentScriptError(input: { messageType: string; error: unknown }) {
	if (!MAINTENANCE_MESSAGES.has(input.messageType)) return true;
	return !isReceivingEndError(input.error);
}

function isReceivingEndError(error: unknown) {
	return error instanceof Error && /receiving end does not exist/i.test(error.message);
}
```

- [ ] Modify `sendActiveTabMessage` in `extension/sidebar/App.svelte` so cleanup calls pass `{ surfaceErrors: false }` and use `shouldSurfaceContentScriptError` before setting `captureError`.

- [ ] Update calls:
  - `removeItem`: `sendActiveTabMessage({ type: MESSAGE_DESELECT_ITEM, url: item.url }, { surfaceErrors: false })`
  - `clearAll`: `sendActiveTabMessage({ type: MESSAGE_CLEAR_SELECTION }, { surfaceErrors: false })`
  - post-import badge clear: same silent option.

- [ ] Run `npm run test:unit -- --run extension/sidebar/capture-maintenance.spec.ts` and `npm run check`.

- [ ] Commit:

```bash
git add extension/sidebar/capture-maintenance.ts extension/sidebar/capture-maintenance.spec.ts extension/sidebar/App.svelte
git commit -m "fix: suppress cleanup content script errors"
```

## Task 2: Parse PNG Text Chunks And NovelAI Prompt Data

**Files:**
- Create: `src/lib/server/library/embeddedImageMetadata.ts`
- Create: `src/lib/server/library/embeddedImageMetadata.spec.ts`
- Create: `src/lib/server/library/novelAiGeneration.ts`
- Create: `src/lib/server/library/novelAiGeneration.spec.ts`
- Modify: `src/lib/library/types.ts`

- [ ] Write failing PNG metadata tests.

Test cases:
- `extractEmbeddedImageMetadata(buffer)` returns `pngText.Software`, `pngText.Description`, and parsed `pngText.Comment`.
- Invalid/non-PNG buffers return `{ kind: 'unknown', warnings: [...] }` without throwing.

- [ ] Run `npm run test:unit -- --run src/lib/server/library/embeddedImageMetadata.spec.ts`.

Expected: FAIL because module does not exist.

- [ ] Implement `embeddedImageMetadata.ts` using `sharp(buffer).metadata()` and `metadata.comments`.

Return shape:

```ts
export type EmbeddedImageMetadata = {
	kind: 'png' | 'unknown';
	pngText: Record<string, string>;
	warnings: string[];
};
```

- [ ] Run the embedded metadata tests and verify PASS.

- [ ] Write failing NovelAI parser tests.

Test cases:
- Maps `Software: NovelAI`, `Source`, and JSON `Comment` to provider/model/prompt/negativePrompt/seed/sampler/steps/cfgScale.
- Pulls character prompt captions from `v4_prompt.caption.char_captions`.
- Separates negative prompt tokens from positive token suggestions.
- Parses weighted syntax like `1.5::simple background::`.
- Marks `artist:nightcrow` as role `artist_style_reference` and does not produce creator attribution.

- [ ] Run `npm run test:unit -- --run src/lib/server/library/novelAiGeneration.spec.ts`.

Expected: FAIL because module does not exist.

- [ ] Implement `novelAiGeneration.ts`.

Public functions:

```ts
export function parseNovelAiGeneration(metadata: EmbeddedImageMetadata): AiGenerationMetadata | null;
export function parsePromptTokens(prompt: string, scope: PromptTokenScope): PromptToken[];
```

- [ ] Extend `AiGenerationMetadata` in `src/lib/library/types.ts` with optional:

```ts
promptTokens?: PromptToken[];
characterPrompts?: Array<{ label: string | null; prompt: string; negativePrompt: string | null }>;
settings?: Record<string, string | number | boolean | null>;
```

- [ ] Run both parser test suites.

- [ ] Commit:

```bash
git add src/lib/server/library/embeddedImageMetadata.ts src/lib/server/library/embeddedImageMetadata.spec.ts src/lib/server/library/novelAiGeneration.ts src/lib/server/library/novelAiGeneration.spec.ts src/lib/library/types.ts
git commit -m "feat: parse novelai image metadata"
```

## Task 3: Populate Library Generation Records

**Files:**
- Modify: `src/lib/server/library/import.ts`
- Modify: `src/lib/server/library/read.ts`
- Modify: `src/lib/server/library/read.spec.ts`
- Modify: `src/routes/api/library/server.spec.ts` if route coverage is cleaner.

- [ ] Write failing integration test for downloaded NovelAI PNG import.

Use a generated 1x1 PNG with NovelAI `comments` and import it with `storage_mode: 'download'`.

Assert:
- `assets.metadata_json.rawMetadata.embeddedImageMetadata.pngText.Software === 'NovelAI'`
- `getLibrarySnapshot().assets[0].record.generation.provider === 'novelai'`
- `generation.promptTagSuggestions` includes positive prompt tokens
- `generation.promptTokens` includes `{ text: 'artist:nightcrow', role: 'artist_style_reference' }`

- [ ] Write failing fallback test where `metadata_json` lacks `embeddedImageMetadata` but `original_path` points at a NovelAI PNG; `getLibrarySnapshot()` still returns generation metadata.

- [ ] Run focused library tests and verify FAIL.

- [ ] Modify `import.ts`:
  - after `writeOriginal`, parse image bytes for downloaded imports
  - merge result into `metadata.rawMetadata.embeddedImageMetadata`
  - never throw on parser failures

- [ ] Modify `read.ts`:
  - parse stored `metadata.rawMetadata.embeddedImageMetadata`
  - if missing and local original exists, call file parser
  - set `generation: parseNovelAiGeneration(embedded)`.

- [ ] Run focused library tests and verify PASS.

- [ ] Commit:

```bash
git add src/lib/server/library/import.ts src/lib/server/library/read.ts src/lib/server/library/read.spec.ts src/routes/api/library/server.spec.ts
git commit -m "feat: populate ai generation metadata"
```

## Task 4: Render Atlas AI Metadata

**Files:**
- Modify: `src/lib/components/atlas/AtlasAiMetadataSection.svelte`
- Modify: `src/lib/components/atlas/AtlasAssetInspect.svelte`

- [ ] Modify `AtlasAiMetadataSection.svelte` props:

```ts
import type { AiGenerationMetadata } from '$lib/library/types';

type Props = {
	generation: AiGenerationMetadata | null | undefined;
};
let { generation }: Props = $props();
```

- [ ] Render empty state only when `!generation`.

- [ ] Render summary:
  - provider/model
  - seed
  - sampler, steps, scale
  - prompt token count

- [ ] Render expanded content:
  - positive prompt first
  - character prompts next
  - prompt tag chips from positive/character tokens
  - negative prompt section
  - settings grid
  - raw payload `<details>`

- [ ] Modify `AtlasAssetInspect.svelte`:

```svelte
<AtlasAiMetadataSection generation={visibleAsset.record?.generation} />
```

- [ ] Run `npm run check`.

- [ ] Commit:

```bash
git add src/lib/components/atlas/AtlasAiMetadataSection.svelte src/lib/components/atlas/AtlasAssetInspect.svelte
git commit -m "feat: render ai generation metadata"
```

## Task 5: Add Sidebar Drag/Drop Staging

**Files:**
- Create: `extension/sidebar/drop-import.ts`
- Create: `extension/sidebar/drop-import.spec.ts`
- Modify: `extension/shared/messages.ts`
- Modify: `extension/shared/types.ts`
- Modify: `extension/background/service-worker.ts`
- Modify: `extension/sidebar/App.svelte`
- Modify: `extension/content/index.ts`
- Modify: `extension/background/enrich-capture.ts`

- [ ] Write failing drop helper tests:
  - `dropPayloadFromDataTransfer` extracts first image file.
  - `dropPayloadFromDataTransfer` extracts `text/uri-list`.
  - local image file payload includes filename, mime type, and base64 data.

- [ ] Run `npm run test:unit -- --run extension/sidebar/drop-import.spec.ts`.

Expected: FAIL because helper does not exist.

- [ ] Implement `drop-import.ts`:
  - `dropPayloadFromDataTransfer(dataTransfer): DropImportPayload | null`
  - `capturedPayloadForDroppedFile(file): Promise<CapturedItemPayload>`
  - `urlFromDroppedData(dataTransfer): string | null`

- [ ] Add message constant/type for dropped URL staging if needed:

```ts
export const MESSAGE_STAGE_DROPPED_URL = 'PASTICHE_STAGE_DROPPED_URL';
```

- [ ] Modify service worker to handle dropped URL by calling `capturedPayloadForImageSource` or direct URL capture.

- [ ] Modify `App.svelte`:
  - add `ondragover`, `ondragleave`, and `ondrop` on `<main>`
  - show compact drop-active visual state
  - local file drops are converted to captured payloads and sent through `MESSAGE_ITEM_CAPTURED`
  - URL drops use `MESSAGE_STAGE_DROPPED_URL`
  - refresh tray and select staged item

- [ ] Modify `content/index.ts`:
  - add capture-phase `dragstart` listener
  - if target resolves to image, set `DataTransfer` `text/uri-list` and `text/plain` to candidate URL
  - best-effort `ext.runtime.sendMessage({ type: PASTICHE_DRAG_STARTED })` only if needed for side-panel opening.

- [ ] Ensure dropped local file raw metadata survives to import by extending `wireImportItemForEnrichedItem` if needed.

- [ ] Run focused extension tests, `npm run check`, and `npm run build:extension`.

- [ ] Commit:

```bash
git add extension/sidebar/drop-import.ts extension/sidebar/drop-import.spec.ts extension/shared/messages.ts extension/shared/types.ts extension/background/service-worker.ts extension/sidebar/App.svelte extension/content/index.ts extension/background/enrich-capture.ts
git commit -m "feat: add extension drag drop import"
```

## Task 6: Final Verification And Push

**Files:**
- No planned source changes unless verification exposes a defect.

- [ ] Run focused suites:

```bash
npm run test:unit -- --run \
  extension/sidebar/capture-maintenance.spec.ts \
  extension/sidebar/drop-import.spec.ts \
  src/lib/server/library/embeddedImageMetadata.spec.ts \
  src/lib/server/library/novelAiGeneration.spec.ts \
  src/lib/server/library/read.spec.ts
```

- [ ] Run full checks:

```bash
npm run check
npm run test:unit -- --run
npm run build:extension
```

- [ ] Start dev server and smoke `/api/status`:

```bash
npm run dev
curl -i http://localhost:5173/api/status
```

Expected: HTTP 200 and JSON containing `"connected":true`.

- [ ] Stop dev server.

- [ ] Inspect git status:

```bash
git status --short --branch
```

- [ ] Push:

```bash
git push origin codex/atlas-search-v1
```
