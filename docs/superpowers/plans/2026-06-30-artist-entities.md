# Artist Entities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build integrated Atlas artist entities that resolve usernames/profile URLs on import, expose artist profile/wiki data, link artist mentions, and support `artist:(...)` search.

**Architecture:** Keep artists in the existing Atlas entity model (`atlas_entities.kind = "artist"`) and add entity-specific profile/link/alias tables beside the concept wiki. Import creates or resolves artist identities; Atlas reads/search/UI consume the same entity records rather than a separate artist surface.

**Tech Stack:** SvelteKit, TypeScript, `better-sqlite3`, Vitest, existing Atlas schema/read/search/import routes.

---

## File Map

- Modify `src/lib/server/atlas/schema.ts`: add artist/entity profile, alias, and link tables.
- Modify `src/lib/atlas/types.ts`: add artist/entity profile summary types.
- Create `src/lib/server/atlas/entityIdentity.ts`: normalize profile URLs/usernames and resolve/create artist entities.
- Create `src/lib/server/atlas/entityProfile.ts`: read artist profile + linked works for UI/API.
- Modify `src/lib/server/atlas/ingest.ts`: include artist profile link evidence in ingestion proposals and apply it.
- Modify `src/lib/server/library/import.ts`: pass source profile metadata from extension/import metadata into Atlas ingestion.
- Modify `src/lib/server/library/types.ts` and `src/routes/api/import/+server.ts`: accept artist profile URL/username metadata.
- Modify `extension/shared/source-adapters.ts`: extract source artist/profile URLs where known.
- Modify `extension/background/enrich-capture.ts`: send artist profile link metadata to import API.
- Add route `src/routes/api/atlas/entities/[kind]/[slug]/+server.ts`: return artist entity profile data.
- Modify `src/lib/server/atlas/search.ts` and search API types: parse `artist:(...)`, match aliases/profile usernames, and emit artist result cards.
- Modify `src/lib/components/atlas/AtlasMetadataPanel.svelte`: open artist entity wiki mode for artist rows.
- Modify `src/lib/components/atlas/AtlasWiki.svelte`: render entity/artist mode inside the existing wiki surface.
- Modify `src/lib/components/atlas/AtlasSearch.svelte`: render artist result cards and show-works action.
- Modify Library inspector components after backend entity links are available.

---

### Task 1: Artist Entity Schema And Types

**Files:**
- Modify: `src/lib/server/atlas/schema.ts`
- Modify: `src/lib/atlas/types.ts`
- Test: `src/lib/server/atlas/schema.spec.ts`

- [ ] **Step 1: Write the failing schema test**

Add expectations for the new tables in `src/lib/server/atlas/schema.spec.ts`:

```ts
expect(tables).toEqual([
  'asset_import_failures',
  'asset_tags',
  'assets',
  'atlas_annotation_classifiers',
  'atlas_annotation_concepts',
  'atlas_annotations',
  'atlas_asset_concepts',
  'atlas_asset_entities',
  'atlas_claims',
  'atlas_concepts',
  'atlas_entities',
  'atlas_entity_aliases',
  'atlas_entity_links',
  'atlas_entity_profiles',
  'atlas_ingestion_runs',
  'atlas_tag_suggestions',
  'atlas_wiki_entries',
  'folders',
  'lazy_download_jobs',
  'project_asset_refs',
  'project_folder_refs',
  'projects',
  'tag_facets',
  'tags'
]);
```

- [ ] **Step 2: Run schema test to verify it fails**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/schema.spec.ts
```

Expected: FAIL because `atlas_entity_profiles`, `atlas_entity_aliases`, and `atlas_entity_links` do not exist.

- [ ] **Step 3: Add schema tables**

In `src/lib/server/atlas/schema.ts`, add inside `ensureAtlasSchema` after `atlas_entities`:

```sql
create table if not exists atlas_entity_profiles (
  entity_id text primary key references atlas_entities(id) on delete cascade,
  summary text,
  notes text,
  movements_json text not null default '[]',
  styles_json text not null default '[]',
  common_subjects_json text not null default '[]',
  historical_period text,
  media_json text not null default '[]',
  ai_guidance text,
  updated_at text not null
);

