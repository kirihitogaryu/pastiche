import type { LibraryAsset, LibraryResponse, StorageMode } from '$lib/library/types';

export type ImportRequest = {
	destination_folder_id: string | null;
	create_folder_name?: string;
	items: ImportItem[];
};

export type ImportItem = {
	filename: string;
	storage_mode: StorageMode;
	image_data: string | null;
	source_image_url: string | null;
	mime_type: string | null;
	natural_width: number;
	natural_height: number;
	source_url: string;
	page_title: string | null;
	alt_text: string | null;
	captured_at: string;
};

export type ImportedItem = {
	index: number;
	asset_id: string;
	source_hash: string;
	duplicate: boolean;
};

export type FailedImportItem = {
	index: number;
	error: string;
};

export type ImportResponse = {
	imported: ImportedItem[];
	failed: FailedImportItem[];
};

export type StatusResponse = {
	connected: true;
	unassigned_count: number;
	recent_folders: Array<{
		id: string;
		name: string;
		last_used: string;
	}>;
	imported_sources: Array<{
		source_hash: string;
		source_image_url: string | null;
		source_url: string;
	}>;
};

export type { LibraryAsset, LibraryResponse, StorageMode };
