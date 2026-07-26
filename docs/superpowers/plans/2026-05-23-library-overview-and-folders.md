# Library Overview And Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Library-first asset grid with a Library Overview, folder contents views, global Full Library access, and static filter surfaces that match the new mobile IA.

**Architecture:** Library becomes its own workspace rather than a special case of the shared browse grid. `LibraryWorkspace` owns Library route state (`overview`, `all`, `folder`, `smart`, `tag`, `project`) and composes focused child components for overview sections, folder contents, and the existing asset masonry grid. Explore can keep using the existing browse workspace until a later pass.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Phosphor icons, Playwright e2e tests, Vitest unit tests, existing CSS token system.

---

## Reference Material

Use these mockups as the visual target:

- `docs/design/mockups/mobile/library-overview.png`
- `docs/design/mockups/mobile/folder-contents.png`
- `docs/design/mockups/filters/mobile-filter-drawer.png`
- `docs/design/mockups/filters/desktop-filter-panel.png`

Keep these product decisions intact:

- Library Overview is an organization hub, not Home and not a file tree.
- View Full Library shows every saved or imported asset in the app, including unfiled assets and project-only assets.
- Folder pages show direct assets in the current folder by default.
- Child folders are navigation, not filters.
- Projects are workspaces layered over Library assets, not folders.
- Full recursive folder browsing should be explicit later, not the default.
- Use Phosphor icons. Do not introduce Lucide or Material icons.

## File Structure

Create these files:

- `src/lib/data/library-organization.ts`: mock folder, smart folder, tag, overview, and helper data.
- `src/lib/components/library/LibraryWorkspace.svelte`: top-level Library mode controller.
- `src/lib/components/library/LibraryOverview.svelte`: overview screen with search, chips, full library row, projects, folders, smart folders.
- `src/lib/components/library/FolderContents.svelte`: folder page with breadcrumb, title, search/sort row, child folders, assets.
- `src/lib/components/library/LibrarySearch.svelte`: reusable mobile-first search row.
- `src/lib/components/library/ProjectCarousel.svelte`: pinned project cards.
- `src/lib/components/library/GroupedNavList.svelte`: folder and smart folder grouped list rows.
- `src/lib/components/library/FolderCards.svelte`: direct child folder cards for folder contents pages.
- `src/lib/components/filters/FilterDrawer.svelte`: mobile bottom sheet filter UI from the mockup.
- `src/lib/components/filters/FilterPanel.svelte`: desktop right panel filter UI from the mockup.

Modify these files:

- `src/lib/types.ts`: add Library route and organization types.
- `src/lib/state/app-state.svelte.ts`: add Library view state, filter state, and navigation helpers.
- `src/lib/components/shell/AppShell.svelte`: route Library mode to `LibraryWorkspace`; mount filter drawer/panel.
- `src/lib/components/shell/MobileHeader.svelte`: stop rendering Library-specific breadcrumb/search chrome when Library owns its page header.
- `src/lib/components/shell/TopBar.svelte`: make Filter open the filter panel/drawer.
- `src/lib/components/ui/BottomNav.svelte`: active Library tap returns to Library Overview; switching away and back restores the last Library view.
- `src/lib/components/browse/BrowseWorkspace.svelte`: keep Explore path working; remove Library-only assumptions after `LibraryWorkspace` exists.
- `tests/pastiche.e2e.ts`: cover Library overview, full library, folder contents, active Library tap behavior, and filter open/close.
- `src/lib/data/mock-assets.spec.ts`: add helper/data tests for direct folder contents and full library inclusion.
- `docs/design/mobile-interface-plan.md`: keep references and IA decisions current.

## Task 1: Add Library IA Types And Mock Organization Data

**Files:**

- Modify: `src/lib/types.ts`
- Create: `src/lib/data/library-organization.ts`
- Test: `src/lib/data/mock-assets.spec.ts`

- [ ] **Step 1: Add the Library route and organization types**

In `src/lib/types.ts`, add these types after the existing `Project` type:

```ts
export type LibraryView = 'overview' | 'all' | 'folder' | 'smart' | 'tag' | 'project';

export type LibraryFolder = {
	id: string;
	name: string;
	path: string[];
	assetCount: number;
	childFolderCount: number;
	parentId?: string;
};

export type SmartFolder = {
	id: string;
	label: string;
	count: number;
	icon: 'star' | 'clock' | 'tag' | 'link';
};

export type LibraryProjectSummary = Project & {
	noteCount: number;
	coverAssetIds: string[];
};
```

- [ ] **Step 2: Create organization mock data and helpers**

Create `src/lib/data/library-organization.ts`:

