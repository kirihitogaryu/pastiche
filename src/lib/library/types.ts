import type { Asset, LibraryFolder } from '$lib/types';

export type StorageMode = 'download' | 'url_reference' | 'lazy_download';

export type LibrarySourceType =
	| 'museum'
	| 'artist_site'
	| 'social'
	| 'gallery'
	| 'ai_generator'
	| 'cdn'
	| 'local'
	| 'unknown';

export type LibraryAssetSource = {
	label: string;
	type: LibrarySourceType;
	pageUrl: string | null;
	imageUrl: string | null;
	imageHost: string | null;
	domain: string | null;
	sourceId: string | null;
};

export type LibraryAssetImage = {
	previewUrl: string | null;
	originalUrl: string | null;
	sourceImageUrl: string | null;
	localOriginalAvailable: boolean;
	localThumbnailAvailable: boolean;
};

export type LibraryAssetFacts = {
	medium?: string;
	type?: string;
	department?: string;
	culture?: string;
	period?: string;
	rights?: string;
};

export type LibraryTagFacet = {
	id: string;
	name: string;
	slug: string;
	tagCount: number;
};

export type LibraryTag = {
	id: string;
	facetId: string;
	facetName: string;
	facetSlug: string;
	value: string;
	name: string;
	slug: string;
	assetCount: number;
};

export type SourceTagSuggestion = {
	name: string;
	slug: string;
	facetName: string;
	facetSlug: string;
	value: string;
	accepted: boolean;
	useful: boolean;
};

export type LibraryProject = {
	id: string;
	name: string;
	description: string | null;
	pinned: boolean;
	coverAssetId: string | null;
	assetCount: number;
	folderCount: number;
	createdAt: string;
	updatedAt: string;
};

export type AiGenerationMetadata = {
	provider: 'novelai' | 'stable_diffusion' | 'midjourney' | 'dalle' | 'unknown';
	prompt: string | null;
	negativePrompt: string | null;
	model: string | null;
	seed: string | number | null;
	sampler: string | null;
	steps: number | null;
	cfgScale: number | null;
	rawParameters: Record<string, unknown>;
	promptTagSuggestions: string[];
};

export type LibraryAssetRecord = {
	id: string;
	title: string;
	artist: string | null;
	description: string | null;
	dates: {
		dateDisplay: string | null;
		importedAt: string;
		capturedAt: string;
		modifiedAt: string | null;
	};
	dimensions: {
		width: number;
		height: number;
	};
	source: LibraryAssetSource;
	image: LibraryAssetImage;
	facts: LibraryAssetFacts;
	organization: {
		folderId: string | null;
		folderPath: string[];
		tags: LibraryTag[];
		sourceTagSuggestions: SourceTagSuggestion[];
		projects: string[];
		favorite: boolean;
	};
	generation: AiGenerationMetadata | null;
	raw: {
		importer: 'explore' | 'extension' | 'manual';
		sourceMetadata: Record<string, unknown>;
	};
};

export type LibraryAsset = Asset & {
	storageMode: StorageMode;
	sourceImageUrl: string | null;
	importedAt: string;
	capturedAt: string;
	record?: LibraryAssetRecord;
};

export type LibraryResponse = {
	assets: LibraryAsset[];
	folders: LibraryFolder[];
	projects: LibraryProject[];
	tagFacets: LibraryTagFacet[];
	stats: {
		assets: number;
		projects: number;
		folders: number;
		tags: number;
	};
};
