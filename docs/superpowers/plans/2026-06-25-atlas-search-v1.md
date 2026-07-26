# Atlas Search V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a functional Atlas Search vertical slice with typed query parsing, local asset search, adaptive sidebar data, and a quiet Pastiche-native search UI.

**Architecture:** Implement the search spine before the UI. Shared client/server query types and parser live under `src/lib/atlas`, server-only resolution/ranking lives under `src/lib/server/atlas`, SvelteKit API routes expose parse/search responses, and `AtlasWorkspace` gains a search view that renders real parser/search output instead of mock state.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest, better-sqlite3, Phosphor Svelte, existing Pastiche design tokens.

---

## Source Documents

Read these before implementing:

```text
docs/superpowers/specs/2026-06-25-atlas-search-mechanics-design.md
docs/superpowers/specs/2026-06-25-atlas-search-ui-design.md
docs/superpowers/specs/2026-06-05-atlas-search-browser-design.md
docs/superpowers/specs/2026-06-05-atlas-ui-mode-design.md
docs/atlas/wiki/tagging-rules.md
docs/atlas/wiki/implication-rules.md
docs/atlas/wiki/ai-agent-tagging-rules.md
src/lib/server/atlas/schema.ts
src/lib/server/atlas/mutate.ts
src/lib/server/atlas/read.ts
src/lib/components/atlas/AtlasWorkspace.svelte
src/lib/components/atlas/AtlasWiki.svelte
src/lib/state/app-state.svelte.ts
```

## Scope

Included:

- Query parser for concepts, exclusions, classifier clauses, comma `OR`, plus `AND`, and role clauses.
- Concept resolution through slug, label, alias, and prefix.
- Search service that matches asset concepts, annotations, entities, claims, annotation classifiers, automatic implications, and visual roles.
- Result explanations and single-concept vs multi-clause context mode.
- Sidebar sections for single concept concept-map mode and multi-clause query-facet mode.
- API routes for parsing and search.
- Atlas Search UI shell with real API data, query input, compact pills, retractable sidebar, single-concept banner behavior, multi-clause explanation row, result cards, and role/page-size/sort controls.

Excluded:

- Prompt metadata search.
- Computed color search.
- Vector similarity.
- Saved searches.
- Parentheses and explicit Boolean grammar.
- Polished phone editing UI.
- Mass tagging and review overlays.

## File Structure

Create:

```text
src/lib/atlas/searchTypes.ts
src/lib/atlas/searchParser.ts
src/lib/atlas/searchParser.spec.ts
src/lib/server/atlas/search.ts
src/lib/server/atlas/search.spec.ts
src/routes/api/atlas/search/+server.ts
src/routes/api/atlas/search/parse/+server.ts
src/lib/components/atlas/AtlasSearch.svelte
```

Modify:

```text
src/lib/state/app-state.svelte.ts
src/lib/components/atlas/AtlasWorkspace.svelte
src/lib/components/atlas/AtlasHome.svelte
src/lib/server/atlas/mutate.ts
src/routes/api/atlas/wiki/server.spec.ts
```

Responsibilities:

- `searchTypes.ts`: Shared query AST, result, sidebar, and API response types.
- `searchParser.ts`: Client-safe parsing and canonicalization, no database access.
- `search.ts`: Server-side resolver, matcher, ranker, explanation builder, sidebar builder.
- API routes: Thin wrappers around parse/search services.
- `AtlasSearch.svelte`: Product UI for Atlas Search.
- `app-state.svelte.ts`: Add `atlasView: 'search'`, query state, and navigation helpers.
- `AtlasWorkspace.svelte`: Route to search view and keep Library snapshot available.
- `AtlasHome.svelte`: Add an entry point to Atlas Search.

---

### Task 1: Shared Search Types And Parser Tests

**Files:**

- Create: `src/lib/atlas/searchTypes.ts`
- Create: `src/lib/atlas/searchParser.ts`
- Create: `src/lib/atlas/searchParser.spec.ts`

- [ ] **Step 1: Write failing parser tests**