```ts
import type { Asset, LibraryFolder, LibraryProjectSummary, SmartFolder } from '$lib/types';
import { mockAssets } from '$lib/data/mock-assets';
import { pinnedProjects } from '$lib/data/mock-navigation';

export const libraryOverviewStats = {
	assets: 12842,
	projects: 14,
	folders: 38
};

export const libraryTopFolders: LibraryFolder[] = [
	{ id: 'refs', name: 'refs', path: ['library', 'refs'], assetCount: 8731, childFolderCount: 9 },
	{
		id: 'imports',
		name: 'imports',
		path: ['library', 'imports'],
		assetCount: 842,
		childFolderCount: 3
	},
	{
		id: 'resources',
		name: 'resources',
		path: ['library', 'resources'],
		assetCount: 216,
		childFolderCount: 5
	},
	{
		id: 'inspiration',
		name: 'inspiration',
		path: ['library', 'inspiration'],
		assetCount: 142,
		childFolderCount: 2
	},
	{
		id: 'personal',
		name: 'personal',
		path: ['library', 'personal'],
		assetCount: 93,
		childFolderCount: 1
	}
];

export const libraryFolders: LibraryFolder[] = [
	...libraryTopFolders,
	{
		id: 'refs-artworks',
		name: 'artworks',
		path: ['library', 'refs', 'artworks'],
		parentId: 'refs',
		assetCount: 428,
		childFolderCount: 4
	},
	{
		id: 'refs-artworks-impressionism',
		name: 'impressionism',
		path: ['library', 'refs', 'artworks', 'impressionism'],
		parentId: 'refs-artworks',
		assetCount: 82,
		childFolderCount: 0
	},
	{
		id: 'refs-artworks-lighting',
		name: 'lighting',
		path: ['library', 'refs', 'artworks', 'lighting'],
		parentId: 'refs-artworks',
		assetCount: 41,
		childFolderCount: 0
	},
	{
		id: 'refs-artworks-architecture',
		name: 'architecture',
		path: ['library', 'refs', 'artworks', 'architecture'],
		parentId: 'refs-artworks',
		assetCount: 33,
		childFolderCount: 0
	},
	{
		id: 'refs-artworks-figure',
		name: 'figure',
		path: ['library', 'refs', 'artworks', 'figure'],
		parentId: 'refs-artworks',
		assetCount: 27,
		childFolderCount: 0
	}
];

export const librarySmartFolders: SmartFolder[] = [
	{ id: 'favorites', label: 'Favorites', count: 1203, icon: 'star' },
	{ id: 'recently-added', label: 'Recently Added', count: 842, icon: 'clock' },
	{ id: 'untagged', label: 'Untagged', count: 76, icon: 'tag' },
	{ id: 'missing-source', label: 'Missing Source', count: 231, icon: 'link' }
];

export const librarySectionChips = ['Overview', 'Projects', 'Folders', 'Smart', 'Tags'];

export const libraryPinnedProjects: LibraryProjectSummary[] = pinnedProjects.map(
	(project, index) => ({
		...project,
		noteCount: index === 0 ? 5 : 3,
		coverAssetIds: project.assetIds.slice(0, 4)
	})
);

export function findFolderByPath(path: string[]) {
	return (
		libraryFolders.find((folder) => folder.path.join('/') === path.join('/')) ?? libraryFolders[0]
	);
}

export function getChildFolders(parentId: string) {
	return libraryFolders.filter((folder) => folder.parentId === parentId);
}

export function getFullLibraryAssets() {
	return mockAssets.filter((asset) => asset.saved);
}

export function getDirectFolderAssets(path: string[]) {
	const folderKey = path.join('/');
	return mockAssets.filter((asset) => asset.saved && asset.folderPath.join('/') === folderKey);
}
```

- [ ] **Step 3: Add unit tests for the helper semantics**

Append these tests to `src/lib/data/mock-assets.spec.ts`:

```ts
import {
	findFolderByPath,
	getChildFolders,
	getDirectFolderAssets,
	getFullLibraryAssets
} from './library-organization';

describe('library organization helpers', () => {
	it('treats full library as every saved asset', () => {
		const assets = getFullLibraryAssets();
		expect(assets.length).toBeGreaterThan(0);
		expect(assets.every((asset) => asset.saved)).toBe(true);
	});

	it('treats folders as direct containers by default', () => {
		const folder = findFolderByPath(['library', 'refs', 'artworks']);
		const assets = getDirectFolderAssets(folder.path);
		expect(assets.every((asset) => asset.folderPath.join('/') === folder.path.join('/'))).toBe(
			true
		);
	});

	it('returns only direct child folders for folder navigation', () => {
		const folder = findFolderByPath(['library', 'refs', 'artworks']);
		const children = getChildFolders(folder.id);
		expect(children.map((child) => child.name)).toEqual([
			'impressionism',
			'lighting',
			'architecture',
			'figure'
		]);
	});
});
```

- [ ] **Step 4: Run the focused unit test**

Run:

```bash
npm run test:unit -- --run src/lib/data/mock-assets.spec.ts
```

Expected: all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/data/library-organization.ts src/lib/data/mock-assets.spec.ts
git commit -m "Add library organization data model"
```

## Task 2: Add Library View State And Navigation Helpers

**Files:**

- Modify: `src/lib/state/app-state.svelte.ts`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Extend app state**

Add Library fields to `appState`:

```ts
libraryView: 'overview' as LibraryView,
lastLibraryView: 'overview' as LibraryView,
activeLibraryFolderPath: ['library', 'refs', 'artworks'] as string[],
activeSmartFolderId: null as string | null,
activeTagId: null as string | null,
activeProjectId: null as string | null,
librarySort: 'Newest',
filterOpen: false,
```

Import `LibraryView` from `$lib/types`.

- [ ] **Step 2: Add navigation helpers**

Add these functions to `src/lib/state/app-state.svelte.ts`:

```ts
export function openLibraryOverview() {
	appState.mode = 'library';
	appState.libraryView = 'overview';
	appState.lastLibraryView = 'overview';
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
}

export function openFullLibrary() {
	appState.mode = 'library';
	appState.libraryView = 'all';
	appState.lastLibraryView = 'all';
	appState.mobileState = 'browse';
}

export function openLibraryFolder(path: string[]) {
	appState.mode = 'library';
	appState.libraryView = 'folder';
	appState.lastLibraryView = 'folder';
	appState.activeLibraryFolderPath = path;
	appState.folderPath = path;
	appState.mobileState = 'browse';
}

