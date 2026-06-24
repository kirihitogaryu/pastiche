# Library Hub Organization Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not use subagents unless the user explicitly changes that preference. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Library default view into a useful organization hub that clearly displays projects, folder depth, general tags, grouped tags, and smart folders while preserving the current persisted organization model.

**Architecture:** Treat the hub as a composed UI over a stronger Library read model. Server code should return global tag group data and project cover hints; client code should build folder trees and view models without inventing fake data. The first implementation targets the mobile-friendly hub shape; richer desktop/iPad workspace behavior is planned as a follow-on layer, not a blocker.

**Tech Stack:** Svelte 5, SvelteKit API routes, TypeScript, SQLite via `better-sqlite3`, Vitest, `svelte-check`, Phosphor icons.

---

## Design Contract

Implement the improved mockup direction, not the current row-heavy overview.

- Projects are prominent visual cards. Empty projects render as muted clickable workspace cards.
- Folders are utility navigation rows with visible depth. The hub shows a compact accordion tree, not a flat top-level list.
- Tags are split into `General` first, then named tag groups. Tag group names are headers, not tags. Tag values render as pills.
- Smart folders stay at the bottom and are quieter than user-created organization.
- Creation controls exist both as large hub actions and compact top-bar actions where Library mode already exposes them.
- Browser visual checks are left to the user. Verification for this plan is code, type, and unit checks only.

## Terminology Decision

Use **Tag Group** instead of **Facet** everywhere the product explains itself. A tag group is the category that contains tags:

- `General`: loose user tags with no stronger organization.
- `Subject`: hands, portrait, lizard.
- `Medium`: oil painting, albumen print, charcoal.
- `Style / Era`: baroque, impressionism, 1860s-70s.
- `Source`: The Met, Art Institute of Chicago, NovelAI.

Execution note: the current code and older snippets may still use `facet` because that is the legacy implementation language. The redesign should rename public types, routes, component names, visible labels, and new service functions to `TagGroup` / `tagGroup`. Database tables can either be renamed to `tag_groups` with a migration or kept as `tag_facets` internally if preserving existing local libraries is more important, but no user-visible UI should say “facet.”

## File Structure

### Data And API

- Modify `src/lib/library/types.ts`
  - Add global tag group types.
  - Add project cover preview fields.
  - Keep existing asset-level `organization.tags` shape.
- Modify `src/lib/server/library/schema.ts`
  - Add default `general` tag group.
  - Ensure default tag group ordering remains deterministic.
- Modify `src/lib/server/library/organization.ts`
  - Make plain tags default to `general`.
  - Add explicit tag group creation service.
- Modify `src/lib/server/library/read.ts`
  - Return `tagGroups` with tag values, not only counts.
  - Return a `coverPreviewUrl` for projects when possible.
- Create `src/routes/api/library/tag-groups/+server.ts`
  - Create an empty tag group without requiring a tag.
- Modify tests in:
  - `src/lib/server/library/library.spec.ts`
  - `src/lib/server/library/read.spec.ts`
  - `src/routes/api/library/organization.server.spec.ts`

### Client Model And Components

- Create `src/lib/components/library/libraryOverviewModel.ts`
  - Build folder trees.
  - Sort tag groups.
  - Cap tag previews.
  - Derive smart folder counts.
- Create `src/lib/components/library/libraryOverviewModel.spec.ts`
  - Unit tests for tree/tag/project view-model behavior.
- Create `src/lib/components/library/ProjectCardGrid.svelte`
  - Visual project cards and empty cards.
- Create `src/lib/components/library/FolderTree.svelte`
  - Compact expandable folder tree.
- Create `src/lib/components/library/TagGroupList.svelte`
  - General tags first, then tag groups, with preview pill caps.
- Create `src/lib/components/library/SmartFolderList.svelte`
  - Quiet system list at the bottom.
- Modify `src/lib/components/library/CreateOrganizationPopover.svelte`
  - Support tag group creation.
  - Default plain tags to General.
  - Keep popovers anchored to the triggering button on desktop and viewport-safe on mobile.
- Modify `src/lib/components/library/LibraryOverview.svelte`
  - Replace generic `GroupedNavList` hub sections with the new composed components.
- Modify `src/lib/components/library/LibraryWorkspace.svelte`
  - Pass any top-bar create actions needed by the redesigned hub.
- Modify `src/lib/components/library/FolderContents.svelte`
  - Ensure folder/project/full-library views have an obvious back/reset affordance.

