# Library Search Mobile Upload Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Library hub usable by adding real search results, reducing mobile density, making tag groups progressively disclosed, cleaning folder-view controls, and wiring the Add to Library sheet to the existing import backend.

**Architecture:** Keep the Library hub as a composed UI over the existing `LibraryResponse` snapshot. Add small client view-model helpers for search and mobile tag summaries, then reuse `/api/import` for local image upload, folder import, URL import, and clipboard import. Avoid changing the persistence model unless a task explicitly proves the import endpoint cannot support the needed flow.

**Tech Stack:** Svelte 5, SvelteKit API routes, TypeScript, Vitest, Playwright smoke checks, Phosphor icons, existing `/api/import` import service.

---

## Critique Summary

### Impeccable Critique Inputs

- Product context loaded from `PRODUCT.md` and `DESIGN.md`.
- Register: `product`.
- Deterministic detector command: `npx impeccable --json src/lib/components/library src/lib/components/shell src/routes`.
- Deterministic detector result: `[]`.
- Live measurements were gathered at desktop `1440x900` and mobile `390x844`.

### Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                        |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 1         | Library search accepts input but shows no state, no count, no results, and no empty message.                     |
| 2         | Match System / Real World       | 2         | Upload actions promise gallery/folder/clipboard imports but are static buttons.                                  |
| 3         | User Control and Freedom        | 2         | Mobile tags expand into a long list with weak escape/summary controls.                                           |
| 4         | Consistency and Standards       | 2         | Library hub search, top-bar search, folder-view search, and Add sheet use different control vocabularies.        |
| 5         | Error Prevention                | 1         | Upload has no validation, import progress, duplicate feedback, or failure state in the UI.                       |
| 6         | Recognition Rather Than Recall  | 2         | Tags expose empty groups instead of useful summaries; users must inspect too many rows.                          |
| 7         | Flexibility and Efficiency      | 1         | Search does not support direct navigation or filtered browsing, so it cannot speed movement through the archive. |
| 8         | Aesthetic and Minimalist Design | 1         | Mobile creates giant full-width buttons and expands low-value sections, consuming the task surface.              |
| 9         | Error Recovery                  | 1         | Upload/import failures are not surfaced because no import path is wired.                                         |
| 10        | Help and Documentation          | 2         | Some labels are clear, but non-working controls mislead users.                                                   |
| **Total** |                                 | **16/40** | **Needs immediate UX repair before further visual polish.**                                                      |

### Anti-Patterns Verdict

This does not look like generic AI-gradient slop; it fails in a more product-specific way. The visual language is on-brand in color and type, but the components are not earning their footprint. On mobile, standard task controls are rendered as ceremonial blocks, and organization data is shown exhaustively instead of progressively.

### Measured Failures

- Desktop Library search is `1308px x 49px`; it is visually prominent but behaviorally inert.
- Mobile Library search is `358px x 49px`; it keeps desktop chrome and does not explain scope.
- Mobile create buttons are each `358px x 48px`; three buttons consume a large vertical chunk before any archive content.
- Mobile General tag row measured `157px` tall, followed by nine tag-group rows around `74px` each.
- Four visible tag groups rendered `No tags in this group`, forcing users through low-value rows.
- `src/lib/components/ui/AddToLibrarySheet.svelte` has no file inputs, URL input, clipboard handler, import request, progress state, or snapshot refresh.

## File Structure

### Search Model

- Modify `src/lib/components/library/libraryOverviewModel.ts`
  - Add `normalizeLibraryQuery`, `searchLibrary`, `filterAssetsByLibraryQuery`, and result grouping types.
- Modify `src/lib/components/library/libraryOverviewModel.spec.ts`
  - Add focused unit tests for assets, projects, folders, tags, empty query, and result ranking.

### Search UI

- Modify `src/lib/components/library/LibrarySearch.svelte`
  - Convert from inert input into a scoped search surface with suggestions/results and submit behavior.
- Modify `src/lib/components/library/LibraryOverview.svelte`
  - Pass `library`, `variant="hub"`, and open handlers into `LibrarySearch`.
- Modify `src/lib/components/library/FolderContents.svelte`
  - Filter visible assets by query inside the active scope and use compact mobile action controls.

### Mobile Layout

