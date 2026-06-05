# Atlas Asset Inspect UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Atlas as a top-level app mode and ship the first read-only Atlas asset inspect workbench using real Library assets and existing Atlas ingestion data.

**Architecture:** Follow the existing single-page app-shell state pattern instead of adding SvelteKit routes for UI pages. Add a server API endpoint for per-asset Atlas data, then build focused client components under `src/lib/components/atlas`. The first slice is view mode only: it exposes identity, source claims, Atlas entities/claims/suggestions, category-colored rows, image preview tooling, an empty AI metadata section, and a Library inspector deep link.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest, Playwright, existing local Library SQLite/Atlas services.

---

## Source Documents

Read these before implementation:

```text
docs/superpowers/specs/2026-06-05-atlas-ui-mode-design.md
docs/superpowers/specs/2026-06-05-atlas-asset-inspect-design.md
docs/superpowers/specs/2026-06-05-ai-generation-metadata-design.md
docs/design/mockups/atlas/atlas-asset-inspect-guernica-view-mode-v3.html
src/lib/state/app-state.svelte.ts
src/lib/components/shell/AppShell.svelte
src/lib/components/shell/ModeRail.svelte
src/lib/components/inspector/AssetInspector.svelte
src/lib/server/atlas/read.ts
src/lib/atlas/types.ts
```

## Scope

Included:

- Add `atlas` to the app mode model and desktop rail.
- Add state helpers for opening an asset in Atlas.
- Add `/api/library/assets/[id]/atlas` read endpoint.
- Build read-only Atlas asset inspect workspace.
- Render category-colored rows for identity, claims, source entities, suggestions, and grouped legacy tags.
- Add inline filter for left-panel metadata rows.
- Add image zoom/focused-preview entry point using existing `FocusedAssetPreview`.
- Add an empty AI generation metadata section that matches the future parser surface.
- Add “Open in Atlas” from the Library inspector.
- Add unit tests for Atlas grouping helpers and API behavior.
- Add one e2e smoke test for entering Atlas from the Library inspector.

Excluded:

- Wiki implementation.
- Atlas search/browser implementation.
- AI generation metadata parser/storage.
- Tag editing, approval, merge, deprecate, and history mutation.
- Region annotation editing.
- Full similar-image ranking.

## File Structure

Create:

```text
src/lib/atlas/display.ts
src/lib/atlas/display.spec.ts
src/lib/components/atlas/AtlasWorkspace.svelte
src/lib/components/atlas/AtlasAssetInspect.svelte
src/lib/components/atlas/AtlasMetadataPanel.svelte
src/lib/components/atlas/AtlasImageStage.svelte
src/lib/components/atlas/AtlasAiMetadataSection.svelte
src/routes/api/library/assets/[id]/atlas/+server.ts
src/routes/api/library/assets/[id]/atlas/server.spec.ts
```

Modify:

```text
src/lib/types.ts
src/lib/atlas/types.ts
src/lib/data/mock-navigation.ts
src/lib/state/app-state.svelte.ts
src/lib/components/shell/AppShell.svelte
src/lib/components/shell/ModeRail.svelte
src/lib/components/inspector/AssetInspector.svelte
tests/pastiche.e2e.ts
```

Responsibilities:

- `src/lib/atlas/display.ts`: client-safe row grouping and category-color helpers.
- `AtlasWorkspace.svelte`: chooses the active asset and handles loading Atlas summaries.
- `AtlasAssetInspect.svelte`: page composition for one asset.
- `AtlasMetadataPanel.svelte`: left list panel, filter, grouped metadata rows.
- `AtlasImageStage.svelte`: image viewer shell, zoom controls, focused preview callback.
- `AtlasAiMetadataSection.svelte`: collapsed/expanded empty-state shell for future generation metadata.
- API endpoint: returns `{ asset, atlas }` for one asset or a 404.

---