Create `src/lib/atlas/searchParser.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseAtlasSearchQuery } from './searchParser';

describe('parseAtlasSearchQuery', () => {
	it('parses multi-concept search as include concept clauses', () => {
		const parsed = parseAtlasSearchQuery('horse saddle');

		expect(parsed.canonical).toBe('horse saddle');
		expect(parsed.clauses).toEqual([
			{ kind: 'concept', raw: 'horse', slug: 'horse', mode: 'include' },
			{ kind: 'concept', raw: 'saddle', slug: 'saddle', mode: 'include' }
		]);
	});

	it('parses exclude: and dash shorthand as exclude clauses', () => {
		const parsed = parseAtlasSearchQuery('horse exclude:tree -spider');

		expect(parsed.clauses).toContainEqual({
			kind: 'concept',
			raw: 'exclude:tree',
			slug: 'tree',
			mode: 'exclude'
		});
		expect(parsed.clauses).toContainEqual({
			kind: 'concept',
			raw: '-spider',
			slug: 'spider',
			mode: 'exclude'
		});
	});

	it('parses classifier clauses with comma OR and plus AND values', () => {
		const any = parseAtlasSearchQuery('horse.coat_color:bay,gray');
		const all = parseAtlasSearchQuery('ball_python.morph:enchi+albino');

		expect(any.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'horse.coat_color:bay,gray',
				target: 'horse',
				classifier: 'coat_color',
				values: { op: 'any', values: ['bay', 'gray'] },
				mode: 'include'
			}
		]);
		expect(all.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'ball_python.morph:enchi+albino',
				target: 'ball_python',
				classifier: 'morph',
				values: { op: 'all', values: ['enchi', 'albino'] },
				mode: 'include'
			}
		]);
	});

	it('parses visual role clauses', () => {
		const parsed = parseAtlasSearchQuery(
			'horse role:focal exclude_role:background_detail,setting_context'
		);

		expect(parsed.clauses).toContainEqual({
			kind: 'role',
			raw: 'role:focal',
			include: ['focal_point']
		});
		expect(parsed.clauses).toContainEqual({
			kind: 'role',
			raw: 'exclude_role:background_detail,setting_context',
			exclude: ['background_detail', 'setting_context']
		});
	});
});
```

- [ ] **Step 2: Run parser tests to verify RED**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/searchParser.spec.ts
```

Expected: FAIL because `src/lib/atlas/searchParser.ts` does not exist.

- [ ] **Step 3: Add shared search types**

Create `src/lib/atlas/searchTypes.ts`:

```ts
import type { AtlasConceptSummary } from './types';

export type AtlasQueryClause =
	| { kind: 'concept'; raw: string; slug: string; mode: 'include' | 'exclude' }
	| {
			kind: 'classifier';
			raw: string;
			target: string;
			classifier: string;
			values: AtlasQueryValueExpr;
			mode: 'include' | 'exclude';
	  }
	| { kind: 'entity'; raw: string; entityKind?: string; slug: string; mode: 'include' | 'exclude' }
	| { kind: 'claim'; raw: string; claimKind: string; value: string; mode: 'include' | 'exclude' }
	| { kind: 'role'; raw: string; include?: string[]; exclude?: string[] }
	| { kind: 'evidence'; raw: string; include?: string[]; exclude?: string[] };

export type AtlasQueryValueExpr = { op: 'any'; values: string[] } | { op: 'all'; values: string[] };

export type AtlasParsedSearchQuery = {
	raw: string;
	canonical: string;
	clauses: AtlasQueryClause[];
	warnings: AtlasQueryMessage[];
	corrections: AtlasQueryCorrection[];
};

export type AtlasQueryMessage = {
	code: string;
	message: string;
	raw?: string;
};

export type AtlasQueryCorrection = {
	raw: string;
	replacement: string;
	reason: string;
};

export type AtlasSearchContext =
	| { mode: 'single_concept'; dominantConcept: AtlasConceptSummary }
	| { mode: 'multi_clause'; dominantConcept?: AtlasConceptSummary }
	| { mode: 'unresolved'; dominantConcept?: AtlasConceptSummary };

export type AtlasSidebarItemIntent = 'refine' | 'navigate' | 'specialize' | 'context' | 'ambiguous';

export type AtlasSidebarItem = {
	label: string;
	value: string;
	count: number | null;
	tone: string;
	intent: AtlasSidebarItemIntent;
	defaultAction: 'add' | 'navigate' | 'menu';
	query?: string;
	slug?: string;
};

export type AtlasSidebarSection = {
	title: string;
	kind: 'concept_map' | 'query_facet' | 'classifiers';
	items: AtlasSidebarItem[];
};

export type AtlasSearchResult = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	sourceUrl: string;
	subtitle: string;
	score: number;
	primaryExplanation: string;
	explanations: string[];
};

