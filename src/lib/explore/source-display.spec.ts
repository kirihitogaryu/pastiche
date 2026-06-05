import { describe, expect, it } from 'vitest';
import type { ExploreItem } from './types';
import { exploreSourceLabel } from './source-display';

function item(patch: Partial<ExploreItem>): ExploreItem {
	return {
		id: 'id',
		source: 'wikidata',
		detailUrl: 'https://www.wikidata.org/wiki/Q1',
		title: 'Title',
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
		imageUrl: null,
		additionalImages: [],
		isIIIF: false,
		description: null,
		tags: [],
		isHighlight: false,
		isPublicDomain: null,
		rawMetadata: {},
		...patch
	};
}

describe('explore source display', () => {
	it('labels Commons reference items as Wikimedia Commons', () => {
		expect(
			exploreSourceLabel(
				item({
					detailUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
					rawMetadata: { wikimediaReference: { lane: 'text' } }
				})
			)
		).toBe('Wikimedia Commons');
	});

	it('keeps Wikidata artwork records labeled as Wikidata', () => {
		expect(exploreSourceLabel(item({ rawMetadata: { wikidata: { id: 'Q1' } } }))).toBe('Wikidata');
	});
});