### Task 1: Align Atlas Types And App Mode

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/lib/atlas/types.ts`
- Modify: `src/lib/data/mock-navigation.ts`

- [ ] **Step 1: Update shared app and Atlas types**

Edit `src/lib/types.ts`:

```ts
export type AppMode = 'home' | 'library' | 'explore' | 'atlas' | 'canvas' | 'colors' | 'resources';
```

Edit `src/lib/atlas/types.ts`:

```ts
export type AtlasClaimKind =
	| 'rights'
	| 'medium'
	| 'date'
	| 'dimensions'
	| 'source_metadata'
	| 'technical_metadata'
	| 'ai_generation';

export type AtlasEvidence =
	| 'observed'
	| 'metadata'
	| 'prompted'
	| 'inferred'
	| 'interpretive'
	| 'computed';
```

- [ ] **Step 2: Add Atlas to desktop navigation**

Edit `src/lib/data/mock-navigation.ts`:

```ts
export const appModes: Array<{ id: AppMode; label: string }> = [
	{ id: 'home', label: 'Home' },
	{ id: 'library', label: 'Library' },
	{ id: 'explore', label: 'Explore' },
	{ id: 'atlas', label: 'Atlas' },
	{ id: 'canvas', label: 'Canvas' },
	{ id: 'colors', label: 'Colors' },
	{ id: 'resources', label: 'Resources' }
];
```

Do not add Atlas to `mobileModes` in this slice. Phone Atlas editing remains deferred.

- [ ] **Step 3: Run type check and expect current nav icon failure**

Run:

```sh
npm run check
```

Expected: FAIL because `ModeRail.svelte` does not yet provide an icon for `atlas`.

- [ ] **Step 4: Commit**

```sh
git add src/lib/types.ts src/lib/atlas/types.ts src/lib/data/mock-navigation.ts
git commit -m "Add Atlas app mode types"
```

---

### Task 2: Add Atlas State Helpers And Rail Icon

**Files:**

- Modify: `src/lib/state/app-state.svelte.ts`
- Modify: `src/lib/components/shell/ModeRail.svelte`

- [ ] **Step 1: Add state fields and helper**

Edit the `appState` object in `src/lib/state/app-state.svelte.ts`:

```ts
	activeAtlasAssetId: null as string | null,
```

Add this helper near other open/select helpers:

```ts
export function openAtlasAsset(assetId: string) {
	appState.activeAtlasAssetId = assetId;
	appState.selectedAssetId = assetId;
	appState.mode = 'atlas';
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
	appState.inspectorOpen = false;
	appState.shellScrolled = false;
	appState.focusedPreviewOpen = false;
}
```

In `setMode`, preserve the selected Atlas asset when switching into Atlas:

```ts
	if (mode === 'atlas' && !appState.activeAtlasAssetId && appState.selectedAssetId) {
		appState.activeAtlasAssetId = appState.selectedAssetId;
	}
```

Place that block after `appState.mode = mode;`.

- [ ] **Step 2: Add Atlas rail icon**

Edit `src/lib/components/shell/ModeRail.svelte` imports:

```ts
import DatabaseIcon from 'phosphor-svelte/lib/DatabaseIcon';
```

Update `icons`:

```ts
	const icons = {
		home: HouseIcon,
		library: BookOpenIcon,
		explore: CompassIcon,
		atlas: DatabaseIcon,
		canvas: ScribbleIcon,
		colors: PaletteIcon,
		resources: FolderIcon
	};
```

- [ ] **Step 3: Verify check passes**

Run:

```sh
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add src/lib/state/app-state.svelte.ts src/lib/components/shell/ModeRail.svelte
git commit -m "Wire Atlas into app navigation"
```

---

### Task 3: Add Atlas Asset API Endpoint

**Files:**

- Create: `src/routes/api/library/assets/[id]/atlas/+server.ts`
- Create: `src/routes/api/library/assets/[id]/atlas/server.spec.ts`

- [ ] **Step 1: Write failing API tests**

Create `src/routes/api/library/assets/[id]/atlas/server.spec.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