create table if not exists atlas_entity_aliases (
  id text primary key,
  entity_id text not null references atlas_entities(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null,
  confidence text not null,
  created_at text not null,
  unique(entity_id, normalized_alias, source)
);

create table if not exists atlas_entity_links (
  id text primary key,
  entity_id text not null references atlas_entities(id) on delete cascade,
  url text not null,
  normalized_url text not null,
  host text not null,
  username text,
  source_label text,
  confidence text not null,
  first_seen_asset_id text references assets(id) on delete set null,
  last_seen_at text not null,
  created_at text not null,
  unique(entity_id, normalized_url)
);
```

- [ ] **Step 4: Add TypeScript types**

In `src/lib/atlas/types.ts`, add:

```ts
export type AtlasEntityProfile = {
  entityId: string;
  kind: AtlasEntityKind;
  slug: string;
  label: string;
  summary: string | null;
  notes: string | null;
  movements: string[];
  styles: string[];
  commonSubjects: string[];
  historicalPeriod: string | null;
  media: string[];
  aiGuidance: string | null;
  aliases: Array<{ alias: string; source: string; confidence: string }>;
  links: Array<{
    url: string;
    host: string;
    username: string | null;
    sourceLabel: string | null;
    confidence: string;
  }>;
  works: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    sourceUrl: string;
    importedAt: string;
  }>;
};
```

- [ ] **Step 5: Run schema test to verify it passes**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/schema.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/atlas/schema.ts src/lib/atlas/types.ts src/lib/server/atlas/schema.spec.ts
git commit -m "feat: add atlas entity profile schema"
```

---

### Task 2: Artist Identity Resolution

**Files:**
- Create: `src/lib/server/atlas/entityIdentity.ts`
- Test: `src/lib/server/atlas/entityIdentity.spec.ts`

- [ ] **Step 1: Write failing identity tests**

Create `src/lib/server/atlas/entityIdentity.spec.ts` with tests for:

```ts
it('normalizes social profile URLs to host and username', () => {
  expect(normalizeArtistProfileUrl('https://www.deviantart.com/ExampleArtist/gallery')).toMatchObject({
    normalizedUrl: 'https://deviantart.com/exampleartist',
    host: 'deviantart.com',
    username: 'exampleartist'
  });
  expect(normalizeArtistProfileUrl('https://x.com/ExampleArtist/status/1')).toMatchObject({
    normalizedUrl: 'https://x.com/exampleartist',
    host: 'x.com',
    username: 'exampleartist'
  });
});

it('resolves existing artists by host and username before display name', () => {
  const first = resolveOrCreateArtistEntity(db, {
    label: 'Example Artist',
    profileUrl: 'https://www.deviantart.com/exampleartist',
    sourceLabel: 'DeviantArt',
    assetId: 'asset-a',
    provenance: 'metadata.artist',
    now
  });
  const second = resolveOrCreateArtistEntity(db, {
    label: 'ExampleArtist',
    profileUrl: 'https://deviantart.com/exampleartist/gallery',
    sourceLabel: 'DeviantArt',
    assetId: 'asset-b',
    provenance: 'metadata.artist',
    now
  });
  expect(second.id).toBe(first.id);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/entityIdentity.spec.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement URL normalization and resolver**

Create `src/lib/server/atlas/entityIdentity.ts` exporting:

```ts
export type ArtistIdentityInput = {
  label: string | null;
  profileUrl?: string | null;
  username?: string | null;
  sourceLabel?: string | null;
  assetId?: string | null;
  provenance: string;
  now: string;
};

export type NormalizedArtistProfileUrl = {
  normalizedUrl: string;
  host: string;
  username: string | null;
};

