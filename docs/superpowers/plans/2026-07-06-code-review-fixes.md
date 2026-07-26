# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the highest-impact code review findings: local API trust boundaries, import atomicity, image size limits, inefficient single-asset reads, repo formatting drift, and large app chunk follow-up.

**Architecture:** Add a shared local API protection layer for localhost/extension routes, then harden import write semantics and resource limits inside the server library service. After correctness/security work, add focused read APIs for single-asset Atlas views, then clean up verification and performance hygiene.

**Tech Stack:** SvelteKit route handlers, TypeScript, Vitest, better-sqlite3 transactions, Node filesystem APIs, Sharp, Prettier, Vite/SvelteKit build.

---

## File Structure

- Create `src/routes/api/localAccess.ts`: shared helpers for trusted local API CORS/preflight and write authorization.
- Modify `src/routes/api/cors.ts`: either remove after migration or make it a compatibility wrapper around `localAccess.ts`.
- Modify route tests under `src/routes/api/**/server.spec.ts`: update expectations from wildcard CORS to trusted-origin behavior.
- Modify `src/routes/api/import/+server.ts`: enforce trusted write access and request-level import limits before invoking the importer.
- Modify `src/lib/server/library/import.ts`: add item-level transactions, temp-file writes, cleanup, and decoded image limits.
- Modify `src/lib/server/library/import.spec.ts` or `src/lib/server/library/library.spec.ts`: cover rollback and cleanup behavior.
- Modify `src/routes/api/library/save-explore/+server.ts`: add remote image response limits.
- Modify `src/lib/server/library/read.ts`: add single-asset read helpers and avoid full snapshot work for Atlas single-asset routes.
- Modify `src/routes/api/library/assets/[id]/atlas/+server.ts`: use single-asset helpers instead of `getLibrarySnapshot()`.
- Modify `package.json`, `.prettierignore`, or formatted files: resolve current `npm run lint` failure.
- Optionally modify app route/component imports after correctness work: dynamically split major UI surfaces if the large chunk is worth tackling now.

---

### Task 1: Add A Shared Trusted Local API Guard

**Files:**

- Create: `src/routes/api/localAccess.ts`
- Modify: `src/routes/api/cors.ts`
- Test: `src/routes/api/import/server.spec.ts`
- Test: `src/routes/api/library/server.spec.ts`

- [ ] **Step 1: Write failing CORS and write-guard tests for `/api/import`**

Add these cases to `src/routes/api/import/server.spec.ts`:

```ts
it('allows trusted extension preflight requests', async () => {
	const { OPTIONS } = await import('./+server');

	const response = await OPTIONS({
		request: new Request('http://localhost/api/import', {
			method: 'OPTIONS',
			headers: {
				origin: 'chrome-extension://pastiche-test',
				'access-control-request-method': 'POST'
			}
		})
	});

	expect(response.status).toBe(204);
	expect(response.headers.get('access-control-allow-origin')).toBe(
		'chrome-extension://pastiche-test'
	);
	expect(response.headers.get('vary')).toContain('Origin');
});

it('rejects untrusted browser writes before parsing import payloads', async () => {
	const { POST } = await import('./+server');

	const response = await POST({
		request: new Request('http://localhost/api/import', {
			method: 'POST',
			headers: {
				origin: 'https://hostile.example',
				'content-type': 'application/json'
			},
			body: JSON.stringify({ destination_folder_id: null, items: [] })
		})
	});

	expect(response.status).toBe(403);
	await expect(response.json()).resolves.toEqual({ error: 'Untrusted local API origin' });
});
```

- [ ] **Step 2: Write failing read-origin test for `/api/library`**

Update the existing CORS expectation in `src/routes/api/library/server.spec.ts` and add an untrusted-origin case:

```ts
expect(response.headers.get('access-control-allow-origin')).toBeNull();
```

```ts
it('does not expose the full library snapshot to untrusted cross-origin browsers', async () => {
	const { GET } = await import('./+server');

	const response = await GET({
		request: new Request('http://localhost/api/library', {
			headers: { origin: 'https://hostile.example' }
		})
	});

	expect(response.status).toBe(403);
	await expect(response.json()).resolves.toEqual({ error: 'Untrusted local API origin' });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
npm run test:unit -- --run src/routes/api/import/server.spec.ts src/routes/api/library/server.spec.ts
```

