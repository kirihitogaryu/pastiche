import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
		expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
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
});
