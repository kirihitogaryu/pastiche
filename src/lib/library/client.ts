import { dev } from '$app/environment';
import { mockLibrarySnapshot } from './mock';
import type { LibraryResponse } from './types';

export function emptyLibrarySnapshot(): LibraryResponse {
	return {
		assets: [],
		folders: [],
		projects: [],
		tagFacets: [],
		stats: { assets: 0, projects: 0, folders: 0, tags: 0 }
	};
}

export async function loadLibrarySnapshot(): Promise<LibraryResponse> {
	const response = await fetch('/api/library');
	if (!response.ok) throw new Error('Library could not be loaded.');
	const snapshot = (await response.json()) as LibraryResponse;
	if (dev && snapshot.assets.length === 0) return mockLibrarySnapshot();
	return snapshot;
}