export function normalizeArtistProfileUrl(value: string | null | undefined): NormalizedArtistProfileUrl | null;
export function normalizeArtistAlias(value: string): string;
export function resolveOrCreateArtistEntity(db: Database.Database, input: ArtistIdentityInput): { id: string; slug: string; label: string };
```

Implementation rules:

- Normalize `www.` away.
- Treat `twitter.com` and `x.com` as `x.com`.
- For DeviantArt, X/Twitter, Instagram, Tumblr, Bluesky, use the first path segment as username when it is not a reserved route.
- Match existing artist in this order:
  1. `atlas_entity_links.normalized_url`
  2. `atlas_entity_links.host + username`
  3. `atlas_entity_aliases.normalized_alias`
  4. `atlas_entities.kind='artist' + slug`
- Create a new `atlas_entities` artist when no match exists.
- Upsert alias and link rows when values are present.

- [ ] **Step 4: Run identity tests to verify they pass**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/entityIdentity.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/atlas/entityIdentity.ts src/lib/server/atlas/entityIdentity.spec.ts
git commit -m "feat: resolve atlas artist identities"
```

---

### Task 3: Import Artist Profile Evidence

**Files:**
- Modify: `src/lib/atlas/types.ts`
- Modify: `src/lib/server/atlas/ingest.ts`
- Modify: `src/lib/server/library/types.ts`
- Modify: `src/lib/server/library/import.ts`
- Modify: `src/routes/api/import/+server.ts`
- Modify: `extension/shared/candidates.ts`
- Modify: `extension/shared/source-adapters.ts`
- Modify: `extension/background/enrich-capture.ts`
- Tests: `src/lib/server/atlas/ingest.spec.ts`, `src/lib/server/library/library.spec.ts`, `extension/shared/source-adapters.spec.ts`, `extension/background/enrich-capture.spec.ts`

- [ ] **Step 1: Write failing import tests**

Add a library import test asserting:

```ts
metadata: {
  sourceName: 'DeviantArt',
  sourceType: 'gallery',
  creator: 'ExampleArtist',
  artistProfileUrl: 'https://www.deviantart.com/exampleartist',
  artistUsername: 'ExampleArtist'
}
```

After import, assert:

```ts
select atlas_entities.kind, atlas_entities.slug, atlas_entities.label from atlas_entities
```

contains `{ kind: 'artist', slug: 'exampleartist', label: 'ExampleArtist' }`, and `atlas_entity_links` contains host `deviantart.com`, username `exampleartist`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts extension/shared/source-adapters.spec.ts extension/background/enrich-capture.spec.ts
```

Expected: FAIL because artist profile metadata is not accepted or applied.

- [ ] **Step 3: Extend metadata types**

Add optional import metadata fields:

```ts
artistProfileUrl?: string | null;
artistUsername?: string | null;
```

Update route validation to accept nullable strings.

- [ ] **Step 4: Apply artist resolver during ingestion**

In `applyAtlasIngestionProposal`, replace direct artist entity insert path with `resolveOrCreateArtistEntity` for artist entities. Pass `profileUrl`, `username`, `sourceLabel`, `assetId`, and provenance from the ingestion input.

- [ ] **Step 5: Extract source artist links in extension**

In `extension/shared/source-adapters.ts`, add host-specific artist extraction:

- DeviantArt: byline/profile anchor or `twitter:creator` fallback.
- Tumblr: blog URL from page host and byline when available.
- X/Twitter: profile URL from page URL `/username/status/...`.
- Instagram: profile URL from page URL when a username is available in metadata/page links.
- Danbooru: artist tag source tags can provide artist label; profile URL may remain null unless present.

Store in `CaptureMetadata.artistProfileUrl` and `CaptureMetadata.artistUsername`.

- [ ] **Step 6: Send metadata through import wire format**

In `extension/background/enrich-capture.ts`, include:

```ts
artistProfileUrl: item.metadata.artistProfileUrl,
artistUsername: item.metadata.artistUsername
```

- [ ] **Step 7: Run tests to verify pass**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts src/routes/api/import/server.spec.ts extension/shared/source-adapters.spec.ts extension/background/enrich-capture.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/atlas/types.ts src/lib/server/atlas/ingest.ts src/lib/server/library/types.ts src/lib/server/library/import.ts src/routes/api/import/+server.ts extension/shared/candidates.ts extension/shared/source-adapters.ts extension/background/enrich-capture.ts src/lib/server/library/library.spec.ts src/routes/api/import/server.spec.ts extension/shared/source-adapters.spec.ts extension/background/enrich-capture.spec.ts
git commit -m "feat: record artist profile evidence on import"
```

