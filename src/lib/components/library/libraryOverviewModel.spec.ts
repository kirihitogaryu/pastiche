import { describe, expect, it } from 'vitest';
import {
	buildFolderTree,
	previewTags,
	sortHubTagGroups,
	type FolderTreeNode
} from './libraryOverviewModel';

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
});
