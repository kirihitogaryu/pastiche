# Atlas Wiki Tagging Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first read-only Atlas wiki/tagging foundation using the Apollo Killing the Python seed case.

**Architecture:** Add canonical Atlas vocabulary/wiki tables beside the existing ingestion tables, seed the initial wiki governance pages and Apollo/Python vocabulary as structured data, and extend the Atlas asset summary so inspect can display approved visual concepts and nested classifiers. Keep editing out of scope for this slice; the point is proving the model and read path before authoring UI.

**Tech Stack:** SvelteKit, TypeScript, better-sqlite3, Vitest, Playwright, Markdown source docs under `docs/atlas/wiki`.

---

## File Structure

- Modify `src/lib/atlas/types.ts`: add canonical concept, wiki entry, assignment, annotation, and classifier read-model types.
- Modify `src/lib/server/atlas/schema.ts`: add SQLite tables for concepts, wiki entries, asset concept assignments, annotations, annotation concepts, and annotation classifiers.
- Create `src/lib/server/atlas/wikiSeed.ts`: structured seed data for governance docs and Apollo/Python concepts.
- Create `src/lib/server/atlas/wikiSeed.spec.ts`: tests for seed integrity, slug uniqueness, maturity, and concept cap.
- Create `src/lib/server/atlas/wiki.ts`: seed/apply/read helpers for wiki entries and canonical concepts.
- Create `src/lib/server/atlas/wiki.spec.ts`: tests for idempotent seed application and read APIs.
- Modify `src/lib/server/atlas/read.ts`: include approved concepts, annotations, classifier assignments, and wiki snippets in `AtlasAssetSummary`.
- Modify `src/lib/server/atlas/read.spec.ts`: verify Apollo-style classifier projection through both named entity and broad visual tag.
- Modify `src/routes/api/library/assets/[id]/atlas/+server.ts`: include the expanded summary in the API response and mock fallback.
- Create `src/routes/api/atlas/wiki/+server.ts`: list wiki entries and groups.
- Create `src/routes/api/atlas/wiki/[slug]/+server.ts`: read one wiki entry.
- Create `src/routes/api/atlas/wiki/server.spec.ts`: API tests for list/detail behavior.
- Modify `src/lib/components/atlas/AtlasMetadataPanel.svelte`: render concepts and annotation classifiers as nested rows.
- Create `src/lib/components/atlas/AtlasWiki.svelte`: first two-column wiki read view.
- Modify `src/lib/components/atlas/AtlasWorkspace.svelte`: route `appState.atlasView === 'wiki'` to `AtlasWiki`.
- Modify `src/lib/state/app-state.svelte.ts`: add `openAtlasWiki` and selected wiki slug state if not already present.
- Modify `tests/pastiche.e2e.ts`: add smoke coverage for Atlas wiki and nested classifier display.

## Task 1: Extend Atlas Types and Schema

**Files:**

- Modify: `src/lib/atlas/types.ts`
- Modify: `src/lib/server/atlas/schema.ts`
- Test: `src/lib/server/atlas/schema.spec.ts`

- [ ] **Step 1: Add failing schema expectations**

Add assertions in `src/lib/server/atlas/schema.spec.ts` that `ensureAtlasSchema` creates these tables:

```ts
const expectedTables = [
	'atlas_concepts',
	'atlas_wiki_entries',
	'atlas_asset_concepts',
	'atlas_annotations',
	'atlas_annotation_concepts',
	'atlas_annotation_classifiers'
];
```

For each table:

```ts
const row = db
	.prepare("select name from sqlite_master where type = 'table' and name = ?")
	.get(table);
expect(row).toMatchObject({ name: table });
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run:

```bash
npx vitest run src/lib/server/atlas/schema.spec.ts
```

Expected: FAIL because the new tables do not exist.

- [ ] **Step 3: Add read-model types**

In `src/lib/atlas/types.ts`, add:

```ts
export type AtlasConceptKind = 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'system';

export type AtlasConceptMaturity = 'stub' | 'draft' | 'usable' | 'reviewed' | 'locked';

export type AtlasConceptStatus =
	| 'active'
	| 'suggested'
	| 'needs_review'
	| 'deprecated'
	| 'merged'
	| 'alias'
	| 'blocked';

export type AtlasConceptSummary = {
	id: string;
	slug: string;
	label: string;
	kind: AtlasConceptKind;
	category: string;
	displayGroup: string;
	status: AtlasConceptStatus;
	maturity: AtlasConceptMaturity;
	shortDefinition: string;
};

