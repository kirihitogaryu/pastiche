import { libraryFolders, libraryPinnedProjects } from '$lib/data/library-organization';
import { mockAssets } from '$lib/data/mock-assets';
import type { LibraryResponse } from './types';

export function mockLibrarySnapshot(): LibraryResponse {
	const savedAssets = mockAssets.filter((asset) => asset.saved);
	return {
		assets: savedAssets.map((asset) => ({
			...asset,
			storageMode: 'url_reference',
			sourceImageUrl: asset.imageUrl,
			importedAt: '2026-05-27T12:00:00.000Z',
			capturedAt: '2026-05-27T12:00:00.000Z'
		})),
		folders: libraryFolders,
		projects: libraryPinnedProjects.map((project) => ({
			id: project.id,
			name: project.name,
			description: project.description,
			pinned: project.pinned,
			coverAssetId: project.coverAssetIds[0] ?? null,
			assetCount: project.assetIds.length,
			folderCount: 0,
			createdAt: '2026-05-27T12:00:00.000Z',
			updatedAt: '2026-05-27T12:00:00.000Z'
		})),
		tagFacets: [],
		stats: {
			assets: savedAssets.length,
			projects: libraryPinnedProjects.length,
			folders: libraryFolders.length,
			tags: 0
		}
	};
}
