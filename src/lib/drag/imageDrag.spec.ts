// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { imageFileName } from './imageDrag';

describe('image drag payloads', () => {
	it('creates safe filenames while preserving known image formats', () => {
		expect(imageFileName('Dragon: study?', 'image/png', '/api/image?variant=original')).toBe(
			'Dragon- study-.png'
		);
		expect(imageFileName('Reference', 'image/jpeg', 'https://example.com/work.webp')).toBe(
			'Reference.webp'
		);
		expect(
			imageFileName('Vector study', 'image/svg+xml', 'data:image/svg+xml,%3Csvg%3E')
		).toBe('Vector study.svg');
		expect(imageFileName('Scan', 'image/tiff', 'https://example.com/image')).toBe('Scan.tif');
		expect(imageFileName('Existing scan', 'image/jpeg', 'https://example.com/image.tiff')).toBe(
			'Existing scan.tif'
		);
	});
});
