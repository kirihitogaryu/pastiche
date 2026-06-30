# Extension Import Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pastiche extension import workbench described in `docs/superpowers/specs/2026-06-30-extension-import-workbench-design.md`.

**Architecture:** Convert the extension from a one-URL capture queue into a candidate-first import workflow. Content scripts collect image candidates, shared helpers score and cluster them, the background service worker enriches selected candidates and sends editable metadata through `/api/import`, and the sidebar renders a compact Pastiche-native workbench with alternates and import fields.

**Tech Stack:** TypeScript, Svelte 5, Manifest V3 extension APIs, Vite, Vitest, SvelteKit server routes, Pastiche Library import metadata.

---

## File Structure

- Create `extension/shared/candidates.ts`: shared candidate, source, metadata, and capture item types plus lightweight helpers.
- Create `extension/content/candidate-scanner.ts`: DOM-only candidate extraction from images, srcset, picture/source, background images, lazy data attributes, metadata, video, and canvas.
- Create `extension/content/candidate-scanner.spec.ts`: fixture-driven scanner tests with jsdom.
- Create `extension/shared/candidate-scoring.ts`: hard rejection, quality scoring, confidence labels, and best-candidate selection.
- Create `extension/shared/candidate-scoring.spec.ts`: scoring and rejection tests.
- Create `extension/shared/metadata.ts`: title/source/tag normalization helpers shared by background and sidebar.
- Create `extension/shared/metadata.spec.ts`: import metadata mapping tests.
- Modify `extension/shared/types.ts`: add candidate fields and editable metadata to captured and enriched items.
- Modify `extension/content/resolver.ts`: keep compatibility wrappers while delegating to candidate scanner/scoring.
- Modify `extension/content/index.ts`: send candidate sessions instead of only one resolved URL while preserving existing message names initially.
- Modify `extension/background/service-worker.ts`: enrich selected candidates, preserve alternates, pass editable metadata through `/api/import`.
- Modify `src/lib/server/library/types.ts`: allow extension source types used by metadata.
- Modify `src/routes/api/import/+server.ts`: validate optional import metadata.
- Modify `extension/sidebar/App.svelte`: add selected item state and metadata mutation handlers.
- Modify `extension/sidebar/components/SelectionItem.svelte`: render quality/source summary and selection state.
- Create `extension/sidebar/components/CaptureCommandStrip.svelte`: Pastiche-native command row.
- Create `extension/sidebar/components/SelectedItemInspector.svelte`: preview, quality reason, URLs, alternates entry point.
- Create `extension/sidebar/components/AlternatesDrawer.svelte`: candidate list sorted by score with select actions.
- Create `extension/sidebar/components/MetadataEditor.svelte`: editable title, artist, date, source label, original URL, and tags.
- Create or modify extension style entrypoints to import/copy Pastiche tokens from `src/lib/styles/tokens.css` and `src/lib/styles/global.css` where feasible.

## Task 1: Candidate Types And Scoring

**Files:**

- Create: `extension/shared/candidates.ts`
- Create: `extension/shared/candidate-scoring.ts`
- Create: `extension/shared/candidate-scoring.spec.ts`

- [ ] **Step 1: Write failing scoring tests**

