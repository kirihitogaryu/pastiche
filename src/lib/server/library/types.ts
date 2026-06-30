import type {
	AiGenerationMetadata,
	LibraryAsset,
	LibraryAssetFacts,
	LibraryAssetImage,
	LibraryAssetRecord,
	LibraryAssetSource,
	LibraryProject,
	LibraryResponse,
	LibrarySourceType,
	LibraryTag,
	LibraryTagFacet,
	SourceTagSuggestion,
	StorageMode
} from '$lib/library/types';

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
	metadata?: LibraryImportMetadata | null;
};

export type LibraryImportMetadata = {
	sourceId?: string | null;
	sourceName?: string | null;
	sourceType?:
		| 'local'
		| 'web'
		| 'social'
		| 'gallery'
		| 'booru'
		| 'museum'
		| 'collection'
		| 'cdn'
		| 'unknown'
		| null;
	detailUrl?: string | null;
	creator?: string | null;
	artistProfileUrl?: string | null;
	artistUsername?: string | null;
	dateDisplay?: string | null;
	medium?: string | null;
	objectName?: string | null;
	department?: string | null;
	culture?: string | null;
	period?: string | null;
	rights?: string | null;
	tags?: string[];
	acceptedConceptSlugs?: string[];
	rawMetadata?: Record<string, unknown>;
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

export type {
	AiGenerationMetadata,
	LibraryAsset,
	LibraryAssetFacts,
	LibraryAssetImage,
	LibraryAssetRecord,
	LibraryAssetSource,
	LibraryProject,
	LibraryResponse,
	LibrarySourceType,
	LibraryTag,
	LibraryTagFacet,
	SourceTagSuggestion,
	StorageMode
};
