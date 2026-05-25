import { describe, expect, it } from 'vitest';
import { getExploreDisplayImageUrl, getExplorePreviewImageUrl } from './image-url';
import type { ExploreItem } from './types';

function createItem(overrides: Partial<ExploreItem>): ExploreItem {
	return {
		id: 'met-1',
		source: 'met',
		detailUrl: 'https://example.com/item/1',
		title: 'Test artwork',
		artistRaw: null,
		artistBio: null,
		artistNationality: null,
		dateDisplay: null,
		yearStart: null,
		yearEnd: null,
		medium: null,
		mediumCategory: null,
		objectName: null,
		department: null,
		culture: null,
		period: null,
		thumbUrl: null,
		imageUrl: 'https://example.com/image.jpg',
		additionalImages: [],
		isIIIF: false,
		description: null,
		tags: [],
		isHighlight: false,
		isPublicDomain: null,
		rawMetadata: {},
		...overrides
	};
}

describe('Explore image URLs', () => {
	it('uses normal image URLs directly for display and preview images', () => {
		const item = createItem({ imageUrl: 'https://images.example.com/object.jpg' });

		expect(getExploreDisplayImageUrl(item)).toBe('https://images.example.com/object.jpg');
		expect(getExplorePreviewImageUrl(item)).toBe('https://images.example.com/object.jpg');
	});

	it('builds concrete sized image URLs for IIIF display and preview images', () => {
		const item = createItem({
			source: 'artic',
			id: 'artic-1',
			imageUrl: 'https://www.artic.edu/iiif/2/abc123/',
			isIIIF: true
		});

		expect(getExploreDisplayImageUrl(item)).toBe(
			'https://www.artic.edu/iiif/2/abc123/full/1200,/0/default.jpg'
		);
		expect(getExplorePreviewImageUrl(item)).toBe(
			'https://www.artic.edu/iiif/2/abc123/full/1600,/0/default.jpg'
		);
	});
});