---

## Milestone 0: Rename Facet Language To Tag Group

### Task 0: Replace Product And Public API Terminology

**Files:**
- Modify: `src/lib/library/types.ts`
- Modify: `src/lib/server/library/schema.ts`
- Modify: `src/lib/server/library/organization.ts`
- Modify: `src/lib/server/library/read.ts`
- Rename or replace: `src/routes/api/library/tag-facets/+server.ts` -> `src/routes/api/library/tag-groups/+server.ts`
- Rename or replace: `src/lib/components/library/TagFacetGroups.svelte` -> `src/lib/components/library/TagGroupList.svelte`
- Modify: `src/lib/components/library/CreateOrganizationPopover.svelte`
- Modify: `src/lib/components/library/LibraryOverview.svelte`
- Modify tests that mention facets.

- [ ] **Step 1: Rename shared product types**

Use these target names in `src/lib/library/types.ts`:

```ts
export type LibraryTagGroupKind = 'general' | 'group';

export type LibraryTagGroup = {
	id: string;
	name: string;
	slug: string;
	tagCount: number;
	kind: LibraryTagGroupKind;
	tags: LibraryTag[];
};
```

Keep tag value fields as `groupId`, `groupName`, and `groupSlug`:

```ts
export type LibraryTag = {
	id: string;
	groupId: string;
	groupName: string;
	groupSlug: string;
	value: string;
	name: string;
	slug: string;
	assetCount: number;
};
```

`LibraryResponse` should expose:

```ts
tagGroups: LibraryTagGroup[];
```

- [ ] **Step 2: Rename route and service language**

Target public route:

```txt
POST /api/library/tag-groups
```

Target service function:

```ts
export function createTagGroup(input: { name: string; now?: string }) {
	// Create an empty tag group without creating a tag value.
}
```

If preserving existing SQLite data, the implementation may keep the physical table name `tag_facets` for this slice and map it into `LibraryTagGroup`. If doing a schema migration now, use `tag_groups` and `tags.tag_group_id`.

- [ ] **Step 3: Rename visible labels**

Use:

```txt
New Tag Group
+ Add Group
No tags in this group
General
Subject
Medium
Style / Era
Source
Location
Color Mood
Usage Intent
```

Do not use the word `facet` in visible UI, button labels, empty states, or inspector copy.

- [ ] **Step 4: Rename component/helper language**

Target names:

```txt
TagGroupList.svelte
sortHubTagGroups
expandedTagGroups
toggleTagGroup
onCreateTagGroup
```

Existing helper behavior remains the same: `General` sorts first; every group displays preview pills capped at 6 unless expanded.

- [ ] **Step 5: Run rename checks**

Run:

```bash
rg -n "facet|Facet|facets|Facets" src docs/superpowers/plans/2026-06-04-library-hub-organization-redesign.md
```

Expected: Remaining matches are allowed only in migration comments, compatibility code around old SQLite table names, or this plan section explaining the rename.

---

## Milestone 1: Read Model For Real Hub Data

### Task 1: Add Global Tag Groups To Shared Types

**Files:**
- Modify: `src/lib/library/types.ts`
- Test: Type coverage through `npm run check`

- [ ] **Step 1: Extend tag/facet types**

Add these types near the existing `LibraryTagFacet` and `LibraryTag` definitions:

```ts
export type LibraryTagFacetKind = 'general' | 'facet';

export type LibraryTagFacet = {
	id: string;
	name: string;
	slug: string;
	tagCount: number;
	kind: LibraryTagFacetKind;
	tags: LibraryTag[];
};
```

Keep `LibraryTag` as the tag value shape already used by asset records:

```ts
export type LibraryTag = {
	id: string;
	facetId: string;
	facetName: string;
	facetSlug: string;
	value: string;
	name: string;
	slug: string;
	assetCount: number;
};
```

- [ ] **Step 2: Add project cover preview**

Extend `LibraryProject`:

```ts
export type LibraryProject = {
	id: string;
	name: string;
	description: string | null;
	pinned: boolean;
	coverAssetId: string | null;
	coverPreviewUrl: string | null;
	assetCount: number;
	folderCount: number;
	createdAt: string;
	updatedAt: string;
};
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run check
```

Expected: Type errors appear anywhere that constructs `LibraryTagFacet` or `LibraryProject` without the new fields. These are expected at this stage.

### Task 2: Add The Reserved General Facet

