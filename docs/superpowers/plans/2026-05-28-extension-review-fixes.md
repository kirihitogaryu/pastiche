# Pastiche Extension Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the extension changes from review so the Chrome/Firefox skeleton builds, follows `agent-guidelines-extension.md`, and preserves the local library duplicate contract.

**Architecture:** Keep one compiled extension codebase with browser-specific manifests copied by Vite. Move reusable extension behavior into small pure helpers where tests can cover it, keep content scripts framework-free, and leave the sidebar as the source of selection truth.

**Tech Stack:** Svelte 5, Vite, MV3 extension APIs, Vitest, TypeScript, Pastiche `/api/status` and `/api/import`.

---

## File Structure

- Modify `package.json`: remove the stale `cp extension/manifest.json ...` step and add explicit Chrome/Firefox build scripts.
- Modify `extension/vite.config.ts`: keep the manifest-copy plugin and make browser target validation explicit.
- Move sidebar components into `extension/sidebar/components/`: matches the existing `App.svelte` imports and keeps their `../../shared/*` imports correct.
- Modify `extension/background/service-worker.ts`: import capture activation, consume `/api/status.imported_sources`, use full source hashes, and update the local library index with server hashes.
- Modify `extension/shared/types.ts`: add `ImportedSource` and `StatusApiResponse` types.
- Create `extension/shared/source-hash.ts`: normalize URLs and compute the same full SHA-256 source hash contract used by the Pastiche server.
- Create `extension/shared/source-hash.spec.ts`: unit coverage for full hash length, normalization, and fallback URL selection.
- Modify `extension/content/resolver.ts`: replace hand-rolled `srcset` splitting with browser-native `HTMLImageElement.currentSrc` selection.
- Modify `extension/content/index.ts`: return only new sweep candidates.
- Restore `agent-guidelines-explore.md` and `agent-guidelines-explore2.md` unless the user explicitly confirms those unrelated deletions.

---

### Task 1: Restore Buildability And File Layout

**Files:**

- Modify: `package.json`
- Modify: `extension/vite.config.ts`
- Move:
  - `extension/sidebar/StatusBar.svelte` to `extension/sidebar/components/StatusBar.svelte`
  - `extension/sidebar/SelectionList.svelte` to `extension/sidebar/components/SelectionList.svelte`
  - `extension/sidebar/SelectionItem.svelte` to `extension/sidebar/components/SelectionItem.svelte`
  - `extension/sidebar/FolderDropdown.svelte` to `extension/sidebar/components/FolderDropdown.svelte`
  - `extension/sidebar/EmptyState.svelte` to `extension/sidebar/components/EmptyState.svelte`
  - `extension/sidebar/StorageModeLabel.svelte` to `extension/sidebar/components/StorageModeLabel.svelte`

- [ ] **Step 1: Move sidebar component files**

Run:

```bash
mkdir -p extension/sidebar/components
git mv extension/sidebar/StatusBar.svelte extension/sidebar/components/StatusBar.svelte
git mv extension/sidebar/SelectionList.svelte extension/sidebar/components/SelectionList.svelte
git mv extension/sidebar/SelectionItem.svelte extension/sidebar/components/SelectionItem.svelte
git mv extension/sidebar/FolderDropdown.svelte extension/sidebar/components/FolderDropdown.svelte
git mv extension/sidebar/EmptyState.svelte extension/sidebar/components/EmptyState.svelte
git mv extension/sidebar/StorageModeLabel.svelte extension/sidebar/components/StorageModeLabel.svelte
```

Expected: the component paths now match the imports in `extension/sidebar/App.svelte:25-28`, and their existing imports like `../../shared/types` remain correct.

- [ ] **Step 2: Fix extension build scripts**

Change `package.json` scripts to:

```json
"build:extension": "vite build --config extension/vite.config.ts",
"build:extension:chrome": "vite build --config extension/vite.config.ts",
"build:extension:firefox": "BROWSER=firefox vite build --config extension/vite.config.ts",
```

Remove the stale `cp extension/manifest.json extension/dist/manifest.json` portion.

- [ ] **Step 3: Make the Vite browser target explicit**

