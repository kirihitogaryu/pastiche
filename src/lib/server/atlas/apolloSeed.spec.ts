import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyApolloPythonSeedForAsset, shouldApplyApolloPythonSeed } from './apolloSeed';

describe('Apollo/Python Atlas seed', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-apollo-seed-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('detects the Apollo Killing the Python fixture from title or source URL', () => {
		expect(shouldApplyApolloPythonSeed({ title: 'Apollo Killing the Python' })).toBe(true);
		expect(
			shouldApplyApolloPythonSeed({
				sourceUrl:
					'https://commons.wikimedia.org/wiki/File:Apollo_Killing_the_Python_LACMA_54.70.1i.jpg'
			})
		).toBe(true);
		expect(shouldApplyApolloPythonSeed({ title: 'Apollo and Daphne' })).toBe(false);
	});

	it('creates concepts, annotations, and classifiers for the fixture asset', async () => {
		const imported = await importLibraryItems({
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
						objectName: 'Print',
						department: 'Prints',
						culture: null,
						period: null,
						rights: 'Public domain.',
						tags: [],
						rawMetadata: {}
					}
				}
			]
		});
		const db = openLibraryDatabase();
		try {
			applyApolloPythonSeedForAsset(db, imported.imported[0].asset_id, '2026-06-05T12:00:00.000Z');

			const concepts = db
				.prepare(
					`select atlas_concepts.slug
					 from atlas_asset_concepts
					 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
					 where atlas_asset_concepts.asset_id = ?
					 order by atlas_concepts.slug`
				)
				.all(imported.imported[0].asset_id)
				.map((row) => (row as { slug: string }).slug);
			const classifiers = db
				.prepare(
					`select classifier_type, classifier_value
					 from atlas_annotation_classifiers
					 order by classifier_type, classifier_value`
				)
				.all();

			expect(concepts).toEqual(
				expect.arrayContaining([
					'apollo_(deity)',
					'python_(mythology)',
					'serpent',
					'castle',
					'lizard',
					'tree'
				])
			);
			expect(classifiers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ classifier_type: 'state', classifier_value: 'wounded' }),
					expect.objectContaining({ classifier_type: 'pose', classifier_value: 'reclining' }),
					expect.objectContaining({
						classifier_type: 'visual_role',
						classifier_value: 'background_detail'
					})
				])
			);
		} finally {
			db.close();
		}
	});
});