export type AtlasConceptAssignment = AtlasConceptSummary & {
	assignmentId: string;
	evidence: AtlasEvidence;
	provenance: string;
	assignmentStatus: AtlasAssignmentStatus;
};

export type AtlasAnnotationClassifier = {
	id: string;
	type: string;
	value: string;
	evidence: AtlasEvidence;
	status: AtlasAssignmentStatus;
};

export type AtlasAnnotationSummary = {
	id: string;
	label: string;
	regionJson: string | null;
	concepts: AtlasConceptAssignment[];
	classifiers: AtlasAnnotationClassifier[];
};

export type AtlasWikiEntrySummary = AtlasConceptSummary & {
	aliases: string[];
	broader: string[];
	related: string[];
	confusable: string[];
	allowedClassifiers: string[];
	aiGuidance: string;
};
```

Extend `AtlasAssetSummary`:

```ts
approvedConcepts: AtlasConceptAssignment[];
annotations: AtlasAnnotationSummary[];
wikiHints: AtlasWikiEntrySummary[];
```

- [ ] **Step 4: Add SQLite tables**

In `ensureAtlasSchema`, add:

```sql
create table if not exists atlas_concepts (
	id text primary key,
	slug text not null unique,
	label text not null,
	kind text not null,
	category text not null,
	display_group text not null,
	status text not null,
	maturity text not null,
	short_definition text not null,
	created_by text not null,
	created_at text not null,
	updated_at text not null
);

create table if not exists atlas_wiki_entries (
	concept_id text primary key references atlas_concepts(id) on delete cascade,
	long_description text,
	use_when_json text not null,
	do_not_use_when_json text not null,
	aliases_json text not null,
	broader_json text not null,
	narrower_json text not null,
	related_json text not null,
	confusable_json text not null,
	automatic_implications_json text not null,
	suggested_implications_json text not null,
	allowed_classifiers_json text not null,
	examples_json text not null,
	counterexamples_json text not null,
	ai_guidance text not null,
	citations_json text not null,
	updated_at text not null
);

create table if not exists atlas_asset_concepts (
	id text primary key,
	asset_id text not null references assets(id) on delete cascade,
	concept_id text not null references atlas_concepts(id) on delete cascade,
	evidence text not null,
	provenance text not null,
	status text not null,
	note text,
	created_at text not null,
	updated_at text not null,
	unique(asset_id, concept_id)
);

create table if not exists atlas_annotations (
	id text primary key,
	asset_id text not null references assets(id) on delete cascade,
	label text not null,
	region_json text,
	source text not null,
	confidence real,
	status text not null,
	note text,
	created_at text not null,
	updated_at text not null
);

create table if not exists atlas_annotation_concepts (
	annotation_id text not null references atlas_annotations(id) on delete cascade,
	concept_id text not null references atlas_concepts(id) on delete cascade,
	evidence text not null,
	provenance text not null,
	status text not null,
	created_at text not null,
	primary key (annotation_id, concept_id)
);

create table if not exists atlas_annotation_classifiers (
	id text primary key,
	annotation_id text not null references atlas_annotations(id) on delete cascade,
	classifier_type text not null,
	classifier_value text not null,
	evidence text not null,
	status text not null,
	created_at text not null,
	unique(annotation_id, classifier_type, classifier_value)
);
```

- [ ] **Step 5: Run the schema test**

Run:

```bash
npx vitest run src/lib/server/atlas/schema.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/atlas/types.ts src/lib/server/atlas/schema.ts src/lib/server/atlas/schema.spec.ts
git commit -m "Add Atlas canonical schema"
```

## Task 2: Add Seeded Wiki Concepts

**Files:**

- Create: `src/lib/server/atlas/wikiSeed.ts`
- Create: `src/lib/server/atlas/wikiSeed.spec.ts`
- Modify: `src/lib/atlas/types.ts` if the seed needs exported input types.

- [ ] **Step 1: Write seed integrity tests**

Create `src/lib/server/atlas/wikiSeed.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ATLAS_WIKI_SEED_CONCEPTS } from './wikiSeed';

