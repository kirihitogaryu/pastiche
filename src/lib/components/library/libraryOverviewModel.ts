import type { LibraryTag, LibraryTagFacet } from '$lib/library/types';
import type { Asset, LibraryFolder, SmartFolder } from '$lib/types';

export type FolderTreeNode = LibraryFolder & {
	children: FolderTreeNode[];
	depth: number;
};

export function buildFolderTree(folders: LibraryFolder[]): FolderTreeNode[] {
	const nodes = new Map<string, FolderTreeNode>();
	for (const folder of folders) {
		nodes.set(folder.id, { ...folder, children: [], depth: 0 });
	}

	const roots: FolderTreeNode[] = [];
	for (const node of nodes.values()) {
		if (node.parentId && nodes.has(node.parentId)) {
			const parent = nodes.get(node.parentId)!;
			node.depth = parent.depth + 1;
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortNodes = (items: FolderTreeNode[]) => {
		items.sort((a, b) => a.name.localeCompare(b.name));
		for (const item of items) sortNodes(item.children);
	};
	sortNodes(roots);
	return roots;
}

export function sortHubTagGroups(groups: LibraryTagFacet[]): LibraryTagFacet[] {
	return [...groups].sort((a, b) => {
		if (a.slug === 'general') return -1;
		if (b.slug === 'general') return 1;
		return a.name.localeCompare(b.name);
	});
}

export function previewTags(tags: LibraryTag[], limit = 6) {
	return {
		visible: tags.slice(0, limit),
		hiddenCount: Math.max(0, tags.length - limit)
	};
}

export function buildSmartFolderItems(assets: Asset[]): SmartFolder[] {
	return [
		{
			id: 'favorites',
			label: 'Favorites',
			count: assets.filter((asset) => asset.favorite).length,
			icon: 'star'
		},
		{
			id: 'recently-added',
			label: 'Recently Added',
			count: assets.length,
			icon: 'clock'
		},
		{
			id: 'untagged',
			label: 'Untagged',
			count: assets.filter((asset) => asset.tags.length === 0).length,
			icon: 'tag'
		},
		{
			id: 'missing-source',
			label: 'Missing Source',
			count: assets.filter((asset) => !asset.sourceUrl).length,
			icon: 'link'
		}
	];
}
