# Atlas Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first non-UI Atlas foundation: canonical metadata tables, deterministic ingestion proposals from import metadata, and read services that prove Explore imports can normalize no-brainer artist/rights/institution/medium metadata without creating visual tag noise.

**Architecture:** Add Atlas as a bridge-first layer inside the existing local Library SQLite database. The current Library tables remain intact; Atlas tables are created idempotently by the Library database initializer, and import flows call Atlas ingestion after the asset row is inserted. Atlas ingestion is deterministic and source-backed: it creates entities and claims for reliable metadata, while source tags remain suggestions rather than approved visual truth.

**Tech Stack:** SvelteKit, TypeScript, Vitest, better-sqlite3, existing local Library sidecar under `src/lib/server/library`.

---

## Source Documents

Read these before implementing:

```text
docs/superpowers/specs/2026-06-05-atlas-metadata-wiki-design.md
README.md
docs/architecture/local-library-sidecar.md
src/lib/server/library/schema.ts
src/lib/server/library/import.ts
src/lib/server/library/read.ts
src/routes/api/library/save-explore/+server.ts
```

## Scope

This plan intentionally does not build Atlas UI. It creates the data and service spine that future Library/Inspector UI can consume.

Included:

- Atlas TypeScript domain types.
- Shared slug normalization.
- Atlas SQLite schema tables.
- Deterministic ingestion proposal builder.
- Server write path for entities, claims, suggestions, and raw unmapped metadata.
- Import integration after asset creation.
- Read service for per-asset Atlas metadata.
- Tests for schema, normalization, ingestion, import integration, and Explore save.

Excluded:

- Tag wiki editing UI.
- Classifier UI.
- Explicit Atlas search syntax.
- AI integration.
- Migration of existing Library tags.
- Color profiles and image relationships.

## File Structure

Create:

```text
src/lib/atlas/types.ts
src/lib/atlas/normalization.ts
src/lib/atlas/normalization.spec.ts
src/lib/server/atlas/schema.ts
src/lib/server/atlas/schema.spec.ts
src/lib/server/atlas/ingest.ts
src/lib/server/atlas/ingest.spec.ts
src/lib/server/atlas/read.ts
src/lib/server/atlas/read.spec.ts
```

Modify:

```text
src/lib/server/library/schema.ts
src/lib/server/library/import.ts
src/lib/server/library/library.spec.ts
src/routes/api/library/save-explore/server.spec.ts
```

Responsibilities:

- `src/lib/atlas/types.ts`: Shared domain types safe for client and server imports.
- `src/lib/atlas/normalization.ts`: Deterministic text-to-slug normalization and small source value normalizers.
- `src/lib/server/atlas/schema.ts`: Atlas table creation against the existing Library database connection.
- `src/lib/server/atlas/ingest.ts`: Deterministic proposal construction and apply logic.
- `src/lib/server/atlas/read.ts`: Query helpers for asset-level Atlas summaries.

---

### Task 1: Shared Atlas Types and Normalization

**Files:**

- Create: `src/lib/atlas/types.ts`
- Create: `src/lib/atlas/normalization.ts`
- Create: `src/lib/atlas/normalization.spec.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `src/lib/atlas/normalization.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeAtlasSlug, normalizeKnownAtlasValue } from './normalization';

describe('Atlas normalization', () => {
	it('normalizes labels into stable lowercase slugs', () => {
		expect(normalizeAtlasSlug(' Pablo Picasso ')).toBe('pablo_picasso');
		expect(normalizeAtlasSlug('Oil on canvas')).toBe('oil_on_canvas');
		expect(normalizeAtlasSlug('The Metropolitan Museum of Art')).toBe(
			'the_metropolitan_museum_of_art'
		);
		expect(normalizeAtlasSlug('1860s–70s')).toBe('1860s_70s');
		expect(normalizeAtlasSlug('B&W')).toBe('b_and_w');
	});

	it('uses known mappings for common source values', () => {
		expect(normalizeKnownAtlasValue('institution', 'The Metropolitan Museum of Art')).toEqual({
			label: 'The Met',
			slug: 'the_met'
		});
		expect(normalizeKnownAtlasValue('institution', 'Metropolitan Museum')).toEqual({
			label: 'The Met',
			slug: 'the_met'
		});
		expect(normalizeKnownAtlasValue('source', 'Wikimedia Commons')).toEqual({
			label: 'Wikimedia Commons',
			slug: 'wikimedia_commons'
		});
		expect(normalizeKnownAtlasValue('rights', 'Public domain image according to The Met.')).toEqual(
			{
				label: 'Public Domain',
				slug: 'public_domain'
			}
		);
		expect(normalizeKnownAtlasValue('medium', 'Oil on canvas')).toEqual({
			label: 'Oil on canvas',
			slug: 'oil_on_canvas'
		});
	});
});
```

- [ ] **Step 2: Run the failing test**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/normalization.spec.ts
```

Expected: FAIL because `src/lib/atlas/normalization.ts` does not exist.

- [ ] **Step 3: Add shared types**

