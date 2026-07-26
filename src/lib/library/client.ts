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
	const response = await fetch('/api/library/structure');
	if (!response.ok) throw new Error('Library could not be loaded.');
	const structure = (await response.json()) as LibraryResponse;
	const assets = [] as LibraryResponse['assets'];
	let cursor: string | null = null;
	do {
		const parameters = new URLSearchParams({ limit: '250' });
		if (cursor) parameters.set('cursor', cursor);
		const pageResponse = await fetch(`/api/library/assets?${parameters}`);
		if (!pageResponse.ok) throw new Error('Library assets could not be loaded.');
		const page = (await pageResponse.json()) as {
			assets: LibraryResponse['assets'];
			page: { nextCursor: string | null };
		};
		assets.push(...page.assets);
		const previousCursor: string | null = cursor;
		cursor = page.page.nextCursor;
		if (cursor && cursor === previousCursor) throw new Error('Library pagination did not advance.');
	} while (cursor);
	const snapshot = { ...structure, assets };
	if (dev && snapshot.assets.length === 0) return mockLibrarySnapshot();
	return snapshot;
}
