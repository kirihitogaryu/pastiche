import { describe, expect, it } from 'vitest';
import type { ExploreItem } from './types';
import { uniqueExploreItemsById } from './items';

const baseItem: ExploreItem = {
	id: 'wikidata-Q1',
	source: 'wikidata',
	detailUrl: 'https://www.wikidata.org/wiki/Q1',
	title: 'First',
	artistRaw: null,
	artistBio: null,
	artistNationality: null,
	dateDisplay: null,
	yearStart: null,
	yearEnd: null,
	medium: null,
	mediumCategory: null,
	objectName: 'Painting',
	department: null,
	culture: null,
	period: null,
	thumbUrl: 'https://example.test/first.jpg',
	imageUrl: 'https://example.test/first.jpg',
	additionalImages: [],
	isIIIF: false,
	description: null,
	tags: [],
	isHighlight: false,
	isPublicDomain: null,
	rawMetadata: {}
};

describe('Explore item helpers', () => {
	it('keeps the first item for each stable Explore id', () => {
		const duplicate = { ...baseItem, title: 'Duplicate title' };
		const second = { ...baseItem, id: 'wikidata-Q2', title: 'Second' };

		expect(uniqueExploreItemsById([baseItem, duplicate, second])).toEqual([baseItem, second]);
	});
});
