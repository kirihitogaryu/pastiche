import type { ExploreFacetOption } from '$lib/state/app-state.svelte';
import type { ExploreItem } from './types';

export type ArticExploreFilters = {
	publicDomainOnly: boolean;
	mediumCategory: string | null;
	objectName: string | null;
	department: string | null;
	cultureLocation: string | null;
	movementEra: string | null;
};

export type ArticFilterOptions = {
	mediumCategories: ExploreFacetOption[];
	objectNames: ExploreFacetOption[];
	departments: ExploreFacetOption[];
	cultureLocations: ExploreFacetOption[];
	movementEras: ExploreFacetOption[];
};

export function hasActiveArticMetadataFilters(filters: ArticExploreFilters) {
	return Boolean(
		filters.mediumCategory ||
		filters.objectName ||
		filters.department ||
		filters.cultureLocation ||
		filters.movementEra
	);
}

export function filterArticItems(itemsToFilter: ExploreItem[], filters: ArticExploreFilters) {
	if (!hasActiveArticMetadataFilters(filters)) return itemsToFilter;
	return itemsToFilter.filter((item) => {
		if (filters.mediumCategory && item.mediumCategory !== filters.mediumCategory) return false;
		if (filters.objectName && item.objectName !== filters.objectName) return false;
		if (filters.department && item.department !== filters.department) return false;
		if (filters.cultureLocation && !itemMatchesCultureLocation(item, filters.cultureLocation)) {
			return false;
		}
		if (filters.movementEra && item.period !== filters.movementEra) return false;
		return true;
	});
}

export function buildArticFilterOptions(itemsForOptions: ExploreItem[]): ArticFilterOptions {
	return {
		mediumCategories: facetOptions(
			itemsForOptions.map((item) => item.mediumCategory),
			(value) => labelize(value)
		),
		objectNames: facetOptions(itemsForOptions.map((item) => item.objectName)),
		departments: facetOptions(itemsForOptions.map((item) => item.department)),
		cultureLocations: facetOptions(itemsForOptions.flatMap(cultureLocationValues)),
		movementEras: facetOptions(itemsForOptions.map((item) => item.period))
	};
}

export function emptyArticFilterOptions(): ArticFilterOptions {
	return {
		mediumCategories: [],
		objectNames: [],
		departments: [],
		cultureLocations: [],
		movementEras: []
	};
}

function facetOptions(
	values: Array<string | null | undefined>,
	labelFor: (value: string) => string = (value) => value
): ExploreFacetOption[] {
	const counts = new Map<string, number>();
	for (const value of values) {
		const normalized = value?.trim();
		if (!normalized) continue;
		counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || labelFor(a[0]).localeCompare(labelFor(b[0])))
		.slice(0, 12)
		.map(([value, count]) => ({ value, label: labelFor(value), count }));
}

function cultureLocationValues(item: ExploreItem) {
	return uniqueStrings([item.culture, ...item.tags.filter(isLocationLikeTag)]);
}

function itemMatchesCultureLocation(item: ExploreItem, value: string) {
	return item.culture === value || item.tags.some((tag) => tag.trim() === value);
}

function isLocationLikeTag(tag: string) {
	const trimmed = tag.trim();
	return trimmed.includes(',') || LOCATION_TAGS.has(trimmed);
}

function labelize(value: string) {
	return value
		.split(/[-_]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function uniqueStrings(values: Array<string | null | undefined>) {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const trimmed = value?.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		result.push(trimmed);
	}
	return result;
}

const LOCATION_TAGS = new Set([
	'Africa',
	'Argentina',
	'Austria',
	'Belgium',
	'Brazil',
	'Canada',
	'China',
	'Denmark',
	'Egypt',
	'England',
	'France',
	'Germany',
	'Greece',
	'India',
	'Iran',
	'Iraq',
	'Ireland',
	'Italy',
	'Japan',
	'Korea',
	'Mexico',
	'Netherlands',
	'Peru',
	'Russia',
	'Scotland',
	'Spain',
	'Sweden',
	'Switzerland',
	'Turkey',
	'United Kingdom',
	'United States'
]);