Create `extension/shared/candidate-scoring.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ImageCandidate } from './candidates';
import { chooseBestCandidate, scoreCandidate } from './candidate-scoring';

function candidate(partial: Partial<ImageCandidate>): ImageCandidate {
	return {
		id: partial.id ?? crypto.randomUUID(),
		url: partial.url ?? 'https://example.com/image.jpg',
		kind: partial.kind ?? 'img',
		width: partial.width ?? 1200,
		height: partial.height ?? 900,
		visibleWidth: partial.visibleWidth ?? 600,
		visibleHeight: partial.visibleHeight ?? 450,
		mimeType: partial.mimeType ?? 'image/jpeg',
		byteSize: partial.byteSize ?? null,
		altText: partial.altText ?? null,
		sourceElementPath: partial.sourceElementPath ?? null,
		detailUrl: partial.detailUrl ?? null,
		inlineData: partial.inlineData ?? null,
		score: partial.score ?? 0,
		confidence: partial.confidence ?? 'medium',
		rejectionReasons: partial.rejectionReasons ?? [],
		scoreReasons: partial.scoreReasons ?? []
	};
}

describe('candidate scoring', () => {
	it('rejects tiny page-scan icons but keeps a reason', () => {
		expect.assertions(3);
		const scored = scoreCandidate(candidate({
			url: 'https://example.com/icon.png',
			width: 32,
			height: 32,
			visibleWidth: 16,
			visibleHeight: 16
		}), { minDimension: 300, directSelection: false });

		expect(scored.rejectionReasons).toContain('below minimum page-scan size');
		expect(scored.rejectionReasons).toContain('icon-like URL');
		expect(scored.score).toBeLessThan(0);
	});

	it('keeps directly selected small images but labels them low confidence', () => {
		expect.assertions(2);
		const scored = scoreCandidate(candidate({
			url: 'https://example.com/small-reference.png',
			width: 120,
			height: 120,
			visibleWidth: 120,
			visibleHeight: 120
		}), { minDimension: 300, directSelection: true });

		expect(scored.rejectionReasons).toEqual([]);
		expect(scored.confidence).toBe('low');
	});

	it('prefers original/full candidates over thumbnails from the same cluster', () => {
		expect.assertions(2);
		const thumb = scoreCandidate(candidate({
			id: 'thumb',
			url: 'https://cdn.example.com/thumb/work-small.jpg',
			width: 320,
			height: 320
		}), { minDimension: 300, directSelection: false });
		const original = scoreCandidate(candidate({
			id: 'original',
			url: 'https://cdn.example.com/original/work-full.jpg',
			width: 2400,
			height: 3200
		}), { minDimension: 300, directSelection: false });

		expect(original.score).toBeGreaterThan(thumb.score);
		expect(chooseBestCandidate([thumb, original])?.id).toBe('original');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- --run extension/shared/candidate-scoring.spec.ts
```

Expected: fail because `extension/shared/candidates.ts` and `extension/shared/candidate-scoring.ts` do not exist.

- [ ] **Step 3: Implement candidate types and scoring**

Create `extension/shared/candidates.ts` with the candidate/source/metadata types from the spec, plus `inlineData`.

Create `extension/shared/candidate-scoring.ts` with:

- `scoreCandidate(candidate, options)`
- `chooseBestCandidate(candidates)`
- hard rejection for tiny page-scan candidates and icon-like URLs
- positive score for large dimensions, original/full URL terms, and visible size
- low confidence for directly selected small candidates

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:unit -- --run extension/shared/candidate-scoring.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add extension/shared/candidates.ts extension/shared/candidate-scoring.ts extension/shared/candidate-scoring.spec.ts
git commit -m "feat: add extension image candidate scoring"
```

## Task 2: Generic Candidate Scanner

**Files:**

- Create: `extension/content/candidate-scanner.ts`
- Create: `extension/content/candidate-scanner.spec.ts`
- Modify: `extension/content/resolver.ts`

- [ ] **Step 1: Write scanner tests**

Tests must cover:

- largest `srcset` width candidate is collected
- CSS background candidates are collected
- lazy data attributes are collected
- OpenGraph and JSON-LD metadata candidates are collected
- tiny icons can be emitted as candidates for scoring to reject

- [ ] **Step 2: Run scanner tests to verify they fail**

Run:

```bash
npm run test:unit -- --run extension/content/candidate-scanner.spec.ts
```

Expected: fail because scanner module does not exist.

- [ ] **Step 3: Implement scanner**

Implement DOM-only scanner helpers:

- `scanDocumentForCandidates(options)`
- `candidatesForElement(element)`
- `candidateClusterForElement(element, options)`
- `srcset` parsing using a dependency or a small standards-compatible local helper only if package install is blocked
- CSS `url(...)` extraction
- metadata extraction from `meta`, `link`, and JSON-LD
- data attribute extraction

- [ ] **Step 4: Preserve resolver compatibility**

Modify `extension/content/resolver.ts` so current callers still receive `ResolvedImage`, but the implementation chooses the best candidate from the scanner/scoring path.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:unit -- --run extension/content/candidate-scanner.spec.ts extension/shared/candidate-scoring.spec.ts
```

