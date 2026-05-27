# Wikidata Search Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wikidata subject search feel like the primary Explore search mode: one clear search input, image-first results, bounded loading times, and effective caching.

**Architecture:** Replace the separate subject input with a mode-aware top search box that performs Wikidata entity autocomplete when Explore is in `wikidata` mode. Split Wikidata search into candidate lookup, metadata enrichment, and Commons image resolution so broad subjects do not run one heavy SPARQL query. Add server/client timing, timeout, and cache behavior so slow upstream calls fail gracefully and repeated searches are fast.

**Tech Stack:** Svelte 5, SvelteKit server routes, Vitest, Playwright, Wikidata Search API, Wikidata Query Service SPARQL, Commons MediaWiki API, existing `ServerCache` and IndexedDB client cache.

---

## Root Cause Notes

Observed on May 25, 2026:

- The UI has two simultaneous search surfaces in Wikidata mode: the global shell search and the inline "Search depicted subjects" field. This makes it unclear which field controls results.
- `dragon` autocomplete currently returns `Dragon (Q37493975) - family name` before `dragon (Q7559) - legendary winged, fire-breathing reptile`. Picking the wrong entity returns no visual results and looks like the search is broken.
- Local API checks against the running app showed cached `dragon` pages returning quickly, but `woman` page 2 took about 17.3 seconds. That means broad subjects remain too slow even after the first query simplification.
- The current connector still performs search as one SPARQL query that fetches item, labels, dates, collection, creator, and image together. For broad concepts, label/metadata work should happen after a smaller candidate set is known.
- The connector shares one scheduler for WDQS and Commons. A slow SPARQL call can block Commons image resolution behind it.
- There is no explicit upstream timeout. A long WDQS call can leave the UI in skeleton state for too long.
- `hand (Q33767)` exposed a separate client-render failure: Wikidata can return the same item more than once when an artwork has multiple matching image rows. Svelte's keyed grid then throws `each_key_duplicate`, leaving the visible UI stuck with result text and skeleton cards. The immediate fix is to deduplicate normalized `ExploreItem.id` values before returning any connector page; the deeper search redesign below should still preserve that invariant.
- Some Commons rows can fall back to full original `upload.wikimedia.org` URLs when no thumbnail URL is resolved. Chromium can block at least some of these via ORB. Commons thumbnail resolution should be treated as mandatory for grid cards where possible, with original URLs reserved for source/detail actions.

## File Structure

- Modify `src/lib/explore/types.ts`
  - Add a Wikidata search-mode state type if needed.
  - Keep `ExploreSubject` as the entity chip model.

- Modify `src/lib/state/app-state.svelte.ts`
  - Store selected Wikidata subjects centrally so the top search bar can own subject entry.

- Modify `src/lib/components/shell/SearchBox.svelte`
  - Make the existing top search input mode-aware.
  - In Wikidata mode, query `/explore/api/wikidata/entities` and show entity suggestions.
  - Selecting an entity adds a subject chip and clears the draft text.

- Modify `src/lib/components/explore/ExploreWorkspace.svelte`
  - Remove the inline subject input.
  - Keep a compact chip row below source pills, or inside the search bar if the component shape allows it cleanly.
  - Keep museum source pills separate and clickable.

- Modify `src/lib/explore/connectors/wikidata.ts`
  - Split search into candidate SPARQL, metadata SPARQL, and Commons imageinfo.
  - Use separate schedulers for WDQS and Commons.
  - Add timeout handling.
  - Cache candidate pages, metadata records by QID, and Commons imageinfo by filename.

- Modify `src/lib/explore/wikidata-entities.ts`
  - Rank entity suggestions for visual subjects.
  - Penalize names, works, organizations, games, records, and other non-depictable entities where descriptions make that obvious.

- Modify `src/routes/explore/api/search/+server.ts`
  - Preserve existing validation.
  - Return clearer timeout errors from connector exceptions.

- Test `src/lib/explore/connectors/wikidata.spec.ts`
  - Candidate query construction.
  - Metadata enrichment.
  - Commons image batch resolution.
  - Timeout behavior.
  - Cache key behavior.

- Test `src/lib/explore/wikidata-entities.spec.ts`
  - Ranking puts `dragon (Q7559)` ahead of family-name/video-game/etc suggestions.

