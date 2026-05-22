import type { AppMode, Project } from '$lib/types';

export const appModes: Array<{ id: AppMode; label: string }> = [
	{ id: 'home', label: 'Home' },
	{ id: 'library', label: 'Library' },
	{ id: 'explore', label: 'Explore' },
	{ id: 'canvas', label: 'Canvas' },
	{ id: 'colors', label: 'Colors' },
	{ id: 'resources', label: 'Resources' }
];

export const mobileModes: AppMode[] = ['library', 'explore', 'canvas', 'resources'];

export const libraryFolders = [
	{ path: ['library', 'refs'], label: 'refs', count: 8731 },
	{ path: ['library', 'refs', 'landscapes'], label: 'landscapes', count: 1624 },
	{ path: ['library', 'refs', 'portraits'], label: 'portraits', count: 1142 },
	{ path: ['library', 'refs', 'abstract'], label: 'abstract', count: 982 },
	{ path: ['library', 'refs', 'abstract', 'paintings'], label: 'paintings', count: 428 },
	{ path: ['library', 'refs', 'abstract', 'ink'], label: 'ink', count: 187 },
	{ path: ['library', 'refs', 'sketches'], label: 'sketches', count: 206 },
	{ path: ['library', 'refs', 'digital'], label: 'digital', count: 161 }
];

export const smartFolders = [
	{ label: 'Warm Colors', count: 312 },
	{ label: 'High Contrast', count: 198 },
	{ label: 'Recently Added', count: 428 },
	{ label: 'Untagged', count: 76 }
];

export const libraryChips = ['all', 'abstract', 'color field', 'geometric', 'splatter', 'composition'];
export const exploreChips = [
	'All',
	'Painting',
	'Drawing',
	'Print',
	'Photography',
	'Digital Art',
	'Sculpture',
	'Architecture'
];

export const exploreSources = ['All Sources', 'The Met', 'MoMA', 'Wikimedia', 'Europeana', 'Artvee'];

export const pinnedProjects: Project[] = [
	{
		id: 'project-coastal-studies',
		name: 'Coastal Studies',
		description: 'Light, architecture, and Mediterranean color notes for a painting series.',
		pinned: true,
		assetIds: ['coastal-village', 'summer-studio', 'church-hillside'],
		canvasCount: 3
	},
	{
		id: 'project-abstract-warmth',
		name: 'Abstract Warmth',
		description: 'Color-field references, palette experiments, and compositional studies.',
		pinned: true,
		assetIds: ['crimson-horizon', 'orange-black-orbit', 'rose-band'],
		canvasCount: 2
	}
];
