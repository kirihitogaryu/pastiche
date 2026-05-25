import { describe, expect, it } from 'vitest';
import { buildIiifImageUrl, normalizeIiifBaseUrl } from './iiif';

describe('IIIF helpers', () => {
	it('normalizes an IIIF base URL without trailing slash', () => {
		expect(normalizeIiifBaseUrl('https://www.artic.edu/iiif/2/abc123/')).toBe(
			'https://www.artic.edu/iiif/2/abc123'
		);
	});

	it('builds sized IIIF image URLs', () => {
		expect(buildIiifImageUrl('https://www.artic.edu/iiif/2/abc123', '400,')).toBe(
			'https://www.artic.edu/iiif/2/abc123/full/400,/0/default.jpg'
		);
	});
});