**Files:**
- Modify: `src/lib/server/library/schema.ts`
- Modify: `src/lib/server/library/organization.ts`
- Test: `src/lib/server/library/library.spec.ts`

- [ ] **Step 1: Write schema test**

Add a test that initializes the database and verifies the default facets include `general` first:

```ts
it('creates the reserved general tag facet', () => {
	const db = openLibraryDatabase();
	const facets = db
		.prepare('select slug, name from tag_facets order by rowid')
		.all() as Array<{ slug: string; name: string }>;
	db.close();

	expect(facets[0]).toEqual({ slug: 'general', name: 'General' });
	expect(facets.map((facet) => facet.slug)).toContain('subject');
	expect(facets.map((facet) => facet.slug)).toContain('medium');
});
```

- [ ] **Step 2: Run the focused schema test**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts
```

Expected: FAIL because `general` is not seeded.

- [ ] **Step 3: Update default facets**

Change `DEFAULT_TAG_FACETS` in `src/lib/server/library/schema.ts` so the first entry is:

```ts
const DEFAULT_TAG_FACETS = [
	{ slug: 'general', name: 'General' },
	{ slug: 'subject', name: 'Subject' },
	{ slug: 'medium', name: 'Medium' },
	{ slug: 'style-era', name: 'Style / Era' },
	{ slug: 'source', name: 'Source' },
	{ slug: 'location', name: 'Location' },
	{ slug: 'department', name: 'Department' },
	{ slug: 'culture', name: 'Culture' },
	{ slug: 'usage-intent', name: 'Usage Intent' },
	{ slug: 'color-mood', name: 'Color Mood' }
];
```

- [ ] **Step 4: Make plain tags default to General**

In `src/lib/server/library/organization.ts`, update `parseTagInput`:

```ts
if (explicitValue) return { facet: explicitFacet ?? 'General', value: explicitValue };
if (label) return { facet: explicitFacet ?? 'General', value: label };
```

Do not change `acceptSourceTagSuggestion`; imported suggestions should keep their inferred source/subject/medium facets.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts src/routes/api/library/organization.server.spec.ts
```

Expected: PASS, after updating any expectations that previously assumed plain tags defaulted to `subject`.

### Task 3: Return Global Tags And Project Covers

**Files:**
- Modify: `src/lib/server/library/read.ts`
- Test: `src/lib/server/library/read.spec.ts`

- [ ] **Step 1: Write read model tests**

Add tests covering:

```ts
it('returns general tags before faceted tags with tag values', () => {
	const snapshot = getLibrarySnapshot();
	const general = snapshot.tagFacets[0];

	expect(general.slug).toBe('general');
	expect(general.kind).toBe('general');
	expect(general.tags.every((tag) => tag.facetSlug === 'general')).toBe(true);
});

it('returns project cover preview urls when the cover asset exists', () => {
	const snapshot = getLibrarySnapshot();
	const project = snapshot.projects.find((item) => item.coverAssetId);

	if (project) {
		expect(project.coverPreviewUrl).toMatch(/^\/api\/library\/assets\/.+\/image\?variant=thumb$/);
	}
});
```

- [ ] **Step 2: Add global tag query**

In `getLibrarySnapshot`, query all tags after `tagFacets`:

```ts
const allTags = db
	.prepare(
		`select
			tags.id,
			tags.facet_id,
			tag_facets.name as facet_name,
			tag_facets.slug as facet_slug,
			tags.value,
			tags.name,
			tags.slug,
			(select count(*) from asset_tags where asset_tags.tag_id = tags.id) as asset_count
		 from tags
		 join tag_facets on tag_facets.id = tags.facet_id
		 order by tag_facets.slug, lower(tags.value)`
	)
	.all() as TagRow[];
```

- [ ] **Step 3: Map facets with tags and General first**

Add:

```ts
function mapTagFacets(facets: TagFacetRow[], tags: TagRow[]): LibraryTagFacet[] {
	const tagsByFacet = new Map<string, LibraryTag[]>();
	for (const tag of tags) {
		const list = tagsByFacet.get(tag.facet_id) ?? [];
		list.push(mapTag(tag));
		tagsByFacet.set(tag.facet_id, list);
	}

	return facets
		.map((facet) => ({
			id: facet.id,
			name: facet.name,
			slug: facet.slug,
			tagCount: facet.tag_count,
			kind: facet.slug === 'general' ? 'general' : 'facet',
			tags: tagsByFacet.get(facet.id) ?? []
		}))
		.sort((a, b) => {
			if (a.slug === 'general') return -1;
			if (b.slug === 'general') return 1;
			return a.name.localeCompare(b.name);
		});
}
```