Create `src/lib/atlas/types.ts`:

```ts
export type AtlasMetadataKind = 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'computed';

export type AtlasEntityKind =
	| 'artist'
	| 'work'
	| 'character'
	| 'ip'
	| 'institution'
	| 'source'
	| 'place'
	| 'species';

export type AtlasClaimKind =
	| 'rights'
	| 'medium'
	| 'date'
	| 'dimensions'
	| 'source_metadata'
	| 'technical_metadata';

export type AtlasEvidence = 'observed' | 'metadata' | 'inferred' | 'interpretive' | 'computed';

export type AtlasAssignmentStatus =
	| 'approved'
	| 'suggested'
	| 'needs_review'
	| 'rejected'
	| 'deprecated';

export type AtlasSourceKind = 'explore' | 'extension' | 'manual' | 'agent' | 'import';

export type AtlasNormalizedValue = {
	label: string;
	slug: string;
};

export type AtlasIngestionInput = {
	assetId: string;
	source: AtlasSourceKind;
	sourceId: string | null;
	sourceName: string | null;
	detailUrl: string | null;
	creator: string | null;
	dateDisplay: string | null;
	medium: string | null;
	objectName: string | null;
	department: string | null;
	culture: string | null;
	period: string | null;
	rights: string | null;
	tags: string[];
	rawMetadata: Record<string, unknown>;
	now: string;
};

export type AtlasEntityProposal = {
	kind: AtlasEntityKind;
	label: string;
	slug: string;
	sourceText: string;
	provenance: string;
};

export type AtlasClaimProposal = {
	kind: AtlasClaimKind;
	label: string;
	value: string;
	slug: string;
	sourceText: string;
	provenance: string;
};

export type AtlasTagSuggestionProposal = {
	label: string;
	slug: string;
	sourceText: string;
	provenance: string;
	status: 'suggested';
};

export type AtlasIngestionProposal = {
	assetId: string;
	source: AtlasSourceKind;
	sourceId: string | null;
	entities: AtlasEntityProposal[];
	claims: AtlasClaimProposal[];
	tagSuggestions: AtlasTagSuggestionProposal[];
	rawUnmapped: Record<string, unknown>;
	warnings: string[];
	createdAt: string;
};

export type AtlasAssetSummary = {
	assetId: string;
	entities: Array<AtlasEntityProposal & { id: string }>;
	claims: Array<AtlasClaimProposal & { id: string }>;
	tagSuggestions: Array<AtlasTagSuggestionProposal & { id: string }>;
};
```

- [ ] **Step 4: Add normalization implementation**

Create `src/lib/atlas/normalization.ts`:

```ts
import type { AtlasClaimKind, AtlasEntityKind, AtlasNormalizedValue } from './types';

type KnownKind = AtlasEntityKind | AtlasClaimKind;

const KNOWN_VALUE_SLUGS: Partial<Record<KnownKind, Record<string, AtlasNormalizedValue>>> = {
	institution: {
		'the metropolitan museum of art': { label: 'The Met', slug: 'the_met' },
		'metropolitan museum': { label: 'The Met', slug: 'the_met' },
		'the met': { label: 'The Met', slug: 'the_met' },
		'art institute of chicago': {
			label: 'Art Institute of Chicago',
			slug: 'art_institute_of_chicago'
		},
		'art institute': { label: 'Art Institute of Chicago', slug: 'art_institute_of_chicago' }
	},
	source: {
		'the metropolitan museum of art': { label: 'The Met', slug: 'the_met' },
		'metropolitan museum': { label: 'The Met', slug: 'the_met' },
		'wikimedia commons': { label: 'Wikimedia Commons', slug: 'wikimedia_commons' },
		wikidata: { label: 'Wikidata', slug: 'wikidata' },
		'the met': { label: 'The Met', slug: 'the_met' },
		'art institute': { label: 'Art Institute', slug: 'art_institute' }
	}
};

export function normalizeAtlasSlug(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
		.replace(/&/g, ' and ')
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

export function normalizeKnownAtlasValue(
	kind: KnownKind,
	input: string
): AtlasNormalizedValue | null {
	const clean = input.trim();
	if (!clean) return null;
	const key = clean.toLowerCase().replace(/\s+/g, ' ');
	const known = KNOWN_VALUE_SLUGS[kind]?.[key];
	if (known) return known;
	if (kind === 'rights' && /public domain/i.test(clean)) {
		return { label: 'Public Domain', slug: 'public_domain' };
	}
	return { label: clean, slug: normalizeAtlasSlug(clean) };
}
```

- [ ] **Step 5: Run normalization tests**

Run:

```sh
npm run test:unit -- --run src/lib/atlas/normalization.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add src/lib/atlas/types.ts src/lib/atlas/normalization.ts src/lib/atlas/normalization.spec.ts
git commit -m "Add Atlas normalization primitives"
```

---

### Task 2: Atlas SQLite Schema

**Files:**

- Create: `src/lib/server/atlas/schema.ts`
- Create: `src/lib/server/atlas/schema.spec.ts`
- Modify: `src/lib/server/library/schema.ts`
- Modify: `src/lib/server/library/library.spec.ts`