export type AtlasSearchResponse = {
	query: AtlasParsedSearchQuery;
	context: AtlasSearchContext;
	sidebar: AtlasSidebarSection[];
	results: AtlasSearchResult[];
	page: {
		limit: number;
		nextCursor: string | null;
		totalEstimate: number;
	};
};
```

- [ ] **Step 4: Implement minimal parser**

Create `src/lib/atlas/searchParser.ts`:

```ts
import { normalizeAtlasSlug } from './normalization';
import type { AtlasParsedSearchQuery, AtlasQueryClause, AtlasQueryValueExpr } from './searchTypes';

const ROLE_ALIASES: Record<string, string> = {
	focal: 'focal_point',
	main: 'focal_point',
	focal_point: 'focal_point',
	supporting: 'supporting_subject',
	supporting_subject: 'supporting_subject',
	background: 'background_detail',
	background_detail: 'background_detail',
	setting_context: 'setting_context'
};

export function parseAtlasSearchQuery(input: string): AtlasParsedSearchQuery {
	const raw = input.trim();
	const clauses = tokenize(raw)
		.map(parseToken)
		.filter((clause): clause is AtlasQueryClause => Boolean(clause));
	return {
		raw,
		canonical: clauses.map(canonicalClause).join(' '),
		clauses,
		warnings: [],
		corrections: []
	};
}

function tokenize(input: string) {
	return input.match(/"[^"]+"|\S+/g)?.map((token) => token.replace(/^"|"$/g, '')) ?? [];
}

function parseToken(token: string): AtlasQueryClause | null {
	if (!token.trim()) return null;
	if (token.startsWith('exclude_role:')) {
		return {
			kind: 'role',
			raw: token,
			exclude: parseValueList(token.slice('exclude_role:'.length)).values.map(normalizeRole)
		};
	}
	if (token.startsWith('role:') || token.startsWith('visual_role:')) {
		const value = token.includes(':') ? token.slice(token.indexOf(':') + 1) : '';
		return { kind: 'role', raw: token, include: parseValueList(value).values.map(normalizeRole) };
	}
	if (token.startsWith('exclude:')) {
		return conceptClause(token, token.slice('exclude:'.length), 'exclude');
	}
	if (token.startsWith('-') && token.length > 1) {
		return conceptClause(token, token.slice(1), 'exclude');
	}
	const classifier = token.match(/^([^:\s.]+)\.([^:\s]+):(.+)$/);
	if (classifier) {
		return {
			kind: 'classifier',
			raw: token,
			target: normalizeAtlasSlug(classifier[1]),
			classifier: normalizeAtlasSlug(classifier[2]),
			values: parseValueList(classifier[3]),
			mode: 'include'
		};
	}
	return conceptClause(token, token, 'include');
}

function conceptClause(raw: string, value: string, mode: 'include' | 'exclude'): AtlasQueryClause {
	return { kind: 'concept', raw, slug: normalizeAtlasSlug(value), mode };
}

function parseValueList(value: string): AtlasQueryValueExpr {
	const op = value.includes('+') ? 'all' : 'any';
	const separator = op === 'all' ? '+' : ',';
	return {
		op,
		values: value
			.split(separator)
			.map((item) => normalizeAtlasSlug(item))
			.filter(Boolean)
	};
}

function normalizeRole(value: string) {
	return ROLE_ALIASES[normalizeAtlasSlug(value)] ?? normalizeAtlasSlug(value);
}

