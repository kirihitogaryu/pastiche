# First Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Pastiche frontend vertical slice: design tokens, responsive app shell, mock Library/Explore data, Inspector, mobile states, and enough visual QA to decide whether the product direction feels right.

**Architecture:** Start with a SvelteKit app using static mock data and client-side state. Keep the implementation frontend-only for this slice: no SQLite, file imports, museum APIs, authentication, browser extension, or canvas editor yet. The shell should prove the interaction model across desktop, iPad, and phone before backend architecture hardens.

**Tech Stack:** SvelteKit via `npx sv create`, TypeScript, Svelte 5, CSS custom properties, Vitest, Playwright, `phosphor-svelte` icons.

---

## Source Context

Read these docs before implementing:

- `PRODUCT.md`
- `docs/superpowers/specs/2026-05-22-responsive-shell-design.md`
- `docs/design/mobile-interface-plan.md`
- `docs/design/tablet-desktop-interface-plan.md`
- `docs/product/information-architecture-home-hub.md`
- `docs/design/mockups/mobile/*.png`
- `docs/design/mockups/tablet-desktop/*.png`

Use the existing mockups as visual references, not as pixel-perfect mandates.

## Scope For This Slice

Build:

- seed `DESIGN.md`
- SvelteKit scaffold
- Phosphor icon system
- responsive app shell
- Home hub shell
- Library browse
- Explore browse
- right Inspector on tablet/desktop
- focused art preview overlay
- non-mobile Add to Library popover
- mobile Library browse
- mobile Selection Mode
- mobile Add drawer
- mobile Image Inspect screen
- mock data and state preservation
- basic unit tests and Playwright visual-flow tests

Do not build:

- SQLite
- external-drive archive storage
- real image imports
- real Explore API calls
- authentication
- browser extension
- full Canvas editor
- real color extraction

## File Structure

Create or modify:

- `DESIGN.md`: seed visual system for impeccable and future UI work.
- `package.json`: SvelteKit scripts and dependencies.
- `src/app.html`: viewport and root document.
- `src/routes/+layout.svelte`: app-wide shell wrapper.
- `src/routes/+page.svelte`: first vertical slice route.
- `src/lib/styles/tokens.css`: color, spacing, typography, radius, and layout tokens.
- `src/lib/styles/global.css`: reset and global element styles.
- `src/lib/types.ts`: shared app types.
- `src/lib/data/mock-assets.ts`: reference image data.
- `src/lib/data/mock-navigation.ts`: modes, folders, projects, chips, sources.
- `src/lib/state/app-state.svelte.ts`: selected mode, asset, filters, mobile state, panel state.
- `src/lib/components/shell/AppShell.svelte`: responsive shell.
- `src/lib/components/shell/ModeRail.svelte`: left rail and mobile bottom nav helpers.
- `src/lib/components/shell/TopBar.svelte`: desktop/tablet top controls.
- `src/lib/components/shell/MobileHeader.svelte`: phone breadcrumb/search/header.
- `src/lib/components/home/HomeHub.svelte`: starter Home hub.
- `src/lib/components/library/LibraryView.svelte`: Library workspace.
- `src/lib/components/explore/ExploreView.svelte`: Explore workspace.
- `src/lib/components/grid/AssetGrid.svelte`: responsive image grid.
- `src/lib/components/grid/AssetCard.svelte`: Library/Explore card.
- `src/lib/components/inspector/InspectorPanel.svelte`: tablet/desktop Inspector.
- `src/lib/components/inspector/MobileInspectScreen.svelte`: phone inspect route state.
- `src/lib/components/overlays/AddToLibrary.svelte`: popover/drawer.
- `src/lib/components/overlays/FocusedPreview.svelte`: visual inspection overlay.
- `src/lib/components/selection/SelectionActionBar.svelte`: batch action bar.
- `src/lib/components/ui/Chip.svelte`: filter chip.
- `src/lib/components/ui/IconButton.svelte`: accessible Phosphor icon button.
- `src/lib/components/ui/SearchField.svelte`: accessible search field.
- `src/lib/components/ui/PaletteRow.svelte`: palette swatches.
- `src/lib/components/ui/BottomNav.svelte`: phone navigation.
- `src/lib/components/ui/Button.svelte`: text/icon button primitive.
- `src/lib/utils/asset-state.ts`: pure state helpers.
- `src/lib/utils/asset-state.test.ts`: unit tests.
- `tests/pastiche-shell.spec.ts`: Playwright shell flow tests.

