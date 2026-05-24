import type { Asset, LibraryFolder, LibraryProjectSummary, SmartFolder } from '$lib/types';
import { mockAssets } from '$lib/data/mock-assets';
import { pinnedProjects } from '$lib/data/mock-navigation';

export const libraryOverviewStats = {
	assets: 12842,
	projects: 14,
	folders: 38
};

export const libraryTopFolders: LibraryFolder[] = [
	{ id: 'refs', name: 'refs', path: ['library', 'refs'], assetCount: 8731, childFolderCount: 9 },
	{
		id: 'imports',
		name: 'imports',
		path: ['library', 'imports'],
		assetCount: 842,
		childFolderCount: 3
	},
	{
		id: 'resources',
		name: 'resources',
		path: ['library', 'resources'],
		assetCount: 216,
		childFolderCount: 5
	},
	{
		id: 'inspiration',
		name: 'inspiration',
		path: ['library', 'inspiration'],
		assetCount: 142,
		childFolderCount: 2
	},
	{
		id: 'personal',
		name: 'personal',
		path: ['library', 'personal'],
		assetCount: 93,
		childFolderCount: 1
	}
];

export const libraryFolders: LibraryFolder[] = [
	...libraryTopFolders,
	{
		id: 'refs-artworks',
		name: 'artworks',
		path: ['library', 'refs', 'artworks'],
		parentId: 'refs',
		assetCount: 428,
		childFolderCount: 4
	},
	{
		id: 'refs-artworks-impressionism',
		name: 'impressionism',
		path: ['library', 'refs', 'artworks', 'impressionism'],
		parentId: 'refs-artworks',
		assetCount: 82,
		childFolderCount: 0
	},
	{
		id: 'refs-artworks-lighting',
		name: 'lighting',
		path: ['library', 'refs', 'artworks', 'lighting'],
		parentId: 'refs-artworks',
		assetCount: 41,
		childFolderCount: 0
	},
	{
		id: 'refs-artworks-architecture',
		name: 'architecture',
		path: ['library', 'refs', 'artworks', 'architecture'],
		parentId: 'refs-artworks',
		assetCount: 33,
		childFolderCount: 0
	},
	{
		id: 'refs-artworks-figure',
		name: 'figure',
		path: ['library', 'refs', 'artworks', 'figure'],
		parentId: 'refs-artworks',
		assetCount: 27,
		childFolderCount: 0
	}
];

export const librarySmartFolders: SmartFolder[] = [
	{ id: 'favorites', label: 'Favorites', count: 1203, icon: 'star' },
	{ id: 'recently-added', label: 'Recently Added', count: 842, icon: 'clock' },
	{ id: 'untagged', label: 'Untagged', count: 76, icon: 'tag' },
	{ id: 'missing-source', label: 'Missing Source', count: 231, icon: 'link' }
];

export const librarySectionChips = ['Overview', 'Projects', 'Folders', 'Smart', 'Tags'];

export const libraryPinnedProjects: LibraryProjectSummary[] = pinnedProjects.map(
	(project, index) => ({
		...project,
		noteCount: index === 0 ? 5 : 3,
		coverAssetIds: project.assetIds.slice(0, 4)
	})
);

export function findFolderByPath(path: string[]) {
	return (
		libraryFolders.find((folder) => folder.path.join('/') === path.join('/')) ?? libraryFolders[0]
	);
}

export function getChildFolders(parentId: string) {
	return libraryFolders.filter((folder) => folder.parentId === parentId);
}

export function getFullLibraryAssets() {
	return mockAssets.filter((asset) => asset.saved);
}

export function getDirectFolderAssets(path: string[]) {
	const folderKey = path.join('/');
	return mockAssets.filter(
		(asset: Asset) => asset.saved && asset.folderPath.join('/') === folderKey
	);
}