Replace `tagFacets: tagFacets.map(mapTagFacet)` with:

```ts
tagFacets: mapTagFacets(tagFacets, allTags)
```

- [ ] **Step 4: Add project cover previews**

Before returning `projects`, build a map:

```ts
const assetPreviewById = new Map(
	assets.map((asset) => [asset.id, mapImage(asset).previewUrl])
);
```

Update `mapProject` to accept that map:

```ts
function mapProject(
	project: ProjectRow,
	assetCount: number,
	folderRefs: ProjectFolderRefRow[],
	assetPreviewById: Map<string, string | null>
): LibraryProject {
	return {
		id: project.id,
		name: project.name,
		description: project.description,
		pinned: Boolean(project.pinned),
		coverAssetId: project.cover_asset_id,
		coverPreviewUrl: project.cover_asset_id ? (assetPreviewById.get(project.cover_asset_id) ?? null) : null,
		assetCount,
		folderCount: folderRefs.filter((ref) => ref.project_id === project.id).length,
		createdAt: project.created_at,
		updatedAt: project.updated_at
	};
}
```

- [ ] **Step 5: Run focused read tests**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/read.spec.ts
```

Expected: PASS.

---

## Milestone 2: Facet Creation API

### Task 4: Add Explicit Facet Creation

**Files:**
- Modify: `src/lib/server/library/organization.ts`
- Create: `src/routes/api/library/tag-facets/+server.ts`
- Test: `src/routes/api/library/organization.server.spec.ts`

- [ ] **Step 1: Write route test**

Add:

```ts
it('creates an empty user facet without creating a tag', async () => {
	const response = await POST_TAG_FACETS({
		request: new Request('http://test/api/library/tag-facets', {
			method: 'POST',
			body: JSON.stringify({ name: 'Texture' })
		})
	} as never);
	const body = await response.json();

	expect(response.status).toBe(201);
	expect(body.snapshot.tagFacets.some((facet) => facet.slug === 'texture')).toBe(true);
	expect(body.snapshot.tagFacets.find((facet) => facet.slug === 'texture')?.tagCount).toBe(0);
});
```

Import the route handler as `POST_TAG_FACETS`.

- [ ] **Step 2: Add service function**

Export this from `organization.ts`:

```ts
export function createTagFacet(input: { name: string; now?: string }) {
	const db = openLibraryDatabase();
	try {
		const name = cleanString(input.name);
		if (!name) throw new Error('Facet name is required');
		return findOrCreateFacet(db, name, input.now);
	} finally {
		db.close();
	}
}
```

- [ ] **Step 3: Add route**

Create `src/routes/api/library/tag-facets/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { createTagFacet } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';

export async function POST({ request }) {
	try {
		const body = (await request.json()) as { name?: string };
		createTagFacet({ name: body.name ?? '' });
		return json({ snapshot: getLibrarySnapshot() }, { status: 201 });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Could not create facet' },
			{ status: 400 }
		);
	}
}
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm run test:unit -- --run src/routes/api/library/organization.server.spec.ts
```

Expected: PASS.

---

## Milestone 3: Hub View Model Utilities

### Task 5: Add Folder/Tag/Project View Model Helpers

**Files:**
- Create: `src/lib/components/library/libraryOverviewModel.ts`
- Create: `src/lib/components/library/libraryOverviewModel.spec.ts`

- [ ] **Step 1: Write utility tests**

Create tests for:

```ts
import { describe, expect, it } from 'vitest';
import {
	buildFolderTree,
	previewTags,
	sortHubFacets,
	type FolderTreeNode
} from './libraryOverviewModel';