In `extension/vite.config.ts`, replace the browser constant with:

```ts
const browserName = process.env.BROWSER ?? 'chrome';
if (browserName !== 'chrome' && browserName !== 'firefox') {
	throw new Error(`Unsupported extension browser target: ${browserName}`);
}

const browser = browserName;
const outDir = browser === 'firefox' ? 'dist-firefox' : 'dist';
```

- [ ] **Step 4: Verify Chrome and Firefox extension builds**

Run:

```bash
npm run build:extension
npm run build:extension:firefox
```

Expected: both commands pass; `extension/dist/manifest.json` is copied from `manifest.chrome.json`, and `extension/dist-firefox/manifest.json` is copied from `manifest.firefox.json`.

- [ ] **Step 5: Commit**

```bash
git add package.json extension/vite.config.ts extension/sidebar
git commit -m "fix: restore extension build layout"
```

---

### Task 2: Fix Capture Command Import

**Files:**

- Modify: `extension/background/service-worker.ts`

- [ ] **Step 1: Write the minimal failure check**

Run:

```bash
npm run build:extension
```

Expected before this task: after Task 1, TypeScript or bundling should surface `MESSAGE_CAPTURE_ACTIVATE` as missing if it is still not imported.

- [ ] **Step 2: Import the missing message constant**

In `extension/background/service-worker.ts`, update the import from `../shared/messages`:

```ts
import {
	MESSAGE_GET_STATUS,
	MESSAGE_SMOKE_IMPORT,
	MESSAGE_ITEM_CAPTURED,
	MESSAGE_SWEEP_RESULTS,
	MESSAGE_LASSO_RESULTS,
	MESSAGE_CAPTURE_ACTIVATE,
	MESSAGE_DO_IMPORT,
	MESSAGE_RETRY_ITEM,
	MESSAGE_FETCH_IMAGE,
	MESSAGE_ITEM_READY,
	MESSAGE_BATCH_READY,
	MESSAGE_FETCH_COMPLETE,
	MESSAGE_QUEUE_UPDATED,
	MESSAGE_QUEUE_REPLAYED
} from '../shared/messages';
```

- [ ] **Step 3: Verify shortcut path compiles**

Run:

```bash
npm run build:extension
```

Expected: build passes this missing-constant issue.

- [ ] **Step 4: Commit**

```bash
git add extension/background/service-worker.ts
git commit -m "fix: wire extension capture command message"
```

---

### Task 3: Align Duplicate Detection With Pastiche Status Hashes

**Files:**

- Create: `extension/shared/source-hash.ts`
- Create: `extension/shared/source-hash.spec.ts`
- Modify: `extension/shared/types.ts`
- Modify: `extension/background/service-worker.ts`

- [ ] **Step 1: Add failing tests for source hash behavior**

Create `extension/shared/source-hash.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeSourceHash, sourceKeyForUrls } from './source-hash';

describe('extension source hashing', () => {
	it('uses source image URL before page URL', () => {
		expect.assertions(1);
		expect(sourceKeyForUrls(' https://example.com/image.jpg ', 'https://example.com/page')).toBe(
			'https://example.com/image.jpg'
		);
	});

	it('falls back to source URL when the image URL is absent', () => {
		expect.assertions(1);
		expect(sourceKeyForUrls(null, ' https://example.com/page ')).toBe('https://example.com/page');
	});

	it('computes a full sha256 hash compatible with /api/status source_hash', async () => {
		expect.assertions(2);
		const hash = await computeSourceHash('https://example.com/image.jpg');
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});
});
```

Run:

```bash
npm run test:unit -- --run extension/shared/source-hash.spec.ts
```

Expected: fail because `extension/shared/source-hash.ts` does not exist yet.

- [ ] **Step 2: Implement source hashing helper**

Create `extension/shared/source-hash.ts`:

```ts
export function sourceKeyForUrls(sourceImageUrl: string | null, sourceUrl: string): string {
	return (sourceImageUrl?.trim() || sourceUrl.trim()).trim();
}

export async function computeSourceHash(source: string): Promise<string> {
	const data = new TextEncoder().encode(source.trim());
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
```