describe('GET /api/library/assets/[id]/atlas', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns a library asset with Atlas summary data', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Atlas route ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/atlas.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 800,
					source_url: 'https://www.metmuseum.org/art/collection/search/123',
					page_title: 'Atlas Route Ref',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: {
						source: 'met',
						sourceName: 'The Met',
						creator: 'Pablo Picasso',
						dateDisplay: '1937',
						medium: 'Oil on canvas',
						rights: 'Public domain image according to The Met.',
						tags: ['Horse', 'War']
					}
				}
			]
		});
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: imported.imported[0].asset_id } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.asset.title).toBe('Atlas Route Ref');
		expect(body.atlas.assetId).toBe(imported.imported[0].asset_id);
		expect(body.atlas.entities).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'artist', label: 'Pablo Picasso' }),
				expect.objectContaining({ kind: 'source', label: 'The Met' })
			])
		);
		expect(body.atlas.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'date', value: '1937' }),
				expect.objectContaining({ kind: 'medium', value: 'Oil on canvas' })
			])
		);
		expect(body.atlas.tagSuggestions).toEqual(
			expect.arrayContaining([expect.objectContaining({ label: 'Horse', status: 'suggested' })])
		);
	});

	it('returns 404 for a missing asset', async () => {
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'missing-asset' } });
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe('Asset not found');
	});
});
```

- [ ] **Step 2: Run the failing test**

Run:

```sh
npm run test:unit -- --run src/routes/api/library/assets/[id]/atlas/server.spec.ts
```

Expected: FAIL because `+server.ts` does not exist.

- [ ] **Step 3: Implement endpoint**

Create `src/routes/api/library/assets/[id]/atlas/+server.ts`:

```ts
import { getAtlasAssetSummary } from '$lib/server/atlas/read';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { EXTENSION_CORS_HEADERS } from '../../../../cors';

export function GET({ params }: { params: { id: string } }) {
	const snapshot = getLibrarySnapshot();
	const asset = snapshot.assets.find((item) => item.id === params.id);
	if (!asset) {
		return Response.json(
			{ error: 'Asset not found' },
			{ status: 404, headers: EXTENSION_CORS_HEADERS }
		);
	}

	return Response.json(
		{
			asset,
			atlas: getAtlasAssetSummary(params.id)
		},
		{ headers: EXTENSION_CORS_HEADERS }
	);
}
```

- [ ] **Step 4: Verify endpoint tests pass**

Run:

```sh
npm run test:unit -- --run src/routes/api/library/assets/[id]/atlas/server.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/routes/api/library/assets/[id]/atlas
git commit -m "Add Atlas asset summary API"
```

---

### Task 4: Add Atlas Display Helpers

**Files:**

- Create: `src/lib/atlas/display.ts`
- Create: `src/lib/atlas/display.spec.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/lib/atlas/display.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { atlasRowTone, groupAtlasRows, normalizeDisplayTag } from './display';

describe('Atlas display helpers', () => {
	it('groups rows without losing order inside groups', () => {
		const groups = groupAtlasRows([
			{ group: 'Identity', label: 'Artist', value: 'Pablo Picasso', tone: 'artist' },
			{ group: 'Identity', label: 'Work', value: 'Guernica', tone: 'work' },
			{ group: 'Source Claims', label: 'Medium', value: 'Oil on canvas', tone: 'source' }
		]);

		expect(groups).toEqual([
			{
				name: 'Identity',
				rows: [
					{ group: 'Identity', label: 'Artist', value: 'Pablo Picasso', tone: 'artist' },
					{ group: 'Identity', label: 'Work', value: 'Guernica', tone: 'work' }
				]
			},
			{
				name: 'Source Claims',
				rows: [{ group: 'Source Claims', label: 'Medium', value: 'Oil on canvas', tone: 'source' }]
			}
		]);
	});

	it('maps Atlas concept kinds to display tones', () => {
		expect(atlasRowTone({ kind: 'artist' })).toBe('artist');
		expect(atlasRowTone({ kind: 'work' })).toBe('work');
		expect(atlasRowTone({ kind: 'rights' })).toBe('source');
		expect(atlasRowTone({ kind: 'medium' })).toBe('source');
		expect(atlasRowTone({ status: 'suggested' })).toBe('prompt');
	});

	it('normalizes legacy display tags into row labels', () => {
		expect(normalizeDisplayTag('Blue Horse')).toEqual({
			label: 'Blue Horse',
			value: 'blue_horse'
		});
	});
});
```

- [ ] **Step 2: Run failing tests**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/display.spec.ts
```