describe('libraryOverviewModel', () => {
	it('builds a nested folder tree from flat folders', () => {
		const tree = buildFolderTree([
			{ id: 'root', name: 'References', parentId: null, path: ['References'], assetCount: 2 },
			{ id: 'child', name: 'Figures', parentId: 'root', path: ['References', 'Figures'], assetCount: 1 }
		] as never);

		expect(tree[0].children[0].name).toBe('Figures');
	});

	it('caps visual depth after two nested levels', () => {
		const node = { depth: 5 } as FolderTreeNode;
		expect(Math.min(node.depth, 2)).toBe(2);
	});

	it('sorts General before facets', () => {
		const sorted = sortHubFacets([
			{ slug: 'medium', name: 'Medium' },
			{ slug: 'general', name: 'General' }
		] as never);

		expect(sorted.map((facet) => facet.slug)).toEqual(['general', 'medium']);
	});

	it('returns visible tag pills plus overflow count', () => {
		const result = previewTags(
			Array.from({ length: 8 }, (_, index) => ({
				id: String(index),
				value: `tag-${index}`
			})) as never,
			4
		);

		expect(result.visible).toHaveLength(4);
		expect(result.hiddenCount).toBe(4);
	});
});
```

- [ ] **Step 2: Implement helpers**

Create:

```ts
import type { LibraryFolder } from '$lib/types';
import type { LibraryTag, LibraryTagFacet } from '$lib/library/types';

export type FolderTreeNode = LibraryFolder & {
	children: FolderTreeNode[];
	depth: number;
};

