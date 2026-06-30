# Extension Tag Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-verified Atlas tag selection to the extension import sidebar, preserve source tags, and apply selected tags as approved Atlas concepts on import.

**Architecture:** Extend extension metadata with `acceptedConceptSlugs` and structured `sourceTags`, replace the freeform tag textarea with an autocomplete chip input backed by `/api/atlas/concepts`, and update the library import endpoint to apply selected concepts through the existing Atlas patch path. Source-tag extraction stays adapter-based in `extension/shared/source-adapters.ts` and remains raw metadata until explicitly accepted.

**Tech Stack:** Svelte 5 extension UI, TypeScript, Vite extension build, SvelteKit API routes, better-sqlite3-backed Atlas tables, Vitest with happy-dom.

---

## File Structure

- Modify `extension/shared/candidates.ts`: add `SourceTag` and metadata fields.
- Modify `extension/shared/capture-tray.ts`: restore new metadata fields from storage safely.
- Modify `extension/shared/source-adapters.ts`: emit structured source tags for Danbooru, DeviantArt, Tumblr, and generic sources.
- Modify `extension/shared/source-adapters.spec.ts`: cover new adapter extraction.
- Modify `extension/background/enrich-capture.ts`: preserve accepted concept slugs and source tags in wire import metadata.
- Modify `extension/background/enrich-capture.spec.ts`: assert wire metadata carries selected slugs and source tags.
- Modify `extension/sidebar/item-state.ts`: normalize accepted concept slugs and source tags when metadata changes.
- Modify `extension/sidebar/item-state.spec.ts`: cover dedupe/normalization of selected concepts.
- Create `extension/sidebar/components/TagPicker.svelte`: reusable compact Atlas concept picker.
- Create `extension/sidebar/components/tag-picker.ts`: pure helpers for chip state and suggestion fetch shaping.
- Create `extension/sidebar/components/tag-picker.spec.ts`: helper tests.
- Modify `extension/sidebar/components/MetadataEditor.svelte`: replace freeform tags textarea with `TagPicker` and show read-only source tags.
- Modify `src/lib/server/library/types.ts`: add import metadata fields.
- Modify `src/routes/api/import/+server.ts`: validate accepted concept slugs and source tag raw metadata.
- Modify `src/lib/server/library/import.ts`: apply accepted concepts after creating each asset.
- Modify `src/routes/api/import/server.spec.ts` and `src/lib/server/library/library.spec.ts`: prove import applies selected Atlas concepts while raw source tags remain metadata.

## Task 1: Metadata Types And Storage

**Files:**
- Modify: `extension/shared/candidates.ts`
- Modify: `extension/shared/capture-tray.ts`
- Modify: `extension/shared/capture-tray.spec.ts`
- Modify: `extension/sidebar/item-state.ts`
- Modify: `extension/sidebar/item-state.spec.ts`

- [ ] **Step 1: Add failing tests for metadata restoration and updates**

Add assertions to `extension/shared/capture-tray.spec.ts` that a stored legacy item without new fields restores `acceptedConceptSlugs: []` and `sourceTags: []`, and that malformed values are dropped.

Add assertions to `extension/sidebar/item-state.spec.ts`:

```ts
const [updated] = updateItemMetadata([item({ id: 'first' })], 'first', {
	acceptedConceptSlugs: [' dragon ', 'dragon', 'black_hair'],
	sourceTags: [
		{
			source: 'deviantart',
			category: 'tag',
			label: 'Dragon',
			slug: 'dragon',
			url: 'https://www.deviantart.com/tag/dragon',
			confidence: 'high',
			selectorHint: 'a[data-tagname][href*="/tag/"]'
		}
	]
});

expect(updated.metadata.acceptedConceptSlugs).toEqual(['dragon', 'black_hair']);
expect(updated.metadata.sourceTags).toHaveLength(1);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- --run extension/shared/capture-tray.spec.ts extension/sidebar/item-state.spec.ts
```

Expected: FAIL because `acceptedConceptSlugs` and `sourceTags` do not exist yet.

- [ ] **Step 3: Add metadata types and storage normalization**

In `extension/shared/candidates.ts`, add:

```ts
export type SourceTag = {
	source: 'danbooru' | 'deviantart' | 'tumblr' | 'x' | 'bluesky' | 'instagram' | 'generic';
	category: 'tag' | 'artist' | 'character' | 'copyright' | 'meta' | 'hashtag' | 'unknown';
	label: string;
	slug: string;
	url: string | null;
	confidence: 'high' | 'medium' | 'low';
	selectorHint: string;
	deprecated?: boolean;
	count?: number | null;
};
```

Add `acceptedConceptSlugs: string[]` and `sourceTags: SourceTag[]` to `CaptureMetadata`.

In `extension/shared/capture-tray.ts`, ensure missing or malformed fields become empty arrays.

