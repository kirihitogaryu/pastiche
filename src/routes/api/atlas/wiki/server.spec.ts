import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/atlas/wiki', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-wiki-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns seeded wiki entries', async () => {
		const { GET } = await import('./+server');

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.entries).toEqual(
			expect.arrayContaining([expect.objectContaining({ slug: 'serpent' })])
		);
	});

	it('returns one seeded wiki entry by slug', async () => {
		const { GET } = await import('./[slug]/+server');

		const response = await GET({ params: { slug: 'serpent' } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.entry).toMatchObject({
			slug: 'serpent',
			allowedClassifiers: expect.arrayContaining(['pose', 'state'])
		});
	});

	it('returns 404 for a missing wiki entry', async () => {
		const { GET } = await import('./[slug]/+server');

		const response = await GET({ params: { slug: 'missing' } });
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe('Wiki entry not found');
	});

	it('returns an allowlisted documentation page', async () => {
		const { GET } = await import('./docs/[slug]/+server');

		const response = await GET({ params: { slug: 'tagging-rules' } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.doc).toMatchObject({
			slug: 'tagging-rules',
			title: 'Tagging Rules'
		});
		expect(body.doc.markdown).toContain('# Tagging Rules');
	});

	it('returns 404 for non-allowlisted documentation', async () => {
		const { GET } = await import('./docs/[slug]/+server');

		const response = await GET({ params: { slug: '../README' } });
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe('Wiki document not found');
	});
});
