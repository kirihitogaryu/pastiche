import { describe, expect, it } from 'vitest';
import { createAtlasIngestionProposal } from './ingest';

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
