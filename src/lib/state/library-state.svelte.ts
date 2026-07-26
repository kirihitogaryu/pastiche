import { emptyLibrarySnapshot } from '$lib/library/client';
import type { LibraryAsset, LibraryResponse } from '$lib/library/types';

export const libraryState = $state({
	snapshot: emptyLibrarySnapshot()
});

export function setLibrarySnapshot(snapshot: LibraryResponse) {
	libraryState.snapshot = snapshot;
}

export function replaceLibraryAsset(asset: LibraryAsset) {
	const previous = libraryState.snapshot.assets.find((item) => item.id === asset.id);
	const previousFolderId = previous?.record?.organization.folderId ?? null;
	const nextFolderId = asset.record?.organization.folderId ?? null;
	libraryState.snapshot = {
		...libraryState.snapshot,
		assets: libraryState.snapshot.assets.map((item) => (item.id === asset.id ? asset : item)),
		folders: libraryState.snapshot.folders.map((folder) => ({
			...folder,
			assetCount:
				folder.assetCount +
				(folder.id === nextFolderId && folder.id !== previousFolderId ? 1 : 0) -
				(folder.id === previousFolderId && folder.id !== nextFolderId ? 1 : 0)
		}))
	};
}