Expected: pass.

## Task 3: Capture Payload And Background Enrichment

**Files:**

- Modify: `extension/shared/types.ts`
- Modify: `extension/content/index.ts`
- Modify: `extension/background/service-worker.ts`
- Create: `extension/background/enrich-capture.spec.ts`

- [ ] **Step 1: Write enrichment tests**

Tests must verify:

- selected candidate becomes `EnrichedItem.url`
- alternates are preserved
- title defaults from metadata or filename
- source label and original page URL are preserved
- direct image URL still drives duplicate hashing

- [ ] **Step 2: Run enrichment tests to verify they fail**

Run:

```bash
npm run test:unit -- --run extension/background/enrich-capture.spec.ts
```

Expected: fail because extraction/enrichment helpers are not exported yet.

- [ ] **Step 3: Extend shared types**

Add to `CapturedItemPayload`:

- `selectedCandidateId?: string`
- `candidates?: ImageCandidate[]`
- `source?: CaptureSource`
- `metadata?: CaptureMetadata`

Add to `EnrichedItem`:

- `selectedCandidateId: string`
- `candidates: ImageCandidate[]`
- `source: CaptureSource`
- `metadata: CaptureMetadata`

- [ ] **Step 4: Refactor background enrichment**

Extract enrichment helper from `service-worker.ts` so tests can call it. Keep the message protocol stable while accepting richer payloads.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:unit -- --run extension/background/enrich-capture.spec.ts extension/background/canonical-image.spec.ts extension/background/context-menu.spec.ts
```

Expected: pass.

## Task 4: Import Metadata Passthrough

**Files:**

- Modify: `extension/background/service-worker.ts`
- Modify: `src/lib/server/library/types.ts`
- Modify: `src/routes/api/import/+server.ts`
- Modify or create: `src/routes/api/import/server.spec.ts`

- [ ] **Step 1: Write route validation tests**

Tests must verify `/api/import` accepts optional metadata with:

- `sourceName`
- `sourceType: 'social'`
- `detailUrl`
- `creator`
- `dateDisplay`
- `tags`
- `rawMetadata`

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
npm run test:unit -- --run src/routes/api/import/server.spec.ts
```

Expected: fail because metadata validation currently ignores `metadata`.

- [ ] **Step 3: Extend import validation and types**

Allow extension source types:

- `web`
- `social`
- `gallery`
- `booru`
- `museum`
- `collection`
- `cdn`
- `local`

Validate metadata fields structurally and reject invalid tag arrays.

- [ ] **Step 4: Send metadata from extension**