### Task 1: Seed The Visual System

**Files:**

- Create: `DESIGN.md`

- [ ] **Step 1: Create seed `DESIGN.md`**

Create `DESIGN.md` with:

````markdown
---
name: Pastiche
status: seed
register: product
iconSystem: Phosphor
colorMode: dark
---

# Overview

Pastiche is an elegant, archival, studio-minded artist reference tool. The interface should feel like a quiet creative archive: image-first, dense when useful, and calm enough for long browsing sessions.

The design system is seeded from the current mockups and should be refreshed after real components exist.

# Color

Use a restrained dark product palette with warm neutral surfaces. Avoid pure black and pure white. Prefer tinted neutrals, quiet borders, and a small warm accent for selected states and primary actions.

Suggested CSS token direction:

```css
:root {
	--color-bg: oklch(13% 0.01 70);
	--color-surface: oklch(17% 0.01 70);
	--color-surface-raised: oklch(22% 0.012 70);
	--color-border: oklch(100% 0 0 / 0.11);
	--color-text: oklch(90% 0.01 75);
	--color-muted: oklch(70% 0.012 75);
	--color-dim: oklch(52% 0.012 75);
	--color-accent: oklch(78% 0.08 78);
	--color-danger: oklch(62% 0.18 28);
}
```

# Typography

Use a practical product sans for UI text and a restrained italic serif wordmark. Do not use display fonts in controls, labels, or metadata.

# Layout

Use responsive, image-first layouts:

- phone: bottom navigation, masonry browsing, separate inspect screen
- iPad portrait: browse-first with drawer inspection
- iPad landscape and desktop: rail, workspace, optional sidebar, persistent Inspector

# Components

Core components:

- Phosphor icon buttons
- mode rail and bottom nav
- breadcrumb path
- search field
- filter chips
- image cards
- Inspector sections
- palette row
- Add drawer/popover
- selection action bar
- focused preview overlay

# Motion

Use short, stateful transitions only. Drawer, Inspector, selection bar, and preview overlay motion should orient the user without delaying browsing.

# Do's And Don'ts

Do use abstract art mockups to test density and visual rhythm.
Do preserve keyboard navigation and visible focus states.
Do make image browsing feel fast and calm.
Do keep Phosphor icons consistent.

Do not use Material icons as placeholders.
Do not use generic dashboard cards for Home.
Do not make Explore feel like an algorithmic feed.
Do not rely on hover or right-click for core workflows.
````

- [ ] **Step 2: Verify impeccable context loads**

Run:

```bash
node /home/kristoph/.codex/skills/impeccable/scripts/load-context.mjs
```

Expected: JSON reports `"hasProduct": true` and `"hasDesign": true`.

- [ ] **Step 3: Commit visual system seed**

Run:

```bash
git add DESIGN.md
git commit -m "Seed design system context"
```

Expected: commit succeeds.

### Task 2: Scaffold SvelteKit And Install UI Dependencies

**Files:**

- Create/modify: SvelteKit project files
- Modify: `.gitignore`

- [ ] **Step 1: Scaffold SvelteKit**

Run from `/home/kristoph/Desktop/pastiche`:

```bash
npx sv create . --template minimal --types ts --add eslint prettier vitest playwright --install npm --no-dir-check
```

Expected: SvelteKit project files are created without deleting existing docs.

- [ ] **Step 2: Install Phosphor icons**

Run:

```bash
npm install -D phosphor-svelte
```

Expected: `package.json` includes `phosphor-svelte`.

- [ ] **Step 3: Extend `.gitignore` for SvelteKit and test output**

Ensure `.gitignore` includes:

```gitignore
# SvelteKit
.svelte-kit/
build/

# Test output
coverage/
test-results/
playwright-report/
```

- [ ] **Step 4: Run baseline checks**

Run:

```bash
npm run check
npm run test
```

Expected: both commands exit 0 on the scaffold.

- [ ] **Step 5: Commit scaffold**

Run:

```bash
git add .
git commit -m "Scaffold SvelteKit app"
```

Expected: commit succeeds.

### Task 3: Add Tokens, Global Styles, Types, And Mock Data

**Files:**

- Create: `src/lib/styles/tokens.css`
- Create: `src/lib/styles/global.css`
- Modify: `src/routes/+layout.svelte`
- Create: `src/lib/types.ts`
- Create: `src/lib/data/mock-assets.ts`
- Create: `src/lib/data/mock-navigation.ts`

- [ ] **Step 1: Add style imports to `src/routes/+layout.svelte`**

Use:

```svelte
<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/global.css';

	let { children } = $props();
</script>

{@render children()}
```

- [ ] **Step 2: Create `src/lib/styles/tokens.css`**

Include tokens for colors, type, spacing, radii, dimensions, z-index, and motion. Required token names:

```css
:root {
	color-scheme: dark;

	--color-bg: oklch(13% 0.01 70);
	--color-surface: oklch(17% 0.01 70);
	--color-surface-soft: oklch(19% 0.01 70);
	--color-surface-raised: oklch(22% 0.012 70);
	--color-hover: oklch(26% 0.012 70);
	--color-border: oklch(100% 0 0 / 0.11);
	--color-border-strong: oklch(100% 0 0 / 0.22);
	--color-text: oklch(90% 0.01 75);
	--color-muted: oklch(70% 0.012 75);
	--color-dim: oklch(52% 0.012 75);
	--color-accent: oklch(78% 0.08 78);
	--color-danger: oklch(62% 0.18 28);

	--font-ui:
		Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	--font-wordmark: 'Crimson Text', Georgia, serif;

	--rail-width: 4.75rem;
	--sidebar-width: 17rem;
	--inspector-width: 24rem;
	--bottom-nav-height: 5.5rem;
	--radius-sm: 0.375rem;
	--radius-md: 0.5rem;
	--radius-lg: 0.75rem;
	--radius-xl: 1rem;

	--space-1: 0.25rem;
	--space-2: 0.5rem;
	--space-3: 0.75rem;
	--space-4: 1rem;
	--space-5: 1.25rem;
	--space-6: 1.5rem;
	--space-8: 2rem;

	--z-dropdown: 100;
	--z-sticky: 200;
	--z-sheet: 300;
	--z-modal: 400;
	--z-toast: 500;

	--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
	--duration-fast: 140ms;
	--duration-base: 210ms;
}
```

- [ ] **Step 3: Create `src/lib/styles/global.css`**

Include reset, body, focus, button, image, and reduced-motion rules:

```css
*,
*::before,
*::after {
	box-sizing: border-box;
}

html,
body {
	margin: 0;
	min-height: 100%;
	background: var(--color-bg);
	color: var(--color-text);
	font-family: var(--font-ui);
}

body {
	overflow: hidden;
}

button,
input,
select,
textarea {
	font: inherit;
}

button {
	color: inherit;
}

img {
	display: block;
	max-width: 100%;
}

:focus {
	outline: none;
}

:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		animation-duration: 1ms !important;
		scroll-behavior: auto !important;
		transition-duration: 1ms !important;
	}
}
```

- [ ] **Step 4: Create shared types**

`src/lib/types.ts` must export:

```ts
export type AppMode = 'home' | 'library' | 'explore' | 'canvas' | 'colors' | 'resources';
export type AssetSource = 'library' | 'explore';
export type MobileState = 'browse' | 'selecting' | 'adding' | 'inspecting';

export type PaletteSwatch = {
	hex: string;
	label: string;
};

export type Asset = {
	id: string;
	title: string;
	creator: string;
	year: string;
	medium: string;
	sourceName: string;
	sourceUrl?: string;
	sourceType: 'local' | 'web' | 'museum' | 'collection';
	imageUrl: string;
	width: number;
	height: number;
	tags: string[];
	palette: PaletteSwatch[];
	description: string;
	notes?: string;
	favorite?: boolean;
	saved: boolean;
	projects: string[];
	folderPath: string[];
};

export type Project = {
	id: string;
	name: string;
	description: string;
	pinned: boolean;
	assetIds: string[];
	canvasCount: number;
};
```

- [ ] **Step 5: Create mock data**

Use `docs/design/mockups` as reference, but load remote placeholder images from stable URLs or local generated assets checked into `static/mock-art/`. Preferred for this slice: create `static/mock-art/` and copy 10 to 16 existing mockup art crops only if licensing/source is acceptable for local development. If not, use CSS gradient placeholders with realistic aspect ratios.

`mock-assets.ts` must export at least 12 `Asset` objects with mixed Library and Explore examples.

- [ ] **Step 6: Commit data and styles**

Run:

```bash
npm run check
npm run test
git add src static package.json package-lock.json
git commit -m "Add design tokens and mock data"
```

Expected: checks pass and commit succeeds.

### Task 4: Implement Shell, Navigation, And Home Hub

**Files:**

- Create: `src/lib/state/app-state.svelte.ts`
- Create: `src/lib/components/shell/AppShell.svelte`
- Create: `src/lib/components/shell/ModeRail.svelte`
- Create: `src/lib/components/shell/TopBar.svelte`
- Create: `src/lib/components/shell/MobileHeader.svelte`
- Create: `src/lib/components/ui/BottomNav.svelte`
- Create: `src/lib/components/home/HomeHub.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add app state**

`src/lib/state/app-state.svelte.ts` must track:

```ts
import type { AppMode, Asset, MobileState } from '$lib/types';

export const appState = $state({
	mode: 'home' as AppMode,
	selectedAssetId: null as string | null,
	selectedAssetIds: [] as string[],
	mobileState: 'browse' as MobileState,
	addOpen: false,
	focusedPreviewOpen: false,
	query: '',
	activeTags: [] as string[],
	folderPath: ['library', 'refs', 'artworks'],
	lastBrowseScrollY: 0
});

export function selectAsset(asset: Asset) {
	appState.selectedAssetId = asset.id;
}

export function openMobileInspect(asset: Asset, scrollY: number) {
	appState.lastBrowseScrollY = scrollY;
	appState.selectedAssetId = asset.id;
	appState.mobileState = 'inspecting';
}

export function closeMobileInspect() {
	appState.mobileState = 'browse';
}

export function enterSelection(asset: Asset) {
	appState.mobileState = 'selecting';
	appState.selectedAssetIds = [asset.id];
}

export function toggleSelection(asset: Asset) {
	const selected = new Set(appState.selectedAssetIds);
	if (selected.has(asset.id)) selected.delete(asset.id);
	else selected.add(asset.id);
	appState.selectedAssetIds = [...selected];
	if (appState.selectedAssetIds.length === 0) appState.mobileState = 'browse';
}
```

- [ ] **Step 2: Build shell components**

Implement the shell with these responsive rules:

- desktop/tablet landscape: rail + topbar + workspace + optional Inspector
- phone: mobile header + content + bottom nav
- Home appears in rail on non-mobile
- phone bottom nav uses Library / Explore / Add / Canvas / Resources

- [ ] **Step 3: Build Home hub**

Home hub must show:

- pinned Projects
- recent Canvases placeholder
- recent imports placeholder
- quick actions: Import Images, Create Project, Explore Sources
- no metric-card dashboard pattern

- [ ] **Step 4: Wire `+page.svelte`**

`src/routes/+page.svelte` should render:

```svelte
<script lang="ts">
	import AppShell from '$lib/components/shell/AppShell.svelte';
