import type {
	LibraryAsset,
	LibraryResponse,
	LibraryTag,
	LibraryTagFacet
} from '$lib/library/types';
import type { LibraryFilterState } from '$lib/state/app-state.svelte';
import type { Asset, LibraryFolder, SmartFolder } from '$lib/types';

export type FolderTreeNode = LibraryFolder & {
	children: FolderTreeNode[];
	depth: number;
};

export type LibrarySearchResults = {
	folders: FolderTreeNode[];
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

export function visibleTagGroups(
	groups: LibraryTagFacet[],
	includeEmpty = false
): LibraryTagFacet[] {
	return groups.filter(
		(group) => includeEmpty || group.tags.length > 0 || group.slug === 'general'
	);
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
	query: string,
	resolvedExpressions: string[] = []
): LibraryAsset[] {
	const segments = query.split(',').map(normalizeLibraryQuery).filter(Boolean);
	if (!segments.length) return assets;
	return assets.filter((asset) =>
		segments.every((segment, index) =>
			matchesLibraryQuery(
				asset,
				index === segments.length - 1 ? [segment, ...resolvedExpressions] : [segment]
			)
		)
	);
}

function matchesLibraryQuery(asset: LibraryAsset, queries: string[]) {
	const metadataValues = [
		asset.title,
		asset.creator,
		asset.sourceName,
		asset.medium,
		asset.description
	].filter((value): value is string => Boolean(value));
	const tagValues = [
		...asset.tags,
		...(asset.record?.organization.tags.flatMap((tag) => [tag.value, tag.name, tag.slug]) ?? []),
		...(asset.record?.organization.atlasTags?.flatMap((tag) => [
			tag.expression,
			tag.slug,
			tag.label
		]) ?? [])
	];

	return queries.some((query) => {
		const textQuery = normalizeSearchText(query);
		const slugQuery = normalizeSearchSlug(query);
		if (!textQuery) return false;
		if (
			metadataValues.some((value) => normalizeSearchText(value).includes(textQuery)) ||
			tagValues.some((value) => {
				const text = normalizeSearchText(value);
				const slug = normalizeSearchSlug(value);
				return (
					text.includes(textQuery) || slug.includes(slugQuery) || fuzzyTagMatch(slugQuery, slug)
				);
			})
		) {
			return true;
		}
		return false;
	});
}

function normalizeSearchText(value: string) {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/[_.:()[\]-]+/g, ' ')
		.replace(/\s+/g, ' ');
}

function normalizeSearchSlug(value: string) {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_:().-]+/g, '');
}

function fuzzyTagMatch(query: string, candidate: string) {
	if (query.length < 4 || candidate.length < 4) return false;
	const threshold = query.length >= 8 ? 2 : 1;
	if (Math.abs(query.length - candidate.length) <= threshold) {
		return editDistanceWithin(query, candidate, threshold);
	}
	return candidate
		.split(/[_.:()-]+/)
		.some(
			(part) =>
				Math.abs(query.length - part.length) <= threshold &&
				editDistanceWithin(query, part, threshold)
		);
}

function editDistanceWithin(first: string, second: string, maximum: number) {
	if (Math.abs(first.length - second.length) > maximum) return false;
	let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
	for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
		const current = [firstIndex];
		let rowMinimum = current[0];
		for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
			const cost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
			const value = Math.min(
				previous[secondIndex] + 1,
				current[secondIndex - 1] + 1,
				previous[secondIndex - 1] + cost
			);
			current.push(value);
			rowMinimum = Math.min(rowMinimum, value);
		}
		if (rowMinimum > maximum) return false;
		previous = current;
	}
	return previous[second.length] <= maximum;
}

export function filterAssetsByLibraryFilters(
	assets: LibraryAsset[],
	filters: LibraryFilterState
): LibraryAsset[] {
	return assets.filter((asset) => {
		if (filters.favoritesOnly && !asset.favorite) return false;
		if (filters.untaggedOnly && asset.tags.length > 0) return false;
		if (filters.missingSourceOnly && asset.sourceUrl) return false;
		if (filters.folderId && asset.record?.organization.folderId !== filters.folderId) return false;
		if (filters.projectId && !asset.projects.includes(filters.projectId)) return false;
		if (
			filters.tagIds.length > 0 &&
			!asset.record?.organization.tags.some((tag) => filters.tagIds.includes(tag.id))
		) {
			return false;
		}
		if (
			filters.sourceTypes.length > 0 &&
			!filters.sourceTypes.includes(asset.record?.source.type ?? asset.sourceType)
		) {
			return false;
		}
		if (
			filters.importers.length > 0 &&
			!filters.importers.includes(asset.record?.raw.importer ?? 'manual')
		) {
			return false;
		}
		for (const [key, value] of Object.entries(filters.metadata)) {
			if (value && asset.record?.facts[key as keyof typeof filters.metadata] !== value)
				return false;
		}
		if (
			filters.orientation &&
			imageOrientation(asset.width, asset.height) !== filters.orientation
		) {
			return false;
		}
		return true;
	});
}

export function searchLibrary(input: {
	library: LibraryResponse;
	query: string;
	limit?: number;
}): LibrarySearchResults {
	const normalized = normalizeLibraryQuery(input.query);
	const limit = input.limit ?? 6;
	if (!normalized) {
		return { folders: [], hasQuery: false, total: 0 };
	}

	const folders = buildFolderTree(input.library.folders)
		.flatMap(flattenFolderTree)
		.filter((folder) =>
			[folder.name, folder.path.join(' / ')].some((value) =>
				value.toLocaleLowerCase().includes(normalized)
			)
		);
	return {
		folders: folders.slice(0, limit),
		hasQuery: true,
		total: folders.length
	};
}

function imageOrientation(width: number, height: number) {
	if (Math.abs(width - height) <= Math.max(width, height) * 0.08) return 'square';
	return width > height ? 'landscape' : 'portrait';
}

function flattenFolderTree(node: FolderTreeNode): FolderTreeNode[] {
	return [node, ...node.children.flatMap(flattenFolderTree)];
}