- Test `src/lib/components/shell/SearchBox` via e2e in `tests/pastiche.e2e.ts`
  - Wikidata mode uses the top search bar for entity selection.
  - No inline competing search field exists in Wikidata mode.

---

### Task 1: Centralize Wikidata Subject State

**Files:**

- Modify: `src/lib/state/app-state.svelte.ts`
- Modify: `src/lib/explore/types.ts`
- Test: existing typecheck plus e2e after UI tasks

- [ ] **Step 1: Add state fields**

In `src/lib/state/app-state.svelte.ts`, add:

```ts
wikidataSubjects: [] as ExploreSubject[],
wikidataEntitySuggestions: [] as ExploreSubject[],
wikidataEntityLoading: false,
wikidataEntityError: null as string | null,
```

Import `ExploreSubject` next to `ExploreQuery`.

- [ ] **Step 2: Add state helpers**

Add:

```ts
export function addWikidataSubject(subject: ExploreSubject) {
	if (appState.wikidataSubjects.some((selected) => selected.id === subject.id)) return;
	appState.wikidataSubjects = [...appState.wikidataSubjects, subject];
	appState.query = '';
	appState.exploreCommittedQuery = '';
}

export function removeWikidataSubject(id: string) {
	appState.wikidataSubjects = appState.wikidataSubjects.filter((subject) => subject.id !== id);
}

export function clearWikidataSubjects() {
	appState.wikidataSubjects = [];
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
}

export function setWikidataEntitySuggestions(suggestions: ExploreSubject[]) {
	appState.wikidataEntitySuggestions = suggestions;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`

Expected: PASS after later UI references are adjusted. If this fails immediately because helpers are unused, continue to Task 2 before final verification.

---

### Task 2: Use The Top Search Bar For Wikidata Entities

**Files:**

- Modify: `src/lib/components/shell/SearchBox.svelte`
- Modify: `src/lib/components/explore/ExploreWorkspace.svelte`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Write failing e2e expectations**

In `tests/pastiche.e2e.ts`, extend the desktop Explore test after switching to Wikidata:

```ts
await page.getByRole('button', { name: 'Find by Subject' }).click();
await expect(page.getByLabel('Search depicted subjects')).toHaveCount(0);
await page.route('**/explore/api/wikidata/entities?search=dragon', async (route) => {
	await route.fulfill({
		contentType: 'application/json',
		body: JSON.stringify({
			entities: [
				{ id: 'Q7559', label: 'dragon', description: 'legendary winged, fire-breathing reptile' }
			]
		})
	});
});
await page.getByPlaceholder('Search artwork, artists, or collections...').fill('dragon');
await expect(page.getByRole('option', { name: /dragon.*legendary winged/ })).toBeVisible();
```

Run: `npx playwright test tests/pastiche.e2e.ts --grep "desktop library"`

Expected: FAIL because the inline Wikidata input still exists and the top search bar does not query Wikidata entities.

- [ ] **Step 2: Make `SearchBox.svelte` mode-aware**

In `SearchBox.svelte`, when `mode === 'explore'` and `appState.exploreSourceLabel === 'Find by Subject'`, debounce `appState.query` and fetch:

```ts
fetch(`/explore/api/wikidata/entities?search=${encodeURIComponent(query)}`);
```

Render returned entities in the existing suggestion popover. Selecting one should call `addWikidataSubject(subject)` instead of `selectExploreSuggestion(suggestion)`.

- [ ] **Step 3: Remove inline subject input**

In `ExploreWorkspace.svelte`, remove the `<input aria-label="Search depicted subjects">` block. Keep a chip row:

```svelte
{#if activeSource === 'wikidata' && appState.wikidataSubjects.length > 0}
	<div class="subject-chip-row" aria-label="Selected depicted subjects">
		{#each appState.wikidataSubjects as subject (subject.id)}
			<button
				type="button"
				aria-label={`Remove ${subject.label}`}
				onclick={() => removeWikidataSubject(subject.id)}
			>
				<span>{subject.label}</span>
				<small>{subject.id}</small>
			</button>
		{/each}
	</div>
{/if}
```

- [ ] **Step 4: Build Wikidata query from centralized subjects**

In `ExploreWorkspace.svelte`, change the Wikidata branch of `buildQuery()` to use:

```ts
depicts: appState.wikidataSubjects,
```

- [ ] **Step 5: Verify UI tests**

Run: `npx playwright test tests/pastiche.e2e.ts`

Expected: PASS.

---

### Task 3: Rank Wikidata Entity Suggestions For Visual Subject Search

**Files:**

- Modify: `src/lib/explore/wikidata-entities.ts`
- Create or modify: `src/lib/explore/wikidata-entities.spec.ts`

- [ ] **Step 1: Write failing ranking test**

Create `src/lib/explore/wikidata-entities.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { searchWikidataEntities } from './wikidata-entities';

describe('Wikidata entity search ranking', () => {
	it('prefers visual concepts over names and media titles', async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				search: [
					{ id: 'Q37493975', label: 'Dragon', description: 'family name' },
					{ id: 'Q7559', label: 'dragon', description: 'legendary winged, fire-breathing reptile' },
					{ id: 'Q114832799', label: 'Dragon', description: 'Snake clone video game' }
				]
			})
		);

		const entities = await searchWikidataEntities('dragon', { fetch: fetchMock, limit: 8 });

		expect(entities[0]).toMatchObject({ id: 'Q7559', label: 'dragon' });
	});
});
```

Run: `npm run test:unit -- --run src/lib/explore/wikidata-entities.spec.ts`

Expected: FAIL because API order is currently preserved.

- [ ] **Step 2: Implement ranking**

In `wikidata-entities.ts`, score suggestions:

```ts
function visualSubjectScore(entity: ExploreSubject, search: string): number {
	const label = entity.label.toLowerCase();
	const description = (entity.description ?? '').toLowerCase();
	let score = 0;
	if (label === search.toLowerCase()) score += 20;
	if (
		description.match(/animal|plant|object|person|concept|myth|legendary|body|part|building|place/)
	)
		score += 10;
	if (
		description.match(
			/family name|surname|given name|film|video game|album|song|record label|company|organization|character in/
		)
	)
		score -= 30;
	return score;
}
```

Sort normalized entities by descending score while preserving API order for ties.

- [ ] **Step 3: Verify ranking**

Run: `npm run test:unit -- --run src/lib/explore/wikidata-entities.spec.ts`

Expected: PASS.

---

### Task 4: Split Wikidata Search Into Candidate And Enrichment Calls

**Files:**

- Modify: `src/lib/explore/connectors/wikidata.ts`
- Modify: `src/lib/explore/connectors/wikidata.spec.ts`

- [ ] **Step 1: Write failing candidate-query test**

In `wikidata.spec.ts`, add:

```ts
import { buildWikidataCandidateQuery, buildWikidataMetadataQuery } from './wikidata';

it('builds a lean candidate query without labels or optional metadata', () => {
	const query = buildWikidataCandidateQuery({
		depicts: [{ id: 'Q7559', label: 'dragon', description: null }],
		hasImageOnly: true,
		limit: 40
	});

	expect(query).toContain('?item wdt:P180 wd:Q7559.');
	expect(query).toContain('?item wdt:P18 ?image.');
	expect(query).not.toContain('SERVICE wikibase:label');
	expect(query).not.toContain('OPTIONAL { ?item wdt:P170');
});

it('builds metadata query from known QIDs only', () => {
	const query = buildWikidataMetadataQuery(['Q1', 'Q2']);

	expect(query).toContain('VALUES ?item { wd:Q1 wd:Q2 }');
	expect(query).toContain('SERVICE wikibase:label');
});
```

Run: `npm run test:unit -- --run src/lib/explore/connectors/wikidata.spec.ts`

Expected: FAIL because these helpers do not exist.

- [ ] **Step 2: Implement candidate query**

In `wikidata.ts`, export:

```ts
export function buildWikidataCandidateQuery(query: ExploreQuery): string {
	const limit = clampLimit(query.limit || DEFAULT_LIMIT);
	const offset = parseCursor(query.cursor);
	const depictsTriples = (query.depicts ?? [])
		.map((subject) => subject.id)
		.filter(isQid)
		.map((qid) => `  ?item wdt:P180 wd:${qid}.`)
		.join('\n');

	return `
