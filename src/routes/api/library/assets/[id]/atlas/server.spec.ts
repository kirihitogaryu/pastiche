import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed } from '$lib/server/atlas/wiki';

describe('GET /api/library/assets/[id]/atlas', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns a library asset with Atlas summary data', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Atlas Route Ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/atlas.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 800,
					source_url: 'https://www.metmuseum.org/art/collection/search/123',
					page_title: 'Atlas Route Ref',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: {
						sourceId: 'met',
						sourceName: 'The Met',
						sourceType: 'museum',
						creator: 'Pablo Picasso',
						dateDisplay: '1937',
						medium: 'Oil on canvas',
						rights: 'Public domain image according to The Met.',
						tags: ['Horse', 'War']
					}
				}
			]
		});
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: imported.imported[0].asset_id } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.asset.title).toBe('Atlas Route Ref');
		expect(body.atlas.assetId).toBe(imported.imported[0].asset_id);
		expect(body.atlas.entities).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'artist', label: 'Pablo Picasso' }),
				expect.objectContaining({ kind: 'source', label: 'The Met' })
			])
		);
		expect(body.atlas.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'date', value: '1937' }),
				expect.objectContaining({ kind: 'medium', value: 'Oil on canvas' })
			])
		);
		expect(body.atlas.tagSuggestions).toEqual(
			expect.arrayContaining([expect.objectContaining({ label: 'Horse', status: 'suggested' })])
		);
	});

	it('returns 404 for a missing asset', async () => {
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'missing-asset' } });
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe('Asset not found');
	});

	it('returns mock Atlas data for the mock library fallback', async () => {
		vi.stubEnv('PASTICHE_MOCK_LIBRARY_FALLBACK', '1');
		vi.resetModules();
		const { GET } = await import('./+server');

		const response = await GET({ params: { id: 'crimson-horizon' } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.asset.title).toBe('Crimson Horizon');
		expect(body.atlas.claims).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: 'medium', value: 'Oil on canvas' })])
		);
		expect(body.atlas.tagSuggestions).toEqual(
			expect.arrayContaining([expect.objectContaining({ label: 'abstract', status: 'suggested' })])
		);
	});

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
		await expect(response.json()).resolves.toEqual({ error: 'Untrusted local API origin' });
	});

	it('patches Atlas metadata and returns similar assets from shared concepts', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Serpent One',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/serpent-one.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 800,
					source_url: 'https://example.com/serpent-one',
					page_title: 'Serpent One',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				},
				{
					filename: 'Serpent Two',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/serpent-two.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1000,
					natural_height: 700,
					source_url: 'https://example.com/serpent-two',
					page_title: 'Serpent Two',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				}
			]
		});
		const { PATCH } = await import('./+server');
		for (const item of imported.imported) {
			const response = await PATCH({
				params: { id: item.asset_id },
				request: new Request('http://localhost/api/library/assets/id/atlas', {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						identity: {
							title: item.asset_id === imported.imported[0].asset_id ? 'Renamed One' : undefined
						},
						concepts: [{ slug: 'serpent', evidence: 'observed', status: 'approved' }],
						annotations: [
							{
								label: 'serpent_body',
								concepts: ['serpent'],
								classifiers: { visual_role: 'focal_point' }
							}
						]
					})
				})
			});
			expect(response.status).toBe(200);
		}
		const { GET } = await import('../../../../atlas/assets/[id]/similar/+server');

		const response = await GET({
			params: { id: imported.imported[0].asset_id },
			url: new URL('http://localhost/api/atlas/assets/id/similar?limit=3')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.assets).toEqual(
			expect.arrayContaining([expect.objectContaining({ title: 'Serpent Two' })])
		);
	});

	it('requires unknown annotation concepts to be classified before assignment', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Unreviewed Tag Ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/unreviewed.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/unreviewed',
					page_title: 'Unreviewed Tag Ref',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				}
			]
		});
		const { PATCH } = await import('./+server');

		const response = await PATCH({
			params: { id: imported.imported[0].asset_id },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					annotations: [
						{
							label: 'apollo_archer',
							concepts: ['apollo_deity'],
							classifiers: { visual_role: 'setting_context' }
						}
					]
				})
			})
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toContain('Classify and create it before assigning it');
	});

	it('resolves aliases and appends concepts when editing an existing annotation', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Alias Annotation Ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/alias-annotation.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/alias-annotation',
					page_title: 'Alias Annotation Ref',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				}
			]
		});
		const { PATCH } = await import('./+server');
		const db = openLibraryDatabase();
		applyAtlasWikiSeed(db);
		db.prepare(
			`update atlas_concepts set status = 'active', maturity = 'usable' where slug = 'wing'`
		).run();
		db.prepare(
			`update atlas_concept_aliases set status = 'approved'
			 where concept_id = (select id from atlas_concepts where slug = 'wing')
				and normalized_alias = 'wings'`
		).run();
		db.close();
		const assetId = imported.imported[0].asset_id;
		await PATCH({
			params: { id: assetId },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					annotations: [
						{
							label: 'python_as_dragon',
							concepts: ['dragon'],
							classifiers: { visual_role: 'focal_point' }
						}
					]
				})
			})
		});

		const response = await PATCH({
			params: { id: assetId },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					annotations: [
						{
							label: 'python_as_dragon',
							concepts: ['wings']
						}
					]
				})
			})
		});
		const body = await response.json();
		const annotation = body.atlas.annotations.find(
			(item: { label: string }) => item.label === 'python_as_dragon'
		);

		expect(response.status).toBe(200);
		expect(annotation.concepts.map((concept: { slug: string }) => concept.slug)).toEqual(
			expect.arrayContaining(['dragon', 'wing'])
		);
		expect(annotation.concepts.map((concept: { slug: string }) => concept.slug)).not.toContain(
			'wings'
		);

		const removeResponse = await PATCH({
			params: { id: assetId },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					annotations: [
						{
							label: 'python_as_dragon',
							removeConcepts: ['dragon']
						}
					]
				})
			})
		});
		const removeBody = await removeResponse.json();
		const updatedAnnotation = removeBody.atlas.annotations.find(
			(item: { label: string }) => item.label === 'python_as_dragon'
		);

		expect(removeResponse.status).toBe(200);
		expect(updatedAnnotation.concepts.map((concept: { slug: string }) => concept.slug)).toEqual([
			'wing'
		]);
	});

	it('exports a scoped Atlas context packet for outside AI agents', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Context Packet Ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/context.jpg',
					mime_type: 'image/jpeg',
					natural_width: 900,
					natural_height: 700,
					source_url: 'https://example.com/context',
					page_title: 'Context Packet Ref',
					alt_text: 'A serpent-like creature in a test image.',
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: { sourceName: 'Manual', tags: [] }
				}
			]
		});
		const assetId = imported.imported[0].asset_id;
		const { PATCH } = await import('./+server');
		await PATCH({
			params: { id: assetId },
			request: new Request('http://localhost/api/library/assets/id/atlas', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					concepts: [{ slug: 'serpent', evidence: 'observed', status: 'approved' }],
					annotations: [
						{
							label: 'serpent_body',
							concepts: ['serpent'],
							classifiers: { visual_role: 'focal_point' }
						}
					]
				})
			})
		});
		const { GET } = await import('../../../../atlas/assets/[id]/context-packet/+server');

		const response = await GET({
			params: { id: assetId },
			url: new URL('http://localhost/api/atlas/assets/id/context-packet?format=json')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.schema).toBe('pastiche.atlas.asset-context.v1');
		expect(body.asset.title).toBe('Context Packet Ref');
		expect(body.relevantVocabulary.serpent).toMatchObject({
			slug: 'serpent',
			confusable: expect.arrayContaining(['dragon'])
		});
		expect(body.batchJsonContract.visualRoleValues).toContain('focal_point');
	});
});