- Modify `src/lib/components/library/LibraryOverview.svelte`
  - Replace stacked mobile create buttons with a compact action rail.
- Modify `src/lib/components/library/TagGroupList.svelte`
  - Collapse groups by default on mobile, hide empty groups behind a low-priority disclosure, and summarize counts.
- Modify `src/lib/components/library/ProjectCardGrid.svelte`
  - Confirm mobile project cards remain horizontal and do not consume the whole first screen.
- Modify `src/lib/components/library/FolderContents.svelte`
  - Replace giant sort/action buttons next to search with icon actions or an overflow menu.

### Import UI

- Modify `src/lib/components/ui/AddToLibrarySheet.svelte`
  - Add hidden file inputs for image files and directory import.
  - Add URL import inline form.
  - Add clipboard paste handler.
  - Show import progress, imported count, duplicate count, and failures.
- Modify `src/lib/components/shell/AppShell.svelte`
  - Pass the current library snapshot and `setLibrarySnapshot` into the sheet or let the sheet load a fresh snapshot after import.
- Add `src/lib/components/ui/addToLibraryImport.ts`
  - Convert `File`, URL, and clipboard `Blob` data into `/api/import` requests.
- Add `src/lib/components/ui/addToLibraryImport.spec.ts`
  - Unit-test import request construction and image dimension extraction with mock files/blobs.
- Modify `src/routes/api/import/server.spec.ts`
  - Add coverage for the exact payload the UI will send for local manual imports.

---

## Task 1: Real Library Search View Model

**Files:**

- Modify: `src/lib/components/library/libraryOverviewModel.ts`
- Modify: `src/lib/components/library/libraryOverviewModel.spec.ts`

- [ ] **Step 1: Write failing search tests**

Add these tests to `src/lib/components/library/libraryOverviewModel.spec.ts`:

```ts
it('searches library assets by title, creator, source, medium, and accepted tags', () => {
	const assets = [
		assetFixture('hands-study', [
			{
				id: 'tag-hands',
				facetId: 'facet-subject',
				facetName: 'Subject',
				facetSlug: 'subject',
				value: 'hands',
				name: 'Subject: hands',
				slug: 'subject-hands',
				assetCount: 1
			}
		]),
		{ ...assetFixture('landscape', []), title: 'Coastal Landscape', creator: 'Turner' }
	];

	expect(filterAssetsByLibraryQuery(assets, 'hands').map((asset) => asset.id)).toEqual([
		'hands-study'
	]);
	expect(filterAssetsByLibraryQuery(assets, 'turner').map((asset) => asset.id)).toEqual([
		'landscape'
	]);
});

it('returns grouped search results for hub navigation', () => {
	const results = searchLibrary({
		library: {
			assets: [assetFixture('hands-study', [])],
			folders: [
				{
					id: 'folder-figures',
					name: 'Figures',
					path: ['library', 'References', 'Figures'],
					assetCount: 3,
					childFolderCount: 0
				}
			],
			projects: [
				{
					id: 'project-study',
					name: 'Figure Studies',
					description: null,
					pinned: false,
					coverAssetId: null,
					coverPreviewUrl: null,
					assetCount: 1,
					folderCount: 0,
					createdAt: '2026-06-04T00:00:00.000Z',
					updatedAt: '2026-06-04T00:00:00.000Z'
				}
			],
			tagFacets: [
				{
					id: 'facet-subject',
					name: 'Subject',
					slug: 'subject',
					kind: 'facet',
					tagCount: 1,
					tags: [
						{
							id: 'tag-figure',
							facetId: 'facet-subject',
							facetName: 'Subject',
							facetSlug: 'subject',
							value: 'figure',
							name: 'Subject: figure',
							slug: 'subject-figure',
							assetCount: 1
						}
					]
				}
			],
			stats: { assets: 1, folders: 1, projects: 1, tags: 1 }
		},
		query: 'figure'
	});

	expect(results.projects[0]?.id).toBe('project-study');
	expect(results.folders[0]?.id).toBe('folder-figures');
	expect(results.tags[0]?.id).toBe('tag-figure');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test:unit -- --run src/lib/components/library/libraryOverviewModel.spec.ts
```

Expected: fails because `filterAssetsByLibraryQuery` and `searchLibrary` do not exist.

