import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/atlas/search', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-search-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('parses Atlas search syntax without opening a library database', async () => {
		const { GET } = await import('./parse/+server');

		const response = await GET({
			url: new URL('http://localhost/api/atlas/search/parse?q=shirt.color:blue exclude:tree')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.query.canonical).toBe('shirt.color:blue exclude:tree');
	});

	it('returns a structured search response', async () => {
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/api/atlas/search?q=horse&limit=25')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			query: expect.objectContaining({ canonical: 'horse' }),
			context: expect.objectContaining({ mode: expect.any(String) }),
			page: expect.objectContaining({ limit: 25, nextCursor: null })
		});
		expect(Array.isArray(body.results)).toBe(true);
		expect(Array.isArray(body.sidebar)).toBe(true);
	});

	it('returns Atlas search suggestions', async () => {
		const { GET } = await import('./suggest/+server');

		const response = await GET({
			url: new URL('http://localhost/api/atlas/search/suggest?q=exclude:hor')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			token: 'exclude:hor',
			suggestions: expect.arrayContaining([
				expect.objectContaining({
					kind: 'exclude',
					query: 'exclude:horse'
				})
			])
		});
	});
});