Expected: FAIL because `display.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/lib/atlas/display.ts`:

```ts
import { normalizeAtlasSlug } from './normalization';

export type AtlasRowTone =
	| 'artist'
	| 'work'
	| 'entity'
	| 'visual'
	| 'classifier'
	| 'source'
	| 'prompt'
	| 'review'
	| 'muted';

export type AtlasDisplayRow = {
	group: string;
	label: string;
	value: string;
	tone: AtlasRowTone;
	meta?: string;
};

export type AtlasDisplayGroup = {
	name: string;
	rows: AtlasDisplayRow[];
};

export function groupAtlasRows(rows: AtlasDisplayRow[]): AtlasDisplayGroup[] {
	const groups = new Map<string, AtlasDisplayGroup>();
	for (const row of rows) {
		const group = groups.get(row.group) ?? { name: row.group, rows: [] };
		group.rows.push(row);
		groups.set(row.group, group);
	}
	return [...groups.values()];
}

export function atlasRowTone(value: { kind?: string; status?: string }): AtlasRowTone {
	if (value.status === 'suggested' || value.status === 'needs_review') return 'prompt';
	if (value.kind === 'artist') return 'artist';
	if (value.kind === 'work' || value.kind === 'ip' || value.kind === 'character') return 'work';
	if (value.kind === 'institution' || value.kind === 'source' || value.kind === 'rights') return 'source';
	if (value.kind === 'medium' || value.kind === 'date' || value.kind === 'source_metadata') return 'source';
	if (value.kind === 'species' || value.kind === 'place') return 'entity';
	return 'visual';
}

export function normalizeDisplayTag(input: string) {
	return {
		label: input,
		value: normalizeAtlasSlug(input)
	};
}
```

- [ ] **Step 4: Verify helper tests pass**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/display.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/lib/atlas/display.ts src/lib/atlas/display.spec.ts
git commit -m "Add Atlas display helpers"
```

---

### Task 5: Build Atlas Workspace And Asset Inspect Components

**Files:**

- Create: `src/lib/components/atlas/AtlasWorkspace.svelte`
- Create: `src/lib/components/atlas/AtlasAssetInspect.svelte`
- Create: `src/lib/components/atlas/AtlasMetadataPanel.svelte`
- Create: `src/lib/components/atlas/AtlasImageStage.svelte`
- Create: `src/lib/components/atlas/AtlasAiMetadataSection.svelte`
- Modify: `src/lib/components/shell/AppShell.svelte`

- [ ] **Step 1: Create AI metadata empty-state component**

Create `src/lib/components/atlas/AtlasAiMetadataSection.svelte`:

```svelte
<script lang="ts">
	let open = $state(false);
</script>

<details class="ai-metadata" bind:open>
	<summary>
		<span>
			<strong>AI Generation Metadata</strong>
			<small>No embedded generation metadata has been parsed for this asset yet.</small>
		</span>
		<span aria-hidden="true">{open ? '⌄' : '›'}</span>
	</summary>
	<div class="empty">
		<p>NovelAI and other generator metadata will appear here as parsed settings, prompt tokens, prompt-derived suggestions, prompt text, and raw payloads.</p>
	</div>