In `extension/sidebar/item-state.ts`, normalize `acceptedConceptSlugs` with trim/dedupe and normalize `sourceTags` by checking required string fields.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:unit -- --run extension/shared/capture-tray.spec.ts extension/sidebar/item-state.spec.ts
```

Expected: PASS.

## Task 2: Source Tag Extraction

**Files:**
- Modify: `extension/shared/source-adapters.ts`
- Modify: `extension/shared/source-adapters.spec.ts`

- [ ] **Step 1: Add failing adapter tests**

Add tests for:

- Danbooru `.tag-list.categorized-tag-list li[data-tag-name]` extraction with artist, copyright, character, and general categories.
- DeviantArt `a[data-tagname][href*="/tag/"]` extraction.
- Tumblr `a[data-testid="tag-link"][href*="/tagged/"]` extraction.
- Generic `meta[property="article:tag"]` extraction.

Expected shape:

```ts
expect(metadata.sourceTags).toEqual([
	expect.objectContaining({
		source: 'deviantart',
		category: 'tag',
		label: 'dragon',
		slug: 'dragon',
		confidence: 'high'
	})
]);
```

- [ ] **Step 2: Run source adapter tests to verify failure**

Run:

```bash
npm run test:unit -- --run extension/shared/source-adapters.spec.ts
```

Expected: FAIL because `sourceTags` are not extracted.

- [ ] **Step 3: Implement adapter extraction**

Update `sourceMetadataForPage` to set both `suggestedTags` and `sourceTags`. Keep `suggestedTags` as a string list for backward compatibility, derived from `sourceTags` labels where appropriate.

Implement helpers:

```ts
function sourceTagsForHost(document: Document, host: string): SourceTag[] {
	if (isDanbooruHost(host)) return danbooruSourceTags(document);
	if (host.endsWith('deviantart.com')) return deviantArtSourceTags(document);
	if (host.endsWith('tumblr.com')) return tumblrSourceTags(document);
	return genericSourceTags(document);
}
```

Dedupe by `${source}:${category}:${slug}`.

- [ ] **Step 4: Run source adapter tests**

Run:

```bash
npm run test:unit -- --run extension/shared/source-adapters.spec.ts
```

Expected: PASS.

## Task 3: Extension Tag Picker UI

**Files:**
- Create: `extension/sidebar/components/tag-picker.ts`
- Create: `extension/sidebar/components/tag-picker.spec.ts`
- Create: `extension/sidebar/components/TagPicker.svelte`
- Modify: `extension/sidebar/components/MetadataEditor.svelte`

- [ ] **Step 1: Write helper tests**

Create tests in `tag-picker.spec.ts` for:

```ts
expect(addConceptSlug([], 'dragon')).toEqual(['dragon']);
expect(addConceptSlug(['dragon'], ' dragon ')).toEqual(['dragon']);
expect(removeConceptSlug(['dragon', 'flower'], 'dragon')).toEqual(['flower']);
expect(normalizeConceptSlugInput('Black Hair')).toBe('black_hair');
```

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```bash
npm run test:unit -- --run extension/sidebar/components/tag-picker.spec.ts
```

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement helper module**

Create pure helpers:

```ts
export function normalizeConceptSlugInput(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export function addConceptSlug(current: string[], slug: string): string[] {
	const clean = normalizeConceptSlugInput(slug);
	if (!clean || current.includes(clean)) return current;
	return [...current, clean];
}

export function removeConceptSlug(current: string[], slug: string): string[] {
	const clean = normalizeConceptSlugInput(slug);
	return current.filter((entry) => entry !== clean);
}
```

- [ ] **Step 4: Build TagPicker component**

Create `TagPicker.svelte` with props:

```ts
type ConceptSuggestion = {
	id: string;
	slug: string;
	label: string;
	shortDefinition: string;
	match: 'exact' | 'alias' | 'prefix' | 'contains' | 'related';
};

type Props = {
	values: string[];
	onchange: (values: string[]) => void;
};
```

Behavior:

- Fetch `/api/atlas/concepts?q=${encodeURIComponent(query)}&limit=6` after input length reaches 2.
- Add clicked suggestions with `addConceptSlug`.
- On Enter, add the first suggestion when available.
- If no suggestion exists, show "No matching tag" and do not create a tag.
- Render selected slugs as removable chips.

- [ ] **Step 5: Replace metadata textarea**

In `MetadataEditor.svelte`, remove the `tags` textarea and use:

```svelte
<TagPicker
	values={metadata.acceptedConceptSlugs ?? []}
	onchange={(values) => onmetadatachange({ acceptedConceptSlugs: values })}
/>
```

Render `metadata.sourceTags` as read-only chips below the picker when present.

- [ ] **Step 6: Run UI-related checks**

Run:

```bash
npm run test:unit -- --run extension/sidebar/components/tag-picker.spec.ts extension/sidebar/item-state.spec.ts
npm run check
npm run build:extension
```

Expected: all pass.

## Task 4: Import Wire Format And Server Validation

**Files:**
- Modify: `extension/background/enrich-capture.ts`
- Modify: `extension/background/enrich-capture.spec.ts`
- Modify: `src/lib/server/library/types.ts`
- Modify: `src/routes/api/import/+server.ts`
- Modify: `src/routes/api/import/server.spec.ts`

- [ ] **Step 1: Add failing tests for wire metadata**

In `extension/background/enrich-capture.spec.ts`, assert that `wireImportItemForEnrichedItem` includes:

```ts
acceptedConceptSlugs: ['dragon', 'black_hair'],
rawMetadata: {
	sourceTags: [
		expect.objectContaining({ source: 'danbooru', slug: 'dragon' })
	]
}
```

In `src/routes/api/import/server.spec.ts`, assert that import metadata with `acceptedConceptSlugs` and source tags passes validation.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:unit -- --run extension/background/enrich-capture.spec.ts src/routes/api/import/server.spec.ts
```

Expected: FAIL because wire/server types do not include these fields.

- [ ] **Step 3: Add wire and validation fields**

Add to `WireImportItem.metadata` and `LibraryImportMetadata`:

```ts
acceptedConceptSlugs?: string[];
```

Keep source tags under `rawMetadata.sourceTags` so the server does not need a second top-level import metadata surface yet.

Update import route validation:

```ts
(value.acceptedConceptSlugs === undefined ||
	(Array.isArray(value.acceptedConceptSlugs) &&
		value.acceptedConceptSlugs.every((slug) => typeof slug === 'string')))
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:unit -- --run extension/background/enrich-capture.spec.ts src/routes/api/import/server.spec.ts
```

Expected: PASS.

## Task 5: Apply Accepted Concepts During Import

**Files:**
- Modify: `src/lib/server/library/import.ts`
- Modify: `src/lib/server/library/library.spec.ts`

- [ ] **Step 1: Add failing integration test**

In `library.spec.ts`, import an item with:

```ts
metadata: {
	sourceName: 'Extension',
	sourceType: 'web',
	acceptedConceptSlugs: ['dragon']
}
```

Then assert:

```ts
const concepts = db.prepare(`
	select atlas_concepts.slug, atlas_asset_concepts.status, atlas_asset_concepts.evidence
	from atlas_asset_concepts
	join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
	where atlas_asset_concepts.asset_id = ?
`).all(assetId);

expect(concepts).toEqual([
	expect.objectContaining({ slug: 'dragon', status: 'approved', evidence: 'observed' })
]);
```

- [ ] **Step 2: Run library test to verify failure**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts
```

Expected: FAIL because accepted concepts are not applied.

- [ ] **Step 3: Apply concepts after asset creation**

Import `applyAtlasAssetPatch` from `$lib/server/atlas/mutate`.

After the existing ingestion proposal block in `importLibraryItems`, add:

```ts
const acceptedConceptSlugs = normalizeAcceptedConceptSlugs(item.metadata?.acceptedConceptSlugs);
if (acceptedConceptSlugs.length) {
	applyAtlasAssetPatch(
		db,
		assetId,
		{
			concepts: acceptedConceptSlugs.map((slug) => ({
				slug,
				evidence: 'observed',
				status: 'approved'
			}))
		},
		now
	);
}
```

Add a local normalizer that trims, lowercases spaces to underscores, and dedupes.

- [ ] **Step 4: Run library test**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts
```

Expected: PASS.

## Task 6: Rendered Verification And Commit

**Files:**
- No new source files beyond previous tasks.

- [ ] **Step 1: Run full focused test suite**

Run:

```bash
npm run test:unit -- --run extension/shared/source-adapters.spec.ts extension/shared/capture-tray.spec.ts extension/sidebar/item-state.spec.ts extension/sidebar/components/tag-picker.spec.ts extension/background/enrich-capture.spec.ts src/routes/api/import/server.spec.ts src/lib/server/library/library.spec.ts
npm run check
npm run build:extension
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Render sidebar with mocked tags**

Use Playwright against `extension/dist/sidebar/index.html` with a mocked `chrome.runtime.sendMessage` that returns an item with:

```ts
metadata: {
	title: 'Tagged Work',
	artist: null,
	date: null,
	tags: [],
	acceptedConceptSlugs: ['dragon'],
	suggestedTags: [],
	sourceTags: [
		{ source: 'danbooru', category: 'tag', label: 'dragon', slug: 'dragon', url: null, confidence: 'high', selectorHint: 'test' }
	],
	description: null,
	rawPageTitle: null,
	rawAltText: null
}
```

Assert that the tag chip, source tag chip, and import button are visible.

- [ ] **Step 3: Commit**

Run:

```bash
git add extension src docs/superpowers/plans/2026-06-30-extension-tag-import.md
git commit -m "feat: add extension atlas tag import"
```

Expected: commit succeeds with only planned files.
