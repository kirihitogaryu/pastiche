import { describe, expect, it } from 'vitest';
import { rankAtlasWikiEntries } from './wikiSearch';

type TestEntry = Parameters<typeof rankAtlasWikiEntries>[0][number];

function entry(input: Partial<TestEntry> & Pick<TestEntry, 'slug' | 'label'>): TestEntry {
	return {
		slug: input.slug,
		label: input.label,
		shortDefinition: input.shortDefinition ?? '',
		displayGroup: input.displayGroup ?? 'Test',
		category: input.category ?? 'test',
		kind: input.kind ?? 'visual_tag',
		aliases: input.aliases ?? [],
		broader: input.broader ?? [],
		narrower: input.narrower ?? [],
		related: input.related ?? [],
		confusable: input.confusable ?? [],
		allowedClassifiers: input.allowedClassifiers ?? []
	};
}

describe('Atlas wiki search ranking', () => {
	it('places exact slug and label matches before relationship-only matches', () => {
		const ranked = rankAtlasWikiEntries(
			[
				entry({ slug: 'saddle', label: 'saddle', related: ['horse'] }),
				entry({ slug: 'horse', label: 'horse' }),
				entry({ slug: 'horse_chestnut', label: 'horse chestnut' })
			],
			'horse'
		);

		expect(ranked.map((item) => item.slug)).toEqual(['horse', 'horse_chestnut', 'saddle']);
	});

	it('ranks aliases above body text and relationships', () => {
		const ranked = rankAtlasWikiEntries(
			[
				entry({ slug: 'serpent', label: 'serpent', aliases: ['snake'] }),
				entry({ slug: 'dragon', label: 'dragon', shortDefinition: 'A snake-like creature.' }),
				entry({ slug: 'lizard', label: 'lizard', confusable: ['snake'] })
			],
			'snake'
		);

		expect(ranked.map((item) => item.slug)).toEqual(['serpent', 'dragon', 'lizard']);
	});
});
