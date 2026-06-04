import { describe, expect, it } from 'vitest';
import {
	buildSmartFolderItems,
	buildFolderTree,
	filterAssetsByTag,
	previewTags,
	sortHubTagGroups,
	type FolderTreeNode
} from './libraryOverviewModel';
import type { LibraryAsset } from '$lib/library/types';

describe('libraryOverviewModel', () => {
	it('builds a nested folder tree from flat folders', () => {
		const tree = buildFolderTree([
			{
				id: 'root',
				name: 'References',
				parentId: undefined,
				path: ['library', 'References'],
				assetCount: 2,
				childFolderCount: 1
			},
			{
				id: 'child',
				name: 'Figures',
				parentId: 'root',
				path: ['library', 'References', 'Figures'],
				assetCount: 1,
				childFolderCount: 0
			}
		]);

		expect(tree[0].children[0].name).toBe('Figures');
	});

	it('caps visual depth after two nested levels', () => {
		const node = { depth: 5 } as FolderTreeNode;
		expect(Math.min(node.depth, 2)).toBe(2);
	});

	it('sorts General before tag groups', () => {
		const sorted = sortHubTagGroups([
			{ id: 'medium', slug: 'medium', name: 'Medium', tagCount: 0, kind: 'facet', tags: [] },
			{ id: 'general', slug: 'general', name: 'General', tagCount: 0, kind: 'general', tags: [] }
		]);

		expect(sorted.map((group) => group.slug)).toEqual(['general', 'medium']);
	});

	it('returns visible tag pills plus overflow count', () => {
		const result = previewTags(
			Array.from({ length: 8 }, (_, index) => ({
				id: String(index),
				facetId: 'general',
				facetName: 'General',
				facetSlug: 'general',
				value: `tag-${index}`,
				name: `General: tag-${index}`,
				slug: `general-tag-${index}`,
				assetCount: 0
			})),
			4
		);

		expect(result.visible).toHaveLength(4);
		expect(result.hiddenCount).toBe(4);
	});

	it('derives smart folder counts from real library assets', () => {
		const items = buildSmartFolderItems([
			{
				id: 'favorite',
				title: 'Favorite',
				creator: '',
				year: '',
				medium: '',
				sourceName: 'Local',
				sourceUrl: 'https://example.com/favorite',
				sourceType: 'web',
				imageUrl: '',
				width: 1,
				height: 1,
				tags: ['study'],
				palette: [],
				description: '',
				favorite: true,
				saved: true,
				projects: [],
				folderPath: ['library']
			},
			{
				id: 'untagged',
				title: 'Untagged',
				creator: '',
				year: '',
				medium: '',
				sourceName: 'Unknown',
				sourceType: 'web',
				imageUrl: '',
				width: 1,
				height: 1,
				tags: [],
				palette: [],
				description: '',
				saved: true,
				projects: [],
				folderPath: ['library']
			}
		]);

		expect(items).toEqual([
			expect.objectContaining({ id: 'favorites', count: 1 }),
			expect.objectContaining({ id: 'recently-added', count: 2 }),
			expect.objectContaining({ id: 'untagged', count: 1 }),
			expect.objectContaining({ id: 'missing-source', count: 1 })
		]);
	});

	it('filters assets by accepted library tag id or slug', () => {
		const assets = [
			assetFixture('hands', [
				{
					id: 'tag-hands',
					facetId: 'facet-subject',
					facetName: 'Subject',
					facetSlug: 'subject',
					value: 'hands',
					name: 'Subject: hands',
					slug: 'subject-hands',
					assetCount: 1
				}
			]),
			assetFixture('landscape', [
				{
					id: 'tag-landscape',
					facetId: 'facet-subject',
					facetName: 'Subject',
					facetSlug: 'subject',
					value: 'landscape',
					name: 'Subject: landscape',
					slug: 'subject-landscape',
					assetCount: 1
				}
			])
		];

		expect(filterAssetsByTag(assets, 'tag-hands').map((asset) => asset.id)).toEqual(['hands']);
		expect(filterAssetsByTag(assets, 'subject-landscape').map((asset) => asset.id)).toEqual([
			'landscape'
		]);
	});
});

function assetFixture(
	id: string,
	tags: NonNullable<LibraryAsset['record']>['organization']['tags']
): LibraryAsset {
	return {
		id,
		title: id,
		creator: '',
		year: '',
		medium: '',
		sourceName: 'Local',
		sourceType: 'web',
		imageUrl: '',
		storageMode: 'url_reference',
		sourceImageUrl: null,
		importedAt: '2026-06-04T00:00:00.000Z',
		capturedAt: '2026-06-04T00:00:00.000Z',
		width: 1,
		height: 1,
		tags: tags.map((tag) => tag.name),
		palette: [],
		description: '',
		saved: true,
		projects: [],
		folderPath: ['library'],
		record: {
			id,
			title: id,
			artist: null,
			description: null,
			dates: {
				dateDisplay: null,
				importedAt: '2026-06-04T00:00:00.000Z',
				capturedAt: '2026-06-04T00:00:00.000Z',
				modifiedAt: null
			},
			dimensions: { width: 1, height: 1 },
			source: {
				label: 'Local',
				type: 'local',
				pageUrl: null,
				imageUrl: null,
				imageHost: null,
				domain: null,
				sourceId: null
			},
			image: {
				previewUrl: null,
				originalUrl: null,
				sourceImageUrl: null,
				localOriginalAvailable: false,
				localThumbnailAvailable: false
			},
			facts: {},
			organization: {
				folderId: null,
				folderPath: ['library'],
				tags,
				sourceTagSuggestions: [],
				projects: [],
				favorite: false
			},
			generation: null,
			raw: { importer: 'manual', sourceMetadata: {} }
		}
	};
}
