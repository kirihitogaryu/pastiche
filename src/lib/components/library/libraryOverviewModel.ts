import type {
	LibraryAsset,
	LibraryProject,
	LibraryResponse,
	LibraryTag,
	LibraryTagFacet
} from '$lib/library/types';
import type { Asset, LibraryFolder, SmartFolder } from '$lib/types';

export type FolderTreeNode = LibraryFolder & {
	children: FolderTreeNode[];
	depth: number;
};

export type LibrarySearchResults = {
	assets: LibraryAsset[];
	projects: LibraryProject[];
	folders: FolderTreeNode[];
	tags: LibraryTag[];
	hasQuery: boolean;
	total: number;
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

export function filterAssetsByTag(assets: LibraryAsset[], tagId: string | null): LibraryAsset[] {
	if (!tagId) return [];
	return assets.filter((asset) =>
		asset.record?.organization.tags.some((tag) => tag.id === tagId || tag.slug === tagId)
	);
}

export function normalizeLibraryQuery(query: string) {
	return query.trim().toLocaleLowerCase();
}

export function filterAssetsByLibraryQuery(
	assets: LibraryAsset[],
	query: string
): LibraryAsset[] {
	const normalized = normalizeLibraryQuery(query);
	if (!normalized) return assets;
	return assets.filter((asset) =>
		[
			asset.title,
			asset.creator,
			asset.sourceName,
			asset.medium,
			asset.description,
			...(asset.record?.organization.tags.map((tag) => tag.value) ?? [])
		]
			.filter((value): value is string => Boolean(value))
			.some((value) => value.toLocaleLowerCase().includes(normalized))
	);
}

export function searchLibrary(input: {
	library: LibraryResponse;
	query: string;
	limit?: number;
}): LibrarySearchResults {
	const normalized = normalizeLibraryQuery(input.query);
	const limit = input.limit ?? 6;
	if (!normalized) {
		return { assets: [], projects: [], folders: [], tags: [], hasQuery: false, total: 0 };
	}

	const folders = buildFolderTree(input.library.folders)
		.flatMap(flattenFolderTree)
		.filter((folder) =>
			[folder.name, folder.path.join(' / ')]
				.some((value) => value.toLocaleLowerCase().includes(normalized))
		);
	const projects = input.library.projects.filter((project) =>
		[project.name, project.description ?? ''].some((value) =>
			value.toLocaleLowerCase().includes(normalized)
		)
	);
	const tags = input.library.tagFacets
		.flatMap((group) => group.tags)
		.filter((tag) =>
			[tag.value, tag.name, tag.facetName].some((value) =>
				value.toLocaleLowerCase().includes(normalized)
			)
		);
	const assets = filterAssetsByLibraryQuery(input.library.assets, normalized);
	return {
		assets: assets.slice(0, limit),
		projects: projects.slice(0, limit),
		folders: folders.slice(0, limit),
		tags: tags.slice(0, limit),
		hasQuery: true,
		total: assets.length + projects.length + folders.length + tags.length
	};
}

function flattenFolderTree(node: FolderTreeNode): FolderTreeNode[] {
	return [node, ...node.children.flatMap(flattenFolderTree)];
}
