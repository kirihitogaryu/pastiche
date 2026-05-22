export type AppMode = 'home' | 'library' | 'explore' | 'canvas' | 'colors' | 'resources';
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