- [ ] **Step 1: Write failing schema test**

Create `src/lib/server/atlas/schema.spec.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeLibrary } from '$lib/server/library/schema';

describe('Atlas schema', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-schema-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('initializes Atlas tables inside the Library database', () => {
		initializeLibrary();

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const tables = db
			.prepare("select name from sqlite_master where type = 'table' order by name")
			.all()
			.map((row) => (row as { name: string }).name);
		db.close();

		expect(tables).toEqual(
			expect.arrayContaining([
				'atlas_entities',
				'atlas_claims',
				'atlas_tag_suggestions',
				'atlas_ingestion_runs'
			])
		);
	});
});
```

- [ ] **Step 2: Run the failing schema test**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/schema.spec.ts
```

Expected: FAIL because Atlas tables are not created.

- [ ] **Step 3: Add Atlas schema helper**

Create `src/lib/server/atlas/schema.ts`:

```ts
import type Database from 'better-sqlite3';

export function ensureAtlasSchema(db: Database.Database) {
	db.exec(`
		create table if not exists atlas_entities (
			id text primary key,
			kind text not null,
			slug text not null,
			label text not null,
			external_url text,
			created_at text not null,
			updated_at text not null,
			unique(kind, slug)
		);

		create table if not exists atlas_claims (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			kind text not null,
			slug text not null,
			label text not null,
			value text not null,
			source_text text not null,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			updated_at text not null,
			unique(asset_id, kind, slug)
		);

		create table if not exists atlas_asset_entities (
			asset_id text not null references assets(id) on delete cascade,
			entity_id text not null references atlas_entities(id) on delete cascade,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			primary key (asset_id, entity_id)
		);

		create table if not exists atlas_tag_suggestions (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			slug text not null,
			label text not null,
			source_text text not null,
			evidence text not null,
			provenance text not null,
			status text not null,
			created_at text not null,
			updated_at text not null,
			unique(asset_id, slug)
		);

		create table if not exists atlas_ingestion_runs (
			id text primary key,
			asset_id text not null references assets(id) on delete cascade,
			source text not null,
			source_id text,
			proposal_json text not null,
			warnings_json text not null,
			created_at text not null
		);
	`);
}
```

- [ ] **Step 4: Wire Atlas schema into Library schema**

Modify `src/lib/server/library/schema.ts`:

```ts
import Database from 'better-sqlite3';
import { ensureAtlasSchema } from '$lib/server/atlas/schema';
import { ensureLibraryArchive, resolveLibraryPaths } from './paths';
```

Then call `ensureAtlasSchema(db);` after the existing Library `db.exec(...)` block and before `ensureColumn(...)`:

```ts
	`);
	ensureAtlasSchema(db);
	ensureColumn(db, 'assets', 'metadata_json', 'text');
```

- [ ] **Step 5: Update existing schema inventory test**

Modify the table expectation in `src/lib/server/library/library.spec.ts` so it includes the Atlas tables:

```ts
expect(tables).toEqual([
	'asset_import_failures',
	'asset_tags',
	'assets',
	'atlas_asset_entities',
	'atlas_claims',
	'atlas_entities',
	'atlas_ingestion_runs',
	'atlas_tag_suggestions',
	'folders',
	'lazy_download_jobs',
	'project_asset_refs',
	'project_folder_refs',
	'projects',
	'tag_facets',
	'tags'
]);
```

- [ ] **Step 6: Run schema tests**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/schema.spec.ts src/lib/server/library/library.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add src/lib/server/atlas/schema.ts src/lib/server/atlas/schema.spec.ts src/lib/server/library/schema.ts src/lib/server/library/library.spec.ts
git commit -m "Add Atlas SQLite schema"
```

---

### Task 3: Deterministic Atlas Ingestion Proposal Builder

**Files:**

- Create: `src/lib/server/atlas/ingest.ts`
- Create: `src/lib/server/atlas/ingest.spec.ts`

- [ ] **Step 1: Write failing proposal tests**

Create `src/lib/server/atlas/ingest.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAtlasIngestionProposal } from './ingest';