export function openSmartFolder(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'smart';
	appState.lastLibraryView = 'smart';
	appState.activeSmartFolderId = id;
	appState.mobileState = 'browse';
}

export function openProjectLibrary(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'project';
	appState.lastLibraryView = 'project';
	appState.activeProjectId = id;
	appState.mobileState = 'browse';
}

export function openFilter() {
	appState.filterOpen = true;
}

export function closeFilter() {
	appState.filterOpen = false;
}
```

- [ ] **Step 3: Update `setMode` for active Library tap semantics**

Replace the Library branch inside `setMode` with this behavior:

```ts
export function setMode(mode: AppMode) {
	if (mode === 'library' && appState.mode === 'library') {
		openLibraryOverview();
		return;
	}

	appState.mode = mode;
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.inspectorOpen = mode === 'explore';
	appState.shellScrolled = false;
	appState.focusedPreviewOpen = false;

	if (mode === 'library') {
		appState.libraryView = appState.lastLibraryView;
		appState.inspectorOpen = false;
	}
}
```

- [ ] **Step 4: Run type checking**

Run:

```bash
npm run check
```

Expected: type checking passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state/app-state.svelte.ts
git commit -m "Add library view navigation state"
```

## Task 3: Build Library Overview Components

**Files:**

- Create: `src/lib/components/library/LibrarySearch.svelte`
- Create: `src/lib/components/library/ProjectCarousel.svelte`
- Create: `src/lib/components/library/GroupedNavList.svelte`
- Create: `src/lib/components/library/LibraryOverview.svelte`
- Modify: `src/lib/components/shell/AppShell.svelte`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Create reusable Library search**

Create `src/lib/components/library/LibrarySearch.svelte`:

```svelte
<script lang="ts">
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import SlidersHorizontalIcon from 'phosphor-svelte/lib/SlidersHorizontalIcon';
	import { appState, openFilter } from '$lib/state/app-state.svelte';

	type Props = {
		placeholder?: string;
		label?: string;
	};

	let {
		placeholder = 'Search images, projects, folders, tags...',
		label = 'Search library'
	}: Props = $props();
</script>

<label class="library-search">
	<MagnifyingGlassIcon size={20} />
	<span class="sr-only">{label}</span>
	<input bind:value={appState.query} {placeholder} />
	<button type="button" aria-label="Open filters" onclick={openFilter}>
		<SlidersHorizontalIcon size={19} />
	</button>
</label>

<style>
	.library-search {
		min-height: 3.05rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.92rem;
	}

	button {
		width: 2.2rem;
		height: 2.2rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		display: grid;
		place-items: center;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible {
		background: var(--color-hover);
		color: var(--color-text);
	}
</style>
```

- [ ] **Step 2: Create grouped navigation list**

Create `src/lib/components/library/GroupedNavList.svelte`:

```svelte
<script lang="ts">
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TagIcon from 'phosphor-svelte/lib/TagIcon';

	type Row = {
		id: string;
		label: string;
		count: number;
		icon?: 'folder' | 'star' | 'clock' | 'tag' | 'link';
	};

	type Props = {
		rows: Row[];
		ariaLabel: string;
		onOpen: (id: string) => void;
	};

	let { rows, ariaLabel, onOpen }: Props = $props();

	const icons = {
		folder: FolderIcon,
		star: StarIcon,
		clock: ClockIcon,
		tag: TagIcon,
		link: LinkIcon
	};
</script>

<nav class="grouped-list" aria-label={ariaLabel}>
	{#each rows as row}
		{@const Icon = icons[row.icon ?? 'folder']}
		<button type="button" onclick={() => onOpen(row.id)}>
			<Icon size={20} />
			<span>{row.label}</span>
			<small>{row.count.toLocaleString()}</small>
			<CaretRightIcon size={18} />
		</button>
	{/each}
</nav>

<style>
	.grouped-list {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	button {
		width: 100%;
		min-height: 3rem;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 0;
		border-bottom: 1px solid var(--color-border-soft);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
	}

	button:last-child {
		border-bottom: 0;
	}

	button:hover,
	button:focus-visible {
		background: var(--color-hover);
	}

	span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small {
		color: var(--color-muted);
		font-size: 0.86rem;
	}
</style>
```

- [ ] **Step 3: Create project carousel**

Create `src/lib/components/library/ProjectCarousel.svelte`:

```svelte
<script lang="ts">
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import PushPinIcon from 'phosphor-svelte/lib/PushPinIcon';
	import { mockAssets } from '$lib/data/mock-assets';
	import type { LibraryProjectSummary } from '$lib/types';

	type Props = {
		projects: LibraryProjectSummary[];
		onOpen: (id: string) => void;
	};

	let { projects, onOpen }: Props = $props();

	function assetImage(id: string) {
		return mockAssets.find((asset) => asset.id === id)?.imageUrl ?? mockAssets[0]?.imageUrl;
	}
</script>

<div class="project-strip" aria-label="Pinned projects">
	{#each projects as project}
		<article>
			<button class="open-project" type="button" onclick={() => onOpen(project.id)}>
				<img class="cover" src={assetImage(project.coverAssetIds[0])} alt="" />
				<span class="project-body">
					<strong>{project.name}</strong>
					<span>{project.description}</span>
					<small>
						{project.assetIds.length} assets · {project.noteCount} notes · {project.canvasCount}
						{project.canvasCount === 1 ? 'canvas' : 'canvases'}
					</small>
					<span class="thumbs" aria-hidden="true">
						{#each project.coverAssetIds as assetId}
							<img src={assetImage(assetId)} alt="" />
						{/each}
					</span>
				</span>
			</button>
			<div class="project-actions">
				<button type="button" aria-label={`Unpin ${project.name}`}><PushPinIcon size={17} /></button
				>
				<button type="button" aria-label={`${project.name} actions`}
					><DotsThreeIcon size={18} /></button
				>
			</div>
		</article>
	{/each}
</div>

<style>
	.project-strip {
		display: flex;
		gap: var(--space-4);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		padding-bottom: var(--space-1);
	}

	article {
		position: relative;
		flex: 0 0 min(19rem, 82vw);
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		scroll-snap-align: start;
	}

	.open-project {
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
	}

	.cover {
		width: 100%;
		aspect-ratio: 1.75 / 1;
		object-fit: cover;
		display: block;
	}

	.project-body {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
	}

	strong {
		font-size: 0.95rem;
	}

	.project-body > span:not(.thumbs),
	small {
		color: var(--color-muted);
		line-height: 1.45;
	}

	.thumbs {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.thumbs img {
		width: 2.8rem;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		object-fit: cover;
	}

	.project-actions {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		display: flex;
		gap: var(--space-2);
	}

	.project-actions button {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: oklch(8% 0.006 70 / 0.58);
		color: var(--color-text);
	}
</style>
```

- [ ] **Step 4: Create Library overview**

Create `src/lib/components/library/LibraryOverview.svelte`:

```svelte
<script lang="ts">
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import {
		libraryOverviewStats,
		libraryPinnedProjects,
		librarySectionChips,
		librarySmartFolders,
		libraryTopFolders
	} from '$lib/data/library-organization';
	import {
		openFullLibrary,
		openLibraryFolder,
		openProjectLibrary,
		openSmartFolder
	} from '$lib/state/app-state.svelte';
	import GroupedNavList from './GroupedNavList.svelte';
	import LibrarySearch from './LibrarySearch.svelte';
	import ProjectCarousel from './ProjectCarousel.svelte';

	let activeSection = $state('Overview');
</script>

<section class="library-overview" aria-labelledby="library-overview-title">
	<div class="page-title">
		<h1 id="library-overview-title">Library</h1>
		<p>
			{libraryOverviewStats.assets.toLocaleString()} assets · {libraryOverviewStats.projects}
			projects · {libraryOverviewStats.folders} folders
		</p>
	</div>

	<LibrarySearch />

	<nav class="section-chips" aria-label="Library sections">
		{#each librarySectionChips as section}
			<button
				class:active={activeSection === section}
				type="button"
				onclick={() => (activeSection = section)}
			>
				{section}
			</button>
		{/each}
	</nav>

	<button class="full-library" type="button" onclick={openFullLibrary}>
		<SquaresFourIcon size={21} />
		<span>View Full Library</span>
		<span aria-hidden="true">›</span>
	</button>

	<section class="overview-section" aria-labelledby="pinned-projects-heading">
		<header>
			<h2 id="pinned-projects-heading">Pinned Projects</h2>
			<button type="button">See all</button>
		</header>
		<ProjectCarousel projects={libraryPinnedProjects} onOpen={openProjectLibrary} />
	</section>

	<section class="overview-section" aria-labelledby="folders-heading">
		<header>
			<h2 id="folders-heading">Folders</h2>
			<button type="button">+ New Folder</button>
		</header>
		<GroupedNavList
			ariaLabel="Top-level folders"
			rows={libraryTopFolders.map((folder) => ({
				id: folder.id,
				label: folder.name,
				count: folder.assetCount,
				icon: 'folder'
			}))}
			onOpen={(id) => {
				const folder = libraryTopFolders.find((item) => item.id === id);
				if (folder) openLibraryFolder(folder.path);
			}}
		/>
	</section>

	<section class="overview-section" aria-labelledby="smart-folders-heading">
		<header>
			<h2 id="smart-folders-heading">Smart Folders</h2>
			<button type="button">See all</button>
		</header>
		<GroupedNavList
			ariaLabel="Smart folders"
			rows={librarySmartFolders.map((folder) => ({
				id: folder.id,
				label: folder.label,
				count: folder.count,
				icon: folder.icon
			}))}
			onOpen={openSmartFolder}
		/>
	</section>
</section>

<style>
	.library-overview {
		min-height: 100%;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.page-title h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.35rem;
		font-weight: 600;
		line-height: 1;
	}

	.page-title p {
		margin: var(--space-2) 0 0;
		color: var(--color-muted);
	}

	.section-chips {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
	}

	.section-chips button,
	.full-library,
	header button {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.section-chips button {
		min-height: 2.45rem;
		padding: 0 var(--space-4);
		white-space: nowrap;
	}

	.section-chips button.active {
		background: var(--color-surface-raised);
	}

	.full-library {
		min-height: 3.25rem;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		border-radius: var(--radius-lg);
		text-align: left;
	}

	.overview-section {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 600;
	}

	header button {
		border: 0;
		background: transparent;
		color: var(--color-muted);
	}

	@media (min-width: 760px) {
		.library-overview {
			padding: var(--space-6);
		}
	}
</style>
```

- [ ] **Step 5: Temporarily mount Overview in AppShell**

Do this only if `LibraryWorkspace` has not been created yet. Otherwise skip to Task 5.

Expected temporary change in `src/lib/components/shell/AppShell.svelte`:

```svelte
import LibraryOverview from '$lib/components/library/LibraryOverview.svelte';
```

Replace the Library branch with:

```svelte
{:else if appState.mode === 'library'}
	<LibraryOverview />
{:else if appState.mode === 'explore'}
	<BrowseWorkspace mode="explore" />
```