describe('Atlas wiki seed concepts', () => {
	it('keeps slugs unique', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('keeps the Apollo/Python first pass below 50 seed concepts', () => {
		const apolloSeeds = ATLAS_WIKI_SEED_CONCEPTS.filter((concept) =>
			concept.seedSet.includes('apollo_killing_python')
		);
		expect(apolloSeeds.length).toBeLessThan(50);
	});

	it('models pose and state as classifiers rather than compound visual tags', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);
		expect(slugs).toContain('pose');
		expect(slugs).toContain('state');
		expect(slugs).not.toContain('reclining_creature');
		expect(slugs).not.toContain('wounded_creature');
	});

	it('includes both named and broad visual concepts for Python retrieval', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);
		expect(slugs).toEqual(expect.arrayContaining(['python_(mythology)', 'serpent']));
	});
});
```

- [ ] **Step 2: Run the seed test to verify it fails**

Run:

```bash
npx vitest run src/lib/server/atlas/wikiSeed.spec.ts
```

Expected: FAIL because `wikiSeed.ts` does not exist.

- [ ] **Step 3: Create seed data**

Create `src/lib/server/atlas/wikiSeed.ts` with:

```ts
export type AtlasWikiSeedConcept = {
	seedSet: string[];
	slug: string;
	label: string;
	kind: 'visual_tag' | 'entity' | 'classifier' | 'system';
	category: string;
	displayGroup: string;
	status: 'active' | 'needs_review';
	maturity: 'stub' | 'draft' | 'usable' | 'reviewed';
	shortDefinition: string;
	useWhen: string[];
	doNotUseWhen: string[];
	aliases: string[];
	broader: string[];
	narrower: string[];
	related: string[];
	confusable: string[];
	automaticImplications: string[];
	suggestedImplications: string[];
	allowedClassifiers: string[];
	examples: string[];
	counterexamples: string[];
	aiGuidance: string;
	citations: string[];
};
```

Add seed concepts from `docs/atlas/wiki/apollo-killing-python-seed-tag-plan.md`, including:

```ts
{
	seedSet: ['apollo_killing_python'],
	slug: 'serpent',
	label: 'serpent',
	kind: 'visual_tag',
	category: 'animal',
	displayGroup: 'Subjects / Visual Entities',
	status: 'active',
	maturity: 'usable',
	shortDefinition: 'Use when a snake-like creature is visibly depicted.',
	useWhen: ['A snake or serpent-like creature is visible.'],
	doNotUseWhen: ['The image only names a mythological serpent but does not depict one.'],
	aliases: ['snake_like_creature'],
	broader: ['animal'],
	narrower: [],
	related: ['dragon', 'python_(mythology)'],
	confusable: ['dragon'],
	automaticImplications: [],
	suggestedImplications: ['animal'],
	allowedClassifiers: ['pose', 'state', 'view', 'position', 'scale'],
	examples: ['apollo_killing_the_python'],
	counterexamples: [],
	aiGuidance: 'AI may apply when a snake-like creature is clearly visible. Do not identify it as Python without metadata or iconographic support.',
	citations: []
}
```

Also include `python_(mythology)`, `apollo_(deity)`, `hendrick_goltzius`, `bow`, `arrow`, `engraving`, `inscription`, `pose`, `state`, and the remaining seed concepts from the plan.

- [ ] **Step 4: Run the seed test**

Run:

```bash
npx vitest run src/lib/server/atlas/wikiSeed.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/atlas/wikiSeed.ts src/lib/server/atlas/wikiSeed.spec.ts
git commit -m "Seed Atlas wiki concepts"
```

## Task 3: Add Wiki Seed Application and Read APIs

**Files:**

- Create: `src/lib/server/atlas/wiki.ts`
- Create: `src/lib/server/atlas/wiki.spec.ts`
- Create: `src/routes/api/atlas/wiki/+server.ts`
- Create: `src/routes/api/atlas/wiki/[slug]/+server.ts`
- Create: `src/routes/api/atlas/wiki/server.spec.ts`

- [ ] **Step 1: Write failing wiki helper tests**

Create `src/lib/server/atlas/wiki.spec.ts` with tests that:

```ts
expect(readAtlasWikiEntries(db).some((entry) => entry.slug === 'serpent')).toBe(true);
expect(readAtlasWikiEntry(db, 'serpent')).toMatchObject({
	slug: 'serpent',
	allowedClassifiers: expect.arrayContaining(['pose', 'state'])
});
```

Call `applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z')` twice and assert there is still one `serpent` row.

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```bash
npx vitest run src/lib/server/atlas/wiki.spec.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement wiki helpers**

Create `src/lib/server/atlas/wiki.ts`:

```ts
import type Database from 'better-sqlite3';
import { ATLAS_WIKI_SEED_CONCEPTS } from './wikiSeed';

