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
