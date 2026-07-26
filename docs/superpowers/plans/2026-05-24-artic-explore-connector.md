# Art Institute Explore Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Art Institute of Chicago as the second Explore source while keeping Met stable, cache-aware, and rate-limit-safe.

**Architecture:** Keep all source API calls server-side through the existing connector interface. Make routes source-aware first, then add an `artic` connector that normalizes Art Institute records into `ExploreItem`, including IIIF thumb/full image URLs. Keep the UI mostly single-source until the connector is proven, then expose source labels and source selection without introducing full unified search yet.

**Tech Stack:** SvelteKit server routes, TypeScript, Vitest, Playwright, Art Institute of Chicago public API, IIIF Image API 2.0, existing `ServerCache`, existing IndexedDB client cache via `idb-keyval`.

**References:** Art Institute API docs: https://api.artic.edu/docs/. The docs confirm `/api/v1/artworks/search`, `fields`, `image_id`, and IIIF URL construction via `config.iiif_url`.

---

## File Structure

- Modify `src/lib/explore/types.ts`: add `artic` to `SourceId`, keep `tag` support, add any source summary type only if the UI task needs it.
- Modify `src/lib/explore/connectors/index.ts`: register Met and Art Institute connectors and add helper functions for resolving a connector from an item id prefix.
- Create `src/lib/explore/connectors/artic.ts`: Art Institute connector, field mapping, search URL building, IIIF URL construction from API config.
- Create `src/lib/explore/connectors/artic.spec.ts`: Art Institute URL, mapping, pagination, cache, and malformed-record tests.
- Create `src/lib/explore/iiif.ts`: small helpers for IIIF base/thumb/full URL construction.
- Create `src/lib/explore/iiif.spec.ts`: deterministic IIIF URL tests.
- Modify `src/routes/explore/api/search/+server.ts`: accept source-aware search bodies while preserving existing Met-compatible body shape during transition.
- Modify `src/routes/explore/api/item/[id]/+server.ts`: route item lookups by id prefix.
- Modify `src/routes/explore/api/departments/+server.ts`: return departments for a requested source, defaulting to Met for compatibility.
- Modify `src/lib/components/explore/ExploreWorkspace.svelte`: add source state and call source-aware routes.
- Modify `src/lib/components/explore/ExploreCard.svelte`: make source label visible and source-specific once more than one source exists.
- Modify `tests/pastiche.e2e.ts`: cover Art Institute source search/browse smoke flow.

---

### Task 1: Source-Aware Registry

**Files:**

- Modify: `src/lib/explore/types.ts`
- Modify: `src/lib/explore/connectors/index.ts`
- Test: `src/lib/explore/connectors/index.spec.ts`

- [ ] **Step 1: Write the failing registry tests**

```ts
import { describe, expect, it } from 'vitest';
import { getExploreConnector, getExploreConnectorForItemId, isSourceId } from './index';

describe('Explore connector registry', () => {
	it('recognizes supported source ids', () => {
		expect(isSourceId('met')).toBe(true);
		expect(isSourceId('artic')).toBe(true);
		expect(isSourceId('wikiart')).toBe(false);
	});

	it('resolves connectors by source id and namespaced item id', () => {
		expect(getExploreConnector('met').id).toBe('met');
		expect(getExploreConnector('artic').id).toBe('artic');
		expect(getExploreConnectorForItemId('met-437133').id).toBe('met');
		expect(getExploreConnectorForItemId('artic-27992').id).toBe('artic');
	});

	it('rejects invalid namespaced item ids', () => {
		expect(() => getExploreConnectorForItemId('nope-1')).toThrow('Unsupported Explore source');
		expect(() => getExploreConnectorForItemId('badid')).toThrow('Invalid Explore item id');
	});
});
```

- [ ] **Step 2: Run the registry test and verify it fails**

Run: `npm run test:unit -- --run src/lib/explore/connectors/index.spec.ts`

Expected: FAIL because `artic`, `isSourceId`, and `getExploreConnectorForItemId` are not implemented.

