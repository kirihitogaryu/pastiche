import type { Asset, LibraryFolder } from '$lib/types';

export type StorageMode = 'download' | 'url_reference' | 'lazy_download';

export type LibraryAsset = Asset & {
	storageMode: StorageMode;
	sourceImageUrl: string | null;
	importedAt: string;
	capturedAt: string;
};

export type LibraryResponse = {
	assets: LibraryAsset[];
	folders: LibraryFolder[];
	stats: {
		assets: number;
		projects: number;
		folders: number;
	};
};
