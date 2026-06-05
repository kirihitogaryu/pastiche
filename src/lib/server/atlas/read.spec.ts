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

	it('returns approved concepts, annotations, and classifiers for a seeded fixture asset', async () => {
		const result = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Apollo Killing the Python',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://upload.wikimedia.org/apollo-python.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 800,
					source_url:
						'https://commons.wikimedia.org/wiki/File:Apollo_Killing_the_Python_LACMA_54.70.1i.jpg',
					page_title: 'Apollo Killing the Python',
					alt_text: null,
					captured_at: '2026-06-05T12:00:00.000Z',
					metadata: {
						sourceId: 'wikimedia',
						sourceName: 'Wikimedia Commons',
						sourceType: 'museum',
						detailUrl:
							'https://commons.wikimedia.org/wiki/File:Apollo_Killing_the_Python_LACMA_54.70.1i.jpg',
						creator: 'Hendrick Goltzius',
						dateDisplay: '1589',
						medium: 'Engraving',
						rights: 'Public domain.',
						tags: []
					}
				}
			]
		});

		const summary = getAtlasAssetSummary(result.imported[0].asset_id);

		expect(summary.approvedConcepts.map((concept) => concept.slug)).toEqual(
			expect.arrayContaining(['apollo_(deity)', 'python_(mythology)', 'serpent'])
		);
		expect(summary.annotations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'python_body',
					concepts: expect.arrayContaining([
						expect.objectContaining({ slug: 'python_(mythology)' }),
						expect.objectContaining({ slug: 'serpent' })
					]),
					classifiers: expect.arrayContaining([
						expect.objectContaining({ type: 'state', value: 'wounded' })
					])
				})
			])
		);
		expect(summary.wikiHints).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					slug: 'serpent',
					allowedClassifiers: expect.arrayContaining(['pose', 'state'])
				})
			])
		);
	});
});
