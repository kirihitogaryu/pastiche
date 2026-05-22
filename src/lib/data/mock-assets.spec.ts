import { describe, expect, it } from 'vitest';
import { exploreAssets, libraryAssets, mockAssets } from './mock-assets';

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