- [ ] **Step 6: Add e2e coverage for the overview**

In `tests/pastiche.e2e.ts`, add assertions inside the phone test after tapping Library:

```ts
await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
await expect(page.getByRole('button', { name: /View Full Library/ })).toBeVisible();
await expect(page.getByRole('heading', { name: 'Pinned Projects' })).toBeVisible();
await expect(page.getByRole('navigation', { name: 'Top-level folders' })).toBeVisible();
await expect(page.getByRole('navigation', { name: 'Smart folders' })).toBeVisible();
```

- [ ] **Step 7: Run e2e**

Run:

```bash
npm run test:e2e
```

Expected: e2e passes after updating any old assertions that expected the Library asset grid immediately.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/library tests/pastiche.e2e.ts src/lib/components/shell/AppShell.svelte
git commit -m "Add library overview shell"
```

## Task 4: Build Folder Contents And Full Library Views

**Files:**

- Create: `src/lib/components/library/FolderCards.svelte`
- Create: `src/lib/components/library/FolderContents.svelte`
- Create: `src/lib/components/library/LibraryWorkspace.svelte`
- Modify: `src/lib/components/shell/AppShell.svelte`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Create child folder cards**

Create `src/lib/components/library/FolderCards.svelte`:

```svelte
<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import type { LibraryFolder } from '$lib/types';

	type Props = {
		folders: LibraryFolder[];
		onOpen: (path: string[]) => void;
	};

	let { folders, onOpen }: Props = $props();
</script>

