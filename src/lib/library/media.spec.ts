import { describe, expect, it } from 'vitest';
import { isGifMedia } from './media';

describe('isGifMedia', () => {
	it('detects a GIF when its filename is one of several metadata candidates', () => {
		expect(
			isGifMedia(
				null,
				'turtwig_Parent_Blend___animated_2x.gif',
				'/api/library/assets/asset-1/image?variant=original'
			)
		).toBe(true);
	});

	it('detects extensionless GIF assets from their stored media type', () => {
		expect(isGifMedia('image/gif', '/api/library/assets/asset-1/image')).toBe(true);
	});

	it('does not classify a normal static image as a GIF', () => {
		expect(isGifMedia('image/webp', 'reference.webp', 'Animated character study')).toBe(false);
	});
});
