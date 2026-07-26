# Artist Resolution Pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add artist suggestions and picker flows so existing artist entities are selected instead of duplicated during import and Atlas metadata editing.

**Architecture:** Implement one server-side artist suggestion reader and route, then reuse it in the extension metadata editor and Atlas metadata panel. Keep the payload lightweight but include aliases, links, work counts, and match reason so UIs can explain suggestions without duplicating lookup logic.

**Tech Stack:** SvelteKit, TypeScript, Svelte 5, better-sqlite3, Vitest, existing extension sidebar components.

---

## File Map

- Create `src/lib/server/atlas/entitySuggest.ts`: read and rank artist suggestions.
- Create `src/lib/server/atlas/entitySuggest.spec.ts`: focused suggestion matching tests.
- Create `src/routes/api/atlas/entities/suggest/+server.ts`: public suggestion route.
- Create `src/routes/api/atlas/entities/suggest/server.spec.ts`: route tests.
- Modify `extension/shared/types.ts`: optional selected artist identity hint.
- Modify `extension/sidebar/components/MetadataEditor.svelte`: artist autocomplete UI.
- Modify `extension/sidebar/item-state.ts` and tests if metadata patch shape changes.
- Modify `src/lib/components/atlas/AtlasMetadataPanel.svelte`: artist suggestions in Source Entities add form.
- Modify `src/lib/server/atlas/entityProfile.ts`: expose first/last seen link evidence in profile reads if already stored.
- Modify `src/lib/atlas/types.ts`: shared artist suggestion/link evidence types.

## Task 1: Artist Suggestion API

- [ ] Write failing tests in `src/lib/server/atlas/entitySuggest.spec.ts` for matching artists by label, alias, and profile username, plus ranking by exact match and work count.
- [ ] Write failing route tests in `src/routes/api/atlas/entities/suggest/server.spec.ts` for `kind=artist`, empty query, and unsupported kind.
- [ ] Implement `suggestAtlasEntities(db, { kind, query, limit })`.
- [ ] Implement `GET /api/atlas/entities/suggest`.
- [ ] Run `npm run test:unit -- --run src/lib/server/atlas/entitySuggest.spec.ts src/routes/api/atlas/entities/suggest/server.spec.ts`.
- [ ] Commit with `feat: suggest atlas artists`.

## Task 2: Extension Artist Picker

- [ ] Add selected artist identity fields to extension metadata types if needed.
- [ ] Update `MetadataEditor.svelte` so typing in Artist fetches artist suggestions and selecting a suggestion patches artist/profile URL/username.
- [ ] Run `npm run check` and focused extension tests.
- [ ] Commit with `feat: add extension artist picker`.

## Task 3: Atlas Metadata Artist Picker

- [ ] Update `AtlasMetadataPanel.svelte` so the Source Entity add form fetches artist suggestions when `entityKind === 'artist'`.
- [ ] Selecting a suggestion fills the artist label and adds the canonical artist entity.
- [ ] Run `npm run check`.
- [ ] Commit with `feat: add atlas artist picker`.

## Task 4: Evidence Display And Verification

- [ ] Expose profile link evidence details already stored in `atlas_entity_links`.
- [ ] Render source label, host, username, and confidence on artist profiles.
- [ ] Run focused tests, `npm run check`, full unit tests, and `/api/status` smoke if server state changed.
- [ ] Push `codex/atlas-search-v1`.