export function applyAtlasWikiSeed(db: Database.Database, now = new Date().toISOString()) {
	const insertConcept = db.prepare(/* insert atlas_concepts on conflict update */);
	const selectConcept = db.prepare('select id from atlas_concepts where slug = ?');
	const insertWiki = db.prepare(/* insert atlas_wiki_entries on conflict update */);

	const transaction = db.transaction(() => {
		for (const concept of ATLAS_WIKI_SEED_CONCEPTS) {
			insertConcept.run(
				`atlas-concept-${concept.slug}`,
				concept.slug,
				concept.label,
				concept.kind,
				concept.category,
				concept.displayGroup,
				concept.status,
				concept.maturity,
				concept.shortDefinition,
				'seed',
				now,
				now
			);
			const row = selectConcept.get(concept.slug) as { id: string };
			insertWiki.run(
				row.id,
				'',
				JSON.stringify(concept.useWhen),
				JSON.stringify(concept.doNotUseWhen),
				JSON.stringify(concept.aliases),
				JSON.stringify(concept.broader),
				JSON.stringify(concept.narrower),
				JSON.stringify(concept.related),
				JSON.stringify(concept.confusable),
				JSON.stringify(concept.automaticImplications),
				JSON.stringify(concept.suggestedImplications),
				JSON.stringify(concept.allowedClassifiers),
				JSON.stringify(concept.examples),
				JSON.stringify(concept.counterexamples),
				concept.aiGuidance,
				JSON.stringify(concept.citations),
				now
			);
		}
	});

	transaction();
}
```

Also export `readAtlasWikiEntries(db)` and `readAtlasWikiEntry(db, slug)` that parse JSON fields.

- [ ] **Step 4: Add API route tests**

Create `src/routes/api/atlas/wiki/server.spec.ts` that calls `GET` from both routes and expects:

```ts
expect(body.entries.some((entry) => entry.slug === 'serpent')).toBe(true);
expect(detail.slug).toBe('serpent');
```

- [ ] **Step 5: Implement API routes**

`src/routes/api/atlas/wiki/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed, readAtlasWikiEntries } from '$lib/server/atlas/wiki';

export function GET() {
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		return json({ entries: readAtlasWikiEntries(db) });
	} finally {
		db.close();
	}
}
```

`src/routes/api/atlas/wiki/[slug]/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed, readAtlasWikiEntry } from '$lib/server/atlas/wiki';

export function GET({ params }: { params: { slug: string } }) {
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		const entry = readAtlasWikiEntry(db, params.slug);
		if (!entry) return json({ error: 'Wiki entry not found' }, { status: 404 });
		return json({ entry });
	} finally {
		db.close();
	}
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npx vitest run src/lib/server/atlas/wiki.spec.ts src/routes/api/atlas/wiki/server.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/atlas/wiki.ts src/lib/server/atlas/wiki.spec.ts src/routes/api/atlas/wiki src/routes/api/atlas/wiki/server.spec.ts
git commit -m "Add Atlas wiki read API"
```

## Task 4: Seed Apollo/Python Assignments for Matching Imports

**Files:**

- Create: `src/lib/server/atlas/apolloSeed.ts`
- Create: `src/lib/server/atlas/apolloSeed.spec.ts`
- Modify: `src/lib/server/atlas/ingest.ts`
- Modify: `src/lib/server/atlas/read.spec.ts`

- [ ] **Step 1: Write fixture assignment tests**

Create `src/lib/server/atlas/apolloSeed.spec.ts` with an in-memory asset titled `Apollo Killing the Python`.

Assert that `applyApolloPythonSeedForAsset(db, assetId, now)` creates:

```ts
expect(concepts).toEqual(
	expect.arrayContaining(['apollo_(deity)', 'python_(mythology)', 'serpent'])
);
expect(classifiers).toEqual(
	expect.arrayContaining([
		expect.objectContaining({ classifier_type: 'state', classifier_value: 'wounded' }),
		expect.objectContaining({ classifier_type: 'pose', classifier_value: 'reclining' })
	])
);
```

- [ ] **Step 2: Run the fixture test to verify failure**

Run:

```bash
npx vitest run src/lib/server/atlas/apolloSeed.spec.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement fixture seed helper**

Create `src/lib/server/atlas/apolloSeed.ts`:

```ts
const APOLLO_TITLE_PATTERN = /apollo killing the python/i;

export function shouldApplyApolloPythonSeed(input: {
	title?: string | null;
	sourceUrl?: string | null;
}) {
	return Boolean(
		(input.title && APOLLO_TITLE_PATTERN.test(input.title)) ||
		input.sourceUrl?.includes('Apollo_Killing_the_Python_LACMA_54.70.1i')
	);
}
```

