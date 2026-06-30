export type CaptureCommandId = 'pick' | 'tab' | 'area' | 'batch' | 'visible' | 'page' | 'drag';

export type CaptureCommand = {
	id: CaptureCommandId;
	label: string;
	title: string;
	shortcut: string | null;
	enabled: boolean;
	icon: 'crosshair' | 'image' | 'area' | 'grid' | 'viewport' | 'page' | 'drag';
};

export const captureCommands: CaptureCommand[] = [
	{
		id: 'pick',
		label: 'Pick',
		title: 'Pick an image from the page',
		shortcut: 'Alt 0',
		enabled: true,
		icon: 'crosshair'
	},
	{
		id: 'tab',
		label: 'URL',
		title: 'Capture the active tab as a direct image URL',
		shortcut: null,
		enabled: true,
		icon: 'image'
	},
	{
		id: 'area',
		label: 'Area',
		title: 'Capture images inside a drawn area',
		shortcut: 'Alt 2',
		enabled: true,
		icon: 'area'
	},
	{
		id: 'batch',
		label: 'Batch',
		title: 'Scan the page for image candidates',
		shortcut: 'Alt 1',
		enabled: true,
		icon: 'grid'
	},
	{
		id: 'visible',
		label: 'Visible',
		title: 'Capture the visible viewport',
		shortcut: 'Alt 3',
		enabled: false,
		icon: 'viewport'
	},
	{
		id: 'page',
		label: 'Page',
		title: 'Capture the full page',
		shortcut: 'Alt 4',
		enabled: false,
		icon: 'page'
	},
	{
		id: 'drag',
		label: 'Drag',
		title: 'Drag images into Pastiche',
		shortcut: null,
		enabled: false,
		icon: 'drag'
	}
];