Expected: tests fail because `OPTIONS` currently accepts no request argument, wildcard CORS is returned, and untrusted origins are accepted.

- [ ] **Step 4: Implement `localAccess.ts`**

Create `src/routes/api/localAccess.ts`:

```ts
const TRUSTED_EXTENSION_ORIGIN = /^(chrome-extension|moz-extension):\/\/[a-z0-9_-]+$/i;
const TRUSTED_LOCAL_ORIGINS = new Set([
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'http://localhost:4173',
	'http://127.0.0.1:4173'
]);

export type LocalAccessDecision =
	| { ok: true; headers: HeadersInit }
	| { ok: false; response: Response };

export function trustedLocalCorsHeaders(request: Request): HeadersInit {
	const origin = request.headers.get('origin');
	if (!origin || !isTrustedLocalOrigin(origin)) return {};
	return {
		'access-control-allow-origin': origin,
		'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
		'access-control-allow-headers': 'Content-Type, X-Pastiche-Local-Client',
		vary: 'Origin'
	};
}

export function trustedLocalPreflight(request: Request) {
	const decision = requireTrustedLocalAccess(request);
	if (!decision.ok) return decision.response;
	return new Response(null, { status: 204, headers: decision.headers });
}

export function requireTrustedLocalAccess(request: Request): LocalAccessDecision {
	const origin = request.headers.get('origin');
	if (!origin) return { ok: true, headers: {} };
	if (!isTrustedLocalOrigin(origin)) {
		return {
			ok: false,
			response: Response.json({ error: 'Untrusted local API origin' }, { status: 403 })
		};
	}
	return { ok: true, headers: trustedLocalCorsHeaders(request) };
}

function isTrustedLocalOrigin(origin: string) {
	if (TRUSTED_LOCAL_ORIGINS.has(origin)) return true;
	if (TRUSTED_EXTENSION_ORIGIN.test(origin)) return true;
	return false;
}
```

- [ ] **Step 5: Convert `/api/import` to the guard**

Modify `src/routes/api/import/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { importLibraryItems } from '$lib/server/library/import';
import type { ImportRequest } from '$lib/server/library/types';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../localAccess';

export function OPTIONS({ request }: { request: Request }) {
	return trustedLocalPreflight(request);
}

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	const body = await readJson(request);
	if (!isImportRequest(body)) {
		return json({ error: 'Invalid import request' }, { status: 400, headers: access.headers });
	}

	try {
		return json(await importLibraryItems(body), { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Import failed' },
			{ status: 400, headers: access.headers }
		);
	}
}
```

- [ ] **Step 6: Convert `/api/library` read route**

Modify `src/routes/api/library/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { requireTrustedLocalAccess } from '../localAccess';

export function GET({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	if (process.env.PASTICHE_MOCK_LIBRARY_FALLBACK === '1') {
		return json(mockLibrarySnapshot(), { headers: access.headers });
	}
	const snapshot = getLibrarySnapshot();
	return json(snapshot, { headers: access.headers });
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm run test:unit -- --run src/routes/api/import/server.spec.ts src/routes/api/library/server.spec.ts
```

Expected: all tests pass after updating existing test calls to include `request` where needed.

- [ ] **Step 8: Commit**

```bash
git add src/routes/api/localAccess.ts src/routes/api/cors.ts src/routes/api/import/+server.ts src/routes/api/library/+server.ts src/routes/api/import/server.spec.ts src/routes/api/library/server.spec.ts
git commit -m "fix: restrict local api origins"
```

---

### Task 2: Apply The Local API Guard To All Write-Capable Routes

**Files:**

- Modify: `src/routes/api/library/assets/[id]/+server.ts`
- Modify: `src/routes/api/library/assets/[id]/atlas/+server.ts`
- Modify: `src/routes/api/library/save-explore/+server.ts`
- Modify: `src/routes/api/library/folders/+server.ts`
- Modify: `src/routes/api/library/projects/+server.ts`
- Modify: `src/routes/api/library/tags/+server.ts`
- Modify: remaining `src/routes/api/**/+server.ts` files with `POST`, `PATCH`, or `DELETE`
- Test: nearest existing route specs under `src/routes/api/**/server.spec.ts`