describe('createAtlasIngestionProposal', () => {
	it('maps source-backed museum metadata into entities and claims', () => {
		const proposal = createAtlasIngestionProposal({
			assetId: 'asset-1',
			source: 'explore',
			sourceId: 'met',
			sourceName: 'The Metropolitan Museum of Art',
			detailUrl: 'https://www.metmuseum.org/art/collection/search/1',
			creator: 'Pablo Picasso',
			dateDisplay: '1937',
			medium: 'Oil on canvas',
			objectName: 'Painting',
			department: 'Paintings',
			culture: null,
			period: 'Cubism',
			rights: 'Public domain image according to The Met.',
			tags: ['horse', 'mourning'],
			rawMetadata: { objectID: 1 },
			now: '2026-06-05T12:00:00.000Z'
		});

		expect(proposal.entities).toEqual([
			expect.objectContaining({ kind: 'artist', label: 'Pablo Picasso', slug: 'pablo_picasso' }),
			expect.objectContaining({ kind: 'source', label: 'The Met', slug: 'the_met' })
		]);
		expect(proposal.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'date', slug: '1937', value: '1937' }),
				expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas', value: 'Oil on canvas' }),
				expect.objectContaining({ kind: 'rights', slug: 'public_domain', value: 'Public Domain' })
			])
		);
		expect(proposal.tagSuggestions).toEqual([
			expect.objectContaining({ label: 'horse', slug: 'horse', status: 'suggested' }),
			expect.objectContaining({ label: 'mourning', slug: 'mourning', status: 'suggested' })
		]);
		expect(proposal.rawUnmapped).toEqual({
			objectName: 'Painting',
			department: 'Paintings',
			culture: null,
			period: 'Cubism'
		});
	});

	it('does not create empty records for missing metadata', () => {
		const proposal = createAtlasIngestionProposal({
			assetId: 'asset-2',
			source: 'extension',
			sourceId: null,
			sourceName: null,
			detailUrl: null,
			creator: null,
			dateDisplay: null,
			medium: null,
			objectName: null,
			department: null,
			culture: null,
			period: null,
			rights: null,
			tags: [],
			rawMetadata: {},
			now: '2026-06-05T12:00:00.000Z'
		});

		expect(proposal.entities).toEqual([]);
		expect(proposal.claims).toEqual([]);
		expect(proposal.tagSuggestions).toEqual([]);
		expect(proposal.warnings).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the failing proposal tests**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/ingest.spec.ts
```

Expected: FAIL because `createAtlasIngestionProposal` does not exist.

- [ ] **Step 3: Add proposal implementation**

Create `src/lib/server/atlas/ingest.ts`:

```ts
import type Database from 'better-sqlite3';
import { normalizeAtlasSlug, normalizeKnownAtlasValue } from '$lib/atlas/normalization';
import type {
	AtlasClaimKind,
	AtlasClaimProposal,
	AtlasEntityKind,
	AtlasEntityProposal,
	AtlasIngestionInput,
	AtlasIngestionProposal,
	AtlasTagSuggestionProposal
} from '$lib/atlas/types';

export function createAtlasIngestionProposal(input: AtlasIngestionInput): AtlasIngestionProposal {
	const entities: AtlasEntityProposal[] = [];
	const claims: AtlasClaimProposal[] = [];
	const tagSuggestions: AtlasTagSuggestionProposal[] = [];

	addEntity(entities, 'artist', input.creator, 'metadata.creator');
	addEntity(entities, 'source', input.sourceName, 'metadata.sourceName');

	addClaim(claims, 'date', input.dateDisplay, 'metadata.dateDisplay');
	addClaim(claims, 'medium', input.medium, 'metadata.medium');
	addClaim(claims, 'rights', input.rights, 'metadata.rights');

	const seenTags = new Set<string>();
	for (const tag of input.tags) {
		const clean = tag.trim();
		const slug = normalizeAtlasSlug(clean);
		if (!clean || !slug || seenTags.has(slug)) continue;
		seenTags.add(slug);
		tagSuggestions.push({
			label: clean,
			slug,
			sourceText: clean,
			provenance: 'metadata.tags',
			status: 'suggested'
		});
	}

	return {
		assetId: input.assetId,
		source: input.source,
		sourceId: input.sourceId,
		entities,
		claims,
		tagSuggestions,
		rawUnmapped: {
			objectName: input.objectName,
			department: input.department,
			culture: input.culture,
			period: input.period
		},
		warnings: [],
		createdAt: input.now
	};
}

function addEntity(
	entities: AtlasEntityProposal[],
	kind: AtlasEntityKind,
	value: string | null,
	provenance: string
) {
	if (!value?.trim()) return;
	const normalized = normalizeKnownAtlasValue(kind, value);
	if (!normalized) return;
	entities.push({
		kind,
		label: normalized.label,
		slug: normalized.slug,
		sourceText: value,
		provenance
	});
}

function addClaim(
	claims: AtlasClaimProposal[],
	kind: AtlasClaimKind,
	value: string | null,
	provenance: string
) {
	if (!value?.trim()) return;
	const normalized = normalizeKnownAtlasValue(kind, value);
	if (!normalized) return;
	claims.push({
		kind,
		label: normalized.label,
		value: normalized.label,
		slug: normalized.slug,
		sourceText: value,
		provenance
	});
}
```

- [ ] **Step 4: Run proposal tests**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/ingest.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/lib/server/atlas/ingest.ts src/lib/server/atlas/ingest.spec.ts
git commit -m "Add Atlas ingestion proposal builder"
```

---

### Task 4: Apply Atlas Ingestion Proposals

**Files:**

- Modify: `src/lib/server/atlas/ingest.ts`
- Modify: `src/lib/server/atlas/ingest.spec.ts`

- [ ] **Step 1: Add failing apply test**

Append to `src/lib/server/atlas/ingest.spec.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasIngestionProposal, createAtlasIngestionProposal } from './ingest';

describe('applyAtlasIngestionProposal', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-ingest-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('persists entities, claims, tag suggestions, and an ingestion run', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Guernica',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/guernica.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1000,
					natural_height: 500,
					source_url: 'https://example.com/guernica',
					page_title: 'Guernica',
					alt_text: null,
					captured_at: '2026-06-05T12:00:00.000Z'
				}
			]
		});
		const assetId = imported.imported[0].asset_id;
		const proposal = createAtlasIngestionProposal({
			assetId,
			source: 'explore',
			sourceId: 'met',
			sourceName: 'The Metropolitan Museum of Art',
			detailUrl: 'https://example.com/guernica',
			creator: 'Pablo Picasso',
			dateDisplay: '1937',
			medium: 'Oil on canvas',
			objectName: 'Painting',
			department: 'Paintings',
			culture: null,
			period: null,
			rights: 'Public domain image according to The Met.',
			tags: ['horse'],
			rawMetadata: {},
			now: '2026-06-05T12:00:00.000Z'
		});
		const db = openLibraryDatabase();

		applyAtlasIngestionProposal(db, proposal);

		const entities = db
			.prepare('select kind, slug, label from atlas_entities order by kind, slug')
			.all();
		const claims = db
			.prepare('select kind, slug, value, status from atlas_claims order by kind')
			.all();
		const suggestions = db.prepare('select slug, label, status from atlas_tag_suggestions').all();
		const runs = db.prepare('select asset_id, source, source_id from atlas_ingestion_runs').all();
		db.close();

		expect(entities).toEqual([
			{ kind: 'artist', slug: 'pablo_picasso', label: 'Pablo Picasso' },
			{ kind: 'source', slug: 'the_met', label: 'The Met' }
		]);
		expect(claims).toEqual([
			expect.objectContaining({ kind: 'date', slug: '1937', value: '1937', status: 'approved' }),
			expect.objectContaining({
				kind: 'medium',
				slug: 'oil_on_canvas',
				value: 'Oil on canvas',
				status: 'approved'
			}),
			expect.objectContaining({
				kind: 'rights',
				slug: 'public_domain',
				value: 'Public Domain',
				status: 'approved'
			})
		]);
		expect(suggestions).toEqual([{ slug: 'horse', label: 'horse', status: 'suggested' }]);
		expect(runs).toEqual([{ asset_id: assetId, source: 'explore', source_id: 'met' }]);
	});
});
```

If imports conflict, consolidate them at the top of the file instead of duplicating import statements.

- [ ] **Step 2: Run the failing apply test**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/ingest.spec.ts
```

Expected: FAIL because `applyAtlasIngestionProposal` does not exist.

- [ ] **Step 3: Implement apply function**

Add to `src/lib/server/atlas/ingest.ts`:

```ts
export function applyAtlasIngestionProposal(
	db: Database.Database,
	proposal: AtlasIngestionProposal
) {
	const now = proposal.createdAt;

	const insertEntity = db.prepare(
		`insert into atlas_entities (id, kind, slug, label, external_url, created_at, updated_at)
		 values (?, ?, ?, ?, null, ?, ?)
		 on conflict(kind, slug) do update set label = excluded.label, updated_at = excluded.updated_at`
	);
	const entityByKey = db.prepare('select id from atlas_entities where kind = ? and slug = ?');
	const insertAssetEntity = db.prepare(
		`insert or ignore into atlas_asset_entities (
			asset_id, entity_id, evidence, provenance, status, created_at
		) values (?, ?, 'metadata', ?, 'approved', ?)`
	);
	const insertClaim = db.prepare(
		`insert into atlas_claims (
			id, asset_id, kind, slug, label, value, source_text, evidence, provenance, status, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, 'metadata', ?, 'approved', ?, ?)
		on conflict(asset_id, kind, slug) do update set
			label = excluded.label,
			value = excluded.value,
			source_text = excluded.source_text,
			provenance = excluded.provenance,
			updated_at = excluded.updated_at`
	);
	const insertSuggestion = db.prepare(
		`insert into atlas_tag_suggestions (
			id, asset_id, slug, label, source_text, evidence, provenance, status, created_at, updated_at
		) values (?, ?, ?, ?, ?, 'metadata', ?, 'suggested', ?, ?)
		on conflict(asset_id, slug) do update set
			label = excluded.label,
			source_text = excluded.source_text,
			provenance = excluded.provenance,
			updated_at = excluded.updated_at`
	);
	const insertRun = db.prepare(
		`insert into atlas_ingestion_runs (
			id, asset_id, source, source_id, proposal_json, warnings_json, created_at
		) values (?, ?, ?, ?, ?, ?, ?)`
	);

	const apply = db.transaction(() => {
		for (const entity of proposal.entities) {
			insertEntity.run(
				`atlas-entity-${crypto.randomUUID()}`,
				entity.kind,
				entity.slug,
				entity.label,
				now,
				now
			);
			const row = entityByKey.get(entity.kind, entity.slug) as { id: string };
			insertAssetEntity.run(proposal.assetId, row.id, entity.provenance, now);
		}

		for (const claim of proposal.claims) {
			insertClaim.run(
				`atlas-claim-${crypto.randomUUID()}`,
				proposal.assetId,
				claim.kind,
				claim.slug,
				claim.label,
				claim.value,
				claim.sourceText,
				claim.provenance,
				now,
				now
			);
		}

		for (const suggestion of proposal.tagSuggestions) {
			insertSuggestion.run(
				`atlas-tag-suggestion-${crypto.randomUUID()}`,
				proposal.assetId,
				suggestion.slug,
				suggestion.label,
				suggestion.sourceText,
				suggestion.provenance,
				now,
				now
			);
		}

		insertRun.run(
			`atlas-ingestion-${crypto.randomUUID()}`,
			proposal.assetId,
			proposal.source,
			proposal.sourceId,
			JSON.stringify(proposal),
			JSON.stringify(proposal.warnings),
			now
		);
	});

	apply();
}
```

- [ ] **Step 4: Run apply tests**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/ingest.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/lib/server/atlas/ingest.ts src/lib/server/atlas/ingest.spec.ts
git commit -m "Persist Atlas ingestion proposals"
```

---

### Task 5: Hook Atlas Ingestion Into Library Imports

**Files:**

- Modify: `src/lib/server/library/import.ts`
- Modify: `src/lib/server/library/library.spec.ts`

- [ ] **Step 1: Add failing import integration test**

Add this test to `src/lib/server/library/library.spec.ts` inside `describe('local library archive', () => { ... })`:

```ts
it('creates Atlas metadata records from reliable import metadata', async () => {
	const result = await importLibraryItems({
		destination_folder_id: null,
		items: [
			{
				filename: 'Picasso ref',
				storage_mode: 'url_reference',
				image_data: null,
				source_image_url: 'https://example.com/picasso.jpg',
				mime_type: 'image/jpeg',
				natural_width: 1200,
				natural_height: 900,
				source_url: 'https://www.metmuseum.org/art/collection/search/1',
				page_title: 'Picasso ref',
				alt_text: null,
				captured_at: '2026-06-05T12:00:00.000Z',
				metadata: {
					sourceId: 'met',
					sourceName: 'The Metropolitan Museum of Art',
					sourceType: 'museum',
					detailUrl: 'https://www.metmuseum.org/art/collection/search/1',
					creator: 'Pablo Picasso',
					dateDisplay: '1937',
					medium: 'Oil on canvas',
					objectName: 'Painting',
					department: 'Paintings',
					rights: 'Public domain image according to The Met.',
					tags: ['horse', 'mourning'],
					rawMetadata: { objectID: 1 }
				}
			}
		]
	});

	const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
	const entities = db.prepare('select kind, slug, label from atlas_entities order by kind').all();
	const claims = db.prepare('select kind, slug, value from atlas_claims order by kind').all();
	const suggestions = db
		.prepare('select slug, label, status from atlas_tag_suggestions order by slug')
		.all();
	const runs = db.prepare('select asset_id, source, source_id from atlas_ingestion_runs').all();
	db.close();

	expect(result.failed).toEqual([]);
	expect(entities).toEqual([
		{ kind: 'artist', slug: 'pablo_picasso', label: 'Pablo Picasso' },
		{ kind: 'source', slug: 'the_met', label: 'The Met' }
	]);
	expect(claims).toEqual([
		expect.objectContaining({ kind: 'date', slug: '1937', value: '1937' }),
		expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas', value: 'Oil on canvas' }),
		expect.objectContaining({ kind: 'rights', slug: 'public_domain', value: 'Public Domain' })
	]);
	expect(suggestions).toEqual([
		{ slug: 'horse', label: 'horse', status: 'suggested' },
		{ slug: 'mourning', label: 'mourning', status: 'suggested' }
	]);
	expect(runs).toEqual([
		{ asset_id: result.imported[0].asset_id, source: 'explore', source_id: 'met' }
	]);
});
```

- [ ] **Step 2: Run the failing integration test**

Run:

```sh
npm run test:unit -- --run src/lib/server/library/library.spec.ts
```

Expected: FAIL because `importLibraryItems` does not apply Atlas ingestion.

- [ ] **Step 3: Call Atlas ingestion from import service**

Modify imports in `src/lib/server/library/import.ts`:

```ts
import {
	applyAtlasIngestionProposal,
	createAtlasIngestionProposal
} from '$lib/server/atlas/ingest';
```

After the asset insert and lazy-download job insert inside `importOne`, add:

```ts
if (item.metadata) {
	const proposal = createAtlasIngestionProposal({
		assetId,
		source: atlasSourceForImport(item.metadata),
		sourceId: item.metadata.sourceId ?? null,
		sourceName: item.metadata.sourceName ?? null,
		detailUrl: item.metadata.detailUrl ?? null,
		creator: item.metadata.creator ?? null,
		dateDisplay: item.metadata.dateDisplay ?? null,
		medium: item.metadata.medium ?? null,
		objectName: item.metadata.objectName ?? null,
		department: item.metadata.department ?? null,
		culture: item.metadata.culture ?? null,
		period: item.metadata.period ?? null,
		rights: item.metadata.rights ?? null,
		tags: item.metadata.tags ?? [],
		rawMetadata: item.metadata.rawMetadata ?? {},
		now
	});
	applyAtlasIngestionProposal(db, proposal);
}
```

Add helper near `serializeMetadata`:

```ts
function atlasSourceForImport(metadata: NonNullable<ImportItem['metadata']>) {
	if (metadata.sourceType === 'museum' || metadata.sourceType === 'collection') return 'explore';
	if (metadata.sourceType === 'local') return 'manual';
	if (metadata.sourceType === 'web') return 'extension';
	return metadata.sourceId ? 'explore' : 'import';
}
```

If TypeScript needs a narrower return type, annotate:

```ts
function atlasSourceForImport(
	metadata: NonNullable<ImportItem['metadata']>
): 'explore' | 'extension' | 'manual' | 'import' {
```

- [ ] **Step 4: Run integration tests**

Run:

```sh
npm run test:unit -- --run src/lib/server/library/library.spec.ts src/lib/server/atlas/ingest.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/lib/server/library/import.ts src/lib/server/library/library.spec.ts
git commit -m "Run Atlas ingestion during imports"
```

---

### Task 6: Atlas Read Service

**Files:**

- Create: `src/lib/server/atlas/read.ts`
- Create: `src/lib/server/atlas/read.spec.ts`

- [ ] **Step 1: Write failing read service test**

Create `src/lib/server/atlas/read.spec.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { getAtlasAssetSummary } from './read';

describe('getAtlasAssetSummary', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-read-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns entities, claims, and source tag suggestions for an asset', async () => {
		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Atlas read ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/read.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/read',
					page_title: 'Atlas read ref',
					alt_text: null,
					captured_at: '2026-06-05T12:00:00.000Z',
					metadata: {
						sourceId: 'met',
						sourceName: 'The Metropolitan Museum of Art',
						sourceType: 'museum',
						detailUrl: 'https://example.com/read',
						creator: 'Pablo Picasso',
						dateDisplay: '1937',
						medium: 'Oil on canvas',
						rights: 'Public domain image according to The Met.',
						tags: ['horse']
					}
				}
			]
		});

		const summary = getAtlasAssetSummary(result.imported[0].asset_id);

		expect(summary).toMatchObject({
			assetId: result.imported[0].asset_id,
			entities: [
				expect.objectContaining({ kind: 'artist', slug: 'pablo_picasso' }),
				expect.objectContaining({ kind: 'source', slug: 'the_met' })
			],
			claims: [
				expect.objectContaining({ kind: 'date', slug: '1937' }),
				expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas' }),
				expect.objectContaining({ kind: 'rights', slug: 'public_domain' })
			],
			tagSuggestions: [expect.objectContaining({ slug: 'horse', status: 'suggested' })]
		});
	});
});
```

- [ ] **Step 2: Run the failing read test**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/read.spec.ts
```

Expected: FAIL because `getAtlasAssetSummary` does not exist.

- [ ] **Step 3: Add read service**

Create `src/lib/server/atlas/read.ts`:

```ts
import { openLibraryDatabase } from '$lib/server/library/schema';
import type { AtlasAssetSummary } from '$lib/atlas/types';

type EntityRow = {
	id: string;
	kind: AtlasAssetSummary['entities'][number]['kind'];
	slug: string;
	label: string;
	source_text: string | null;
	provenance: string;
};

type ClaimRow = {
	id: string;
	kind: AtlasAssetSummary['claims'][number]['kind'];
	slug: string;
	label: string;
	value: string;
	source_text: string;
	provenance: string;
};

type SuggestionRow = {
	id: string;
	slug: string;
	label: string;
	source_text: string;
	provenance: string;
	status: 'suggested';
};

export function getAtlasAssetSummary(assetId: string): AtlasAssetSummary {
	const db = openLibraryDatabase();
	try {
		const entities = db
			.prepare(
				`select
					atlas_entities.id,
					atlas_entities.kind,
					atlas_entities.slug,
					atlas_entities.label,
					null as source_text,
					atlas_asset_entities.provenance
				 from atlas_asset_entities
				 join atlas_entities on atlas_entities.id = atlas_asset_entities.entity_id
				 where atlas_asset_entities.asset_id = ?
				 order by atlas_entities.kind, atlas_entities.label`
			)
			.all(assetId) as EntityRow[];
		const claims = db
			.prepare(
				`select id, kind, slug, label, value, source_text, provenance
				 from atlas_claims
				 where asset_id = ?
				 order by kind, label`
			)
			.all(assetId) as ClaimRow[];
		const tagSuggestions = db
			.prepare(
				`select id, slug, label, source_text, provenance, status
				 from atlas_tag_suggestions
				 where asset_id = ?
				 order by label`
			)
			.all(assetId) as SuggestionRow[];

		return {
			assetId,
			entities: entities.map((row) => ({
				id: row.id,
				kind: row.kind,
				slug: row.slug,
				label: row.label,
				sourceText: row.source_text ?? row.label,
				provenance: row.provenance
			})),
			claims: claims.map((row) => ({
				id: row.id,
				kind: row.kind,
				slug: row.slug,
				label: row.label,
				value: row.value,
				sourceText: row.source_text,
				provenance: row.provenance
			})),
			tagSuggestions: tagSuggestions.map((row) => ({
				id: row.id,
				slug: row.slug,
				label: row.label,
				sourceText: row.source_text,
				provenance: row.provenance,
				status: row.status
			}))
		};
	} finally {
		db.close();
	}
}
```

- [ ] **Step 4: Run read tests**

Run:

```sh
npm run test:unit -- --run src/lib/server/atlas/read.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/lib/server/atlas/read.ts src/lib/server/atlas/read.spec.ts
git commit -m "Add Atlas asset read service"
```

---

### Task 7: Explore Save Regression Coverage

**Files:**

- Modify: `src/routes/api/library/save-explore/server.spec.ts`

- [ ] **Step 1: Add failing Explore save Atlas test**

Add this test to `src/routes/api/library/save-explore/server.spec.ts`:

```ts
it('normalizes safe Explore metadata into Atlas records while keeping source tags suggested', async () => {
	getById.mockResolvedValue({
		...sampleItem,
		title: 'Picasso metadata study',
		artistRaw: 'Pablo Picasso',
		dateDisplay: '1937',
		medium: 'Oil on canvas',
		objectName: 'Painting',
		department: 'Paintings',
		description: 'Public domain image according to The Met.',
		tags: ['horse', 'mourning']
	});
	const { POST } = await import('./+server');
	const { getLibrarySnapshot } = await import('$lib/server/library/read');
	const { getAtlasAssetSummary } = await import('$lib/server/atlas/read');

	const response = await POST({
		request: new Request('http://localhost/api/library/save-explore', {
			method: 'POST',
			body: JSON.stringify({ item_id: 'met-1', destination_folder_id: null })
		})
	});
	const snapshot = getLibrarySnapshot();
	const summary = getAtlasAssetSummary(snapshot.assets[0].id);

	expect(response.status).toBe(200);
	expect(summary.entities).toEqual([
		expect.objectContaining({ kind: 'artist', slug: 'pablo_picasso' }),
		expect.objectContaining({ kind: 'source', slug: 'the_met' })
	]);
	expect(summary.claims).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ kind: 'date', slug: '1937' }),
			expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas' }),
			expect.objectContaining({ kind: 'rights', slug: 'public_domain' })
		])
	);
	expect(summary.tagSuggestions).toEqual([
		expect.objectContaining({ slug: 'horse', status: 'suggested' }),
		expect.objectContaining({ slug: 'mourning', status: 'suggested' })
	]);
	expect(snapshot.assets[0].tags).toEqual([]);
});
```

- [ ] **Step 2: Run the Explore save test**

Run:

```sh
npm run test:unit -- --run src/routes/api/library/save-explore/server.spec.ts
```

Expected: PASS if prior tasks are correct. If it fails because source label maps to `The Met` rather than `The Metropolitan Museum of Art`, keep expected normalized slug `the_met`.

- [ ] **Step 3: Commit**

```sh
git add src/routes/api/library/save-explore/server.spec.ts
git commit -m "Cover Atlas ingestion for Explore saves"
```

---

### Task 8: Final Verification and README Note

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add a short README note**

In `README.md`, under `## Atlas Direction`, add:

```md
The first implementation layer is deterministic Atlas ingestion: imported source metadata such as creator, institution, source, rights, date, and medium is normalized into typed Atlas entities and claims, while source tags stay as suggestions until reviewed.
```

- [ ] **Step 2: Run full verification**

Run:

```sh
npm run check
npm run test:unit -- --run
npm run build
```

Expected:

- `svelte-check found 0 errors and 0 warnings`
- all Vitest test files pass
- Vite build exits 0

- [ ] **Step 3: Commit README and any final fixes**

```sh
git add README.md
git commit -m "Document Atlas ingestion foundation"
```

If prior implementation changes remain unstaged because a test fix was needed, include only the files changed by that fix and use a commit message that describes the fix.

---

## Self-Review Checklist

Before execution is considered ready:

- [ ] Atlas schema is created by `openLibraryDatabase()` with no separate database.
- [ ] Existing Library tags and tag facets still work.
- [ ] Imports without metadata still succeed and create no Atlas records.
- [ ] Imports with metadata create approved source-backed entities and claims.
- [ ] Source/API tags become `suggested`, not approved visual tags.
- [ ] Public domain rights normalize to `public_domain`.
- [ ] `Pablo Picasso` normalizes to `pablo_picasso`.
- [ ] `The Metropolitan Museum of Art` normalizes to `the_met`.
- [ ] `Oil on canvas` normalizes to `oil_on_canvas`.
- [ ] The implementation does not add UI.
- [ ] Full verification commands pass.