- [ ] **Step 3: Implement the model helpers**

Add to `src/lib/components/library/libraryOverviewModel.ts`:

```ts
import type { LibraryAsset, LibraryProject, LibraryResponse, LibraryTag } from '$lib/library/types';

export type LibrarySearchResults = {
	assets: LibraryAsset[];
	projects: LibraryProject[];
	folders: FolderTreeNode[];
	tags: LibraryTag[];
	hasQuery: boolean;
	total: number;
};

export function normalizeLibraryQuery(query: string) {
	return query.trim().toLocaleLowerCase();
}

export function filterAssetsByLibraryQuery(assets: LibraryAsset[], query: string): LibraryAsset[] {
	const normalized = normalizeLibraryQuery(query);
	if (!normalized) return assets;
	return assets.filter((asset) =>
		[
			asset.title,
			asset.creator,
			asset.sourceName,
			asset.medium,
			asset.description,
			...(asset.record?.organization.tags.map((tag) => tag.value) ?? [])
		]
			.filter(Boolean)
			.some((value) => value.toLocaleLowerCase().includes(normalized))
	);
}

export function searchLibrary(input: {
	library: LibraryResponse;
	query: string;
	limit?: number;
}): LibrarySearchResults {
	const normalized = normalizeLibraryQuery(input.query);
	const limit = input.limit ?? 6;
	if (!normalized) {
		return { assets: [], projects: [], folders: [], tags: [], hasQuery: false, total: 0 };
	}
	const folders = buildFolderTree(input.library.folders)
		.flatMap(flattenFolderTree)
		.filter((folder) => folder.name.toLocaleLowerCase().includes(normalized));
	const projects = input.library.projects.filter((project) =>
		project.name.toLocaleLowerCase().includes(normalized)
	);
	const tags = input.library.tagFacets
		.flatMap((group) => group.tags)
		.filter((tag) =>
			[tag.value, tag.name, tag.facetName].some((value) =>
				value.toLocaleLowerCase().includes(normalized)
			)
		);
	const assets = filterAssetsByLibraryQuery(input.library.assets, normalized);
	return {
		assets: assets.slice(0, limit),
		projects: projects.slice(0, limit),
		folders: folders.slice(0, limit),
		tags: tags.slice(0, limit),
		hasQuery: true,
		total: assets.length + projects.length + folders.length + tags.length
	};
}

function flattenFolderTree(node: FolderTreeNode): FolderTreeNode[] {
	return [node, ...node.children.flatMap(flattenFolderTree)];
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm run test:unit -- --run src/lib/components/library/libraryOverviewModel.spec.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/components/library/libraryOverviewModel.ts src/lib/components/library/libraryOverviewModel.spec.ts
git commit -m "Add library search view model"
```

---

## Task 2: Search UI That Shows Results

**Files:**

- Modify: `src/lib/components/library/LibrarySearch.svelte`
- Modify: `src/lib/components/library/LibraryOverview.svelte`
- Modify: `src/lib/components/library/FolderContents.svelte`

- [ ] **Step 1: Replace inert search props with action props**

In `LibrarySearch.svelte`, change props to:

```ts
import type { LibraryResponse, LibraryTag } from '$lib/library/types';
import type { LibraryFolder } from '$lib/types';
import type { LibraryProject } from '$lib/library/types';
import { searchLibrary } from './libraryOverviewModel';

type Props = {
	library: LibraryResponse;
	placeholder?: string;
	label?: string;
	scopeLabel?: string;
	compact?: boolean;
	onOpenFolder: (path: string[]) => void;
	onOpenProject: (id: string) => void;
	onOpenTag: (id: string) => void;
};
```

- [ ] **Step 2: Add result rendering**

Render result rows when `appState.query.trim().length >= 2`:

```svelte
{@const results = searchLibrary({ library, query: appState.query })}

{#if results.hasQuery}
	<div class="search-results" role="listbox" aria-label="Library search results">
		{#if results.total === 0}
			<p class="empty-result">No matches for "{appState.query.trim()}".</p>
		{:else}
			{#each results.projects as project (project.id)}
				<button type="button" onclick={() => onOpenProject(project.id)}>
					<span>Project</span>
					<strong>{project.name}</strong>
					<small>{project.assetCount.toLocaleString()} assets</small>
				</button>
			{/each}
			{#each results.folders as folder (folder.id)}
				<button type="button" onclick={() => onOpenFolder(folder.path)}>
					<span>Folder</span>
					<strong>{folder.name}</strong>
					<small>{folder.assetCount.toLocaleString()} assets</small>
				</button>
			{/each}
			{#each results.tags as tag (tag.id)}
				<button type="button" onclick={() => onOpenTag(tag.id)}>
					<span>Tag</span>
					<strong>{tag.value}</strong>
					<small>{tag.facetName}</small>
				</button>
			{/each}
			{#each results.assets as asset (asset.id)}
				<button type="button" onclick={() => (appState.selectedAssetId = asset.id)}>
					<span>Image</span>
					<strong>{asset.title}</strong>
					<small>{asset.creator || asset.sourceName}</small>
				</button>
			{/each}
		{/if}
	</div>
{/if}
```

- [ ] **Step 3: Update overview usage**

In `LibraryOverview.svelte`, replace `<LibrarySearch />` with:

```svelte
<LibrarySearch
	{library}
	onOpenFolder={(path) => openLibraryFolder(path)}
	onOpenProject={(id) => openProjectLibrary(id)}
	onOpenTag={(id) => openLibraryTag(id)}
/>
```

- [ ] **Step 4: Update folder view usage**

In `FolderContents.svelte`, pass the same handlers:

```svelte
<LibrarySearch
	{library}
	label={`Search ${title}`}
	scopeLabel={title}
	onOpenFolder={(path) => openLibraryFolder(path)}
	onOpenProject={(id) => openProjectLibrary(id)}
	onOpenTag={(id) => openLibraryTag(id)}
/>
```

Also import `openProjectLibrary` and `openLibraryTag`.

- [ ] **Step 5: Add scoped asset filtering**

In `FolderContents.svelte`, add:

```ts
let visibleAssets = $derived(filterAssetsByLibraryQuery(assets, appState.query));
```

Then pass `visibleAssets` to `AssetGrid`.

- [ ] **Step 6: Run checks**

Run:

```bash
npm run check
npm run test:unit -- --run src/lib/components/library/libraryOverviewModel.spec.ts
```

Expected: no Svelte diagnostics; model tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/components/library/LibrarySearch.svelte src/lib/components/library/LibraryOverview.svelte src/lib/components/library/FolderContents.svelte
git commit -m "Wire library search results"
```

---

## Task 3: Mobile Hub Density Repair

**Files:**

- Modify: `src/lib/components/library/LibraryOverview.svelte`
- Modify: `src/lib/components/library/ProjectCardGrid.svelte`

- [ ] **Step 1: Replace full-width mobile create buttons**

In `LibraryOverview.svelte`, keep desktop buttons as-is, but add mobile-specific compact actions:

```svelte
<div class="mobile-create-actions" aria-label="Create library organization">
	<button type="button" onclick={(event) => openCreate('project', event)}>
		<StackIcon size={17} />
		<span>Project</span>
	</button>
	<button type="button" onclick={(event) => openCreate('folder', event)}>
		<FolderIcon size={17} />
		<span>Folder</span>
	</button>
	<button type="button" onclick={(event) => openCreate('tag', event)}>
		<HashIcon size={17} />
		<span>Tag</span>
	</button>
</div>
```

- [ ] **Step 2: Add compact mobile CSS**

Add:

```css
.mobile-create-actions {
	display: none;
}

