export type AppMode = 'home' | 'library' | 'explore' | 'atlas' | 'canvas' | 'colors' | 'resources';
export type AssetSource = 'library' | 'explore';
export type MobileState = 'browse' | 'selecting' | 'adding' | 'inspecting';

export type PaletteSwatch = {
	hex: string;
	label: string;
};

export type Asset = {
	id: string;
	title: string;
	creator: string;
	year: string;
	medium: string;
	sourceName: string;
	sourceUrl?: string;
	sourceType: 'local' | 'web' | 'museum' | 'collection';
	imageUrl: string;
	width: number;
	height: number;
	tags: string[];
	palette: PaletteSwatch[];
	description: string;
	notes?: string;
	favorite?: boolean;
	saved: boolean;
	projects: string[];
	folderPath: string[];
};

export type Project = {
	id: string;
	name: string;
	description: string;
	pinned: boolean;
	assetIds: string[];
	canvasCount: number;
};

export type LibraryView = 'overview' | 'all' | 'folder' | 'smart' | 'tag' | 'project';

export type LibraryFolder = {
	id: string;
	name: string;
	path: string[];
	assetCount: number;
	childFolderCount: number;
	parentId?: string;
};

export type SmartFolder = {
	id: string;
	label: string;
	count: number;
	icon: 'star' | 'clock' | 'tag' | 'link';
};

export type LibraryProjectSummary = Project & {
	noteCount: number;
	coverAssetIds: string[];
};