</details>

<style>
	.ai-metadata {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	summary {
		min-height: 3.2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	strong,
	small {
		display: block;
	}

	strong {
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	small,
	.empty {
		color: var(--color-muted);
	}

	.empty {
		border-top: 1px solid var(--color-border);
		padding: var(--space-4);
		line-height: 1.45;
	}
</style>
```

- [ ] **Step 2: Create image stage component**

Create `src/lib/components/atlas/AtlasImageStage.svelte`:

```svelte
<script lang="ts">
	import ArrowsOutSimpleIcon from 'phosphor-svelte/lib/ArrowsOutSimpleIcon';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, onPreview }: Props = $props();
	let zoom = $state(100);
	let annotationsOn = $state(false);
	let imageFailed = $state(false);

	let imageUrl = $derived(asset.imageUrl);
	let title = $derived(asset.title);
	let transform = $derived(`scale(${zoom / 100})`);

	$effect(() => {
		if (asset.id || imageUrl) imageFailed = false;
	});
</script>

<section class="image-stage" aria-label="Atlas image viewer">
	<div class="toolbar" aria-label="Image tools">
		<button type="button" onclick={() => (zoom = Math.max(75, zoom - 10))}>−</button>
		<input type="range" min="75" max="160" bind:value={zoom} aria-label="Zoom level" />
		<button type="button" onclick={() => (zoom = Math.min(160, zoom + 10))}>+</button>
		<button type="button" onclick={() => (zoom = 100)}>Fit</button>
		<button type="button" onclick={() => (zoom = 135)}>Actual Size</button>
		<button type="button" aria-pressed={annotationsOn} onclick={() => (annotationsOn = !annotationsOn)}>
			{annotationsOn ? 'Annotations: On' : 'Annotations: Off'}
		</button>
		<button type="button" disabled>Palette analysis</button>
	</div>

	<button
		class="preview"
		type="button"
		aria-label={`Open focused preview for ${title}`}
		onclick={() => onPreview?.(asset)}
	>
		{#if !imageFailed}
			<img src={imageUrl} alt={title} style={`transform: ${transform}`} onerror={() => (imageFailed = true)} />
			<span><ArrowsOutSimpleIcon size={18} /> Open large preview</span>
		{:else}
			<strong>Image unavailable</strong>
		{/if}
	</button>
</section>

<style>
	.image-stage {
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(18rem, 1fr);
		gap: var(--space-3);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.toolbar button {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
	}

	input {
		width: min(12rem, 34vw);
		accent-color: var(--color-text);
	}

	.preview {
		position: relative;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(8% 0.006 70);
	}

	img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		transition: transform var(--duration-base) var(--ease-out);
	}

	.preview span {
		position: absolute;
		right: var(--space-3);
		bottom: var(--space-3);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.35rem 0.55rem;
		border-radius: var(--radius-md);
		background: oklch(10% 0.006 70 / 0.82);
		color: var(--color-muted);
	}
</style>
```

- [ ] **Step 3: Create metadata panel component**

Create `src/lib/components/atlas/AtlasMetadataPanel.svelte`:

```svelte
<script lang="ts">
	import { atlasRowTone, groupAtlasRows, type AtlasDisplayRow } from '$lib/atlas/display';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
	};

	let { asset, atlas }: Props = $props();
	let filter = $state('');

	let rows = $derived(buildRows(asset, atlas));
	let filteredRows = $derived(
		filter.trim()
			? rows.filter((row) => `${row.label} ${row.value} ${row.meta ?? ''}`.toLowerCase().includes(filter.trim().toLowerCase()))
			: rows
	);
	let groups = $derived(groupAtlasRows(filteredRows));

	function buildRows(asset: Asset, atlas: AtlasAssetSummary | null): AtlasDisplayRow[] {
		const identity: AtlasDisplayRow[] = [
			{ group: 'Identity', label: 'Title', value: asset.title, tone: 'work' },
			{ group: 'Identity', label: 'Artist', value: asset.creator, tone: 'artist' },
			{ group: 'Identity', label: 'Year', value: asset.year, tone: 'source' },
			{ group: 'Identity', label: 'Medium', value: asset.medium, tone: 'source' },
			{ group: 'Identity', label: 'Source', value: asset.sourceName, tone: 'source' }
		].filter((row) => row.value.trim());

		const entities =
			atlas?.entities.map((entity) => ({
				group: 'Source Entities',
				label: entity.kind,
				value: entity.label,
				tone: atlasRowTone(entity),
				meta: entity.provenance
			})) ?? [];

		const claims =
			atlas?.claims.map((claim) => ({
				group: 'Source Claims',
				label: claim.kind,
				value: claim.value,
				tone: atlasRowTone(claim),
				meta: claim.provenance
			})) ?? [];

		const suggestions =
			atlas?.tagSuggestions.map((tag) => ({
				group: 'Suggested Tags Needing Review',
				label: tag.label,
				value: tag.sourceText,
				tone: 'prompt' as const,
				meta: tag.provenance
			})) ?? [];

		const legacyTags = asset.tags.map((tag) => ({
			group: 'Legacy Library Tags',
			label: tag,
			value: tag,
			tone: 'visual' as const,
			meta: 'library tag'
		}));

		return [...identity, ...entities, ...claims, ...legacyTags, ...suggestions];
	}
</script>

<aside class="metadata-panel" aria-label="Atlas asset metadata">
	<div class="filter">
		<input bind:value={filter} type="search" placeholder="Filter metadata..." aria-label="Filter metadata" />
	</div>

	{#each groups as group (group.name)}
		<details class="group" open>
			<summary>{group.name} <span>{group.rows.length}</span></summary>
			<ul>
				{#each group.rows as row}
					<li class={`tone-${row.tone}`}>
						<span class="label">{row.label}</span>
						<span class="value">{row.value}</span>
						{#if row.meta}
							<small>{row.meta}</small>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/each}
</aside>

<style>
	.metadata-panel {
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--color-border);
		background: oklch(12% 0.008 70 / 0.82);
		padding: var(--space-3);
	}

	.filter {
		position: sticky;
		top: 0;
		z-index: 1;
		padding-bottom: var(--space-3);
		background: oklch(12% 0.008 70);
	}

	input {
		width: 100%;
		min-height: 2.35rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
	}

	.group {
		border-top: 1px solid var(--color-border-soft);
		padding: var(--space-2) 0;
	}

	summary {
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	ul {
		display: grid;
		gap: 0.18rem;
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(5.5rem, 0.38fr) 1fr;
		gap: var(--space-2);
		padding: 0.12rem 0;
		font-size: 0.78rem;
	}

	.label {
		color: var(--color-dim);
	}

	small {
		grid-column: 2;
		color: var(--color-dim);
	}

	.tone-artist .value { color: oklch(76% 0.075 295); }
	.tone-work .value { color: oklch(76% 0.07 320); }
	.tone-entity .value { color: oklch(76% 0.07 230); }
	.tone-visual .value { color: oklch(74% 0.07 245); }
	.tone-classifier .value { color: oklch(72% 0.055 130); }
	.tone-source .value { color: oklch(70% 0.025 235); }
	.tone-prompt .value { color: oklch(76% 0.07 78); }
	.tone-review .value { color: oklch(76% 0.1 65); }
	.tone-muted .value { color: var(--color-muted); }
</style>
```

- [ ] **Step 4: Create asset inspect page component**

Create `src/lib/components/atlas/AtlasAssetInspect.svelte`:

```svelte
<script lang="ts">
	import AtlasAiMetadataSection from './AtlasAiMetadataSection.svelte';
	import AtlasImageStage from './AtlasImageStage.svelte';
	import AtlasMetadataPanel from './AtlasMetadataPanel.svelte';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		loading?: boolean;
		error?: string | null;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, atlas, loading = false, error = null, onPreview }: Props = $props();
</script>

<section class="atlas-inspect" aria-label={`Atlas inspect ${asset.title}`}>
	<header class="top">
		<div>
			<p>Atlas Inspect</p>
			<h1>{asset.title}</h1>
			<span>{[asset.creator, asset.year, asset.medium].filter(Boolean).join(' · ')}</span>
		</div>
		<div class="actions">
			<button type="button" disabled={loading}>Edit metadata</button>
			<button type="button">Add to project</button>
		</div>
	</header>

	<div class="body">
		<AtlasMetadataPanel {asset} {atlas} />
		<div class="main">
			{#if error}
				<p class="error">{error}</p>
			{/if}
			<AtlasImageStage {asset} {onPreview} />
			<AtlasAiMetadataSection />
		</div>
	</div>
</section>

<style>
	.atlas-inspect {
		height: 100%;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--color-bg);
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
	}

	p,
	h1 {
		margin: 0;
	}

	p {
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		font-size: 1.25rem;
	}

	span {
		color: var(--color-muted);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}

	.body {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr);
	}

	.main {
		min-height: 0;
		display: grid;
		grid-template-rows: minmax(22rem, 1fr) auto;
		gap: var(--space-3);
		padding: var(--space-3);
		overflow: auto;
	}

	.error {
		color: var(--color-danger);
	}

	@media (max-width: 900px) {
		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
```

- [ ] **Step 5: Create workspace data loader**

Create `src/lib/components/atlas/AtlasWorkspace.svelte`:

```svelte
<script lang="ts">
	import AtlasAssetInspect from './AtlasAssetInspect.svelte';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import FocusedAssetPreview from '$lib/components/inspector/FocusedAssetPreview.svelte';
	import { appState, openAtlasAsset } from '$lib/state/app-state.svelte';
	import { libraryState } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type AtlasResponse = {
		asset: Asset;
		atlas: AtlasAssetSummary;
	};

	let atlas = $state<AtlasAssetSummary | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let previewAsset = $state<Asset | null>(null);

	let fallbackAsset = $derived(libraryState.snapshot.assets[0] ?? null);
	let activeAssetId = $derived(appState.activeAtlasAssetId ?? appState.selectedAssetId ?? fallbackAsset?.id ?? null);
	let asset = $derived(libraryState.snapshot.assets.find((item) => item.id === activeAssetId) ?? fallbackAsset);

	$effect(() => {
		if (asset && appState.activeAtlasAssetId !== asset.id) {
			openAtlasAsset(asset.id);
		}
	});

	$effect(() => {
		if (!asset) return;
		void loadAtlas(asset.id);
	});

	async function loadAtlas(assetId: string) {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(assetId)}/atlas`);
			const body = (await response.json()) as AtlasResponse | { error?: string };
			if (!response.ok || !('atlas' in body)) {
				throw new Error('error' in body && body.error ? body.error : 'Atlas metadata could not be loaded.');
			}
			atlas = body.atlas;
		} catch (loadError) {
			atlas = null;
			error = loadError instanceof Error ? loadError.message : 'Atlas metadata could not be loaded.';
		} finally {
			loading = false;
		}
	}
</script>

{#if asset}
	<AtlasAssetInspect {asset} {atlas} {loading} {error} onPreview={(item) => (previewAsset = item)} />
{:else}
	<section class="empty" aria-label="Atlas empty state">
		<p>No library assets are available yet.</p>
	</section>
{/if}

{#if previewAsset}
	<FocusedAssetPreview asset={previewAsset} onClose={() => (previewAsset = null)} />
{/if}

<style>
	.empty {
		height: 100%;
		display: grid;
		place-items: center;
		color: var(--color-muted);
	}
</style>
```

- [ ] **Step 6: Mount Atlas workspace in app shell**

Modify `src/lib/components/shell/AppShell.svelte` imports:

```ts
import AtlasWorkspace from '$lib/components/atlas/AtlasWorkspace.svelte';
```

Add a branch after the Explore workspace branch:

```svelte
			{:else if appState.mode === 'atlas'}
				<AtlasWorkspace />
```

- [ ] **Step 7: Run check**

Run:

```sh
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add src/lib/components/atlas src/lib/components/shell/AppShell.svelte
git commit -m "Add Atlas asset inspect workspace"
```

---

### Task 6: Add Library Inspector Deep Link

**Files:**

- Modify: `src/lib/components/inspector/AssetInspector.svelte`

- [ ] **Step 1: Add state import**

Edit imports in `src/lib/components/inspector/AssetInspector.svelte`:

```ts
import { openAtlasAsset } from '$lib/state/app-state.svelte';
```

- [ ] **Step 2: Add Open in Atlas action**

Add this button inside the existing `.actions` block before `Open Source`:

```svelte
			<button type="button" onclick={() => asset && openAtlasAsset(asset.id)}>
				<GridFourIcon size={19} /> Open in Atlas
			</button>
```

- [ ] **Step 3: Run check**

Run:

```sh
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add src/lib/components/inspector/AssetInspector.svelte
git commit -m "Link library inspector to Atlas"
```

---

### Task 7: Add E2E Smoke Coverage

**Files:**

- Modify: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Add desktop e2e assertions to existing desktop test**

In `tests/pastiche.e2e.ts`, find the desktop library/explore test after it opens `Crimson Horizon` in the image inspector. Add:

```ts
	await page.getByRole('button', { name: 'Open in Atlas' }).click();
	await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Atlas' })).toHaveClass(/active/);
	await expect(page.getByRole('region', { name: /Atlas inspect Crimson Horizon/ })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Atlas asset metadata' })).toBeVisible();
	await expect(page.getByLabel('Filter metadata')).toBeVisible();
	await page.getByLabel('Filter metadata').fill('source');
	await expect(page.getByText('Source Claims')).toBeVisible();
	await expect(page.getByText('AI Generation Metadata')).toBeVisible();
```

If the exact selected test asset differs, use the asset already inspected in that test.

- [ ] **Step 2: Run targeted e2e test**

Run:

```sh
npx playwright test tests/pastiche.e2e.ts:223
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
git add tests/pastiche.e2e.ts
git commit -m "Cover Atlas inspect navigation"
```

---

### Task 8: Full Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run Svelte check**

Run:

```sh
npm run check
```

Expected: 0 errors and 0 warnings.

- [ ] **Step 2: Run unit tests**

Run:

```sh
npm run test:unit -- --run
```

Expected: all test files pass.

- [ ] **Step 3: Run production build**

Run:

```sh
npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Run full project test**

Run:

```sh
npm test
```

Expected: unit tests and Playwright e2e pass.

- [ ] **Step 5: Commit verification-only fixes when verification exposes them**

When verification exposes small compatibility fixes, make them with focused commits. Do not mix unrelated UI polish into this implementation slice.

---

## Self-Review Notes

Spec coverage:

- Top-level Atlas mode: Task 1 and Task 2.
- Read-only asset inspect shell: Task 5.
- Category-colored row grammar: Task 4 and Task 5.
- Library `Open in Atlas` deep link: Task 6.
- API-backed Atlas data: Task 3.
- Empty AI metadata section: Task 5.
- Focused image preview: Task 5.
- E2E smoke coverage: Task 7.

Deferred requirements are intentionally outside this plan and covered by separate specs:

- Wiki UI.
- Search browser UI.
- AI generation parser.
- Editing/review queues/history.
- Annotation authoring.

No task uses incomplete implementation language. Component code is intentionally minimal for the first view-mode slice; polish work during execution must preserve the row/list grammar and avoid pill-based governance UI.
