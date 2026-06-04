# Library Metadata Source Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user explicitly requested no subagents.

**Goal:** Build the first Library metadata/source read model slice and wire the desktop inspector to the canonical fields.

**Architecture:** Add a canonical `LibraryAssetRecord` beside the legacy `Asset` compatibility shape. The server maps SQLite rows and existing `metadata_json` into the canonical record, then derives legacy fields from that record while the rest of the UI migrates gradually. The desktop inspector consumes canonical fields when present and falls back to legacy fields for mock/explore assets.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest, better-sqlite3.

---

### Task 1: Add Canonical Library Types

**Files:**
- Modify: `src/lib/library/types.ts`

- [x] **Step 1: Write the failing type/mapper tests first in Task 2**

Task 1 has no standalone runtime behavior. Its production code is introduced only after Task 2 adds failing tests that require the new fields.

### Task 2: Map Canonical Records On Read

**Files:**
- Modify: `src/lib/server/library/read.spec.ts`
- Modify: `src/lib/server/library/read.ts`
- Modify: `src/lib/library/types.ts`

- [x] **Step 1: Add failing tests**

Add tests proving that Explore metadata maps to `record`, source tags become suggestions, URL-reference images use remote URLs, downloaded images use local API URLs, and missing local files produce no local preview.

- [x] **Step 2: Run red tests**

Run: `npm run test:unit -- --run src/lib/server/library/read.spec.ts`

Expected: Fail because `record` and canonical fields do not exist.

- [x] **Step 3: Implement minimal mapper**

Add `LibraryAssetRecord` types, map rows to records, derive compatibility `Asset` fields from records, and check local file availability.

- [x] **Step 4: Run green tests**

Run: `npm run test:unit -- --run src/lib/server/library/read.spec.ts`

Expected: Pass.

### Task 3: Wire Desktop Inspector To Canonical Fields

**Files:**
- Modify: `src/lib/components/inspector/AssetInspector.svelte`

- [x] **Step 1: Add failing component-oriented expectations through typecheck**

The inspector should compile against `Asset & { record?: LibraryAssetRecord }` and use `record.source.pageUrl`, `record.dates.dateDisplay`, `record.dates.importedAt`, `record.facts`, and `record.organization.sourceTagSuggestions`.

- [x] **Step 2: Implement inspector fallback helpers**

Add derived helpers so mock/explore assets still render, while Library assets use canonical data.

- [x] **Step 3: Run check**

Run: `npm run check`

Expected: Pass.

### Task 4: Final Verification

**Files:**
- No new files.

- [x] **Step 1: Run focused unit tests**

Run: `npm run test:unit -- --run src/lib/server/library/read.spec.ts src/routes/api/library/save-explore/server.spec.ts src/routes/api/library/assets/[id]/image/server.spec.ts`

Expected: Pass.

- [x] **Step 2: Run full typecheck**

Run: `npm run check`

Expected: Pass.

- [x] **Step 3: Inspect git diff**

Run: `git diff --stat`

Expected: Only the implementation files and this plan changed.