- [ ] **Step 3: Extend shared extension types**

In `extension/shared/types.ts`, add:

```ts
export type ImportedSource = {
	source_hash: string;
	source_image_url: string | null;
	source_url: string;
};

export type StatusApiResponse = {
	connected: true;
	unassigned_count: number;
	recent_folders: RecentFolder[];
	imported_sources: ImportedSource[];
};
```

Add `importedSources` to `ConnectionState`:

```ts
export type ConnectionState = {
	connected: boolean;
	offline: boolean;
	queuedCount: number;
	unassignedCount: number;
	recentFolders: RecentFolder[];
	importedSources: ImportedSource[];
};
```

- [ ] **Step 4: Consume imported_sources from /api/status**

In `extension/background/service-worker.ts`, import the helper and type:

```ts
import { computeSourceHash, sourceKeyForUrls } from '../shared/source-hash';
import type { StatusApiResponse } from '../shared/types';
```

Replace the ad hoc status response type in `getPasticheStatus` with:

```ts
const status = (await response.json()) as StatusApiResponse;
const importedSources = status.imported_sources ?? [];
await updateLibraryIndex(importedSources.map((source) => source.source_hash));

const queued = await getQueuedJobs();
const state: ConnectionState = {
	connected: true,
	offline: false,
	queuedCount: queued.length,
	unassignedCount: status.unassigned_count,
	recentFolders: status.recent_folders,
	importedSources
};
```

In the offline fallback object, include:

```ts
importedSources: [];
```

- [ ] **Step 5: Replace truncated hashUrl usage**

In `enrichItem`, replace:

```ts
const id = await hashUrl(captured.url);
const alreadyInLibrary = await checkDuplicate(id);
```

with:

```ts
const sourceHash = await computeSourceHash(sourceKeyForUrls(captured.url, captured.sourceUrl));
const id = sourceHash;
const alreadyInLibrary = await checkDuplicate(sourceHash);
```

In `handleDoImport`, replace:

```ts
const hashes = await Promise.all(importedItems.map((item) => hashUrl(item.url)));
await updateLibraryIndex(hashes);
```

with:

```ts
const hashes = await Promise.all(
	importedItems.map((item) => computeSourceHash(sourceKeyForUrls(item.url, item.sourceUrl)))
);
await updateLibraryIndex(hashes);
```

In `handleRetryItem`, replace:

```ts
await updateLibraryIndex([await hashUrl(item.url)]);
```

with:

```ts
await updateLibraryIndex([await computeSourceHash(sourceKeyForUrls(item.url, item.sourceUrl))]);
```

Delete the old private `hashUrl` function from `service-worker.ts`.

- [ ] **Step 6: Verify duplicate hash tests and extension build**

Run:

```bash
npm run test:unit -- --run extension/shared/source-hash.spec.ts
npm run build:extension
```

Expected: tests pass, and the service worker builds without the removed `hashUrl`.

- [ ] **Step 7: Commit**

```bash
git add extension/shared/source-hash.ts extension/shared/source-hash.spec.ts extension/shared/types.ts extension/background/service-worker.ts
git commit -m "fix: sync extension duplicate index with library status"
```

---

### Task 4: Replace Custom Srcset Parser With Browser-Native Resolution

**Files:**

- Modify: `extension/content/resolver.ts`

- [ ] **Step 1: Remove the custom parser path**

In `resolveImg`, replace the srcset block:

```ts
if (img.srcset) {
	const url = largestSrcsetUrl(img.srcset);
	if (url) {
		return {
			url: applyArtsyUpsize(url),
			naturalWidth: img.naturalWidth,
			naturalHeight: img.naturalHeight,
			mimeType: null,
			inlineData: null,
			altText: img.alt || null
		};
	}
}
```

with browser-native selection:

```ts
const resolvedUrl = img.currentSrc || img.src;
if (resolvedUrl && resolvedUrl !== window.location.href) {
	return {
		url: applyArtsyUpsize(resolvedUrl),
		naturalWidth: img.naturalWidth,
		naturalHeight: img.naturalHeight,
		mimeType: null,
		inlineData: null,
		altText: img.alt || null
	};
}
```