- [ ] **Step 3: Update shared source types**

In `src/lib/explore/types.ts`, update:

```ts
export type SourceId = 'met' | 'artic';
```

- [ ] **Step 4: Implement registry helpers**

In `src/lib/explore/connectors/index.ts`, use this shape:

```ts
import type { SourceConnector, SourceId } from '../types';
import { metConnector } from './met';
import { articConnector } from './artic';

const connectors: Record<SourceId, SourceConnector> = {
	met: metConnector,
	artic: articConnector
};

export function isSourceId(value: string): value is SourceId {
	return value === 'met' || value === 'artic';
}

export function getExploreConnector(source: SourceId = 'met'): SourceConnector {
	return connectors[source];
}

export function getExploreConnectorForItemId(id: string): SourceConnector {
	const [source] = id.split('-', 1);
	if (!source || source === id) throw new Error(`Invalid Explore item id: ${id}`);
	if (!isSourceId(source)) throw new Error(`Unsupported Explore source: ${source}`);
	return getExploreConnector(source);
}
```

Create a temporary `src/lib/explore/connectors/artic.ts` stub so the registry compiles:

```ts
import type { SourceConnector } from '../types';

export const articConnector: SourceConnector = {
	id: 'artic',
	displayName: 'Art Institute of Chicago',
	supportedFilters: [
		'keyword',
		'artist',
		'tag',
		'year_range',
		'medium',
		'department',
		'public_domain',
		'has_image'
	],
	async getDepartments() {
		return [];
	},
	async search() {
		return { items: [], total: 0, nextCursor: null };
	},
	async getById(id: string) {
		throw new Error(`Art Institute connector not implemented: ${id}`);
	}
};
```

- [ ] **Step 5: Verify the registry test passes**

Run: `npm run test:unit -- --run src/lib/explore/connectors/index.spec.ts`

Expected: PASS.

---

### Task 2: IIIF Helpers

**Files:**

- Create: `src/lib/explore/iiif.ts`
- Test: `src/lib/explore/iiif.spec.ts`

- [ ] **Step 1: Write the failing IIIF tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildIiifImageUrl, normalizeIiifBaseUrl } from './iiif';

describe('IIIF helpers', () => {
	it('normalizes an IIIF base URL without trailing slash', () => {
		expect(normalizeIiifBaseUrl('https://www.artic.edu/iiif/2/abc123/')).toBe(
			'https://www.artic.edu/iiif/2/abc123'
		);
	});

	it('builds sized IIIF image URLs', () => {
		expect(buildIiifImageUrl('https://www.artic.edu/iiif/2/abc123', '400,')).toBe(
			'https://www.artic.edu/iiif/2/abc123/full/400,/0/default.jpg'
		);
	});
});
```

- [ ] **Step 2: Run the IIIF test and verify it fails**

Run: `npm run test:unit -- --run src/lib/explore/iiif.spec.ts`

Expected: FAIL because `iiif.ts` does not exist.

- [ ] **Step 3: Implement the helper**

```ts
export function normalizeIiifBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