function canonicalClause(clause: AtlasQueryClause) {
	if (clause.kind === 'concept')
		return clause.mode === 'exclude' ? `exclude:${clause.slug}` : clause.slug;
	if (clause.kind === 'classifier') {
		const separator = clause.values.op === 'all' ? '+' : ',';
		const prefix = clause.mode === 'exclude' ? 'exclude:' : '';
		return `${prefix}${clause.target}.${clause.classifier}:${clause.values.values.join(separator)}`;
	}
	if (clause.kind === 'role') {
		if (clause.include?.length) return `role:${clause.include.join(',')}`;
		return `exclude_role:${clause.exclude?.join(',') ?? ''}`;
	}
	if (clause.kind === 'entity')
		return clause.mode === 'exclude' ? `exclude:${clause.slug}` : clause.slug;
	if (clause.kind === 'claim') return `${clause.claimKind}:${clause.value}`;
	if (clause.kind === 'evidence') return `evidence:${clause.include?.join(',') ?? ''}`;
	return clause.raw;
}
```

- [ ] **Step 5: Run parser tests to verify GREEN**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/searchParser.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit parser foundation**

Run:

```sh
git add src/lib/atlas/searchTypes.ts src/lib/atlas/searchParser.ts src/lib/atlas/searchParser.spec.ts
git commit -m "feat: add Atlas search parser"
```

Expected: commit succeeds.

---

### Task 2: Server Search Service Tests And First Implementation

**Files:**

- Create: `src/lib/server/atlas/search.ts`
- Create: `src/lib/server/atlas/search.spec.ts`
- Modify: `src/lib/server/atlas/mutate.ts`

- [ ] **Step 1: Write failing search service tests**

Create `src/lib/server/atlas/search.spec.ts` with tests that create a temporary Library database, seed wiki concepts, insert assets, annotations, and classifiers, then call `searchAtlasAssets`.

Required test names:

```ts
it('requires classifier matches to land on the same annotation');
it('treats comma classifier values as OR and plus classifier values as AND');
it('excludes concepts through direct and automatic implication matches');
it('ranks focal annotation matches above background matches');
it(
	'uses single concept context for one resolved concept and multi clause context for combined searches'
);
```

The first test must prove this behavior:

```ts
const results = searchAtlasAssets(db, 'shirt.color:blue');
expect(results.results.map((result) => result.id)).toEqual(['blue-shirt']);
expect(results.results[0].primaryExplanation).toBe('Matched shirt.color:blue');
```

The fixture must include one asset with a blue shirt annotation and one asset with a red shirt plus blue background annotation. Only the blue shirt asset should match.

- [ ] **Step 2: Run search service tests to verify RED**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/search.spec.ts
```

Expected: FAIL because `src/lib/server/atlas/search.ts` does not exist.

- [ ] **Step 3: Implement `searchAtlasAssets`**

Create `src/lib/server/atlas/search.ts` with these exports:

```ts
import type Database from 'better-sqlite3';
import { parseAtlasSearchQuery } from '$lib/atlas/searchParser';
import type { AtlasSearchResponse } from '$lib/atlas/searchTypes';

export function searchAtlasAssets(
	db: Database.Database,
	query: string,
	options: { limit?: number } = {}
): AtlasSearchResponse {
	const parsed = parseAtlasSearchQuery(query);
	const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
	applyAtlasWikiSeed(db);
	const resolved = resolveSearchClauses(db, parsed.clauses);
	const candidates = readSearchCandidates(db);
	const matched = candidates
		.map((candidate) => scoreCandidate(candidate, resolved))
		.filter((candidate) => candidate.matched)
		.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
		.slice(0, limit);
	return buildSearchResponse(parsed, resolved, matched, limit);
}
```

Use focused helper functions in the same file for v1:

```ts
export function parseAtlasSearchForApi(query: string) {
	return parseAtlasSearchQuery(query);
}

function roleWeight(role: string | null) {
	switch (role) {
		case 'focal_point':
			return 100;
		case 'supporting_subject':
			return 65;
		case 'background_detail':
			return 15;
		case 'setting_context':
			return 10;
		default:
			return 35;
	}
}
```

Keep the implementation intentionally local and deterministic. Do not add FTS, vector search, or prompt metadata in this task.

- [ ] **Step 4: Run search service tests to verify GREEN**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/search.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit search service**

Run:

```sh
git add src/lib/server/atlas/search.ts src/lib/server/atlas/search.spec.ts
git commit -m "feat: add Atlas asset search service"
```

Expected: commit succeeds.

---

### Task 3: Search API Routes

**Files:**

- Create: `src/routes/api/atlas/search/+server.ts`
- Create: `src/routes/api/atlas/search/parse/+server.ts`
- Modify: `src/routes/api/atlas/wiki/server.spec.ts`

- [ ] **Step 1: Add route tests**

Extend `src/routes/api/atlas/wiki/server.spec.ts` or create a focused search route spec if the file becomes too large.

Required assertions:

```ts
const parseResponse = await parseGET({
	url: new URL('http://localhost/api/atlas/search/parse?q=horse%20exclude:tree')
});
expect(parseBody.query.clauses).toContainEqual({
	kind: 'concept',
	raw: 'exclude:tree',
	slug: 'tree',
	mode: 'exclude'
});

const searchResponse = await searchGET({
	url: new URL('http://localhost/api/atlas/search?q=horse&limit=10')
});
expect(searchBody.query.canonical).toBe('horse');
expect(searchBody.results).toBeInstanceOf(Array);
```

- [ ] **Step 2: Run route tests to verify RED**

Run:

```sh
npm run test:unit -- --run src/routes/api/atlas/wiki/server.spec.ts
```