Implement `applyApolloPythonSeedForAsset(db, assetId, now)` to:

1. call `applyAtlasWikiSeed(db, now)`
2. attach asset concepts for seed slugs:
   `apollo_(deity)`, `python_(mythology)`, `serpent`, `bow`, `arrow`, `inscription`, `engraving`, `printmaking`, `mythological_scene`
3. create annotations:
   `apollo_figure`, `python_body`, `latin_inscription`
4. attach both `python_(mythology)` and `serpent` to `python_body`
5. attach classifiers:
   `pose=reclining`, `state=wounded`, `position=right`

- [ ] **Step 4: Invoke fixture seed after Explore save**

Modify `src/routes/api/library/save-explore/+server.ts` after the asset has been saved and Atlas ingestion has run. Open the library database in that route's existing flow or reuse the database already available in the helper it calls, then call:

```ts
if (shouldApplyApolloPythonSeed({ title: savedAsset.title, sourceUrl: savedAsset.sourceUrl })) {
	applyApolloPythonSeedForAsset(db, savedAsset.id, now);
}
```

Do not call the fixture helper from `applyAtlasIngestionProposal`; that lower-level function does not reliably receive the saved asset title.

- [ ] **Step 5: Run fixture tests**

Run:

```bash
npx vitest run src/lib/server/atlas/apolloSeed.spec.ts src/lib/server/atlas/read.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/atlas/apolloSeed.ts src/lib/server/atlas/apolloSeed.spec.ts src/lib/server/atlas/ingest.ts src/lib/server/atlas/read.spec.ts
git commit -m "Seed Apollo Python Atlas assignments"
```

## Task 5: Expand Atlas Asset Summary Read Model

**Files:**

- Modify: `src/lib/server/atlas/read.ts`
- Modify: `src/lib/server/atlas/read.spec.ts`
- Modify: `src/routes/api/library/assets/[id]/atlas/+server.ts`

- [ ] **Step 1: Add failing read assertions**

In `read.spec.ts`, after applying Apollo seed, assert:

```ts
expect(summary.approvedConcepts.map((concept) => concept.slug)).toEqual(
	expect.arrayContaining(['apollo_(deity)', 'python_(mythology)', 'serpent'])
);
expect(summary.annotations).toEqual([
	expect.objectContaining({
		label: 'python_body',
		concepts: expect.arrayContaining([
			expect.objectContaining({ slug: 'python_(mythology)' }),
			expect.objectContaining({ slug: 'serpent' })
		]),
		classifiers: expect.arrayContaining([
			expect.objectContaining({ type: 'state', value: 'wounded' })
		])
	})
]);
```

- [ ] **Step 2: Run read test to verify failure**

Run:

```bash
npx vitest run src/lib/server/atlas/read.spec.ts
```

Expected: FAIL because the summary does not include these fields.

- [ ] **Step 3: Implement expanded reads**

In `getAtlasAssetSummary`, query:

- `atlas_asset_concepts join atlas_concepts`
- `atlas_annotations`
- `atlas_annotation_concepts join atlas_concepts`
- `atlas_annotation_classifiers`

Return:

```ts
(approvedConcepts, annotations, wikiHints);
```

`wikiHints` should be the first several concepts visible on the asset with parsed wiki metadata.

- [ ] **Step 4: Update mock fallback**

In `src/routes/api/library/assets/[id]/atlas/+server.ts`, add empty arrays for:

```ts
approvedConcepts: [],
annotations: [],
wikiHints: []
```

- [ ] **Step 5: Run tests**

Run:

```bash
npx vitest run src/lib/server/atlas/read.spec.ts src/routes/api/library/assets/[id]/atlas/server.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/atlas/read.ts src/lib/server/atlas/read.spec.ts src/routes/api/library/assets/[id]/atlas/+server.ts
git commit -m "Expand Atlas asset summary"
```

## Task 6: Render Nested Concepts and Classifiers in Inspect

**Files:**

- Modify: `src/lib/components/atlas/AtlasMetadataPanel.svelte`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Add Playwright expectation**

In the desktop Atlas test, mock or use fixture data so the panel contains:

```ts
await expect(page.getByText('python_(mythology)')).toBeVisible();
await expect(page.getByText('serpent')).toBeVisible();
await expect(page.getByText('state: wounded')).toBeVisible();
```