- [ ] **Step 2: Delete the custom parser**

Remove the entire `largestSrcsetUrl` function and the `// srcset parser` section from `extension/content/resolver.ts`.

- [ ] **Step 3: Verify no custom parser remains**

Run:

```bash
rg "largestSrcsetUrl|srcset.split|hand-rolled|custom parser" extension/content/resolver.ts
```

Expected: no matches.

- [ ] **Step 4: Build the extension**

Run:

```bash
npm run build:extension
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add extension/content/resolver.ts
git commit -m "fix: use browser-native srcset resolution"
```

---

### Task 5: Stop Page Sweep From Re-Adding Existing Selections

**Files:**

- Modify: `extension/content/index.ts`

- [ ] **Step 1: Apply the sweep dedupe fix**

In `runSweep`, replace:

```ts
ext.runtime.sendMessage({
	type: MSG_SWEEP_RESULTS,
	items: candidates.map(candidateToPayload)
});
```

with:

```ts
if (newCandidates.length > 0) {
	ext.runtime.sendMessage({
		type: MSG_SWEEP_RESULTS,
		items: newCandidates.map(candidateToPayload)
	});
}
```

- [ ] **Step 2: Verify lasso and sweep now match**

Compare the sweep block to the lasso block:

```bash
sed -n '248,284p' extension/content/index.ts
```

Expected: both modes badge only new candidates and send only new candidates.

- [ ] **Step 3: Build the extension**

Run:

```bash
npm run build:extension
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add extension/content/index.ts
git commit -m "fix: dedupe page sweep results before sidebar add"
```

---

### Task 6: Restore Unrelated Guideline Deletions

**Files:**

- Restore: `agent-guidelines-explore.md`
- Restore: `agent-guidelines-explore2.md`

- [ ] **Step 1: Confirm the deletions are unrelated**

Run:

```bash
git status -sb
git diff -- agent-guidelines-explore.md agent-guidelines-explore2.md
```

Expected: both files are deleted and unrelated to the extension review fixes.

- [ ] **Step 2: Restore the files from HEAD**

Run:

```bash
git restore agent-guidelines-explore.md agent-guidelines-explore2.md
```

Expected: both deletions disappear from `git status`.

- [ ] **Step 3: Commit only if this restoration is not included in an earlier commit**

```bash
git add agent-guidelines-explore.md agent-guidelines-explore2.md
git commit -m "chore: restore explore guideline documents"
```

If `git status` shows no changes for these files, skip the commit.

---

### Task 7: Final Verification

**Files:**

- No new files.

- [ ] **Step 1: Run extension-specific verification**

Run:

```bash
npm run build:extension
npm run build:extension:firefox
npm run test:unit -- --run extension/shared/settings.spec.ts extension/shared/source-hash.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Run project verification**

Run:

```bash
npm run check
npm run test:unit -- --run
npm run build
```

Expected: all pass.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status -sb
git diff --stat
git diff -- package.json extension agent-guidelines-explore.md agent-guidelines-explore2.md
```

Expected:

- no deleted guideline docs
- no reference to `extension/manifest.json`
- no custom `srcset` parser
- no missing component imports
- `MESSAGE_CAPTURE_ACTIVATE` imported in service worker
- duplicate index populated from `/api/status.imported_sources`

- [ ] **Step 4: Final commit if needed**

If any verification-only cleanup remains:

```bash
git add package.json extension agent-guidelines-explore.md agent-guidelines-explore2.md
git commit -m "fix: stabilize extension review fixes"
```

---

## Self-Review

- Spec coverage: all six review findings are covered by Tasks 1-5. The unrelated guideline deletions from the review summary are covered by Task 6. Final build/test confidence is covered by Task 7.
- Placeholder scan: no task relies on TBD behavior. Each task names exact files, commands, and expected outcomes.
- Type consistency: `ImportedSource`, `StatusApiResponse`, `ConnectionState.importedSources`, `computeSourceHash`, and `sourceKeyForUrls` are introduced before their service-worker usage.