</script>

<AppShell />
```

- [ ] **Step 5: Commit shell**

Run:

```bash
npm run check
npm run test
git add src
git commit -m "Build responsive app shell"
```

Expected: checks pass and commit succeeds.

### Task 5: Implement Library, Explore, Grid, Cards, And Inspector

**Files:**

- Create: `src/lib/components/library/LibraryView.svelte`
- Create: `src/lib/components/explore/ExploreView.svelte`
- Create: `src/lib/components/grid/AssetGrid.svelte`
- Create: `src/lib/components/grid/AssetCard.svelte`
- Create: `src/lib/components/inspector/InspectorPanel.svelte`
- Create: `src/lib/components/ui/Chip.svelte`
- Create: `src/lib/components/ui/IconButton.svelte`
- Create: `src/lib/components/ui/SearchField.svelte`
- Create: `src/lib/components/ui/PaletteRow.svelte`

- [ ] **Step 1: Build reusable UI primitives**

Create accessible primitives:

- `IconButton`: accepts `label`, `title`, and icon slot; renders `aria-label`.
- `SearchField`: visible or `aria-label` search name; supports `bind:value`.
- `Chip`: supports active/inactive state.
- `PaletteRow`: renders swatches with text labels.

- [ ] **Step 2: Build `AssetCard`**

Required behavior:

- displays image
- Library variant can show title, creator/year, primary tag, favorite
- Explore variant is image-forward with quick Add
- click selects asset
- long-press or keyboard menu path can enter selection
- selected state is visible without color alone

- [ ] **Step 3: Build `AssetGrid`**

Responsive rules:

- phone Library: two-column masonry-like grid
- phone Explore: tighter two or three-column image grid depending width
- tablet/desktop: CSS grid with `minmax()` columns and varied aspect ratios

- [ ] **Step 4: Build Library and Explore views**

Library:

- breadcrumb path
- search/filter controls
- folder/sidebar on non-mobile
- metadata-aware grid

Explore:

- source row
- category chips
- result count/sort
- quick Add buttons
- no `For You` label

- [ ] **Step 5: Build Inspector**

Inspector includes:

- image preview
- title/creator/source metadata
- description
- tags
- palette row
- notes
- actions

Use action labels from the plans. For unsaved Explore assets, prefer `Add to Library`.

- [ ] **Step 6: Commit browse and inspect**

Run:

```bash
npm run check
npm run test
git add src
git commit -m "Build Library Explore and Inspector"
```

Expected: checks pass and commit succeeds.

### Task 6: Implement Mobile States And Overlays

**Files:**

- Create: `src/lib/components/inspector/MobileInspectScreen.svelte`
- Create: `src/lib/components/overlays/AddToLibrary.svelte`
- Create: `src/lib/components/overlays/FocusedPreview.svelte`
- Create: `src/lib/components/selection/SelectionActionBar.svelte`

- [ ] **Step 1: Build mobile inspect screen**

Phone behavior:

- image opens as separate screen
- back returns to `browse`
- state preserves mode, query, filters, and selected path
- bottom nav remains available unless visual testing says it conflicts

- [ ] **Step 2: Build Selection Mode**

Selection behavior:

- long-press enters selection
- visible alternative: More menu can enter selection
- action bar shows count and actions: Add to, Tag, Move, Palette, More
- bottom nav becomes secondary while selection action bar is active

- [ ] **Step 3: Build Add to Library**

Non-mobile:

- Add button opens anchored popover near top-right Add button
- sources: From Gallery, From Folder, From URL, Paste from Clipboard

Phone:

- center Add opens bottom drawer
- drawer uses focus management and Escape/back close

- [ ] **Step 4: Build focused preview**

Focused preview behavior:

- opens from Inspector image or card secondary action
- overlay with large image, close, favorite, previous, next
- palette toggle and Copy Palette
- Escape closes
- arrow keys navigate

- [ ] **Step 5: Commit mobile states**

Run:

```bash
npm run check
npm run test
git add src
git commit -m "Build mobile states and overlays"
```

Expected: checks pass and commit succeeds.

### Task 7: Add Unit Tests For State Helpers

**Files:**

- Create: `src/lib/utils/asset-state.ts`
- Create: `src/lib/utils/asset-state.test.ts`

- [ ] **Step 1: Extract pure state helpers**

Create helpers:

```ts
export function toggleId(ids: string[], id: string): string[] {
	return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function removeId(ids: string[], id: string): string[] {
	return ids.filter((item) => item !== id);
}

export function formatBreadcrumb(parts: string[]): string {
	return parts.filter(Boolean).join(' / ');
}
```

- [ ] **Step 2: Add tests**

`asset-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatBreadcrumb, removeId, toggleId } from './asset-state';

