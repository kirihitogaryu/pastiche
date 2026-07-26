import { describe, expect, it } from 'vitest';
import { previewAtlasEditSession } from './editPreview';
import type { AtlasAssetSummary } from './types';
import type { Asset } from '$lib/types';

const asset: Asset = {
	id: 'asset-test',
	title: 'Original title',
	creator: 'Original artist',
	year: '1900',
	medium: 'Ink',
	sourceName: 'Manual',
	sourceUrl: 'https://example.com',
	sourceType: 'web',
	imageUrl: 'https://example.com/image.jpg',
	width: 100,
	height: 100,
	tags: [],
	palette: [],
	description: 'Original description',
	saved: true,
	projects: [],
	folderPath: []
};

const atlas: AtlasAssetSummary = {
	assetId: asset.id,
	entities: [],
	claims: [],
	tagSuggestions: [],
	approvedConcepts: [
		{
			assignmentId: 'concept-dragon',
			id: 'dragon',
			slug: 'dragon',
			label: 'Dragon',
			kind: 'visual_tag',
			category: 'creature',
			displayGroup: 'Subjects',
			status: 'active',
			maturity: 'usable',
			shortDefinition: 'Use when a dragon is visible.',
			evidence: 'observed',
			provenance: 'manual',
			assignmentStatus: 'approved'
		}
	],
	annotations: [
		{
			id: 'annotation-dragon',
			label: 'dragon_body',
			regionJson: null,
			concepts: [],
			classifiers: [
				{
					id: 'classifier-role',
					type: 'visual_role',
					value: 'focal_point',
					evidence: 'observed',
					status: 'approved'
				}
			]
		}
	],
	wikiHints: []
};

describe('previewAtlasEditSession', () => {
	it('reflects staged identity edits before they are committed', () => {
		const preview = previewAtlasEditSession(asset, atlas, {
			identity: { title: 'Staged title', description: 'Staged description' }
		});

		expect(preview.asset.title).toBe('Staged title');
		expect(preview.asset.description).toBe('Staged description');
	});

	it('previews staged concept additions and removals', () => {
		const preview = previewAtlasEditSession(asset, atlas, {
			concepts: [
				{ slug: 'dragon', action: 'remove' },
				{ slug: 'wing', evidence: 'observed' }
			]
		});

		expect(preview.atlas?.approvedConcepts.map((concept) => concept.slug)).toEqual(['wing']);
		expect(preview.atlas?.approvedConcepts[0].provenance).toBe('staged edit');
	});

	it('previews annotation classifier updates', () => {
		const preview = previewAtlasEditSession(asset, atlas, {
			annotations: [
				{
					id: 'annotation-dragon',
					label: 'dragon_body',
					concepts: ['wing'],
					classifiers: { visual_role: 'supporting_subject' }
				}
			]
		});
		const annotation = preview.atlas?.annotations[0];

		expect(annotation?.concepts.map((concept) => concept.slug)).toEqual(['wing']);
		expect(annotation?.classifiers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'visual_role', value: 'supporting_subject' })
			])
		);
	});
});
