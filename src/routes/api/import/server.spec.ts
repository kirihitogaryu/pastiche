import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('POST /api/import', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-import-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('responds to extension preflight requests', async () => {
		const { OPTIONS } = await import('./+server');

		const response = await OPTIONS();

		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
		expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
	});

	it('rejects malformed request bodies with CORS headers', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/import', {
				method: 'POST',
				body: '{nope'
			})
		});

		expect(response.status).toBe(400);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		await expect(response.json()).resolves.toEqual({ error: 'Invalid import request' });
	});

	it('imports valid items and reports item-level failures without blocking the batch', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/import', {
				method: 'POST',
				body: JSON.stringify({
					destination_folder_id: null,
					items: [
						{
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
						},
						{
							filename: 'broken',
							storage_mode: 'download',
							image_data: null,
							source_image_url: 'https://example.com/broken.jpg',
							mime_type: 'image/jpeg',
							natural_width: 800,
							natural_height: 600,
							source_url: 'https://example.com/page',
							page_title: 'Example',
							alt_text: null,
							captured_at: '2026-05-27T12:00:00.000Z'
						}
					]
				})
			})
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		await expect(response.json()).resolves.toMatchObject({
			imported: [{ index: 0, duplicate: false }],
			failed: [{ index: 1, error: 'Downloaded imports require image_data' }]
		});
	});

	it('imports a local manual image payload from the app upload sheet', async () => {
		const { POST } = await import('./+server');
		const imageData = await tinyPngBase64();

		const response = await POST({
			request: new Request('http://localhost/api/import', {
				method: 'POST',
				body: JSON.stringify({
					destination_folder_id: null,
					items: [
						{
							filename: 'study.png',
							storage_mode: 'download',
							image_data: imageData,
							source_image_url: null,
							mime_type: 'image/png',
							natural_width: 2,
							natural_height: 2,
							source_url: 'file://study.png',
							page_title: 'study.png',
							alt_text: null,
							captured_at: '2026-06-04T00:00:00.000Z',
							metadata: {
								sourceName: 'Local file',
								sourceType: 'local',
								rawMetadata: { fileName: 'study.png', fileSize: 100 }
							}
						}
					]
				})
			})
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			imported: [{ index: 0, duplicate: false }],
			failed: []
		});
	});

	it('accepts extension metadata for social source imports', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/import', {
				method: 'POST',
				body: JSON.stringify({
					destination_folder_id: null,
					items: [
						{
							filename: 'full-resolution-work.jpg',
							storage_mode: 'url_reference',
							image_data: null,
							source_image_url: 'https://pbs.twimg.com/media/work?format=jpg&name=orig',
							mime_type: 'image/jpeg',
							natural_width: 2400,
							natural_height: 3200,
							source_url: 'https://x.com/artist/status/1',
							page_title: 'artist on X',
							alt_text: 'A full-resolution work',
							captured_at: '2026-06-30T12:00:00.000Z',
							metadata: {
								sourceName: 'X',
								sourceType: 'social',
								detailUrl: 'https://x.com/artist/status/1/photo/1',
								creator: 'artist',
								dateDisplay: '2026-06-30',
								tags: ['illustration', 'reference'],
								acceptedConceptSlugs: ['dragon', 'black_hair'],
								rawMetadata: {
									selectedCandidateId: 'candidate-original',
									pageHost: 'x.com',
									imageHost: 'pbs.twimg.com',
									sourceTags: [
										{
											source: 'danbooru',
											category: 'tag',
											label: 'dragon',
											slug: 'dragon',
											url: null,
											confidence: 'high',
											selectorHint: 'test'
										}
									]
								}
							}
						}
					]
				})
			})
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			imported: [{ index: 0, duplicate: false }],
			failed: []
		});
	});

	it('rejects structurally invalid import metadata before importing', async () => {
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/import', {
				method: 'POST',
				body: JSON.stringify({
					destination_folder_id: null,
					items: [
						{
							filename: 'bad-tags.jpg',
							storage_mode: 'url_reference',
							image_data: null,
							source_image_url: 'https://example.com/bad-tags.jpg',
							mime_type: 'image/jpeg',
							natural_width: 800,
							natural_height: 600,
							source_url: 'https://example.com/page',
							page_title: 'Example',
							alt_text: null,
							captured_at: '2026-06-30T12:00:00.000Z',
							metadata: {
								sourceName: 'Example',
								sourceType: 'social',
								tags: 'illustration, reference'
							}
						}
					]
				})
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid import request' });
	});
});

async function tinyPngBase64() {
	return (
		await sharp({
			create: {
				width: 2,
				height: 2,
				channels: 4,
				background: { r: 220, g: 210, b: 190, alpha: 1 }
			}
		})
			.png()
			.toBuffer()
	).toString('base64');
}
