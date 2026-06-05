import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

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
						source: 'met',
						sourceName: 'The Met',
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
});
