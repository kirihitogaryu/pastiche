import { describe, expect, it } from 'vitest';
import type { ExploreItem } from './types';
import {
	buildArticFilterOptions,
	filterArticItems,
	hasActiveArticMetadataFilters
} from './artic-filters';
import type { ArticExploreFilters } from './artic-filters';

const baseItem: ExploreItem = {
	id: 'artic-1',
	source: 'artic',
	detailUrl: 'https://example.com/1',
	title: 'Work',
	artistRaw: null,
	artistBio: null,
	artistNationality: null,
	dateDisplay: null,
	yearStart: null,
	yearEnd: null,
	medium: 'Oil on canvas',
	mediumCategory: 'oil',
	objectName: 'Painting',
	department: 'Arts of the Americas',
	culture: 'United States',
	period: 'Modernism',
	thumbUrl: null,
	imageUrl: 'https://example.com/image',
	additionalImages: [],
	isIIIF: true,
	description: null,
	tags: [],
	isHighlight: false,
	isPublicDomain: true,
	rawMetadata: {}
};

function item(id: string, patch: Partial<ExploreItem>): ExploreItem {
	return { ...baseItem, id, ...patch };
}

function filters(patch: Partial<ArticExploreFilters> = {}): ArticExploreFilters {
	return {
		publicDomainOnly: false,
		mediumCategory: null,
		objectName: null,
		department: null,
		cultureLocation: null,
		movementEra: null,
		...patch
	};
}

describe('Art Institute explore filters', () => {
	it('builds separate culture/location and movement/era facets from loaded result metadata', () => {
		const options = buildArticFilterOptions([
			item('artic-1', { culture: 'United States', period: 'Modernism', tags: ['Venice, Italy'] }),
			item('artic-2', { culture: 'United States', period: 'Realism' }),
			item('artic-3', { culture: 'France', period: 'Modernism' })
		]);

		expect(options.cultureLocations).toEqual([
			{ value: 'United States', label: 'United States', count: 2 },
			{ value: 'France', label: 'France', count: 1 },
			{ value: 'Venice, Italy', label: 'Venice, Italy', count: 1 }
		]);
		expect(options.movementEras).toEqual([
			{ value: 'Modernism', label: 'Modernism', count: 2 },
			{ value: 'Realism', label: 'Realism', count: 1 }
		]);
	});

	it('filters Art Institute results by culture/location and movement/era independently', () => {
		const items = [
			item('artic-1', { culture: 'United States', period: 'Modernism', tags: ['Venice, Italy'] }),
			item('artic-2', { culture: 'United States', period: 'Realism' }),
			item('artic-3', { culture: 'France', period: 'Modernism' })
		];

		expect(
			filterArticItems(items, filters({ cultureLocation: 'United States' })).map((i) => i.id)
		).toEqual(['artic-1', 'artic-2']);
		expect(filterArticItems(items, filters({ movementEra: 'Modernism' })).map((i) => i.id)).toEqual(
			['artic-1', 'artic-3']
		);
		expect(
			filterArticItems(items, filters({ cultureLocation: 'Venice, Italy' })).map((i) => i.id)
		).toEqual(['artic-1']);
		expect(
			filterArticItems(
				items,
				filters({ cultureLocation: 'United States', movementEra: 'Modernism' })
			).map((i) => i.id)
		).toEqual(['artic-1']);
	});

	it('treats culture/location and movement/era as active metadata filters', () => {
		expect(hasActiveArticMetadataFilters(filters())).toBe(false);
		expect(hasActiveArticMetadataFilters(filters({ cultureLocation: 'United States' }))).toBe(true);
		expect(hasActiveArticMetadataFilters(filters({ movementEra: 'Modernism' }))).toBe(true);
	});
});