export function buildIiifImageUrl(baseUrl: string, size: string): string {
	return `${normalizeIiifBaseUrl(baseUrl)}/full/${size}/0/default.jpg`;
}
```

- [ ] **Step 4: Verify the IIIF test passes**

Run: `npm run test:unit -- --run src/lib/explore/iiif.spec.ts`

Expected: PASS.

---

### Task 3: Art Institute Connector Mapping

**Files:**

- Modify: `src/lib/explore/connectors/artic.ts`
- Test: `src/lib/explore/connectors/artic.spec.ts`

- [ ] **Step 1: Write failing mapping tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildArticIiifBaseUrl, normalizeArticArtwork, parseArticNativeId } from './artic';

const baseArtwork = {
	id: 27992,
	title: 'A Sunday on La Grande Jatte',
	artist_display: 'Georges Seurat\\nFrench, 1859-1891',
	date_display: '1884-86',
	date_start: 1884,
	date_end: 1886,
	medium_display: 'Oil on canvas',
	artwork_type_title: 'Painting',
	department_title: 'Painting and Sculpture of Europe',
	place_of_origin: 'France',
	style_title: 'Post-Impressionism',
	image_id: 'abc123',
	alt_image_ids: ['alt456'],
	api_link: 'https://api.artic.edu/api/v1/artworks/27992',
	web_url: 'https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte',
	is_public_domain: true,
	is_boosted: true,
	category_titles: ['Painting'],
	term_titles: ['Figures', 'Landscape'],
	classification_titles: ['painting'],
	subject_titles: ['Parks']
};

describe('Art Institute connector helpers', () => {
	it('parses namespaced Art Institute ids', () => {
		expect(parseArticNativeId('artic-27992')).toBe(27992);
		expect(parseArticNativeId('27992')).toBe(27992);
		expect(parseArticNativeId('met-27992')).toBeNull();
	});

	it('builds IIIF base URLs from config and image id', () => {
		expect(buildArticIiifBaseUrl('https://www.artic.edu/iiif/2', 'abc123')).toBe(
			'https://www.artic.edu/iiif/2/abc123'
		);
	});

	it('normalizes complete Art Institute records', () => {
		const item = normalizeArticArtwork(baseArtwork, 'https://www.artic.edu/iiif/2');
		expect(item).toMatchObject({
			id: 'artic-27992',
			source: 'artic',
			title: 'A Sunday on La Grande Jatte',
			artistRaw: 'Georges Seurat',
			artistBio: 'French, 1859-1891',
			dateDisplay: '1884-86',
			yearStart: 1884,
			yearEnd: 1886,
			medium: 'Oil on canvas',
			mediumCategory: 'oil',
			objectName: 'Painting',
			department: 'Painting and Sculpture of Europe',
			culture: 'France',
			period: 'Post-Impressionism',
			thumbUrl: 'https://www.artic.edu/iiif/2/abc123/full/400,/0/default.jpg',
			imageUrl: 'https://www.artic.edu/iiif/2/abc123',
			additionalImages: ['https://www.artic.edu/iiif/2/alt456'],
			isIIIF: true,
			tags: ['Painting', 'Figures', 'Landscape', 'painting', 'Parks'],
			isHighlight: true,
			isPublicDomain: true
		});
	});

	it('skips records without image ids', () => {
		expect(
			normalizeArticArtwork({ ...baseArtwork, image_id: null }, 'https://www.artic.edu/iiif/2')
		).toBeNull();
	});
});
```

- [ ] **Step 2: Run the mapping tests and verify they fail**

Run: `npm run test:unit -- --run src/lib/explore/connectors/artic.spec.ts`

Expected: FAIL because helpers are not implemented.

- [ ] **Step 3: Implement the mapping helpers**

Implement Art Institute helper functions with explicit unknown-safe parsing:

```ts
import type { ExploreItem, SourceConnector } from '../types';
import { buildIiifImageUrl, normalizeIiifBaseUrl } from '../iiif';
import { normalizeMedium } from '../medium';

export function parseArticNativeId(id: string): number | null {
	const raw = id.startsWith('artic-') ? id.slice(6) : id;
	if (!/^\d+$/.test(raw)) return null;
	return Number(raw);
}

export function buildArticIiifBaseUrl(iiifUrl: string, imageId: string): string {
	return `${normalizeIiifBaseUrl(iiifUrl)}/${imageId}`;
}

export function normalizeArticArtwork(
	object: Record<string, unknown>,
	iiifUrl: string
): ExploreItem | null {
	const id = numberOrNull(object.id);
	const imageId = stringOrNull(object.image_id);
	if (id === null || !imageId) return null;

	const artistParts = splitArtistDisplay(stringOrNull(object.artist_display));
	const baseUrl = buildArticIiifBaseUrl(iiifUrl, imageId);
	const altImageIds = stringArray(object.alt_image_ids);
	const medium = stringOrNull(object.medium_display);

	return {
		id: `artic-${id}`,
		source: 'artic',
		detailUrl: stringOrNull(object.web_url) ?? `https://www.artic.edu/artworks/${id}`,
		title: stringOrNull(object.title) ?? 'Untitled',
		artistRaw: artistParts.name,
		artistBio: artistParts.bio,
		artistNationality: null,
		dateDisplay: stringOrNull(object.date_display),
		yearStart: numberOrNull(object.date_start),
		yearEnd: numberOrNull(object.date_end),
		medium,
		mediumCategory: normalizeMedium(medium),
		objectName: stringOrNull(object.artwork_type_title),
		department: stringOrNull(object.department_title),
		culture: stringOrNull(object.place_of_origin),
		period: stringOrNull(object.style_title),
		thumbUrl: buildIiifImageUrl(baseUrl, '400,'),
		imageUrl: baseUrl,
		additionalImages: altImageIds.map((altId) => buildArticIiifBaseUrl(iiifUrl, altId)),
		isIIIF: true,
		description: stringOrNull(object.description),
		tags: uniqueStrings([
			...stringArray(object.category_titles),
			...stringArray(object.term_titles),
			...stringArray(object.classification_titles),
			...stringArray(object.subject_titles)
		]),
		isHighlight: Boolean(object.is_boosted),
		isPublicDomain: booleanOrNull(object.is_public_domain),
		rawMetadata: {
			api_link: object.api_link,
			image_id: object.image_id,
			alt_image_ids: object.alt_image_ids,
			thumbnail: object.thumbnail,
			artist_id: object.artist_id,
			style_id: object.style_id
		}
	};
}

function splitArtistDisplay(value: string | null): { name: string | null; bio: string | null } {
	if (!value) return { name: null, bio: null };
	const [name, ...bioParts] = value
		.split('\n')
		.map((part) => part.trim())
		.filter(Boolean);
	return { name: name ?? null, bio: bioParts.join(', ') || null };
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
		: [];
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values)];
}
```

- [ ] **Step 4: Verify mapping tests pass**

Run: `npm run test:unit -- --run src/lib/explore/connectors/artic.spec.ts`

Expected: PASS for helper tests.

---

### Task 4: Art Institute Search And Detail

**Files:**

- Modify: `src/lib/explore/connectors/artic.ts`
- Test: `src/lib/explore/connectors/artic.spec.ts`

- [ ] **Step 1: Add failing search/detail tests**

Append tests that mock `fetch`:

```ts
it('searches Art Institute artworks with image and public domain filters', async () => {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = new URL(input.toString());
		if (url.pathname.endsWith('/artworks/search')) {
			expect(url.searchParams.get('q')).toBe('seurat');
			expect(url.searchParams.get('fields')).toContain('image_id');
			expect(url.searchParams.get('query[exists][field]')).toBe('image_id');
			expect(url.searchParams.get('query[term][is_public_domain]')).toBe('true');
			return Response.json({
				config: { iiif_url: 'https://www.artic.edu/iiif/2' },
				pagination: { total: 1, current_page: 1, total_pages: 1 },
				data: [baseArtwork]
			});
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});

	const connector = createArticConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
	const page = await connector.search({ keyword: 'seurat', publicDomainOnly: true, limit: 20 });

	expect(page.items.map((item) => item.id)).toEqual(['artic-27992']);
	expect(page.total).toBe(1);
	expect(page.nextCursor).toBeNull();
});

