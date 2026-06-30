# Artist Profile Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable Atlas artist profiles for profile metadata, aliases, and profile links.

**Architecture:** Keep all behavior in the existing Atlas entity/profile model. Add a PATCH route that updates profile rows, aliases, and links, then returns the existing `AtlasEntityProfile` response shape. Extend the current Atlas Wiki artist profile branch with a compact edit mode.

**Tech Stack:** SvelteKit, TypeScript, `better-sqlite3`, Vitest, existing Atlas Wiki UI patterns.

---

## File Map

- Modify `src/lib/server/atlas/entityProfile.ts`: add profile update helpers.
- Modify `src/routes/api/atlas/entities/[kind]/[slug]/+server.ts`: add PATCH endpoint and request validation.
- Modify `src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts`: route tests for profile update and search-visible aliases.
- Modify `src/lib/components/atlas/AtlasWiki.svelte`: artist edit mode, save/cancel, alias/link inputs.

## Task 1: Artist Profile Update API

**Files:**
- Modify: `src/lib/server/atlas/entityProfile.ts`
- Modify: `src/routes/api/atlas/entities/[kind]/[slug]/+server.ts`
- Test: `src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts`

- [ ] **Step 1: Write failing route tests**

Add tests proving PATCH can update profile fields, aliases, and links, and that the new alias/search username resolves through Atlas search.

- [ ] **Step 2: Run focused route tests and verify failure**

Run:

```bash
npm run test:unit -- --run 'src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts'
```

Expected: FAIL because PATCH is not implemented.

- [ ] **Step 3: Implement profile update helper**

Add an `updateAtlasEntityProfile` helper that:

- Confirms the entity exists.
- Upserts `atlas_entity_profiles`.
- Replaces manual aliases from the request with normalized aliases.
- Replaces manual links from the request with normalized profile URLs.
- Returns `readAtlasEntityProfile(...)`.

- [ ] **Step 4: Implement PATCH route**

Parse JSON, validate supported entity kind, call the update helper, and return `{ entity }` or existing error shapes.

- [ ] **Step 5: Verify focused API tests pass**

Run:

```bash
npm run test:unit -- --run 'src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/atlas/entityProfile.ts src/routes/api/atlas/entities/[kind]/[slug]/+server.ts src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts
git commit -m "feat: edit atlas artist profiles"
```

## Task 2: Artist Profile Editor UI

**Files:**
- Modify: `src/lib/components/atlas/AtlasWiki.svelte`

- [ ] **Step 1: Add edit state**

Add draft state for active artist profiles and helpers to serialize list fields.

- [ ] **Step 2: Add edit controls**

Render Edit/Save/Cancel controls on artist profiles. In edit mode, show compact inputs for text fields, list fields, aliases, and profile links.

- [ ] **Step 3: Save through PATCH route**

PATCH the draft to `/api/atlas/entities/${kind}/${slug}` and replace `activeEntity` with the returned profile.

- [ ] **Step 4: Verify Svelte check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/atlas/AtlasWiki.svelte
git commit -m "feat: add artist profile editor"
```

## Task 3: Final Verification

**Files:** no implementation files expected.

- [ ] **Step 1: Run focused tests**

```bash
npm run test:unit -- --run 'src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts' src/lib/server/atlas/search.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full checks**

```bash
npm run check
npm run test:unit -- --run
```

Expected: PASS.

- [ ] **Step 3: Push**

```bash
git push origin codex/atlas-search-v1
```