Modify `postImport()` in `extension/background/service-worker.ts` to map `EnrichedItem.metadata` and `EnrichedItem.source` into the request item's `metadata`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:unit -- --run src/routes/api/import/server.spec.ts extension/background/enrich-capture.spec.ts
```

Expected: pass.

## Task 5: Sidebar Workbench Data Editing

**Files:**

- Modify: `extension/sidebar/App.svelte`
- Modify: `extension/sidebar/components/SelectionList.svelte`
- Modify: `extension/sidebar/components/SelectionItem.svelte`
- Create: `extension/sidebar/components/SelectedItemInspector.svelte`
- Create: `extension/sidebar/components/AlternatesDrawer.svelte`
- Create: `extension/sidebar/components/MetadataEditor.svelte`

- [ ] **Step 1: Add UI state tests where practical**

For pure helpers, add unit tests for:

- selecting an alternate candidate updates selected URL
- editing metadata updates the item without mutating other items
- tag input normalizes comma-separated values

- [ ] **Step 2: Implement sidebar item mutations**

Add handlers in `App.svelte`:

- `selectItem(id)`
- `selectCandidate(itemId, candidateId)`
- `updateMetadata(itemId, metadataPatch)`
- `updateTags(itemId, tags)`

- [ ] **Step 3: Implement selected item inspector**

Render:

- preview
- selected candidate dimensions
- source label
- image host
- original page URL
- score reason
- alternates button

- [ ] **Step 4: Implement alternates drawer**

Render candidates sorted by score. Selecting an alternate updates `selectedCandidateId`, `url`, dimensions, preview, and fetch state as needed.

- [ ] **Step 5: Implement metadata editor**

Editable fields:

- title
- artist
- date
- source label
- original page URL
- tags

- [ ] **Step 6: Run extension build**

Run:

```bash
npm run build:extension
```

Expected: pass.

## Task 6: Pastiche-Native Sidebar Styling

**Files:**

- Modify: `extension/sidebar/App.svelte`
- Modify: `extension/sidebar/components/*.svelte`
- Modify: `extension/settings/Settings.svelte`
- Potentially create: `extension/sidebar/tokens.css`

- [ ] **Step 1: Port visual tokens**

Mirror essential values from `src/lib/styles/tokens.css` into the extension bundle or import a copied extension-local token file.

- [ ] **Step 2: Add command strip**

Create `CaptureCommandStrip.svelte` with:

- Pick Image
- Scan Page
- Capture Area
- Capture Visible
- Capture Page
- Drag Capture toggle

Wire existing implemented commands first. Disabled unimplemented commands must be visibly disabled, not fake-working.

- [ ] **Step 3: Restyle rows and controls**

Use app-like surfaces, borders, muted text, compact icon buttons, and readable input controls.

- [ ] **Step 4: Build**

Run:

```bash
npm run build:extension
```

Expected: pass.

## Task 7: Source Adapter Pack 1

**Files:**

- Create: `extension/shared/source-adapters.ts`
- Create: `extension/shared/source-adapters.spec.ts`
- Modify: `extension/background/service-worker.ts`
- Modify: `extension/content/candidate-scanner.ts`

- [ ] **Step 1: Write adapter tests**

Cover:

- X/Twitter source label and `name=orig`
- Danbooru original-over-sample scoring hint
- Tumblr tag extraction
- DeviantArt title/artist/source label hints
- Generic host fallback

- [ ] **Step 2: Implement adapters**

Implement pure adapters with:

- `matches(url)`
- `normalizeSource(context)`
- `extractMetadata(document, context)`
- `transformCandidateUrl(url, context)`
- `scoreCandidate(candidate, context)`

- [ ] **Step 3: Wire adapters into scanner/enrichment**

Use adapter transforms before scoring and adapter metadata before generic fallbacks.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test:unit -- --run extension/shared/source-adapters.spec.ts extension/content/candidate-scanner.spec.ts extension/shared/candidate-scoring.spec.ts
```

Expected: pass.

## Task 8: Verification And Browser Builds

**Files:** no required source changes.

- [ ] **Step 1: Run focused extension tests**

Run:

```bash
npm run test:unit -- --run extension/shared/candidate-scoring.spec.ts extension/content/candidate-scanner.spec.ts extension/background/enrich-capture.spec.ts extension/shared/source-adapters.spec.ts extension/background/canonical-image.spec.ts extension/background/context-menu.spec.ts extension/sidebar/import-notification.spec.ts extension/shared/source-hash.spec.ts extension/shared/settings.spec.ts
```

Expected: pass.

- [ ] **Step 2: Run import route tests**

Run:

```bash
npm run test:unit -- --run src/routes/api/import/server.spec.ts
```

Expected: pass.

- [ ] **Step 3: Run Chrome extension build**

Run:

```bash
npm run build:extension
```

Expected: pass.

- [ ] **Step 4: Run Firefox extension build**

Run:

```bash
npm run build:extension:firefox
```

Expected: pass. Runtime Firefox fixes can remain a later phase unless Chrome implementation regresses shared code.

- [ ] **Step 5: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no output.