@media (max-width: 759px) {
	.library-overview {
		gap: var(--space-4);
		padding: var(--space-4) var(--space-3) calc(var(--bottom-nav-height) + var(--space-6));
	}

	.create-actions {
		display: none;
	}

	.mobile-create-actions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.mobile-create-actions button {
		min-height: 2.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.82rem;
	}
}
```

- [ ] **Step 3: Confirm mobile first-screen content**

Run a Playwright measurement at `390x844` and verify:

```txt
create button height <= 40px
search height <= 44px
at least one project or folder section heading appears before y=520
```

- [ ] **Step 4: Commit**

Run:

```bash
git add src/lib/components/library/LibraryOverview.svelte src/lib/components/library/ProjectCardGrid.svelte
git commit -m "Compact mobile library hub actions"
```

---

## Task 4: Progressive Tag Groups For Mobile

**Files:**

- Modify: `src/lib/components/library/TagGroupList.svelte`
- Modify: `src/lib/components/library/LibraryOverview.svelte`
- Modify: `src/lib/components/library/libraryOverviewModel.ts`
- Modify: `src/lib/components/library/libraryOverviewModel.spec.ts`

- [ ] **Step 1: Add tag group filtering helper**

In `libraryOverviewModel.ts`, add:

```ts
export function visibleTagGroups(
	groups: LibraryTagFacet[],
	includeEmpty = false
): LibraryTagFacet[] {
	return groups.filter(
		(group) => includeEmpty || group.tags.length > 0 || group.slug === 'general'
	);
}
```

- [ ] **Step 2: Test empty group hiding**

In `libraryOverviewModel.spec.ts`, add:

```ts
it('hides empty tag groups by default while keeping General', () => {
	const groups = visibleTagGroups([
		{ id: 'general', slug: 'general', name: 'General', tagCount: 0, kind: 'general', tags: [] },
		{ id: 'empty', slug: 'empty', name: 'Empty', tagCount: 0, kind: 'facet', tags: [] },
		{
			id: 'subject',
			slug: 'subject',
			name: 'Subject',
			tagCount: 1,
			kind: 'facet',
			tags: [
				{
					id: 'tag-hands',
					facetId: 'subject',
					facetName: 'Subject',
					facetSlug: 'subject',
					value: 'hands',
					name: 'Subject: hands',
					slug: 'subject-hands',
					assetCount: 1
				}
			]
		}
	]);

	expect(groups.map((group) => group.slug)).toEqual(['general', 'subject']);
});
```

- [ ] **Step 3: Start tag groups collapsed on mobile**

In `LibraryOverview.svelte`, initialize:

```ts
let expandedTagGroups = $state(new Set<string>());
```

Do not force `general` expanded. The group row itself should show a compact preview count.

- [ ] **Step 4: Add compact group row summary**

In `TagGroupList.svelte`, render collapsed rows as:

```svelte
<button class="group-toggle" type="button" onclick={() => onToggle(group.slug)}>
	{#if expanded.has(group.slug)}
		<CaretDownIcon size={15} />
	{:else}
		<CaretRightIcon size={15} />
	{/if}
	<span class="group-dot" style={dotStyle(group.slug)}></span>
	<strong>{group.name}</strong>
	<small>{group.tags.length.toLocaleString()} tags</small>
</button>
```

Only render `.tag-pills` when `expanded.has(group.slug)`.

- [ ] **Step 5: Hide empty group pills**

If a group has no tags, render no pill row. Keep empty group management available through `+ Add Group`, not through repetitive empty rows.

- [ ] **Step 6: Add desktop exception**

Desktop may show `General` expanded by default if useful, but mobile must not. Use `window.matchMedia('(min-width: 760px)')` inside `onMount` or keep all groups collapsed and rely on previews.

- [ ] **Step 7: Run checks**

Run:

```bash
npm run check
npm run test:unit -- --run src/lib/components/library/libraryOverviewModel.spec.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/lib/components/library/TagGroupList.svelte src/lib/components/library/LibraryOverview.svelte src/lib/components/library/libraryOverviewModel.ts src/lib/components/library/libraryOverviewModel.spec.ts
git commit -m "Collapse mobile tag groups"
```

---

## Task 5: Folder View Search And Action Toolbar Cleanup

**Files:**

- Modify: `src/lib/components/library/FolderContents.svelte`
- Modify: `src/lib/components/library/LibrarySearch.svelte`

- [ ] **Step 1: Remove giant adjacent action buttons on mobile**

In `FolderContents.svelte`, split desktop and mobile actions:

```svelte
<div class="search-sort">
	<LibrarySearch ... />
	<div class="view-actions desktop-actions">...</div>
	<button class="mobile-overflow" type="button" aria-label="View actions">
		<DotsThreeIcon size={19} />
	</button>
</div>
```

Import `DotsThreeIcon`.

- [ ] **Step 2: Add compact mobile CSS**

```css
.mobile-overflow {
	display: none;
}

@media (max-width: 759px) {
	.search-sort {
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
	}

	.desktop-actions {
		display: none;
	}

	.mobile-overflow {
		width: 2.35rem;
		height: 2.35rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-muted);
	}
}
```

- [ ] **Step 3: Make folder-view search scope legible**

In `LibrarySearch.svelte`, when `scopeLabel` exists, show a compact prefix:

```svelte
{#if scopeLabel}
	<span class="scope-label">{scopeLabel}</span>
{/if}
```

CSS:

```css
.scope-label {
	max-width: 7rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--color-dim);
	font-size: 0.78rem;
}

