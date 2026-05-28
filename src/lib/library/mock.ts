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
		stats: {
			assets: savedAssets.length,
			projects: libraryPinnedProjects.length,
			folders: libraryFolders.length
		}
	};
}