Expected: FAIL because the search route modules do not exist.

- [ ] **Step 3: Implement parse route**

Create `src/routes/api/atlas/search/parse/+server.ts`:

```ts
import { json, type RequestHandler } from '@sveltejs/kit';
import { parseAtlasSearchForApi } from '$lib/server/atlas/search';

export const GET: RequestHandler = ({ url }) => {
	const query = url.searchParams.get('q') ?? '';
	return json({ query: parseAtlasSearchForApi(query) });
};
```

- [ ] **Step 4: Implement search route**

Create `src/routes/api/atlas/search/+server.ts`:

```ts
import { json, type RequestHandler } from '@sveltejs/kit';
import { searchAtlasAssets } from '$lib/server/atlas/search';
import { openLibraryDatabase } from '$lib/server/library/schema';

export const GET: RequestHandler = ({ url }) => {
	const query = url.searchParams.get('q') ?? '';
	const limit = Number(url.searchParams.get('limit') ?? 50);
	const db = openLibraryDatabase();
	try {
		return json(searchAtlasAssets(db, query, { limit }));
	} finally {
		db.close();
	}
};
```

- [ ] **Step 5: Run route tests to verify GREEN**

Run:

```sh
npm run test:unit -- --run src/routes/api/atlas/wiki/server.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit API routes**

Run:

```sh
git add src/routes/api/atlas/search src/routes/api/atlas/wiki/server.spec.ts
git commit -m "feat: expose Atlas search API"
```

Expected: commit succeeds.

---

### Task 4: Atlas Search App State And Workspace Route

**Files:**

- Modify: `src/lib/state/app-state.svelte.ts`
- Modify: `src/lib/components/atlas/AtlasWorkspace.svelte`
- Modify: `src/lib/components/atlas/AtlasHome.svelte`

- [ ] **Step 1: Add app state changes**

Modify `src/lib/state/app-state.svelte.ts`:

```ts
export type AtlasView = 'home' | 'asset' | 'wiki' | 'review' | 'search';
```

Add state:

```ts
atlasSearchQuery: 'horse',
```

Add helpers:

```ts
export function openAtlasSearch(query = appState.atlasSearchQuery) {
	appState.mode = 'atlas';
	appState.atlasView = 'search';
	appState.activeAtlasAssetId = null;
	appState.atlasSearchQuery = query;
	appState.mobileState = 'browse';
}

export function setAtlasSearchQuery(query: string) {
	appState.atlasSearchQuery = query;
}
```

- [ ] **Step 2: Add Search workspace route**

Modify `src/lib/components/atlas/AtlasWorkspace.svelte`:

```svelte
import AtlasSearch from './AtlasSearch.svelte';
```

Render it before asset fallback:

```svelte
{:else if appState.atlasView === 'search'}
	<AtlasSearch />
```

- [ ] **Step 3: Add Atlas Home entry point**

Modify `src/lib/components/atlas/AtlasHome.svelte` to import `openAtlasSearch` and add a compact button in the header:

```svelte
<button type="button" class="search-open" onclick={() => openAtlasSearch()}> Search Atlas </button>
```

Use existing button styling patterns from Atlas Inspect and Atlas Wiki. Keep it quiet and token-based.

- [ ] **Step 4: Run Svelte check**

Run:

```sh
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit navigation**

Run:

```sh
git add src/lib/state/app-state.svelte.ts src/lib/components/atlas/AtlasWorkspace.svelte src/lib/components/atlas/AtlasHome.svelte
git commit -m "feat: add Atlas search navigation"
```

Expected: commit succeeds.

---

### Task 5: Atlas Search UI Shell

**Files:**

- Create: `src/lib/components/atlas/AtlasSearch.svelte`

- [ ] **Step 1: Create component with real API loading**

Create `src/lib/components/atlas/AtlasSearch.svelte` with:

- search input bound to a local draft query
- submit button or Enter handler that updates `appState.atlasSearchQuery`
- fetch to `/api/atlas/search?q=...&limit=...`
- loading, error, empty, and results states
- sidebar open/collapsed state
- banner open/collapsed state
- role control
- page-size control
- sort display

Required script shape:

