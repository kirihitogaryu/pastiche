import { describe, expect, it } from 'vitest';
import { policyForSource } from './storage-policy';

describe('extension storage policy', () => {
	it('defaults every captured web image to an immediate local original', () => {
		for (const url of [
			'https://unknown.example/image.jpg',
			'https://www.metmuseum.org/art/collection/search/1',
			'https://upload.wikimedia.org/work.png',
			'https://www.instagram.com/p/ABC/media?size=l'
		]) {
			expect(policyForSource(url)).toMatchObject({
				mode: 'download',
				reason: 'Original stored locally'
			});
		}
	});
});