- [ ] **Step 1: List write-capable routes before editing**

Run:

```bash
rg -n "export async function (POST|PATCH|DELETE)|export function DELETE|export function PATCH" src/routes/api
```

Expected: every write route that mutates SQLite/filesystem is identified.

- [ ] **Step 2: Add a shared route pattern to each write handler**

For each write handler, add this pattern at the top of the handler:

```ts
const access = requireTrustedLocalAccess(request);
if (!access.ok) return access.response;
```

For handlers without a `request` parameter, change the signature. Example for DELETE in `src/routes/api/library/assets/[id]/+server.ts`:

```ts
export function DELETE({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	if (!deleteLibraryAsset(params.id)) {
		return new Response('Not found', { status: 404, headers: access.headers });
	}

	return new Response(null, { status: 204, headers: access.headers });
}
```

- [ ] **Step 3: Preserve trusted extension CORS on extension-facing reads**

For extension-facing GET routes such as `/api/status`, `/api/atlas/concepts`, and `/api/atlas/entities/suggest`, return CORS headers only when `trustedLocalCorsHeaders(request)` has an allowed origin:

```ts
const headers = trustedLocalCorsHeaders(request);
return json(payload, { headers });
```

- [ ] **Step 4: Add one untrusted-origin regression test per route family**

Add representative tests:

```ts
it('rejects untrusted cross-origin asset deletes', async () => {
	const { DELETE } = await import('./+server');

	const response = await DELETE({
		params: { id: 'asset-test' },
		request: new Request('http://localhost/api/library/assets/asset-test', {
			method: 'DELETE',
			headers: { origin: 'https://hostile.example' }
		})
	});

	expect(response.status).toBe(403);
});
```

```ts
it('rejects untrusted cross-origin Atlas patches', async () => {
	const { PATCH } = await import('./+server');

	const response = await PATCH({
		params: { id: 'asset-test' },
		request: new Request('http://localhost/api/library/assets/asset-test/atlas', {
			method: 'PATCH',
			headers: { origin: 'https://hostile.example', 'content-type': 'application/json' },
			body: JSON.stringify({ concepts: [{ slug: 'serpent' }] })
		})
	});

	expect(response.status).toBe(403);
});
```

- [ ] **Step 5: Run route tests**

Run:

```bash
npm run test:unit -- --run src/routes/api
```

Expected: all API route unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api
git commit -m "fix: guard local write routes"
```

---

### Task 3: Make Imports Atomic And Clean Up Failed File Writes

**Files:**

- Modify: `src/lib/server/library/import.ts`
- Test: `src/lib/server/library/library.spec.ts`

- [ ] **Step 1: Write a failing rollback test**

Add to `src/lib/server/library/library.spec.ts`:

```ts
it('rolls back downloaded asset rows and files when Atlas ingestion fails', async () => {
	const invalidAcceptedSlug = 'x'.repeat(260);
	const imageData = Buffer.from('not a real image').toString('base64');

	const result = await importLibraryItems({
		destination_folder_id: null,
		items: [
			{
				filename: 'Broken atlas import',
				storage_mode: 'download',
				image_data: imageData,
				source_image_url: null,
				mime_type: 'image/png',
				natural_width: 2,
				natural_height: 2,
				source_url: 'file://broken.png',
				page_title: 'Broken atlas import',
				alt_text: null,
				captured_at: '2026-07-06T12:00:00.000Z',
				metadata: {
					sourceName: 'Local file',
					sourceType: 'local',
					acceptedConceptSlugs: [invalidAcceptedSlug]
				}
			}
		]
	});

	const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
	const assetCount = db.prepare('select count(*) as count from assets').get() as { count: number };
	const failureCount = db.prepare('select count(*) as count from asset_import_failures').get() as {
		count: number;
	};
	db.close();

	expect(result.imported).toEqual([]);
	expect(result.failed).toEqual([expect.objectContaining({ index: 0 })]);
	expect(assetCount.count).toBe(0);
	expect(failureCount.count).toBe(1);
	expect(existsSync(join(archiveRoot, 'originals'))).toBe(true);
	expect(existsSync(join(archiveRoot, 'thumbnails'))).toBe(true);
	expect(readdirSync(join(archiveRoot, 'originals'))).toEqual([]);
	expect(readdirSync(join(archiveRoot, 'thumbnails'))).toEqual([]);
});
```

Update imports at the top:

```ts
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts
```

Expected: test fails because files or rows are left behind, or because image validation fails before the intended rollback path. If the fake image fails too early, replace `imageData` with a tiny Sharp-generated PNG helper already used in nearby tests.

- [ ] **Step 3: Add temp-file helpers and cleanup**

In `src/lib/server/library/import.ts`, import filesystem helpers:

```ts
import { renameSync, rmSync, writeFileSync } from 'node:fs';
```

Add helpers:

```ts
type WrittenImportFiles = {
	tempOriginalPath: string | null;
	finalOriginalPath: string | null;
	tempThumbnailPath: string | null;
	finalThumbnailPath: string | null;
};

