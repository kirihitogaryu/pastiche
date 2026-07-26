import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasIngestionProposal, createAtlasIngestionProposal } from './ingest';
import { applyAtlasAssetPatch } from './mutate';

describe('createAtlasIngestionProposal', () => {
	it('maps source-backed museum metadata into entities and claims', () => {
		const proposal = createAtlasIngestionProposal({
			assetId: 'asset-1',
			source: 'explore',
			sourceId: 'met',
			sourceName: 'The Metropolitan Museum of Art',
			detailUrl: 'https://www.metmuseum.org/art/collection/search/1',
			creator: 'Pablo Picasso',
			dateDisplay: '1937',
			medium: 'Oil on canvas',
			objectName: 'Painting',
			department: 'Paintings',
			culture: null,
			period: 'Cubism',
			rights: 'Public domain image according to The Met.',
			tags: ['horse', 'mourning'],
			rawMetadata: { objectID: 1 },
			now: '2026-06-05T12:00:00.000Z'
		});

		expect(proposal.entities).toEqual([
			expect.objectContaining({ kind: 'artist', label: 'Pablo Picasso', slug: 'pablo_picasso' }),
			expect.objectContaining({ kind: 'source', label: 'The Met', slug: 'the_met' })
		]);
		expect(proposal.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'date', slug: '1937', value: '1937' }),
				expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas', value: 'Oil on canvas' }),
				expect.objectContaining({ kind: 'rights', slug: 'public_domain', value: 'Public Domain' })
			])
		);
		expect(proposal.tagSuggestions).toEqual([
			expect.objectContaining({ label: 'horse', slug: 'horse', status: 'suggested' }),
			expect.objectContaining({ label: 'mourning', slug: 'mourning', status: 'suggested' })
		]);
		expect(proposal.rawUnmapped).toEqual({
			objectName: 'Painting',
			department: 'Paintings',
			culture: null,
			period: 'Cubism'
		});
	});

	it('does not create empty records for missing metadata', () => {
		const proposal = createAtlasIngestionProposal({
			assetId: 'asset-2',
			source: 'extension',
			sourceId: null,
			sourceName: null,
			detailUrl: null,
			creator: null,
			dateDisplay: null,
			medium: null,
			objectName: null,
			department: null,
			culture: null,
			period: null,
			rights: null,
			tags: [],
			rawMetadata: {},
			now: '2026-06-05T12:00:00.000Z'
		});

		expect(proposal.entities).toEqual([]);
		expect(proposal.claims).toEqual([]);
		expect(proposal.tagSuggestions).toEqual([]);
		expect(proposal.warnings).toEqual([]);
	});
});

describe('applyAtlasIngestionProposal', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-ingest-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('persists entities, claims, tag suggestions, and an ingestion run', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Guernica',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/guernica.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1000,
					natural_height: 500,
					source_url: 'https://example.com/guernica',
					page_title: 'Guernica',
					alt_text: null,
					captured_at: '2026-06-05T12:00:00.000Z'
				}
			]
		});
		const assetId = imported.imported[0].asset_id;
		const proposal = createAtlasIngestionProposal({
			assetId,
			source: 'explore',
			sourceId: 'met',
			sourceName: 'The Metropolitan Museum of Art',
			detailUrl: 'https://example.com/guernica',
			creator: 'Pablo Picasso',
			dateDisplay: '1937',
			medium: 'Oil on canvas',
			objectName: 'Painting',
			department: 'Paintings',
			culture: null,
			period: null,
			rights: 'Public domain image according to The Met.',
			tags: ['horse'],
			rawMetadata: {},
			now: '2026-06-05T12:00:00.000Z'
		});
		const db = openLibraryDatabase();

		applyAtlasIngestionProposal(db, proposal);

		const entities = db
			.prepare('select kind, slug, label from atlas_entities order by kind, slug')
			.all();
		const claims = db
			.prepare('select kind, slug, value, status from atlas_claims order by kind')
			.all();
		const suggestions = db.prepare('select slug, label, status from atlas_tag_suggestions').all();
		const runs = db.prepare('select asset_id, source, source_id from atlas_ingestion_runs').all();
		db.close();

		expect(entities).toEqual([
			{ kind: 'artist', slug: 'pablo_picasso', label: 'Pablo Picasso' },
			{ kind: 'source', slug: 'the_met', label: 'The Met' }
		]);
		expect(claims).toEqual([
			expect.objectContaining({ kind: 'date', slug: '1937', value: '1937', status: 'approved' }),
			expect.objectContaining({
				kind: 'medium',
				slug: 'oil_on_canvas',
				value: 'Oil on canvas',
				status: 'approved'
			}),
			expect.objectContaining({
				kind: 'rights',
				slug: 'public_domain',
				value: 'Public Domain',
				status: 'approved'
			})
		]);
		expect(suggestions).toEqual([{ slug: 'horse', label: 'horse', status: 'suggested' }]);
		expect(runs).toEqual([{ asset_id: assetId, source: 'explore', source_id: 'met' }]);
	});

	it('accepts a metadata tag suggestion through the shared resolver', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Horse study',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/horse.jpg',
					mime_type: 'image/jpeg',
					natural_width: 900,
					natural_height: 700,
					source_url: 'https://example.com/horse',
					page_title: 'Horse study',
					alt_text: null,
					captured_at: '2026-06-05T12:00:00.000Z'
				}
			]
		});
		const assetId = imported.imported[0].asset_id;
		const db = openLibraryDatabase();
		try {
			applyAtlasIngestionProposal(
				db,
				createAtlasIngestionProposal({
					assetId,
					source: 'extension',
					sourceId: 'example',
					sourceName: 'Example',
					detailUrl: 'https://example.com/horse',
					creator: null,
					dateDisplay: null,
					medium: null,
					objectName: null,
					department: null,
					culture: null,
					period: null,
					rights: null,
					tags: ['horse'],
					rawMetadata: {},
					now: '2026-06-05T12:00:00.000Z'
				})
			);
			const suggestion = db
				.prepare('select id from atlas_tag_suggestions where asset_id = ?')
				.get(assetId) as { id: string };

			applyAtlasAssetPatch(
				db,
				assetId,
				{
					tagSuggestions: [{ id: suggestion.id, action: 'accept', expression: 'horse' }]
				},
				'2026-06-05T13:00:00.000Z'
			);

			expect(
				db.prepare('select status from atlas_tag_suggestions where id = ?').get(suggestion.id)
			).toEqual({ status: 'accepted' });
			expect(
				db
					.prepare(
						`select atlas_concepts.slug, atlas_asset_concepts.status,
							atlas_asset_concepts.provenance
						 from atlas_asset_concepts
						 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
						 where atlas_asset_concepts.asset_id = ?`
					)
					.get(assetId)
			).toEqual({
				slug: 'horse',
				status: 'approved',
				provenance: 'metadata:metadata.tags'
			});
		} finally {
			db.close();
		}
	});
});