describe('asset-state helpers', () => {
	it('adds an id when toggling an unselected id', () => {
		expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('removes an id when toggling a selected id', () => {
		expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
	});

	it('removes an id directly', () => {
		expect(removeId(['a', 'b'], 'b')).toEqual(['a']);
	});

	it('formats breadcrumbs without empty segments', () => {
		expect(formatBreadcrumb(['library', '', 'refs', 'artworks'])).toBe('library / refs / artworks');
	});
});
```

- [ ] **Step 3: Run unit tests**

Run:

```bash
npm run test -- --run
```

Expected: tests pass.

- [ ] **Step 4: Commit unit tests**

Run:

```bash
git add src/lib/utils
git commit -m "Test shell state helpers"
```

Expected: commit succeeds.

### Task 8: Add Playwright Flow Tests And Visual QA

**Files:**

- Create: `tests/pastiche-shell.spec.ts`

- [ ] **Step 1: Add Playwright tests**

Create tests covering:

- desktop Library renders rail, grid, and Inspector after selecting an asset
- Explore renders source/category controls and quick Add buttons
- phone viewport renders bottom nav
- phone asset tap opens inspect screen and Back restores browse
- Add opens drawer/popover
- no visible `For You` text

- [ ] **Step 2: Run Playwright**

Run:

```bash
npm run test:e2e
```

Expected: all tests pass.

- [ ] **Step 3: Manual responsive screenshots**

Run the dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Capture or inspect these viewport widths:

- `390 x 844` phone
- `820 x 1180` iPad portrait
- `1180 x 820` iPad landscape
- `1440 x 1000` desktop

Expected:

- phone uses bottom nav
- iPad portrait preserves browse-first layout
- iPad landscape supports rail and Inspector
- desktop supports full Library sidebar

- [ ] **Step 4: Commit QA tests**

Run:

```bash
git add tests
git commit -m "Add shell flow tests"
```

Expected: commit succeeds.

### Task 9: Final Verification

**Files:**

- Verify all source files and docs touched by the slice.

- [ ] **Step 1: Run complete verification**

Run:

```bash
npm run check
npm run test -- --run
npm run test:e2e
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Check Git status**

Run:

```bash
git status --short --branch
```

Expected: clean branch with local commits ahead of origin.

- [ ] **Step 3: Push branch**

Run:

```bash
git push
```

Expected: branch updates on GitHub.

## Self-Review Checklist

This plan covers:

- SvelteKit setup
- seed `DESIGN.md`
- Phosphor icons
- responsive shell
- Home hub
- Library and Explore browse
- Inspector
- mobile Selection Mode
- mobile Add drawer
- mobile Inspect
- non-mobile Add popover
- focused preview
- unit tests
- Playwright flow tests
- visual QA breakpoints

The backend, real imports, museum APIs, SQLite, and Canvas editor are intentionally outside this first vertical slice.