function emptyWrittenFiles(): WrittenImportFiles {
	return {
		tempOriginalPath: null,
		finalOriginalPath: null,
		tempThumbnailPath: null,
		finalThumbnailPath: null
	};
}

function cleanupWrittenFiles(files: WrittenImportFiles) {
	for (const relativePath of [
		files.tempOriginalPath,
		files.finalOriginalPath,
		files.tempThumbnailPath,
		files.finalThumbnailPath
	]) {
		if (!relativePath) continue;
		rmSync(join(resolveLibraryPaths().root, relativePath), { force: true });
	}
}
```

- [ ] **Step 4: Stage files to temp paths before the DB transaction**

Replace direct `writeOriginal` / `writeThumbnail` use with temp versions:

```ts
const files = emptyWrittenFiles();
try {
	const originalImage =
		item.storage_mode === 'download' ? decodeBase64(item.image_data ?? '') : null;
	const metadata = originalImage
		? await metadataWithEmbeddedImage(item.metadata, originalImage)
		: item.metadata;
	if (originalImage) {
		files.tempOriginalPath = writeOriginal(paths.root, `${assetId}.tmp`, item, originalImage);
		files.finalOriginalPath = finalOriginalPath(assetId, item.mime_type);
		files.tempThumbnailPath = await writeThumbnail(paths.root, `${assetId}.tmp`, originalImage);
		files.finalThumbnailPath = `thumbnails/${assetId}.webp`;
	}
	// transaction happens in next step
} catch (error) {
	cleanupWrittenFiles(files);
	throw error;
}
```

Add:

```ts
function finalOriginalPath(assetId: string, mimeType: string | null) {
	return `originals/${assetId}.${extensionForMimeType(mimeType)}`;
}
```

- [ ] **Step 5: Wrap all DB writes for one item in one transaction**

Inside `importOne`, after temp files and metadata are ready:

```ts
const applyOne = db.transaction(() => {
	db.prepare(
		`insert into assets (
			id, filename, title, storage_mode, mime_type, width, height, original_path,
			thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
			source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		assetId,
		item.filename.trim(),
		item.filename.trim(),
		item.storage_mode,
		item.mime_type,
		item.natural_width,
		item.natural_height,
		files.finalOriginalPath,
		files.finalThumbnailPath,
		item.source_image_url,
		item.source_url,
		item.page_title,
		item.alt_text,
		sourceDomain(item.source_image_url, item.source_url),
		hash,
		destinationFolder?.id ?? null,
		now,
		item.captured_at,
		now,
		serializeMetadata(metadata)
	);

	// keep existing lazy_download_jobs, Atlas ingestion, acceptedConceptSlugs, and Apollo seed writes here.
});

applyOne();
promoteWrittenFiles(paths.root, files);
```

Add:

```ts
function promoteWrittenFiles(archiveRoot: string, files: WrittenImportFiles) {
	if (files.tempOriginalPath && files.finalOriginalPath) {
		renameSync(
			join(archiveRoot, files.tempOriginalPath),
			join(archiveRoot, files.finalOriginalPath)
		);
		files.tempOriginalPath = null;
	}
	if (files.tempThumbnailPath && files.finalThumbnailPath) {
		renameSync(
			join(archiveRoot, files.tempThumbnailPath),
			join(archiveRoot, files.finalThumbnailPath)
		);
		files.tempThumbnailPath = null;
	}
}
```

- [ ] **Step 6: Run library tests**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/library.spec.ts src/routes/api/import/server.spec.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/library/import.ts src/lib/server/library/library.spec.ts
git commit -m "fix: make imports atomic"
```

---

### Task 4: Add Import And Remote Image Resource Limits

**Files:**

- Modify: `src/routes/api/import/+server.ts`
- Modify: `src/lib/server/library/import.ts`
- Modify: `src/routes/api/library/save-explore/+server.ts`
- Test: `src/routes/api/import/server.spec.ts`
- Test: `src/routes/api/library/save-explore/server.spec.ts`

- [ ] **Step 1: Add failing request/item limit tests**

Add to `src/routes/api/import/server.spec.ts`:

```ts
it('rejects import batches with too many items', async () => {
	const { POST } = await import('./+server');
	const validItem = {
		filename: 'test',
		storage_mode: 'url_reference',
		image_data: null,
		source_image_url: 'https://example.com/test.jpg',
		mime_type: 'image/jpeg',
		natural_width: 800,
		natural_height: 600,
		source_url: 'https://example.com/page',
		page_title: 'Example',
		alt_text: null,
		captured_at: '2026-05-27T12:00:00.000Z'
	};

	const response = await POST({
		request: new Request('http://localhost/api/import', {
			method: 'POST',
			body: JSON.stringify({
				destination_folder_id: null,
				items: Array.from({ length: 51 }, () => validItem)
			})
		})
	});

	expect(response.status).toBe(400);
	await expect(response.json()).resolves.toEqual({
		error: 'Import batches are limited to 50 items'
	});
});

it('rejects oversized downloaded image payloads', async () => {
	const { POST } = await import('./+server');
	const oversizedBase64 = Buffer.alloc(26 * 1024 * 1024).toString('base64');

	const response = await POST({
		request: new Request('http://localhost/api/import', {
			method: 'POST',
			body: JSON.stringify({
				destination_folder_id: null,
				items: [
					{
						filename: 'huge.png',
						storage_mode: 'download',
						image_data: oversizedBase64,
						source_image_url: null,
						mime_type: 'image/png',
						natural_width: 1,
						natural_height: 1,
						source_url: 'file://huge.png',
						page_title: 'huge.png',
						alt_text: null,
						captured_at: '2026-07-06T12:00:00.000Z'
					}
				]
			})
		})
	});

	expect(response.status).toBe(200);
	await expect(response.json()).resolves.toMatchObject({
		imported: [],
		failed: [{ index: 0, error: 'Downloaded images are limited to 25 MB' }]
	});
});
```

- [ ] **Step 2: Implement constants and validation**

In `src/lib/server/library/import.ts`:

```ts
const MAX_IMPORT_ITEMS = 50;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 100_000_000;

export function validateImportRequestLimits(request: ImportRequest) {
	if (request.items.length > MAX_IMPORT_ITEMS) return 'Import batches are limited to 50 items';
	return null;
}
```

In `validateImportItem`:

```ts
if (item.natural_width * item.natural_height > MAX_IMAGE_PIXELS) {
	return 'Images are limited to 100 megapixels';
}
if (item.storage_mode === 'download' && item.image_data) {
	const byteLength = decodedBase64ByteLength(item.image_data);
	if (byteLength > MAX_IMAGE_BYTES) return 'Downloaded images are limited to 25 MB';
}
```

Add:

```ts
function decodedBase64ByteLength(value: string) {
	const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
	return Buffer.byteLength(base64, 'base64');
}
```

- [ ] **Step 3: Call request-level validation in route**

In `src/routes/api/import/+server.ts`, after `isImportRequest(body)`:

```ts
const limitError = validateImportRequestLimits(body);
if (limitError) {
	return json({ error: limitError }, { status: 400, headers: access.headers });
}
```

- [ ] **Step 4: Add remote download limits in Explore save**

In `src/routes/api/library/save-explore/+server.ts`, add:

```ts
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
```

Then update `dimensionsFromImageUrl`:

```ts
const contentLength = response.headers.get('content-length');
if (contentLength && Number(contentLength) > MAX_REMOTE_IMAGE_BYTES) {
	throw new Error('Remote images are limited to 25 MB');
}
const buffer = Buffer.from(await response.arrayBuffer());
if (buffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
	throw new Error('Remote images are limited to 25 MB');
}
const metadata = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
```

- [ ] **Step 5: Run import/save tests**

Run:

```bash
npm run test:unit -- --run src/routes/api/import/server.spec.ts src/routes/api/library/save-explore/server.spec.ts src/lib/server/library/library.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/import/+server.ts src/lib/server/library/import.ts src/routes/api/library/save-explore/+server.ts src/routes/api/import/server.spec.ts src/routes/api/library/save-explore/server.spec.ts
git commit -m "fix: limit import resource usage"
```

---

### Task 5: Replace Full Library Snapshot Work In Atlas Asset Route

**Files:**

- Modify: `src/lib/server/library/read.ts`
- Modify: `src/routes/api/library/assets/[id]/atlas/+server.ts`
- Test: `src/routes/api/library/assets/[id]/atlas/server.spec.ts`
- Test: `src/lib/server/library/read.spec.ts`

- [ ] **Step 1: Add a single-asset read test**

Add to `src/lib/server/library/read.spec.ts`:

```ts
it('reads one library asset record by id without requiring a full snapshot', async () => {
	const imported = await importLibraryItems({
		destination_folder_id: null,
		items: [
			{
				filename: 'Single asset',
				storage_mode: 'url_reference',
				image_data: null,
				source_image_url: 'https://example.com/single.jpg',
				mime_type: 'image/jpeg',
				natural_width: 800,
				natural_height: 600,
				source_url: 'https://example.com/page',
				page_title: 'Single Asset',
				alt_text: null,
				captured_at: '2026-07-06T12:00:00.000Z'
			}
		]
	});
	const { getLibraryAssetById } = await import('./read');

	const asset = getLibraryAssetById(imported.imported[0].asset_id);

	expect(asset?.title).toBe('Single Asset');
	expect(asset?.record?.image.previewUrl).toBe('https://example.com/single.jpg');
	expect(getLibraryAssetById('missing')).toBeNull();
});
```

- [ ] **Step 2: Implement `getLibraryAssetById`**

In `src/lib/server/library/read.ts`, add:

```ts
export function getLibraryAssetById(id: string): LibraryAsset | null {
	const db = openLibraryDatabase();
	const asset = db.prepare('select * from assets where id = ?').get(id) as AssetRow | undefined;
	if (!asset) {
		db.close();
		return null;
	}
	const folder = asset.folder_id
		? (db
				.prepare(
					`select
					folders.id,
					folders.name,
					folders.parent_id,
					folders.path,
					(select count(*) from assets where assets.folder_id = folders.id) as asset_count,
					(select count(*) from folders as children where children.parent_id = folders.id) as child_count
				from folders
				where folders.id = ?`
				)
				.get(asset.folder_id) as FolderRow | undefined)
		: undefined;
	const tags = tagsByAssetId(db).get(asset.id) ?? [];
	const projects = projectIdsForAsset(db, asset);
	db.close();
	return mapAsset(asset, folder, tags, projects);
}
```

Add a helper:

```ts
function projectIdsForAsset(db: ReturnType<typeof openLibraryDatabase>, asset: AssetRow) {
	const direct = db
		.prepare('select project_id from project_asset_refs where asset_id = ?')
		.all(asset.id) as Array<{ project_id: string }>;
	return direct.map((row) => row.project_id);
}
```

This first version preserves direct project membership. Add folder-inherited membership later only if UI depends on it in the single-asset Atlas route.

- [ ] **Step 3: Update Atlas asset route**

In `src/routes/api/library/assets/[id]/atlas/+server.ts`, replace full snapshot lookups:

```ts
import { getLibraryAssetById } from '$lib/server/library/read';
```

```ts
const asset = usingMockFallback
	? mockLibrarySnapshot().assets.find((item) => item.id === params.id)
	: getLibraryAssetById(params.id);
```

After PATCH:

```ts
const asset = getLibraryAssetById(params.id);
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test:unit -- --run src/lib/server/library/read.spec.ts src/routes/api/library/assets/[id]/atlas/server.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/library/read.ts src/lib/server/library/read.spec.ts src/routes/api/library/assets/[id]/atlas/+server.ts src/routes/api/library/assets/[id]/atlas/server.spec.ts
git commit -m "perf: read atlas assets directly"
```

---

### Task 6: Fix Repository Formatting Gate

**Files:**

- Modify: files reported by `npm run lint`, or create `.prettierignore`
- Test: `package.json` script `lint`

- [ ] **Step 1: Reproduce formatting failure**

Run:

```bash
npm run lint
```

Expected: Prettier reports formatting drift.

- [ ] **Step 2: Decide formatting policy**

Use this policy unless the user overrides it:

```text
Source, tests, scripts, and docs are Prettier-managed.
Generated mockup HTML files under docs/design/mockups may be ignored if formatting them creates unreadable churn.
```

- [ ] **Step 3: Add `.prettierignore` only for generated mockups if needed**

If mockups are intentionally generated artifacts, create or update `.prettierignore`:

```gitignore
docs/design/mockups/
extension/dist/
extension/dist-firefox/
.svelte-kit/
build/
coverage/
playwright-report/
test-results/
```

- [ ] **Step 4: Format managed files**

Run:

```bash
npm run format
```

If mockups were ignored, run:

```bash
npm run format -- --ignore-path .prettierignore
```

- [ ] **Step 5: Verify lint**

Run:

```bash
npm run lint
```

Expected: Prettier and ESLint pass.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: restore formatting gate"
```

---

### Task 7: Evaluate And Optionally Split The Large Client Chunk

**Files:**

- Modify only if profiling confirms value: `src/routes/+page.svelte`, `src/lib/components/shell/AppShell.svelte`, or mode-loading components
- Test: `npm run build`

- [ ] **Step 1: Capture current build warning**

Run:

```bash
npm run build
```

Expected: build succeeds and reports the large `_page.svelte` client chunk.

- [ ] **Step 2: Inspect route/component ownership**

Run:

```bash
rg -n "import .*Atlas|import .*Explore|import .*Library|<Atlas|<Explore|<Library" src/routes src/lib/components/shell src/lib/components/home
```

Expected: identify which shell/page imports pull all major modes into the first client chunk.

- [ ] **Step 3: Use dynamic imports only at mode boundaries**

If the app shell directly imports all major mode workspaces, split major screens with Svelte async component loading. Keep the shell stable and avoid splitting small components.

Expected shape:

```ts
const atlasModule = () => import('$lib/components/atlas/AtlasWorkspace.svelte');
const exploreModule = () => import('$lib/components/explore/ExploreWorkspace.svelte');
const libraryModule = () => import('$lib/components/library/LibraryWorkspace.svelte');
```

Use the Svelte 5-compatible lazy component pattern already preferred by the project. If there is no existing pattern, defer this task rather than inventing broad app-shell plumbing during the security/import hardening pass.

- [ ] **Step 4: Verify build and smoke test**

Run:

```bash
npm run check
npm run test:unit -- --run
npm run build
```

Expected: checks pass; build either removes or substantially reduces the large chunk warning. If warning remains but chunk size is improved, document the new size in the commit body.

- [ ] **Step 5: Commit only if the split is clean**

```bash
git add src/routes src/lib/components
git commit -m "perf: split major app modes"
```

---

## Final Verification

- [ ] Run type checks:

```bash
npm run check
```

Expected: 0 errors and 0 warnings.

- [ ] Run unit tests:

```bash
npm run test:unit -- --run
```

Expected: all test files pass.

- [ ] Run build:

```bash
npm run build
```

Expected: build succeeds. Large chunk warning is acceptable only if Task 7 was explicitly deferred.

- [ ] Run lint:

```bash
npm run lint
```

Expected: Prettier and ESLint pass.

- [ ] Run whitespace check:

```bash
git diff --check
```

Expected: no output.

---

## Self-Review

- The local API exposure finding is covered by Tasks 1 and 2.
- Import atomicity is covered by Task 3.
- Import/download resource limits are covered by Task 4.
- Single-asset Atlas route performance is covered by Task 5.
- Formatting drift is covered by Task 6.
- Large chunk warning is covered by Task 7 as optional after correctness work.
- The plan intentionally leaves token-based local auth as a follow-up if origin checks are not sufficient for the extension workflow. If stronger protection is required, add a new task after Task 1 to generate a per-install local token and require `X-Pastiche-Local-Client` on writes.