it('loads one Art Institute artwork by id', async () => {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = new URL(input.toString());
		if (url.pathname.endsWith('/artworks/27992')) {
			return Response.json({
				config: { iiif_url: 'https://www.artic.edu/iiif/2' },
				data: baseArtwork
			});
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});

	const connector = createArticConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
	const item = await connector.getById('artic-27992');

	expect(item.id).toBe('artic-27992');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:unit -- --run src/lib/explore/connectors/artic.spec.ts`

Expected: FAIL because `createArticConnector` and network behavior are incomplete.

- [ ] **Step 3: Implement connector search/detail**

Use:

```ts
const ARTIC_BASE_URL = 'https://api.artic.edu/api/v1';
const DEFAULT_LIMIT = 20;
const ARTIC_FIELDS = [
	'id',
	'title',
	'artist_display',
	'date_display',
	'date_start',
	'date_end',
	'medium_display',
	'artwork_type_title',
	'department_title',
	'place_of_origin',
	'style_title',
	'image_id',
	'alt_image_ids',
	'api_link',
	'web_url',
	'is_public_domain',
	'is_boosted',
	'category_titles',
	'term_titles',
	'classification_titles',
	'subject_titles',
	'description',
	'thumbnail'
].join(',');
```

Build `/artworks/search` with:

- `q` from `query.tag || query.artist || query.keyword || '*'`
- `limit`
- `page` from cursor, default `1`
- `fields`
- `query[exists][field]=image_id` unless `hasImageOnly === false`
- `query[term][is_public_domain]=true` when `publicDomainOnly`

Return `nextCursor = String(current_page + 1)` when `current_page < total_pages`, else `null`.

- [ ] **Step 4: Add server cache use**

Wrap search and detail calls:

```ts
cache.getOrFetch(`artic:search:${url.search}`, SERVER_SEARCH_TTL_MS, () => articJson<ArticSearchResponse>(url))
cache.getOrFetch(`artic:object:${nativeId}`, SERVER_OBJECT_TTL_MS, async () => normalizeArticArtwork(...))
```

- [ ] **Step 5: Verify connector tests pass**

Run: `npm run test:unit -- --run src/lib/explore/connectors/artic.spec.ts`

Expected: PASS.

---

### Task 5: Source-Aware Routes

**Files:**

- Modify: `src/routes/explore/api/search/+server.ts`
- Modify: `src/routes/explore/api/item/[id]/+server.ts`
- Modify: `src/routes/explore/api/departments/+server.ts`
- Test: existing route specs plus new source cases

- [ ] **Step 1: Add failing route tests**

Update `src/routes/explore/api/search/server.spec.ts` to assert:

```ts
const search = vi.fn();
const searchArtic = vi.fn();

vi.mock('$lib/explore/connectors', () => ({
	getExploreConnector: (source = 'met') =>
		source === 'artic' ? { search: searchArtic } : { search }
}));

it('routes source-aware search requests to the requested connector', async () => {
	searchArtic.mockResolvedValue({ items: [], total: 0, nextCursor: null });
	const { POST } = await import('./+server');

	const response = await POST({
		request: new Request('http://localhost/explore/api/search', {
			method: 'POST',
			body: JSON.stringify({ source: 'artic', query: { keyword: 'seurat', limit: 20 } })
		})
	});

	expect(response.status).toBe(200);
	expect(searchArtic).toHaveBeenCalledWith({ keyword: 'seurat', limit: 20 });
});
```

- [ ] **Step 2: Run route tests and verify failure**

Run: `npm run test:unit -- --run src/routes/explore/api/search/server.spec.ts src/routes/explore/api/item/[id]/server.spec.ts src/routes/explore/api/departments/server.spec.ts`

Expected: FAIL because routes are Met-only.

- [ ] **Step 3: Implement source-aware request parsing**

Accept both legacy and new body shapes:

```ts
type ExploreSearchBody =
	| ExploreQuery
	| {
			source?: SourceId;
			query: ExploreQuery;
	  };
```

If `body.query` exists, use `body.source ?? 'met'` and `body.query`; otherwise use source `met` and the legacy body.

- [ ] **Step 4: Update item route**

Use:

```ts
const item = await getExploreConnectorForItemId(params.id).getById(params.id);
```

- [ ] **Step 5: Update departments route**

Parse `new URL(request.url).searchParams.get('source')`, default to `met`, validate with `isSourceId`, and call that connector's `getDepartments()`.

- [ ] **Step 6: Verify route tests pass**

Run: `npm run test:unit -- --run src/routes/explore/api/search/server.spec.ts src/routes/explore/api/item/[id]/server.spec.ts src/routes/explore/api/departments/server.spec.ts`

Expected: PASS.

---

### Task 6: Minimal Source Selection UI

**Files:**

- Modify: `src/lib/components/explore/ExploreWorkspace.svelte`
- Modify: `src/lib/components/explore/ExploreCard.svelte`
- Modify: `tests/pastiche.e2e.ts`

- [ ] **Step 1: Add failing E2E source selection expectations**

In `tests/pastiche.e2e.ts`, extend the mock search route to inspect `postDataJSON().source`. Add:

```ts
await page.getByRole('button', { name: 'Art Institute of Chicago' }).click();
await expect(page.getByRole('button', { name: /Inspect Art Institute Study/ })).toBeVisible();
await expect(page.getByText('Art Institute of Chicago')).toBeVisible();
```

- [ ] **Step 2: Run focused E2E and verify failure**

Run: `npm run test:e2e -- --grep "desktop library"`

Expected: FAIL because there is no source selection UI.

- [ ] **Step 3: Add source state and source buttons**

In `ExploreWorkspace.svelte`, add:

```ts
let activeSource = $state<SourceId>('met');
const sources = [
	{ id: 'met' as const, label: 'The Met' },
	{ id: 'artic' as const, label: 'Art Institute of Chicago' }
];
```

Render source buttons near the department strip. When clicked, set `activeSource`, clear source-specific department, and allow current committed search to re-run.

- [ ] **Step 4: Send source-aware search bodies**

Change client fetch body to:

```ts
body: JSON.stringify({ source: activeSource, query });
```

Change cache key calls to use `activeSource` instead of hardcoded `'met'`.

- [ ] **Step 5: Make card source label visible and source-specific**

Pass `item.source` to the existing label and display:

```svelte
<span class="source">{item.source === 'artic' ? 'Art Institute' : 'The Met'}</span>
```

For multi-source readiness, remove default opacity hiding from `.source`; keep hover-only metadata for titles/details.

- [ ] **Step 6: Verify focused E2E passes**

Run: `npm run test:e2e -- --grep "desktop library"`

Expected: PASS.

---

### Task 7: Final Verification And Cleanup

**Files:**

- Review all changed files
- Update `agent-guidelines-explore2.md` only if implementation discovers a correction

- [ ] **Step 1: Run full Svelte check**

Run: `npm run check`

Expected: `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 2: Run full unit suite**

Run: `npm run test:unit -- --run`

Expected: all unit tests pass.

- [ ] **Step 3: Run full E2E suite**

Run: `npm run test:e2e`

Expected: all Playwright tests pass. The existing host dependency warning is acceptable if tests still pass.

- [ ] **Step 4: Manual smoke in the in-app browser**

Use the current local app URL. Verify:

- Met default browse still loads.
- Typing does not search until Enter or the in-field search button.
- Selecting Art Institute loads Art Institute results.
- Art Institute cards show IIIF thumbnails.
- Clicking an Art Institute card opens the inspector with image, source link, metadata, and disabled storage action.
- Returning to Met still works.

- [ ] **Step 5: Commit**

```bash
git add src/lib/explore src/routes/explore src/lib/components/explore tests/pastiche.e2e.ts agent-guidelines-explore2.md
git commit -m "feat: add Art Institute explore source"
```

---

## Self-Review

- Spec coverage: This plan covers source-aware connector registry, Art Institute connector, IIIF URL helpers, source-aware routes, minimal source UI, card source labels, caching reuse, and verification. It intentionally defers Rijksmuseum, Cleveland, Europeana, OpenSeadragon, full source browser, and unified interleaved search until Art Institute is stable.
- Placeholder scan: No `TBD`, `TODO`, or vague implementation-only steps remain.
- Type consistency: `SourceId`, `ExploreQuery`, `ExploreItem`, `SourceConnector`, and cache key usage match the current Explore architecture and the updated v2 guidelines.