```svelte
<script lang="ts">
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { AtlasSearchResponse } from '$lib/atlas/searchTypes';
	import { appState, openAtlasAsset, setAtlasSearchQuery } from '$lib/state/app-state.svelte';

	let draftQuery = $state(appState.atlasSearchQuery);
	let response = $state<AtlasSearchResponse | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let sidebarOpen = $state(true);
	let bannerOpen = $state(true);
	let limit = $state(50);
	let roleMode = $state<'any' | 'main' | 'exclude_background'>('any');

	$effect(() => {
		draftQuery = appState.atlasSearchQuery;
		void loadSearch();
	});

	async function loadSearch() {
		loading = true;
		error = null;
		try {
			const url = `/api/atlas/search?q=${encodeURIComponent(appState.atlasSearchQuery)}&limit=${limit}`;
			const searchResponse = await fetch(url);
			const body = (await searchResponse.json()) as AtlasSearchResponse | { error?: string };
			if (!searchResponse.ok || !('results' in body)) {
				throw new Error(
					'error' in body && body.error ? body.error : 'Atlas search could not be loaded.'
				);
			}
			response = body;
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Atlas search could not be loaded.';
		} finally {
			loading = false;
		}
	}

	function submitSearch() {
		setAtlasSearchQuery(draftQuery.trim() || 'horse');
	}
</script>
```

- [ ] **Step 2: Render query-aware header**

The header must include:

- search input
- clear query button
- syntax help popover or compact help panel
- role segmented control with `Any`, `Main subject`, and `Exclude background`
- result count

For multi-clause context, show compact explanation row. For single-concept context, show the wiki/context banner if `bannerOpen`.

- [ ] **Step 3: Render retractable sidebar**

The sidebar must render `response.sidebar`.

Each sidebar item should show:

- label
- count if available
- tone class
- default action

For v1, clicking an item with `query` should set that query. If default action is `menu`, show the same action menu with Search, Add, Exclude, Open wiki controls.

- [ ] **Step 4: Render result cards**

Each card must show:

- thumbnail or unavailable state
- title
- subtitle
- primary explanation

Clicking a card opens Atlas Inspect through `openAtlasAsset(result.id)`.

Do not show dense tag piles, tagged/untagged status, or tag counts.

- [ ] **Step 5: Style with Pastiche tokens**

Use:

- dark restrained surfaces
- current borders and radii
- `var(--font-heading)` only for concept titles or artwork titles
- `var(--font-ui)` for controls and metadata
- Phosphor icons
- no mockup rail
- no heavy gold usage
- no nested card stacks

- [ ] **Step 6: Run check**

Run:

```sh
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit UI shell**

Run:

```sh
git add src/lib/components/atlas/AtlasSearch.svelte
git commit -m "feat: add Atlas search UI shell"
```

Expected: commit succeeds.

---

### Task 6: Verification And Visual QA

**Files:**

- Modify: the smallest set of files identified by the failed verification command or browser visual check.

- [ ] **Step 1: Run focused unit tests**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/searchParser.spec.ts src/lib/server/atlas/search.spec.ts src/routes/api/atlas/wiki/server.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full project checks**

Run:

```sh
npm run check
git diff --check
```

Expected: both PASS.

- [ ] **Step 3: Start dev server**

Run:

```sh
npm run dev -- --host 127.0.0.1
```

Expected: Vite dev server starts and prints a local URL.

- [ ] **Step 4: Browser visual check**

Open the local app in the in-app browser.

Verify:

- Atlas home has a Search Atlas entry point.
- Atlas Search loads without console errors.
- `horse` shows single-concept context with banner.
- `horse saddle` hides the large banner and shows compact query explanation.
- `shirt.color:blue` renders as a classifier query without visual breakage.
- `exclude:tree` appears as an exclusion pill or clause.
- Sidebar can collapse and restore.
- Result cards show image, title, subtitle, and one explanation.
- No result card shows dense tag piles by default.
- Layout remains calm against Atlas Wiki and Atlas Inspect.

- [ ] **Step 5: Run impeccable check**

Run:

```sh
npx impeccable --json src/lib/components/atlas/AtlasSearch.svelte
```

Expected: no severe findings. Any warning must be reviewed and either fixed or documented as a false positive caused by existing Pastiche design tokens.

- [ ] **Step 6: Commit verification fixes**

If fixes were needed, run:

```sh
git add src/lib/components/atlas/AtlasSearch.svelte src/lib/atlas src/lib/server/atlas src/routes/api/atlas src/lib/state/app-state.svelte.ts src/lib/components/atlas/AtlasWorkspace.svelte src/lib/components/atlas/AtlasHome.svelte
git commit -m "fix: polish Atlas search vertical slice"
```

Expected: commit succeeds when fixes exist. Skip this commit if no fixes were needed.