SELECT DISTINCT ?item ?image
WHERE {
  ?item wdt:P31 wd:Q3305213.
${depictsTriples}
  ?item wdt:P18 ?image.
}
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}
```

- [ ] **Step 3: Implement metadata query**

Export:

```ts
export function buildWikidataMetadataQuery(qids: string[]): string {
	const values = qids
		.filter(isQid)
		.map((qid) => `wd:${qid}`)
		.join(' ');
	return `
SELECT DISTINCT ?item ?itemLabel ?creatorLabel ?inception ?collectionLabel
WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P170 ?creator. }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P195 ?collection. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`.trim();
}
```

- [ ] **Step 4: Change `search()` orchestration**

Replace current single `buildWikidataDepictsQuery()` call with:

1. Candidate SPARQL returns `{ qid, imageUrl }`.
2. Metadata SPARQL enriches only those QIDs.
3. Commons imageinfo resolves thumbnail URLs.
4. Merge by QID.

Keep the old `buildWikidataDepictsQuery()` only if tests or future metadata-only behavior still need it; otherwise remove it and update tests.

- [ ] **Step 5: Verify connector**

Run: `npm run test:unit -- --run src/lib/explore/connectors/wikidata.spec.ts`

Expected: PASS.

---

### Task 5: Add Separate WDQS And Commons Schedulers With Timeouts

**Files:**

- Modify: `src/lib/explore/connectors/wikidata.ts`
- Modify: `src/lib/explore/connectors/wikidata.spec.ts`

- [ ] **Step 1: Write timeout test**

In `wikidata.spec.ts`, add:

```ts
it('fails Wikidata searches with a clear timeout instead of hanging indefinitely', async () => {
	const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
	const connector = createWikidataConnector({
		fetch: fetchMock as typeof fetch,
		requestsPerSecond: 1000,
		timeoutMs: 10
	});

	await expect(
		connector.search({
			depicts: [{ id: 'Q7559', label: 'dragon', description: null }],
			limit: 40
		})
	).rejects.toThrow('Wikidata search timed out');
});
```

Expected: FAIL because `timeoutMs` does not exist.

- [ ] **Step 2: Add connector option**

Update `WikidataConnectorOptions`:

```ts
timeoutMs?: number;
```

Use `const timeoutMs = options.timeoutMs ?? 12_000;`.

- [ ] **Step 3: Add timeout fetch helper**

Add:

```ts
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetcher(input, { ...init, signal: controller.signal });
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error('Wikidata search timed out. Try narrowing the subject or retrying.');
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}
```

- [ ] **Step 4: Split schedulers**

Use:

```ts
const wikidataScheduler = new MetRequestScheduler({ concurrency: 1, requestsPerSecond: 1 });
const commonsScheduler = new MetRequestScheduler({ concurrency: 3, requestsPerSecond: 4 });
```

Route `sparqlJson()` through `wikidataScheduler`; route `commonsJson()` through `commonsScheduler`.

- [ ] **Step 5: Verify timeout tests**

Run: `npm run test:unit -- --run src/lib/explore/connectors/wikidata.spec.ts`

Expected: PASS.

---

### Task 6: Cache Candidate Pages, Metadata, And Commons Separately

**Files:**

- Modify: `src/lib/explore/connectors/wikidata.ts`
- Modify: `src/lib/explore/connectors/wikidata.spec.ts`

- [ ] **Step 1: Write cache behavior test**

Add a test where two searches return overlapping QIDs and assert the metadata query is not repeated for cached QIDs:

```ts
it('caches Wikidata metadata by QID across search pages', async () => {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const body = String(init?.body ?? '');
		if (body.includes('SELECT+DISTINCT+%3Fitem+%3Fimage')) {
			return Response.json({ results: { bindings: [candidateBinding('Q1', 'One.jpg')] } });
		}
		if (body.includes('VALUES+%3Fitem')) {
			return Response.json({ results: { bindings: [metadataBinding('Q1', 'One')] } });
		}
		return Response.json({ query: { pages: {} } });
	});
	const cache = new ServerCache(2000);
	const connector = createWikidataConnector({ fetch: fetchMock, cache, requestsPerSecond: 1000 });

	await connector.search({
		depicts: [{ id: 'Q7559', label: 'dragon', description: null }],
		limit: 40
	});
	await connector.search({
		depicts: [{ id: 'Q7559', label: 'dragon', description: null }],
		limit: 40
	});

	const metadataCalls = fetchMock.mock.calls.filter(([, init]) =>
		String(init?.body ?? '').includes('VALUES+%3Fitem')
	);
	expect(metadataCalls).toHaveLength(1);
});
```

Define `candidateBinding()` and `metadataBinding()` helpers in the test file.

- [ ] **Step 2: Implement cache keys**

Use:

```ts
wikidata:candidates:${hashString(candidateSparql)}
wikidata:metadata:${qid}
commons:imageinfo:${filename}
```

Batch only uncached metadata and filenames. Merge cached and freshly fetched records.

- [ ] **Step 3: Verify cache tests**

Run: `npm run test:unit -- --run src/lib/explore/connectors/wikidata.spec.ts`

Expected: PASS.

---

### Task 7: Improve Client Loading And Stale Search Behavior

**Files:**

- Modify: `src/lib/components/explore/ExploreWorkspace.svelte`
- Modify: `src/lib/explore/client-cache.ts`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Do not keep skeletons forever**

In `ExploreWorkspace.svelte`, add a user-facing slow state after 8 seconds:

```ts
let slowSearch = $state(false);
```

In `loadSearch()`, set a timeout that flips `slowSearch = true`; clear it in `finally`.

Render:

```svelte
{#if loading && slowSearch}
	<section class="message" role="status">
		<h2>Wikidata is taking a while</h2>
		<p>Broad subjects can be slow. Try a more specific subject, or wait a little longer.</p>
	</section>
{/if}
```

- [ ] **Step 2: Add a retry button for timeout errors**

If `error` includes `timed out`, render a retry button that calls `loadSearch(queryKey)`.

- [ ] **Step 3: Prefer stale cached results while refreshing**

The existing cache already supports stale-while-revalidate. Confirm Wikidata search keys are stable after moving subjects into `appState.wikidataSubjects`; add a unit test for `exploreSearchKey()` if needed.

- [ ] **Step 4: Verify e2e**

Run: `npx playwright test tests/pastiche.e2e.ts`

Expected: PASS.

---

### Task 8: Add A Local Performance Harness

**Files:**

- Create: `scripts/check-wikidata-search.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add script**

Create `scripts/check-wikidata-search.mjs`:

```js
const cases = [
	{ id: 'Q7559', label: 'dragon' },
	{ id: 'Q467', label: 'woman' },
	{ id: 'Q33767', label: 'hand' }
];

for (const subject of cases) {
	const started = Date.now();
	const response = await fetch('http://localhost:52144/explore/api/search', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			source: 'wikidata',
			query: {
				depicts: [{ ...subject, description: null }],
				workType: 'painting',
				hasImageOnly: true,
				limit: 40
			}
		})
	});
	const data = await response.json();
	console.log({
		subject: subject.label,
		status: response.status,
		ms: Date.now() - started,
		count: data.items?.length ?? 0,
		withoutImages: data.items?.filter((item) => !item.imageUrl).length ?? 0,
		nextCursor: data.nextCursor ?? null,
		error: data.error
	});
}
```

- [ ] **Step 2: Add package script**

In `package.json`:

```json
"check:wikidata-search": "node scripts/check-wikidata-search.mjs"
```

- [ ] **Step 3: Run harness**

With the dev server running, run:

```bash
npm run check:wikidata-search
```

Expected:

- `dragon` returns image-backed results.
- `woman` returns image-backed results or a timeout error under 12 seconds.
- No case has `withoutImages > 0`.

---

## Final Verification

Run:

```bash
npm run check
npm run test:unit -- --run
npm run build
npx playwright test
```

With the existing local dev server at `http://localhost:52144/`, also run:

```bash
npm run check:wikidata-search
```

Acceptance criteria:

- Wikidata mode has one search input path, not two.
- The top search bar resolves Wikidata entities in Wikidata mode.
- `dragon` ranks the legendary creature ahead of family-name/media-title suggestions.
- Subject searches default to image-backed paintings.
- Broad searches either show results quickly from cache/stale cache or produce a clear timeout/error state within about 12 seconds.
- Repeating the same subject search uses cache and returns much faster than the first upstream request.
- Pagination still works and does not rely on metadata-only records.