<div class="folder-cards" aria-label="Subfolders">
	{#each folders as folder}
		<button type="button" onclick={() => onOpen(folder.path)}>
			<FolderIcon size={20} />
			<span>{folder.name}</span>
			<small>{folder.assetCount.toLocaleString()}</small>
		</button>
	{/each}
</div>

<style>
	.folder-cards {
		display: flex;
		gap: var(--space-3);
		overflow-x: auto;
	}

	button {
		flex: 0 0 9.75rem;
		min-height: 4.6rem;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.2rem var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
	}

	small {
		grid-column: 2;
		color: var(--color-muted);
	}
</style>
```

- [ ] **Step 2: Create folder contents view**

Create `src/lib/components/library/FolderContents.svelte`:

```svelte
<script lang="ts">
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFourIcon';
	import AssetGrid from '$lib/components/browse/AssetGrid.svelte';
	import {
		findFolderByPath,
		getChildFolders,
		getDirectFolderAssets,
		getFullLibraryAssets
	} from '$lib/data/library-organization';
	import {
		appState,
		openLibraryFolder,
		openLibraryOverview,
		openMobileInspect,
		selectAsset,
		toggleSelection
	} from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';
	import FolderCards from './FolderCards.svelte';
	import LibrarySearch from './LibrarySearch.svelte';

	type Props = {
		scope: 'all' | 'folder';
	};

	let { scope }: Props = $props();

	let folder = $derived(findFolderByPath(appState.activeLibraryFolderPath));
	let childFolders = $derived(scope === 'folder' ? getChildFolders(folder.id) : []);
	let assets = $derived(
		scope === 'all' ? getFullLibraryAssets() : getDirectFolderAssets(folder.path)
	);
	let title = $derived(scope === 'all' ? 'All Library' : folder.name);
	let stats = $derived(
		scope === 'all'
			? `${assets.length.toLocaleString()} assets`
			: `${folder.assetCount.toLocaleString()} assets · ${folder.childFolderCount} subfolders`
	);

	function openAsset(asset: Asset) {
		selectAsset(asset);
		if (window.matchMedia('(max-width: 759px)').matches) {
			openMobileInspect(asset, window.scrollY);
		}
	}
</script>

<section class="folder-view" aria-labelledby="folder-title">
	{#if scope === 'folder'}
		<nav class="breadcrumb" aria-label="Library breadcrumb">
			{#each folder.path as segment, index}
				<button
					class:current={index === folder.path.length - 1}
					type="button"
					onclick={() =>
						index === 0
							? openLibraryOverview()
							: openLibraryFolder(folder.path.slice(0, index + 1))}
				>
					{segment}
				</button>
			{/each}
		</nav>
	{/if}

	<div class="folder-title">
		<h1 id="folder-title">{title}</h1>
		<p>{stats}</p>
	</div>

	<div class="search-sort">
		<LibrarySearch label={`Search ${title}`} />
		<button class="sort" type="button">Newest⌄</button>
	</div>

	{#if childFolders.length > 0}
		<section class="content-section" aria-labelledby="subfolders-title">
			<h2 id="subfolders-title">Subfolders</h2>
			<FolderCards folders={childFolders} onOpen={openLibraryFolder} />
		</section>
	{/if}

	<section class="content-section" aria-labelledby="assets-title">
		<header>
			<h2 id="assets-title">Assets</h2>
			<div class="view-toggle" aria-label="View options">
				<button type="button" aria-label="Grid view"
					><SquaresFourIcon size={18} weight="fill" /></button
				>
				<button type="button" aria-label="List view"><ListBulletsIcon size={18} /></button>
			</div>
		</header>
		<AssetGrid
			{assets}
			mode="library"
			activeId={appState.selectedAssetId}
			selectedIds={appState.selectedAssetIds}
			onOpen={openAsset}
			onSelect={(asset) => toggleSelection(asset)}
		/>
	</section>
</section>

<style>
	.folder-view {
		min-height: 100%;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8));
	}

	.breadcrumb {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		color: var(--color-muted);
	}

	.breadcrumb button {
		border: 0;
		background: transparent;
		color: var(--color-muted);
		text-decoration: underline;
	}

	.breadcrumb button.current {
		color: var(--color-text);
		text-decoration: none;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1,
	h2 {
		font-family: var(--font-heading);
		font-weight: 600;
	}

	h1 {
		font-size: 2.35rem;
		line-height: 1;
	}

	p {
		margin-top: var(--space-2);
		color: var(--color-muted);
	}

	.search-sort {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-3);
	}

	.sort {
		min-width: 6.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.content-section {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.view-toggle {
		display: flex;
		padding: var(--space-1);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
	}

	.view-toggle button {
		width: 2.1rem;
		height: 2.1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		display: grid;
		place-items: center;
	}

	:global(.folder-view .asset-grid) {
		padding-inline: 0;
	}

	@media (max-width: 420px) {
		.search-sort {
			grid-template-columns: 1fr;
		}
	}
</style>
```

- [ ] **Step 3: Create Library workspace controller**

Create `src/lib/components/library/LibraryWorkspace.svelte`:

```svelte
<script lang="ts">
	import { appState } from '$lib/state/app-state.svelte';
	import FolderContents from './FolderContents.svelte';
	import LibraryOverview from './LibraryOverview.svelte';
</script>

{#if appState.libraryView === 'overview'}
	<LibraryOverview />
{:else if appState.libraryView === 'all'}
	<FolderContents scope="all" />
{:else if appState.libraryView === 'folder'}
	<FolderContents scope="folder" />
{:else}
	<LibraryOverview />
{/if}
```

- [ ] **Step 4: Route Library mode through LibraryWorkspace**

Modify `src/lib/components/shell/AppShell.svelte`:

```svelte
import LibraryWorkspace from '$lib/components/library/LibraryWorkspace.svelte';
```

Use this branch:

```svelte
{#if appState.mode === 'home'}
	<HomeHub />
{:else if appState.mode === 'library'}
	<LibraryWorkspace />
{:else if appState.mode === 'explore'}
	<BrowseWorkspace mode="explore" />
{:else}
```

- [ ] **Step 5: Add e2e coverage for Full Library and folder contents**

Add to the phone e2e test:

```ts
await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
await page.getByRole('button', { name: /View Full Library/ }).click();
await expect(page.getByRole('heading', { name: 'All Library' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Inspect Crimson Horizon' })).toBeVisible();

await mobilePrimary.getByRole('button', { name: 'Library', exact: true }).click();
await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
await page
	.getByRole('navigation', { name: 'Top-level folders' })
	.getByRole('button', { name: /refs/ })
	.click();
await expect(page.getByRole('heading', { name: 'refs' })).toBeVisible();

await page.getByRole('button', { name: /artworks/ }).click();
await expect(page.getByRole('heading', { name: 'artworks' })).toBeVisible();
await expect(page.getByRole('navigation', { name: 'Library breadcrumb' })).toBeVisible();
await expect(page.getByLabel('Subfolders')).toBeVisible();
```

If `refs` does not have an `artworks` child in the data from Task 1, add that child before running this test.

- [ ] **Step 6: Run checks**

```bash
npm run check
npm run test:unit -- --run
npm run test:e2e
```

Expected: type check, unit tests, and e2e pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/library src/lib/components/shell/AppShell.svelte tests/pastiche.e2e.ts
git commit -m "Add library folder contents views"
```

## Task 5: Adjust Mobile And Desktop Shell Chrome

**Files:**

- Modify: `src/lib/components/shell/MobileHeader.svelte`
- Modify: `src/lib/components/shell/TopBar.svelte`
- Modify: `src/lib/components/browse/BrowseWorkspace.svelte`
- Modify: `src/lib/components/ui/BottomNav.svelte`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Make MobileHeader Library-light**

Update `MobileHeader.svelte` so Library pages receive only the top wordmark row, while `LibraryWorkspace` owns search, breadcrumb, and page title.

Use these derived flags:

```ts
let visible = $derived(mode === 'library' || mode === 'explore');
let showSearch = $derived(mode === 'explore');
let showBreadcrumb = $derived(false);
```

Wrap the search row:

```svelte
{#if showSearch}
	<div class="search-row">
		<label class="search">
			<MagnifyingGlassIcon size={19} />
			<span class="sr-only">{searchLabel}</span>
			<input bind:value={appState.query} placeholder={searchPlaceholder} />
			<SlidersHorizontalIcon size={19} />
		</label>
	</div>
{/if}
```

- [ ] **Step 2: Wire header filter buttons**

In `MobileHeader.svelte`, import and call `openFilter`:

```ts
import { appState, openFilter, setMode } from '$lib/state/app-state.svelte';
```

Change the filter button:

```svelte
<button type="button" aria-label="Filter" onclick={openFilter}><FunnelIcon size={19} /></button>
```

In `TopBar.svelte`, import `openFilter` and update the Filter button:

```svelte
<button class="tool" type="button" onclick={openFilter}>
	<FunnelIcon size={20} />
	<span>Filter</span>
</button>
```

- [ ] **Step 3: Keep Explore on BrowseWorkspace**

In `BrowseWorkspace.svelte`, remove Library sidebar rendering from mobile expectations only after `LibraryWorkspace` is mounted. Desktop Explore should still show its current grid and inspector.

The final branch should be:

```svelte
{#if mode === 'library'}
	<LibrarySidebar ... />
{/if}
```

Then verify AppShell never passes `mode="library"` into `BrowseWorkspace`.

- [ ] **Step 4: Confirm bottom nav active Library behavior**

`BottomNav.svelte` already calls `onSelect('library')`. Confirm the new `setMode` helper from Task 2 handles active Library tap. Do not add duplicate state logic in `BottomNav`.

- [ ] **Step 5: Run e2e**

```bash
npm run test:e2e
```

Expected:

- Library bottom-nav first tap opens or restores Library.
- Active Library tap returns to Library Overview.
- Explore still shows Explore search.
- Home, Canvas, and Resources do not show Library search chrome.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/shell src/lib/components/browse src/lib/components/ui tests/pastiche.e2e.ts
git commit -m "Align shell chrome with library overview"
```

## Task 6: Add Static Filter Drawer And Desktop Filter Panel

**Files:**

- Create: `src/lib/components/filters/FilterDrawer.svelte`
- Create: `src/lib/components/filters/FilterPanel.svelte`
- Modify: `src/lib/components/shell/AppShell.svelte`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Create mobile filter drawer**

Create `src/lib/components/filters/FilterDrawer.svelte`:

```svelte
<script lang="ts">
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { closeFilter } from '$lib/state/app-state.svelte';

	const sortOptions = ['Recently added', 'Recently modified', 'Oldest', 'Artwork date'];
	const tags = ['abstract', 'geometric', 'lighting', 'figure', 'architecture'];
	const sources = ['All sources', 'Uploaded', 'ArtStation', 'The Met', 'MoMA'];
	const colors = [
		'#e13a3a',
		'#f28a2e',
		'#f1cc43',
		'#68b84c',
		'#55beb4',
		'#3c8ed8',
		'#7545d8',
		'#d7799c',
		'#e8ddc8',
		'#a7a7a3',
		'#11100e'
	];
	const mediums = [
		'Painting',
		'Drawing',
		'Print',
		'Photography',
		'Digital',
		'Sculpture / 3D',
		'Mixed media'
	];
</script>

<button class="filter-scrim" type="button" aria-label="Close filters" onclick={closeFilter}
></button>
<section class="filter-drawer" aria-labelledby="filters-title" aria-modal="true" role="dialog">
	<header>
		<div>
			<h2 id="filters-title">Filters</h2>
			<p>Refine visible results</p>
		</div>
		<button type="button" onclick={closeFilter} aria-label="Close filters"
			><XIcon size={22} /></button
		>
	</header>

	<section>
		<h3>Sort by</h3>
		<div class="chips">
			{#each sortOptions as option, index}
				<button class:active={index === 0} type="button">{option}</button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Tags</h3>
		<label class="field"
			><MagnifyingGlassIcon size={18} /><input placeholder="Search tags..." /></label
		>
		<div class="chips">
			{#each tags as tag}
				<button type="button">{tag}</button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Source</h3>
		<div class="chips">
			{#each sources as source, index}
				<button class:active={index === 0} type="button">{source}</button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Artist / Creator</h3>
		<label class="field"
			><MagnifyingGlassIcon size={18} /><input placeholder="Search artists..." /></label
		>
	</section>

	<section>
		<h3>Approximate color</h3>
		<div class="swatches">
			{#each colors as color}
				<button type="button" style={`--swatch: ${color}`} aria-label={`Color ${color}`}></button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Medium</h3>
		<div class="medium-list">
			{#each mediums as medium, index}
				<button class:active={index === 0} type="button">
					<span>{medium}</span>
					<span aria-hidden="true">›</span>
				</button>
			{/each}
		</div>
	</section>

	<footer>
		<span>126 results</span>
		<button type="button">Reset</button>
		<button class="apply" type="button" onclick={closeFilter}>Apply Filters</button>
	</footer>
</section>

<style>
	.filter-scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		border: 0;
		background: oklch(0% 0 0 / 0.55);
	}

	.filter-drawer {
		position: fixed;
		inset: auto 0 0;
		z-index: calc(var(--z-sheet) + 1);
		max-height: 82vh;
		overflow: auto;
		display: grid;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-4) calc(env(safe-area-inset-bottom) + var(--space-5));
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		background: oklch(14% 0.008 70 / 0.96);
		color: var(--color-text);
	}

	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.9rem;
	}

	p,
	footer span {
		color: var(--color-muted);
	}

	section {
		display: grid;
		gap: var(--space-3);
	}

	button {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	header button {
		width: 2.65rem;
		height: 2.65rem;
		border-radius: var(--radius-md);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chips button {
		min-height: 2.35rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
	}

	.chips button.active,
	.apply {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.field {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
	}

	.swatches {
		display: flex;
		gap: var(--space-3);
		overflow-x: auto;
	}

	.swatches button {
		width: 2.15rem;
		height: 2.15rem;
		flex: 0 0 auto;
		border-radius: 50%;
		background: var(--swatch);
	}

	.medium-list {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.medium-list button {
		width: 100%;
		min-height: 2.45rem;
		display: flex;
		justify-content: space-between;
		padding: 0 var(--space-3);
		border: 0;
		border-bottom: 1px solid var(--color-border-soft);
		border-radius: 0;
	}

	footer {
		position: sticky;
		bottom: 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
		background: inherit;
	}

	footer button {
		min-height: 2.65rem;
		padding: 0 var(--space-4);
		border-radius: var(--radius-md);
	}

	@media (min-width: 760px) {
		.filter-scrim,
		.filter-drawer {
			display: none;
		}
	}
</style>
```

- [ ] **Step 2: Create desktop filter panel**

Create `src/lib/components/filters/FilterPanel.svelte` using the same arrays and visual sections as `FilterDrawer.svelte`, but position it as:

```css
.filter-panel {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: var(--z-sheet);
	width: min(31rem, 38vw);
	overflow: auto;
	padding: var(--space-5);
	border-left: 1px solid var(--color-border);
	background: oklch(12% 0.008 70 / 0.98);
}

@media (max-width: 759px) {
	.filter-panel {
		display: none;
	}
}
```

Reuse the same text labels from the desktop mockup:

- Sort by: Relevance, Artwork date: newest, Artwork date: oldest
- Artwork date range inputs
- Keywords / Tags
- Source
- Artist / Creator
- Approximate color
- Color role
- Medium
- Match
- Reset and Apply Filters footer

- [ ] **Step 3: Mount filters in AppShell**

In `src/lib/components/shell/AppShell.svelte`, import:

```svelte
import FilterDrawer from '$lib/components/filters/FilterDrawer.svelte'; import FilterPanel from
'$lib/components/filters/FilterPanel.svelte';
```

Mount near existing sheets:

```svelte
{#if appState.filterOpen}
	<FilterDrawer />
	<FilterPanel />
{/if}
```

- [ ] **Step 4: Add e2e coverage**

Add to the phone test:

```ts
await page.getByRole('button', { name: 'Filter' }).click();
await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
await page.getByRole('button', { name: 'Close filters' }).click();
await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();
```

Add to the desktop test:

```ts
await page.getByRole('banner').getByRole('button', { name: 'Filter' }).click();
await expect(page.getByRole('complementary', { name: 'Filters' })).toBeVisible();
```

If `FilterPanel` uses `role="complementary"`, give it `aria-label="Filters"`.

- [ ] **Step 5: Run checks**

```bash
npm run check
npm run test:e2e
```

Expected: type checking and e2e pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/filters src/lib/components/shell/AppShell.svelte tests/pastiche.e2e.ts
git commit -m "Add static filter surfaces"
```

## Task 7: Update Documentation And Visual References

**Files:**

- Modify: `docs/design/mobile-interface-plan.md`
- Modify: `docs/design/tablet-desktop-interface-plan.md`
- Verify: mockup files exist

- [ ] **Step 1: Update mobile interface plan**

Ensure `docs/design/mobile-interface-plan.md` says:

```md
Library Overview is the phone entry point for Library. It shows full library access, pinned projects, top-level folders, smart folders, and tags.

Folder Contents shows direct assets in the current folder and direct child folders as navigation. It does not recursively show every descendant asset by default.

View Full Library is the global archive stream. It includes every saved/imported asset regardless of folder or project assignment.
```

- [ ] **Step 2: Update tablet and desktop plan**

Add this to `docs/design/tablet-desktop-interface-plan.md`:

```md
Desktop Library should converge with the same information architecture as mobile: Overview, Full Library, Folder Contents, Smart Folders, Tags, and Projects. The desktop sidebar becomes an accelerator for these destinations, not the only way to understand the archive.
```

- [ ] **Step 3: Verify mockup files**

Run:

```bash
ls -l docs/design/mockups/mobile/library-overview.png \
  docs/design/mockups/mobile/folder-contents.png \
  docs/design/mockups/filters/mobile-filter-drawer.png \
  docs/design/mockups/filters/desktop-filter-panel.png
```

Expected: all four files exist.

- [ ] **Step 4: Commit**

```bash
git add docs/design/mobile-interface-plan.md docs/design/tablet-desktop-interface-plan.md docs/design/mockups
git commit -m "Document library overview IA"
```

## Task 8: Final Verification Pass

**Files:**

- Verify all touched files
- Test all relevant commands

- [ ] **Step 1: Run formatting check if the branch expects it**

Run:

```bash
npm run lint
```

Expected: Prettier and ESLint pass. If existing unrelated formatting churn appears, stop and inspect before running `npm run format`.

- [ ] **Step 2: Run core verification**

Run:

```bash
npm run check
npm run test:unit -- --run
npm run test:e2e
```

Expected:

- `svelte-check found 0 errors and 0 warnings`
- unit tests pass
- Playwright tests pass

Playwright may print the existing Linux host dependency warning; passing tests are still valid.

- [ ] **Step 3: Manual browser smoke**

Open `http://127.0.0.1:52144/` and verify these flows:

1. Phone width: Library opens to Overview.
2. Phone width: View Full Library opens a masonry asset grid.
3. Phone width: active Library nav tap returns to Overview.
4. Phone width: folder row opens a folder page with subfolders and assets.
5. Phone width: filter button opens the mobile drawer.
6. Desktop width: Library still has a usable overview and does not depend on phone-only UI.
7. Desktop width: filter button opens the right-side panel.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git diff --stat
git diff --check
git status --short
```

Expected: no whitespace errors, only intended Library, filter, test, and docs files changed.

- [ ] **Step 5: Final commit if needed**

If verification fixes changed files:

```bash
git add <changed-files>
git commit -m "Verify library overview shell"
```

## Risks And Deferrals

- Asset virtualization is not implemented in this shell pass. Keep `View Full Library` on mock data for now, then add virtualization when real large datasets exist.
- Recursive folder browsing is intentionally deferred. Do not add an `Include subfolders` toggle until direct folder behavior is solid.
- Filter controls are static shell UI in this plan. They should update filter state later, after the data/query layer exists.
- Desktop Library can keep a sidebar accelerator temporarily, but the primary IA should move toward Overview and Folder Contents on all breakpoints.
- Avoid relying on hover-only controls on touch surfaces. Hover reveal is acceptable on desktop only when the same action exists through tap or menu on mobile.
