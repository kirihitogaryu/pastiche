import { describe, expect, it } from 'vitest';
import { computeSourceHash, normalizeSource, sourceKeyForUrls } from './source-hash';

describe('extension source hashing', () => {
	it('uses source image URL before page URL', () => {
		expect.assertions(1);
		expect(sourceKeyForUrls(' https://example.com/image.jpg ', 'https://example.com/page')).toBe(
			'https://example.com/image.jpg'
		);
	});

	it('falls back to source URL when the image URL is absent', () => {
		expect.assertions(1);
		expect(sourceKeyForUrls(null, ' https://example.com/page ')).toBe('https://example.com/page');
	});

	it('normalizes URLs like the local library server', () => {
		expect.assertions(1);
		expect(normalizeSource(' HTTPS://Example.COM/Art.jpg#detail ')).toBe(
			'https://example.com/Art.jpg'
		);
	});

	it('computes a full sha256 hash compatible with /api/status source_hash', async () => {
		expect.assertions(2);
		const hash = await computeSourceHash('https://example.com/image.jpg');
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});
});