---

### Task 4: Artist Entity Profile API

**Files:**
- Create: `src/lib/server/atlas/entityProfile.ts`
- Create: `src/routes/api/atlas/entities/[kind]/[slug]/+server.ts`
- Tests: `src/lib/server/atlas/entityProfile.spec.ts`, `src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts`

- [ ] **Step 1: Write failing profile read tests**

Seed an imported asset with an artist entity and link. Assert:

```ts
const profile = readAtlasEntityProfile(db, 'artist', 'exampleartist');
expect(profile).toMatchObject({
  kind: 'artist',
  slug: 'exampleartist',
  label: 'ExampleArtist',
  links: [expect.objectContaining({ host: 'deviantart.com', username: 'exampleartist' })],
  works: [expect.objectContaining({ title: 'Example Work' })]
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/entityProfile.spec.ts
```

Expected: FAIL because profile reader does not exist.

- [ ] **Step 3: Implement `readAtlasEntityProfile`**

Read:

- canonical entity
- profile row, if present
- aliases
- links
- works from `atlas_asset_entities` joined to `assets`

Reuse the same thumbnail URL mapping approach used in `src/lib/server/atlas/mutate.ts` or `src/lib/server/library/read.ts`.

- [ ] **Step 4: Add API route**

`GET /api/atlas/entities/artist/exampleartist` returns:

```ts
{ entity: AtlasEntityProfile }
```

Missing entity returns 404.

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/entityProfile.spec.ts 'src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/atlas/entityProfile.ts 'src/routes/api/atlas/entities/[kind]/[slug]/+server.ts' src/lib/server/atlas/entityProfile.spec.ts 'src/routes/api/atlas/entities/[kind]/[slug]/server.spec.ts'
git commit -m "feat: expose atlas artist entity profiles"
```

---

### Task 5: Artist Search Semantics

**Files:**
- Modify: `src/lib/server/atlas/search.ts`
- Modify: search response types if defined in `src/lib/atlas/search.ts`
- Modify: `src/lib/components/atlas/AtlasSearch.svelte`
- Tests: `src/lib/server/atlas/search.spec.ts`, `src/routes/api/atlas/search/server.spec.ts`

- [ ] **Step 1: Write failing search tests**

Add tests:

```ts
expect(searchAtlasAssets(db, 'artist:(exampleartist)').results.map((item) => item.id)).toEqual([
  importedAssetId
]);