export function buildFolderTree(folders: LibraryFolder[]): FolderTreeNode[] {
	const nodes = new Map<string, FolderTreeNode>();
	for (const folder of folders) {
		nodes.set(folder.id, { ...folder, children: [], depth: 0 });
	}

	const roots: FolderTreeNode[] = [];
	for (const node of nodes.values()) {
		if (node.parentId && nodes.has(node.parentId)) {
			const parent = nodes.get(node.parentId)!;
			node.depth = parent.depth + 1;
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortNodes = (items: FolderTreeNode[]) => {
		items.sort((a, b) => a.name.localeCompare(b.name));
		for (const item of items) sortNodes(item.children);
	};
	sortNodes(roots);
	return roots;
}

export function sortHubFacets(facets: LibraryTagFacet[]): LibraryTagFacet[] {
	return [...facets].sort((a, b) => {
		if (a.slug === 'general') return -1;
		if (b.slug === 'general') return 1;
		return a.name.localeCompare(b.name);
	});
}

export function previewTags(tags: LibraryTag[], limit = 6) {
	return {
		visible: tags.slice(0, limit),
		hiddenCount: Math.max(0, tags.length - limit)
	};
}
```

- [ ] **Step 3: Run utility tests**

Run:

```bash
npm run test:unit -- --run src/lib/components/library/libraryOverviewModel.spec.ts
```

Expected: PASS.

---

## Milestone 4: New Hub Components

### Task 6: Build Project Cards

**Files:**
- Create: `src/lib/components/library/ProjectCardGrid.svelte`

- [ ] **Step 1: Create component contract**

Use these props:

```ts
type Props = {
	projects: LibraryProject[];
	onOpen: (id: string) => void;
	onCreate: (event: MouseEvent) => void;
};
```

- [ ] **Step 2: Implement markup**

Each card:

```svelte
<button class="project-card" class:empty={!project.coverPreviewUrl} type="button" onclick={() => onOpen(project.id)}>
	<div class="project-media">
		{#if project.coverPreviewUrl}
			<img src={project.coverPreviewUrl} alt="" loading="lazy" />
		{:else}
			<StackIcon size={42} />
		{/if}
	</div>
	<div class="project-label">
		<strong>{project.name}</strong>
		<span>{project.assetCount.toLocaleString()} assets</span>
	</div>
</button>
```

Include a final `+ New Project` action only in the section header, not as a fake project card.

- [ ] **Step 3: Implement responsive styling**

Use:

```css
.project-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	gap: var(--space-3);
}

@media (max-width: 759px) {
	.project-grid {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x proximity;
	}

	.project-card {
		flex: 0 0 min(18rem, 82vw);
		scroll-snap-align: start;
	}
}
```

### Task 7: Build Folder Accordion Tree

**Files:**
- Create: `src/lib/components/library/FolderTree.svelte`

- [ ] **Step 1: Create component contract**

Props:

```ts
type Props = {
	nodes: FolderTreeNode[];
	expanded: Set<string>;
	onToggle: (id: string) => void;
	onOpen: (node: FolderTreeNode) => void;
};
```

- [ ] **Step 2: Implement recursive rendering**

Render a chevron only when `node.children.length > 0`:

```svelte
{#each nodes as node (node.id)}
	<div class="folder-row depth-{Math.min(node.depth, 2)}">
		{#if node.children.length}
			<button class="folder-toggle" type="button" aria-label={`Toggle ${node.name}`} onclick={() => onToggle(node.id)}>
				{#if expanded.has(node.id)}<CaretDownIcon size={16} />{:else}<CaretRightIcon size={16} />{/if}
			</button>
		{:else}
			<span class="folder-spacer"></span>
		{/if}
		<button class="folder-open" type="button" onclick={() => onOpen(node)}>
			<FolderIcon size={18} />
			<span>{node.name}</span>
			<small>{node.assetCount.toLocaleString()}</small>
		</button>
	</div>
	{#if node.children.length && expanded.has(node.id)}
		<svelte:self nodes={node.children} {expanded} {onToggle} {onOpen} />
	{/if}
{/each}
```

- [ ] **Step 3: Implement capped depth styles**

Use indentation that stops becoming more dramatic after depth 2:

```css
.depth-0 { --indent: 0rem; --row-height: 3rem; --font-size: 1rem; }
.depth-1 { --indent: 1.35rem; --row-height: 2.75rem; --font-size: 0.93rem; }
.depth-2 { --indent: 2.35rem; --row-height: 2.55rem; --font-size: 0.88rem; }

.folder-row {
	display: grid;
	grid-template-columns: 2rem 1fr;
	padding-left: var(--indent);
}
```

### Task 8: Build Tag Facet Groups

**Files:**
- Create: `src/lib/components/library/TagFacetGroups.svelte`

- [ ] **Step 1: Create component contract**

Props:

```ts
type Props = {
	facets: LibraryTagFacet[];
	expanded: Set<string>;
	onToggle: (slug: string) => void;
	onCreateTag: (event: MouseEvent) => void;
	onCreateFacet: (event: MouseEvent) => void;
	onOpenTag?: (tag: LibraryTag) => void;
};
```

- [ ] **Step 2: Render General first and facets after**

Use `previewTags(facet.tags, expanded.has(facet.slug) ? 999 : 6)`.

Markup:

```svelte
<section class="tag-groups" aria-labelledby="tags-heading">
	<header>
		<h2 id="tags-heading"><TagIcon size={20} /> Tags</h2>
		<div>
			<button type="button" onclick={onCreateTag}>+ Add Tag</button>
			<button type="button" onclick={onCreateFacet}>+ Add Facet</button>
		</div>
	</header>
	{#each facets as facet (facet.id)}
		<article class="facet-row" class:general={facet.slug === 'general'}>
			<button class="facet-toggle" type="button" onclick={() => onToggle(facet.slug)}>
				{#if expanded.has(facet.slug)}<CaretDownIcon size={15} />{:else}<CaretRightIcon size={15} />{/if}
				<span class="facet-dot" data-facet={facet.slug}></span>
				<strong>{facet.name}</strong>
			</button>
			<div class="tag-pills">
				{#each previewTags(facet.tags, expanded.has(facet.slug) ? 999 : 6).visible as tag (tag.id)}
					<button type="button" onclick={() => onOpenTag?.(tag)}>{tag.value}</button>
				{/each}
				{#if previewTags(facet.tags, expanded.has(facet.slug) ? 999 : 6).hiddenCount}
					<button type="button" onclick={() => onToggle(facet.slug)}>
						+{previewTags(facet.tags).hiddenCount}
					</button>
				{/if}
			</div>
		</article>
	{/each}
</section>
```

- [ ] **Step 3: Style for scanning**

Use small neutral pills with subtle facet dots. Do not style facet headers as pills.

### Task 9: Build Smart Folder List

**Files:**
- Create: `src/lib/components/library/SmartFolderList.svelte`

- [ ] **Step 1: Create component**

Props:

```ts
type Props = {
	items: Array<{ id: string; label: string; count: number; icon: string }>;
	onOpen: (id: string) => void;
};
```

Render rows at the bottom with smaller typography and quieter borders than user folders.

---

## Milestone 5: Compose The Redesigned Library Hub

### Task 10: Replace Generic Overview Sections

**Files:**
- Modify: `src/lib/components/library/LibraryOverview.svelte`

- [ ] **Step 1: Replace imports**

Remove `GroupedNavList` from the hub and import:

```ts
import ProjectCardGrid from './ProjectCardGrid.svelte';
import FolderTree from './FolderTree.svelte';
import TagFacetGroups from './TagFacetGroups.svelte';
import SmartFolderList from './SmartFolderList.svelte';
import { buildFolderTree, sortHubFacets } from './libraryOverviewModel';
```

- [ ] **Step 2: Add expansion state**

Use component state backed by `sessionStorage`:

```ts
let expandedFolders = $state(new Set<string>(loadExpanded('pastiche.library.expandedFolders')));
let expandedFacets = $state(new Set<string>(['general']));

function loadExpanded(key: string) {
	if (typeof sessionStorage === 'undefined') return [];
	try {
		return JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[];
	} catch {
		return [];
	}
}

function saveExpanded(key: string, values: Set<string>) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(key, JSON.stringify([...values]));
}
```

- [ ] **Step 3: Add toggle handlers**

```ts
function toggleFolder(id: string) {
	const next = new Set(expandedFolders);
	next.has(id) ? next.delete(id) : next.add(id);
	expandedFolders = next;
	saveExpanded('pastiche.library.expandedFolders', next);
}

function toggleFacet(slug: string) {
	const next = new Set(expandedFacets);
	next.has(slug) ? next.delete(slug) : next.add(slug);
	expandedFacets = next;
}
```

- [ ] **Step 4: Compose sections in order**

Use:

```svelte
<ProjectCardGrid
	projects={library.projects.filter((project) => project.pinned || library.projects.length <= 4)}
	onOpen={openProjectLibrary}
	onCreate={(event) => openCreate('project', event)}
/>

<FolderTree
	nodes={buildFolderTree(library.folders)}
	expanded={expandedFolders}
	onToggle={toggleFolder}
	onOpen={(folder) => openLibraryFolder(folder.path)}
/>

<TagFacetGroups
	facets={sortHubFacets(library.tagFacets)}
	expanded={expandedFacets}
	onToggle={toggleFacet}
	onCreateTag={(event) => openCreate('tag', event)}
	onCreateFacet={(event) => openCreate('facet', event)}
/>

<SmartFolderList items={librarySmartFolders} onOpen={openSmartFolder} />
```

- [ ] **Step 5: Remove section chips from the hub**

Remove the current `activeSection`, `section-chips`, and `View Full Library` row from the default hub. Deep browsing should be reached by opening actual folders/projects/tags, not a generic full-library trap.

### Task 11: Add Facet Creation To The Popover

**Files:**
- Modify: `src/lib/components/library/CreateOrganizationPopover.svelte`

- [ ] **Step 1: Extend kind**

```ts
type Kind = 'folder' | 'project' | 'tag' | 'facet';
```

- [ ] **Step 2: Add labels and endpoints**

```ts
let title = $derived(
	kind === 'folder'
		? 'New Folder'
		: kind === 'project'
			? 'New Project'
			: kind === 'facet'
				? 'New Facet'
				: 'New Tag'
);

function endpoint() {
	if (kind === 'folder') return '/api/library/folders';
	if (kind === 'project') return '/api/library/projects';
	if (kind === 'facet') return '/api/library/tag-facets';
	if (asset) return `/api/library/assets/${encodeURIComponent(asset.id)}/tags`;
	return '/api/library/tags';
}
```

- [ ] **Step 3: Default tag facet to General**

Initialize:

```ts
let facet = $state('General');
```

Payload:

```ts
if (kind === 'facet') return { name };
return name.includes(':') ? { label: name } : { facet, value: name };
```

- [ ] **Step 4: Hide facet selector for facet creation**

Only show the selector when `kind === 'tag' && !name.includes(':')`.

### Task 12: Top-Bar And Back Affordances

**Files:**
- Modify: `src/lib/components/library/LibraryWorkspace.svelte`
- Modify: `src/lib/components/library/FolderContents.svelte`

- [ ] **Step 1: Ensure Library button resets to hub**

Confirm the existing Library nav action calls `openLibraryHub` or equivalent. If it currently opens the last library view, change it so tapping/clicking Library while already in Library mode returns to the hub.

- [ ] **Step 2: Add explicit back action in non-hub views**

At the top of `FolderContents.svelte`, add:

```svelte
<button class="library-back" type="button" onclick={openLibraryHub}>
	<CaretLeftIcon size={18} />
	<span>Library</span>
</button>
```

Only show it when the current view is `folder`, `project`, `smart`, or `all`.

- [ ] **Step 3: Keep create controls accessible**

If `LibraryWorkspace.svelte` owns top-bar buttons, route folder/project/tag icon clicks to `CreateOrganizationPopover` with the same kind values used by the hub.

---

## Milestone 6: Responsive Polish

### Task 13: Apply The New Hub Layout

**Files:**
- Modify: `src/lib/components/library/LibraryOverview.svelte`
- Modify: new component CSS files from Milestone 4

- [ ] **Step 1: Set the hub container**

Use:

```css
.library-overview {
	width: min(100%, 64rem);
	margin-inline: auto;
	display: grid;
	align-content: start;
	gap: var(--space-6);
	padding: var(--space-6) var(--space-5) calc(var(--bottom-nav-height) + var(--space-8));
}
```

- [ ] **Step 2: Mobile adjustments**

At `max-width: 759px`:

```css
.library-overview {
	width: 100%;
	margin: 0;
	padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8));
}
```

- [ ] **Step 3: Desktop/iPad width adjustments**

At `min-width: 1024px`, keep the hub centered and do not stretch rows to absurd widths:

```css
.library-overview {
	width: min(100%, 58rem);
}
```

- [ ] **Step 4: Text wrapping rules**

Project names, folder names, and tag pills must not overflow:

```css
.project-label strong,
.folder-open span,
.tag-pills button {
	min-width: 0;
	overflow-wrap: anywhere;
}
```

### Task 14: Popover Safety Pass

**Files:**
- Modify: `src/lib/components/library/CreateOrganizationPopover.svelte`

- [ ] **Step 1: Keep desktop anchored**

Keep `position: fixed` with `anchorFrom(event.currentTarget)` so popovers open under the clicked button on wide screens.

- [ ] **Step 2: Keep mobile viewport-safe**

At mobile sizes, keep:

```css
@media (max-width: 759px) {
	.create-popover {
		top: max(var(--space-4), env(safe-area-inset-top));
		left: var(--space-3);
		right: var(--space-3);
		width: auto;
		max-height: calc(100dvh - var(--bottom-nav-height) - var(--space-6));
	}
}
```

- [ ] **Step 3: Add outside-click or Escape close if missing**

Add a Svelte window keydown handler:

```svelte
<svelte:window onkeydown={(event) => {
	if (event.key === 'Escape') onClose();
}} />
```

---

## Milestone 7: Validation

### Task 15: Run Code Verification

**Files:**
- No file changes unless failures reveal needed fixes.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm run test:unit -- --run
```

Expected: PASS.

- [ ] **Step 2: Run Svelte/type checks**

Run:

```bash
npm run check
```

Expected: PASS with 0 errors.

- [ ] **Step 3: Do not run browser visual checks**

Stop after code checks and ask the user to inspect the running app visually. The user explicitly prefers to do browser verification themselves.

### Task 16: User Visual Review Checklist

Ask the user to check these specific things:

- Library hub no longer looks like a generic row list.
- Project cards look clickable and empty projects do not look broken.
- Folder rows show depth, but deep nesting does not become a huge staircase.
- Folders without children do not show dropdown icons.
- General tags appear before faceted tags.
- Facet headers do not look like tag pills.
- `+N` tag overflow is understandable and clickable.
- New Tag defaults to General.
- New Facet creates an empty facet visible in the Tags section.
- Mobile does not require a chain of back buttons just to expand folder depth.

---

## Follow-On Plan: Desktop/iPad Organization Workspace

Do not implement this in the hub redesign unless the user explicitly expands scope. The hub should leave clean hooks for it.

### Future Task A: Add Organize Workspace Route/View

- Desktop/iPad landscape only.
- Left panel: persistent folder/project/tag navigation.
- Center: asset grid or folder/project contents.
- Right panel: inspector or bulk edit panel.
- Phone should keep the hub plus drill-in screens, not inherit the desktop workspace.

### Future Task B: Project Workspace

- Project cards open a canvas-heavy workspace later.
- Until that exists, project cards can open the existing project asset view or an empty project placeholder screen.

### Future Task C: Folder Management

- Rename, delete, move, drag-to-nest, and long-press/context menu behavior.
- Not part of this hub redesign.

### Future Task D: Tag Management

- Rename facets/tags.
- Merge tags.
- Move tag values between facets.
- Not part of this hub redesign.

---

## Self-Review

- Spec coverage: Projects, folder depth, general tags, faceted tags, facet creation, smart folders, popover behavior, and mobile constraints are covered.
- Placeholder scan: The first milestone set contains concrete file paths, commands, and expected behavior.
- Type consistency: `LibraryTagFacet.tags`, `LibraryTagFacet.kind`, and `LibraryProject.coverPreviewUrl` are introduced before component tasks use them.
- Scope control: Rename/delete/archive/deep desktop workspace remain follow-on work, not hidden dependencies.
