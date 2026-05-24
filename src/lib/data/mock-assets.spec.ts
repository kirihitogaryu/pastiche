import { describe, expect, it } from 'vitest';
import { exploreAssets, libraryAssets, mockAssets } from './mock-assets';
import {
	findFolderByPath,
	getChildFolders,
	getDirectFolderAssets,
	getFullLibraryAssets
} from './library-organization';

describe('mock asset fixtures', () => {
	it('splits saved assets from explore-only assets', () => {
		expect(mockAssets.length).toBeGreaterThan(8);
		expect(libraryAssets.every((asset) => asset.saved)).toBe(true);
		expect(exploreAssets.every((asset) => !asset.saved)).toBe(true);
	});

	it('keeps fixture metadata useful for the first interface slice', () => {
		for (const asset of mockAssets) {
			expect(asset.title).toBeTruthy();
			expect(asset.imageUrl).toMatch(/^data:image\/svg\+xml/);
			expect(asset.tags.length).toBeGreaterThan(0);
			expect(asset.palette.length).toBeGreaterThan(0);
			expect(asset.folderPath.length).toBeGreaterThan(1);
		}
	});
});

describe('library organization helpers', () => {
	it('treats full library as every saved asset', () => {
		const assets = getFullLibraryAssets();
		expect(assets.length).toBeGreaterThan(0);
		expect(assets.every((asset) => asset.saved)).toBe(true);
	});

	it('treats folders as direct containers by default', () => {
		const folder = findFolderByPath(['library', 'refs', 'artworks']);
		const assets = getDirectFolderAssets(folder.path);
		expect(assets.length).toBeGreaterThan(0);
		expect(assets.every((asset) => asset.folderPath.join('/') === folder.path.join('/'))).toBe(
			true
		);
	});

	it('returns only direct child folders for folder navigation', () => {
		const folder = findFolderByPath(['library', 'refs', 'artworks']);
		const children = getChildFolders(folder.id);
		expect(children.map((child) => child.name)).toEqual([
			'impressionism',
			'lighting',
			'architecture',
			'figure'
		]);
	});
});
