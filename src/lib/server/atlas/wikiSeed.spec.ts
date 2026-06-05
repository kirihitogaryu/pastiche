import { describe, expect, it } from 'vitest';
import { ATLAS_WIKI_SEED_CONCEPTS } from './wikiSeed';

describe('Atlas wiki seed concepts', () => {
	it('keeps slugs unique', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);

		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('keeps the Apollo/Python first pass below 50 seed concepts', () => {
		const apolloSeeds = ATLAS_WIKI_SEED_CONCEPTS.filter((concept) =>
			concept.seedSet.includes('apollo_killing_python')
		);

		expect(apolloSeeds.length).toBeLessThan(50);
	});

	it('models pose and state as classifiers rather than compound visual tags', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);

		expect(slugs).toContain('pose');
		expect(slugs).toContain('state');
		expect(slugs).not.toContain('reclining_creature');
		expect(slugs).not.toContain('wounded_creature');
	});

	it('includes both named and broad visual concepts for Python retrieval', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);

		expect(slugs).toEqual(expect.arrayContaining(['python_(mythology)', 'serpent']));
	});

	it('marks first-pass seed wiki entries as stubs needing review', () => {
		expect(ATLAS_WIKI_SEED_CONCEPTS.every((concept) => concept.status === 'needs_review')).toBe(
			true
		);
		expect(ATLAS_WIKI_SEED_CONCEPTS.every((concept) => concept.maturity === 'stub')).toBe(true);
	});
});
