import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

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

	it('returns the batch editor guide documentation page', async () => {
		const { GET } = await import('./docs/[slug]/+server');

		const response = await GET({ params: { slug: 'batch-editor-guide' } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.doc).toMatchObject({
			slug: 'batch-editor-guide',
			title: 'Batch Editor Guide'
		});
		expect(body.doc.markdown).toContain('The Atlas batch editor accepts strict JSON only.');
	});

	it('returns 404 for non-allowlisted documentation', async () => {
		const { GET } = await import('./docs/[slug]/+server');

		const response = await GET({ params: { slug: '../README' } });
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe('Wiki document not found');
	});

	it('returns exact concept autocomplete matches before fuzzy matches', async () => {
		const { GET } = await import('../concepts/+server');

		const response = await GET({ url: new URL('http://localhost/api/atlas/concepts?q=serpent') });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.concepts[0]).toMatchObject({ slug: 'serpent', match: 'exact' });
	});

	it('updates an existing wiki entry', async () => {
		const { PATCH } = await import('./[slug]/+server');

		const response = await PATCH({
			params: { slug: 'serpent' },
			request: new Request('http://localhost/api/atlas/wiki/serpent', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					shortDefinition: 'Use for visibly serpent-like creatures with elongated bodies.'
				})
			})
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.entry.shortDefinition).toBe(
			'Use for visibly serpent-like creatures with elongated bodies.'
		);
	});

	it('creates draft wiki tags with required guidance', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/atlas/wiki', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					slug: 'test_visible_object',
					label: 'Test Visible Object',
					kind: 'visual_tag',
					category: 'object',
					displayGroup: 'Objects',
					shortDefinition: 'Use when the test object is visibly depicted.',
					useWhen: ['The object is visible.'],
					doNotUseWhen: ['Only source metadata mentions the object.'],
					aiGuidance: 'Agents may suggest this only when visible.'
				})
			})
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.entry).toMatchObject({ slug: 'test_visible_object', maturity: 'draft' });
	});

	it('returns example candidates for assets tagged with a concept', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Serpent Candidate',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/serpent.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 800,
					source_url: 'https://example.com/serpent',
					page_title: 'Serpent Candidate',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				}
			]
		});
		const { PATCH } = await import('../../library/assets/[id]/atlas/+server');
		await PATCH({
			params: { id: imported.imported[0].asset_id },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					concepts: [{ slug: 'serpent', evidence: 'observed', status: 'approved' }]
				})
			})
		});
		const { GET } = await import('./[slug]/example-candidates/+server');

		const response = await GET({
			params: { slug: 'serpent' },
			url: new URL('http://localhost/api/atlas/wiki/serpent/example-candidates?q=Candidate')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.candidates).toEqual(
			expect.arrayContaining([expect.objectContaining({ title: 'Serpent Candidate' })])
		);
	});

	it('returns tags requiring wiki review', async () => {
		const { GET } = await import('./review/+server');

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ slug: 'serpent', reason: 'needs_review' })
			])
		);
	});

	it('deletes accidental reviewable tags from the review queue', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Accidental Tag Ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/accidental.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 800,
					source_url: 'https://example.com/accidental',
					page_title: 'Accidental Tag Ref',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				}
			]
		});
		const { PATCH } = await import('../../library/assets/[id]/atlas/+server');
		await PATCH({
			params: { id: imported.imported[0].asset_id },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ concepts: [{ slug: 'the' }] })
			})
		});
		const reviewRoute = await import('./review/+server');

		const deleteResponse = await reviewRoute.DELETE({
			url: new URL('http://localhost/api/atlas/wiki/review?slug=the')
		});
		const response = await reviewRoute.GET();
		const body = await response.json();

		expect(deleteResponse.status).toBe(200);
		expect(body.items.map((item: { slug: string }) => item.slug)).not.toContain('the');
	});

	it('exports the Atlas vocabulary for outside AI agents', async () => {
		const { GET } = await import('../export/vocabulary/+server');

		const jsonResponse = await GET({
			url: new URL('http://localhost/api/atlas/export/vocabulary?format=json')
		});
		const jsonBody = await jsonResponse.json();
		const markdownResponse = await GET({
			url: new URL('http://localhost/api/atlas/export/vocabulary?format=markdown')
		});
		const markdownBody = await markdownResponse.text();

		expect(jsonResponse.status).toBe(200);
		expect(jsonBody.schema).toBe('pastiche.atlas.vocabulary.v1');
		expect(jsonBody.agentInstructions).toEqual(
			expect.arrayContaining([expect.stringContaining('Prefer existing canonical slugs')])
		);
		expect(jsonBody.canonical.serpent).toMatchObject({
			slug: 'serpent',
			confusable: expect.arrayContaining(['dragon'])
		});
		expect(markdownBody).toContain('# Pastiche Atlas Vocabulary Export');
		expect(markdownBody).toContain('serpent');
	});
});