expect(searchAtlasAssets(db, 'exampleartist').entityResults).toEqual([
  expect.objectContaining({
    kind: 'artist',
    slug: 'exampleartist',
    label: 'ExampleArtist',
    workCount: 1
  })
]);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/search.spec.ts src/routes/api/atlas/search/server.spec.ts
```

Expected: FAIL because `artist:(...)` is not parsed and entity result cards do not exist.

- [ ] **Step 3: Implement `artist:(...)` parsing and matching**

Extend query parsing to identify `artist:(value)` clauses. Match value against:

- artist entity slug
- artist entity label
- artist aliases
- artist link usernames

Filter assets to those with `atlas_asset_entities.status = 'approved'` and `atlas_entities.kind = 'artist'`.

- [ ] **Step 4: Add artist entity results for plain search**

When a plain query matches artist slug/label/alias/username, return entity result summaries with:

```ts
{
  kind: 'artist',
  slug,
  label,
  workCount,
  thumbnails,
  aliases,
  links
}
```

- [ ] **Step 5: Render artist result cards**

In `AtlasSearch.svelte`, show artist entity result cards above asset results. Primary click opens entity wiki mode; secondary button runs `artist:(slug)`.

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
npm run test:unit -- --run src/lib/server/atlas/search.spec.ts src/routes/api/atlas/search/server.spec.ts
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/atlas/search.ts src/lib/components/atlas/AtlasSearch.svelte src/lib/server/atlas/search.spec.ts src/routes/api/atlas/search/server.spec.ts
git commit -m "feat: add atlas artist search"
```

---

### Task 6: Artist Wiki Mode And Links

**Files:**
- Modify: `src/lib/state/app-state.svelte.ts`
- Modify: `src/lib/components/atlas/AtlasWiki.svelte`
- Modify: `src/lib/components/atlas/AtlasMetadataPanel.svelte`
- Modify: Library inspector components under `src/lib/components/inspector/`
- Tests: focused unit tests if state helpers exist, otherwise `npm run check`

- [ ] **Step 1: Add app state for entity wiki mode**

Add a navigation helper:

```ts
export function openAtlasEntity(kind: AtlasEntityKind, slug: string) {
  appState.currentView = 'atlas';
  appState.atlasMode = 'wiki';
  appState.atlasEntitySelection = { kind, slug };
}
```

If current state naming differs, fit this into the existing Atlas wiki selection pattern.

- [ ] **Step 2: Make artist rows open entity mode**

In `AtlasMetadataPanel.svelte`, when row tone/kind is artist/entity, use `openAtlasEntity('artist', row.slug)` instead of `openAtlasWiki(row.slug)`.

- [ ] **Step 3: Render entity wiki mode**

In `AtlasWiki.svelte`, when `atlasEntitySelection` exists:

- fetch `/api/atlas/entities/artist/:slug`
- render the artist fields
- render links/aliases
- render works grid
- provide "show works" action to run `artist:(slug)`

Use the existing wiki visual system, not a new surface.

- [ ] **Step 4: Link Library inspector artist text when entity exists**

After the asset record includes Atlas artist entity info, render the artist as a button/link that opens `openAtlasEntity('artist', slug)`.

- [ ] **Step 5: Run UI checks**

Run:

```bash
npm run check
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/state/app-state.svelte.ts src/lib/components/atlas/AtlasWiki.svelte src/lib/components/atlas/AtlasMetadataPanel.svelte src/lib/components/inspector
git commit -m "feat: link atlas artist entity pages"
```

---

### Task 7: Verification And Push

**Files:**
- All touched files

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test:unit -- --run
npm run check
npm run build
npm run build:extension
git diff --check
```

Expected:

- all unit tests pass
- Svelte check reports 0 errors and 0 warnings
- app and extension builds pass
- `git diff --check` has no output

- [ ] **Step 2: Push branch**

Run:

```bash
git status --short --branch
git push origin codex/atlas-search-v1
```

Expected: branch pushes cleanly and status is clean.

---

## Self-Review

Spec coverage:

- Unique artist wiki pages: Tasks 1, 4, and 6.
- Unique artist fields/search results: Tasks 1, 4, 5, and 6.
- Artist links from Atlas/Library: Task 6.
- Artist tag/search shows all works: Tasks 4 and 5.
- Username/profile links recorded on import: Tasks 2 and 3.
- Synonym handling for URLs/usernames: Task 2.
- AI enrichment boundary: documented as out of scope for this implementation slice.

No placeholders remain in the task steps. The plan intentionally leaves complex merge-review UI and automatic AI artist enrichment out of scope.