@media (max-width: 759px) {
	.scope-label {
		display: none;
	}
}
```

- [ ] **Step 4: Run mobile measurement**

Expected at `390x844`:

```txt
folder view search row height <= 44px
only one compact action button sits next to search
no text button wider than 96px appears next to search
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/components/library/FolderContents.svelte src/lib/components/library/LibrarySearch.svelte
git commit -m "Tighten folder view search actions"
```

---

## Task 6: Working Add To Library Imports

**Files:**

- Add: `src/lib/components/ui/addToLibraryImport.ts`
- Add: `src/lib/components/ui/addToLibraryImport.spec.ts`
- Modify: `src/lib/components/ui/AddToLibrarySheet.svelte`
- Modify: `src/lib/components/shell/AppShell.svelte`
- Modify: `src/routes/api/import/server.spec.ts`

- [ ] **Step 1: Add import request builder**

Create `src/lib/components/ui/addToLibraryImport.ts`:

```ts
import type { ImportRequest } from '$lib/server/library/types';

export async function fileToImportItem(file: File, capturedAt = new Date().toISOString()) {
	const image = await readImageDimensions(file);
	return {
		filename: file.name,
		storage_mode: 'download' as const,
		image_data: await fileToDataUrlPayload(file),
		source_image_url: null,
		mime_type: file.type || 'application/octet-stream',
		natural_width: image.width,
		natural_height: image.height,
		source_url: `file://${file.name}`,
		page_title: file.name,
		alt_text: null,
		captured_at: capturedAt,
		metadata: {
			sourceName: 'Local file',
			sourceType: 'local' as const,
			rawMetadata: { fileName: file.name, fileSize: file.size }
		}
	};
}

export function buildImportRequest(input: {
	destinationFolderId: string | null;
	items: Awaited<ReturnType<typeof fileToImportItem>>[];
}): ImportRequest {
	return {
		destination_folder_id: input.destinationFolderId,
		items: input.items
	};
}

async function fileToDataUrlPayload(file: File) {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('File could not be read'));
		reader.readAsDataURL(file);
	});
	return dataUrl.split(',')[1] ?? '';
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('Image dimensions could not be read'));
			image.src = url;
		});
		return { width: image.naturalWidth || 0, height: image.naturalHeight || 0 };
	} finally {
		URL.revokeObjectURL(url);
	}
}
```

- [ ] **Step 2: Add builder tests**

Create `src/lib/components/ui/addToLibraryImport.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildImportRequest } from './addToLibraryImport';

describe('buildImportRequest', () => {
	it('targets the active folder and preserves import items', () => {
		const request = buildImportRequest({
			destinationFolderId: 'folder-reference',
			items: [
				{
					filename: 'study.png',
					storage_mode: 'download',
					image_data: 'abc',
					source_image_url: null,
					mime_type: 'image/png',
					natural_width: 100,
					natural_height: 200,
					source_url: 'file://study.png',
					page_title: 'study.png',
					alt_text: null,
					captured_at: '2026-06-04T00:00:00.000Z',
					metadata: { sourceName: 'Local file', sourceType: 'local' }
				}
			]
		});

		expect(request.destination_folder_id).toBe('folder-reference');
		expect(request.items[0]?.filename).toBe('study.png');
	});
});
```

- [ ] **Step 3: Wire gallery and folder buttons**

In `AddToLibrarySheet.svelte`, add two hidden inputs:

```svelte
<input
	bind:this={galleryInput}
	class="sr-only"
	type="file"
	accept="image/*"
	multiple
	onchange={(event) => importFiles(event.currentTarget.files)}
/>
<input
	bind:this={folderInput}
	class="sr-only"
	type="file"
	accept="image/*"
	multiple
	webkitdirectory
	onchange={(event) => importFiles(event.currentTarget.files)}