- [ ] **Step 2: Run e2e to verify failure**

Run:

```bash
npx playwright test tests/pastiche.e2e.ts:223
```

Expected: FAIL because the current panel does not render nested annotations/classifiers.

- [ ] **Step 3: Update panel row building**

In `AtlasMetadataPanel.svelte`, add groups:

- `Canonical Visual Tags`
- `Subjects / Entities`
- `Classifiers by Visible Entity`
- `Annotations / Regions`

Render annotation rows like:

```svelte
{#each atlas.annotations as annotation}
	<li class="annotation-row">
		<span class="value">{annotation.label}</span>
		<ul class="nested">
			{#each annotation.concepts as concept}
				<li class={`tone-${atlasRowTone(concept)}`}>{concept.slug}</li>
			{/each}
			{#each annotation.classifiers as classifier}
				<li class="tone-classifier">{classifier.type}: {classifier.value}</li>
			{/each}
		</ul>
	</li>
{/each}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run check
npx playwright test tests/pastiche.e2e.ts:223
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/atlas/AtlasMetadataPanel.svelte tests/pastiche.e2e.ts
git commit -m "Render Atlas classifiers in inspect"
```

## Task 7: Add Read-Only Atlas Wiki UI

**Files:**

- Create: `src/lib/components/atlas/AtlasWiki.svelte`
- Modify: `src/lib/components/atlas/AtlasWorkspace.svelte`
- Modify: `src/lib/state/app-state.svelte.ts`
- Test: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Add e2e expectation**

Add a flow that opens Atlas wiki and expects:

```ts
await expect(page.getByRole('heading', { name: 'Atlas Wiki' })).toBeVisible();
await expect(page.getByRole('button', { name: /serpent/ })).toBeVisible();
await page.getByRole('button', { name: /serpent/ }).click();
await expect(page.getByRole('heading', { name: 'serpent' })).toBeVisible();
await expect(page.getByText('Allowed classifiers')).toBeVisible();
await expect(page.getByText('pose')).toBeVisible();
```

- [ ] **Step 2: Run e2e to verify failure**

Run:

```bash
npx playwright test tests/pastiche.e2e.ts:223
```

Expected: FAIL because the wiki UI does not exist.

- [ ] **Step 3: Implement state helpers**

In `app-state.svelte.ts`, add:

```ts
activeAtlasWikiSlug: 'serpent' as string | null;
```

and:

```ts
export function openAtlasWiki(slug = 'serpent') {
	appState.mode = 'atlas';
	appState.atlasView = 'wiki';
	appState.activeAtlasWikiSlug = slug;
	appState.activeAtlasAssetId = null;
}
```

- [ ] **Step 4: Implement `AtlasWiki.svelte`**

Fetch `/api/atlas/wiki`, render:

- left column with guide links and grouped concept buttons
- pinned search input
- right column with selected entry
- aliases, use/do-not-use, relationships, allowed classifiers, AI guidance

- [ ] **Step 5: Wire workspace**

In `AtlasWorkspace.svelte`:

```svelte
{:else if appState.atlasView === 'wiki'}
	<AtlasWiki />
```

Add a link from `AtlasHome` to open the wiki.

- [ ] **Step 6: Run checks**

Run:

```bash
npm run check
npx playwright test tests/pastiche.e2e.ts:223
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/atlas/AtlasWiki.svelte src/lib/components/atlas/AtlasWorkspace.svelte src/lib/components/atlas/AtlasHome.svelte src/lib/state/app-state.svelte.ts tests/pastiche.e2e.ts
git commit -m "Add Atlas wiki read view"
```

## Task 8: Full Verification

**Files:**

- No new files.

- [ ] **Step 1: Run unit tests**

```bash
npx vitest run src/lib/atlas src/lib/server/atlas src/routes/api/atlas src/routes/api/library/assets/[id]/atlas
```

Expected: all tests pass.

- [ ] **Step 2: Run Svelte check**

```bash
npm run check
```

Expected: 0 errors and 0 warnings.

- [ ] **Step 3: Run targeted e2e**

```bash
npx playwright test tests/pastiche.e2e.ts:223
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 5: Commit any verification-only fixes**

If formatting or small test fixes were needed, stage the exact files changed by the verification commands.

Example:

```bash
git add src/lib/components/atlas/AtlasWiki.svelte tests/pastiche.e2e.ts
git commit -m "Verify Atlas wiki tagging foundation"
```

If no files changed, do not create an empty commit.
