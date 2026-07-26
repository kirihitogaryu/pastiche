# Extension Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the highest-impact extension bugs found in review without disturbing unrelated app work.

**Architecture:** Keep capture enrichment and import orchestration in the service worker, but move reusable state transitions into pure helpers with tests. Keep the sidebar responsive, while treating service-worker storage as canonical for capture events and IndexedDB as the durable home for downloaded image bytes.

**Tech Stack:** TypeScript, Svelte 5, Chrome/Firefox MV3 extension APIs, idb-keyval, Vitest, Vite.

---

## File Structure

- Create `extension/shared/image-data-store.ts`: IndexedDB helpers for fetched image bytes.
- Create `extension/shared/fetch-status.ts`: storage-safe fetch status helpers and import rehydration.
- Create `extension/background/import-result.ts`: classify import failures so only offline/network failures queue.
- Create `extension/background/status-state.ts`: build an offline state from cached status without preserving a stale connected flag.
- Modify `extension/shared/types.ts`: add stable `captureKey` and blob-backed fetch status fields.
- Modify `extension/background/service-worker.ts`: use status/import helpers, include credentials on image fetches, persist blob-backed fetch states, and rehydrate imports before posting.
- Modify `extension/background/enrich-capture.ts`: make wire conversion async and blob-aware.
- Modify `extension/sidebar/App.svelte`: stop racing service-worker capture writes, load blob-backed previews, preserve badge keys, and read configured sweep threshold.
- Modify `extension/sidebar/item-state.ts`: recompute selected candidate identity fields from the current URL while preserving stable capture identity.
- Modify `extension/content/candidate-scanner.ts`: enable `data-srcset`.
- Modify `extension/settings/Settings.svelte`: clear saved-state feedback when values change.
- Modify extension specs near each changed helper.

---

### Task 1: Cover Pure State Bugs

- [ ] Add tests for stale offline status in `extension/background/status-state.spec.ts`.
- [ ] Add tests for import queue classification in `extension/background/import-result.spec.ts`.
- [ ] Add tests for storage-safe fetch status and blob rehydration in `extension/shared/fetch-status.spec.ts`.
- [ ] Add tests for `captureKey` and candidate identity updates in `extension/sidebar/item-state.spec.ts`.
- [ ] Add a `data-srcset` regression in `extension/content/candidate-scanner.spec.ts`.
- [ ] Run the focused tests and confirm they fail before implementation.

### Task 2: Patch Background Behavior

- [ ] Implement offline status rebuilding so cached connected states become offline states.
- [ ] Classify network/timeout failures separately from HTTP import errors.
- [ ] Queue only offline import failures; return server validation/import errors directly.
- [ ] Fetch image URLs with credentials.
- [ ] Store downloaded bytes in IndexedDB and persist only blob keys in `chrome.storage.local`.
- [ ] Rehydrate blob-backed items before posting `/api/import`.

### Task 3: Patch Sidebar State

- [ ] Stop persisting capture and fetch-complete broadcasts back over the service-worker copy.
- [ ] Load blob-backed thumbnails from IndexedDB.
- [ ] Persist metadata edits with storage-safe fetch statuses.
- [ ] Use `captureKey` when clearing badges after candidate switching.
- [ ] Read `sizeThreshold` from extension settings for sweep requests.

### Task 4: Patch Scanner and Settings

- [ ] Add `data-srcset` to lazy image attributes.
- [ ] Clear the settings saved indicator when edited values differ from stored settings.
- [ ] Update message/types drift for `PASTICHE_FETCH_IMAGE`.

### Task 5: Verify

- [ ] Run focused extension unit tests.
- [ ] Run all extension unit tests.
- [ ] Run `npm run check`.
- [ ] Run Chrome and Firefox extension builds.
- [ ] Inspect `git diff --check`.
