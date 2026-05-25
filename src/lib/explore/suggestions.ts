import type { ExploreItem, ExploreSuggestion, SourceDepartment, SourceId } from './types';

const MEDIUM_SUGGESTION_LABELS = [
	'Paintings',
	'Sculpture',
	'Photographs',
	'Drawings',
	'Prints',
	'Textiles',
	'Ceramics',
	'Furniture',
	'Glass',
	'Metalwork'
];

export function buildExploreSuggestions(
	input: string,
	source: SourceId,
	items: ExploreItem[],
	departments: SourceDepartment[],
	limit = 8
): ExploreSuggestion[] {
	const query = input.trim().toLocaleLowerCase();
	if (query.length < 2) return [];

	const suggestions = [
		...tagSuggestions(items),
		...artistSuggestions(source, items),
		...departmentSuggestions(source, departments),
		...MEDIUM_SUGGESTION_LABELS.map((medium) => mediumSuggestion(source, medium))
	];
	const seen = new Set<string>();

	return suggestions
		.filter((suggestion) => suggestion.label.toLocaleLowerCase().includes(query))
		.filter((suggestion) => {
			const key = `${suggestion.kind}:${suggestion.label.toLocaleLowerCase()}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort((a, b) => scoreSuggestion(a, query) - scoreSuggestion(b, query))
		.slice(0, limit);
}

function tagSuggestions(items: ExploreItem[]): ExploreSuggestion[] {
	return items.flatMap((item) =>
		item.tags.map((tag) => ({
			id: `${item.source}-tag-${slug(tag)}`,
			label: tag,
			kind: 'tag',
			source: item.source,
			queryPatch: { tag }
		}))
	);
}

function artistSuggestions(source: SourceId, items: ExploreItem[]): ExploreSuggestion[] {
	return items
		.map((item) => item.artistRaw)
		.filter((artist): artist is string => Boolean(artist))
		.map((artist) => ({
			id: `${source}-artist-${slug(artist)}`,
			label: artist,
			kind: 'artist',
			source,
			queryPatch: { artist }
		}));
}

function departmentSuggestions(
	source: SourceId,
	departments: SourceDepartment[]
): ExploreSuggestion[] {
	return departments.map((department) => ({
		id: `${source}-department-${department.id}`,
		label: department.label,
		kind: 'department',
		source,
		queryPatch: { department: department.id }
	}));
}

function mediumSuggestion(source: SourceId, medium: string): ExploreSuggestion {
	return {
		id: `${source}-medium-${slug(medium)}`,
		label: medium,
		kind: 'medium',
		source,
		queryPatch: { medium }
	};
}

function scoreSuggestion(suggestion: ExploreSuggestion, query: string) {
	const label = suggestion.label.toLocaleLowerCase();
	const kindWeight = { tag: 0, artist: 1, medium: 2, department: 3, source: 4 }[suggestion.kind];
	return (label.startsWith(query) ? 0 : 10) + kindWeight;
}

function slug(value: string) {
	return value
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}
