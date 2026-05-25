import { describe, expect, it } from 'vitest';
import type { ExploreItem, SourceDepartment } from './types';
import { buildExploreSuggestions } from './suggestions';

const item: ExploreItem = {
	id: 'met-1',
	source: 'met',
	detailUrl: 'https://example.test/met-1',
	title: 'A Landscape',
	artistRaw: 'Vincent van Gogh',
	artistBio: null,
	artistNationality: null,
	dateDisplay: '1889',
	yearStart: 1889,
	yearEnd: 1889,
	medium: 'Oil on canvas',
	mediumCategory: 'oil',
	objectName: 'Painting',
	department: 'European Paintings',
	culture: null,
	period: null,
	thumbUrl: 'https://example.test/thumb.jpg',
	imageUrl: 'https://example.test/image.jpg',
	additionalImages: [],
	isIIIF: false,
	description: null,
	tags: ['Landscape', 'Cypress'],
	isHighlight: true,
	isPublicDomain: true,
	rawMetadata: {}
};

const departments: SourceDepartment[] = [{ id: '11', label: 'European Paintings' }];

describe('buildExploreSuggestions', () => {
	it('suggests result-derived tags and artists as structured query patches', () => {
		const suggestions = buildExploreSuggestions('land', 'met', [item], departments);

		expect(suggestions).toContainEqual({
			id: 'met-tag-landscape',
			label: 'Landscape',
			kind: 'tag',
			source: 'met',
			queryPatch: { tag: 'Landscape' }
		});
		expect(suggestions.some((suggestion) => suggestion.kind === 'artist')).toBe(false);
	});

	it('suggests cached departments and broad medium aliases', () => {
		const suggestions = buildExploreSuggestions('paint', 'met', [item], departments);

		expect(suggestions).toEqual(
			expect.arrayContaining([
				{
					id: 'met-department-11',
					label: 'European Paintings',
					kind: 'department',
					source: 'met',
					queryPatch: { department: '11' }
				},
				{
					id: 'met-medium-paintings',
					label: 'Paintings',
					kind: 'medium',
					source: 'met',
					queryPatch: { medium: 'Paintings' }
				}
			])
		);
	});

	it('keeps suggestion ids and source metadata aligned with the active source', () => {
		const articItem = { ...item, id: 'artic-1', source: 'artic' as const };
		const suggestions = buildExploreSuggestions('land', 'artic', [articItem], departments);

		expect(suggestions).toContainEqual({
			id: 'artic-tag-landscape',
			label: 'Landscape',
			kind: 'tag',
			source: 'artic',
			queryPatch: { tag: 'Landscape' }
		});
		expect(buildExploreSuggestions('paint', 'artic', [articItem], departments)).toContainEqual({
			id: 'artic-medium-paintings',
			label: 'Paintings',
			kind: 'medium',
			source: 'artic',
			queryPatch: { medium: 'Paintings' }
		});
	});
});