/>
```

The gallery button calls `galleryInput?.click()`. The folder button calls `folderInput?.click()`.

- [ ] **Step 4: Add import submission**

In `AddToLibrarySheet.svelte`, implement:

```ts
async function importFiles(files: FileList | null) {
	const imageFiles = [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
	if (!imageFiles.length) {
		status = 'Choose at least one image file.';
		return;
	}
	importing = true;
	const items = await Promise.all(imageFiles.map((file) => fileToImportItem(file)));
	const response = await fetch('/api/import', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(buildImportRequest({ destinationFolderId: currentFolderId, items }))
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error ?? 'Import failed');
	const snapshot = await loadLibrarySnapshot();
	setLibrarySnapshot(snapshot);
	status = `${result.imported.length} imported · ${result.failed.length} failed`;
	importing = false;
}
```

Use a `try/catch/finally` in the real implementation so `importing` always resets.

- [ ] **Step 5: Resolve current folder id**

Pass `library={libraryState.snapshot}` or `currentFolderId` from `AppShell.svelte`. For folder views, find:

```ts
const currentFolderId =
	appState.libraryView === 'folder'
		? (library.folders.find(
				(folder) => folder.path.join('/') === appState.activeLibraryFolderPath.join('/')
			)?.id ?? null)
		: null;
```

- [ ] **Step 6: Add URL import path**

Turn “From URL” into an inline URL form. For the first implementation, use `storage_mode: 'url_reference'` with `source_image_url` and `source_url` set to the submitted URL, `image_data: null`, and dimensions `0, 0`. If `importLibraryItems` rejects zero dimensions, add image probing before submission using a temporary `Image`.

- [ ] **Step 7: Add clipboard import path**

Use:

```ts
const clipboardItems = await navigator.clipboard.read();
const imageBlob = clipboardItems
	.flatMap((item) => item.types.map((type) => ({ item, type })))
	.find(({ type }) => type.startsWith('image/'));
```

If no image is present, show `No image found on the clipboard.` Convert the blob into a `File` and reuse `importFiles`.

- [ ] **Step 8: Add API route test for UI payload**

In `src/routes/api/import/server.spec.ts`, add a test that posts one `download` item with base64 `image_data` and expects an imported item. Use the existing `sharp` fixture style from library tests.

- [ ] **Step 9: Run checks**

Run:

```bash
npm run check
npm run test:unit -- --run src/lib/components/ui/addToLibraryImport.spec.ts src/routes/api/import/server.spec.ts
```

Expected: no Svelte diagnostics; import tests pass.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/lib/components/ui/AddToLibrarySheet.svelte src/lib/components/ui/addToLibraryImport.ts src/lib/components/ui/addToLibraryImport.spec.ts src/lib/components/shell/AppShell.svelte src/routes/api/import/server.spec.ts
git commit -m "Wire add to library imports"
```

---

## Task 7: Final Verification And Visual Critique Loop

**Files:**

- No planned source changes unless verification fails.

- [ ] **Step 1: Run full static and unit verification**

Run:

```bash
npm run check
npm run test:unit -- --run
```

Expected: `svelte-check found 0 errors and 0 warnings`; all Vitest files pass.

- [ ] **Step 2: Run desktop and mobile Playwright smoke checks**

Measure:

```txt
desktop Library search results open for query "test"
mobile create actions are compact
mobile tag groups render collapsed
Add to Library gallery button opens a file input
```

- [ ] **Step 3: Re-run Impeccable critique detector**

Run:

```bash
npx impeccable --json src/lib/components/library src/lib/components/shell src/lib/components/ui src/routes
```

Expected: `[]` or findings that are reviewed and either fixed or documented as false positives.

- [ ] **Step 4: Commit verification fixes if needed**

If any verification fix was needed:

```bash
git add <changed-files>
git commit -m "Polish library repair verification"
```

## Execution Notes

- The first execution task should be Task 1. Search behavior needs the model helpers before UI wiring.
- The upload fix is intentionally included in this plan because the existing sheet is entirely inert and the backend endpoint already exists.
- Browser visual checks should use both `1440x900` and `390x844`, because the failure modes are different.
- The mobile UI target is not “smaller everything.” It is lower ceremony: compact actions, progressive disclosure, and fewer empty rows.
