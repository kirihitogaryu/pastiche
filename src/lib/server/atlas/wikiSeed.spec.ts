import { describe, expect, it } from 'vitest';
import { ATLAS_WIKI_SEED_CONCEPTS } from './wikiSeed';

describe('Atlas wiki seed concepts', () => {
	it('keeps slugs unique', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);

		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('includes the Apollo/Python comparison corpus concepts', () => {
		const apolloSeeds = ATLAS_WIKI_SEED_CONCEPTS.filter((concept) =>
			concept.seedSet.includes('apollo_killing_python')
		);
		const slugs = apolloSeeds.map((concept) => concept.slug);

		expect(slugs).toEqual(
			expect.arrayContaining([
				'apollo_(deity)',
				'python_(mythology)',
				'dragon',
				'serpent',
				'horse',
				'chariot',
				'book_illumination',
				'oil_sketch',
				'preparatory_study',
				'visual_role'
			])
		);
	});

	it('models pose and state as classifiers rather than compound visual tags', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);

		expect(slugs).toContain('pose');
		expect(slugs).toContain('state');
		expect(slugs).not.toContain('reclining_creature');
		expect(slugs).not.toContain('wounded_creature');
	});

	it('documents visual role as search and example governance, not a minor qualifier', () => {
		const visualRole = ATLAS_WIKI_SEED_CONCEPTS.find((concept) => concept.slug === 'visual_role');

		expect(visualRole).toMatchObject({
			kind: 'classifier',
			allowedClassifiers: expect.arrayContaining(['focal_point', 'background_detail'])
		});
		expect(
			[visualRole?.longDescription, ...(visualRole?.useWhen ?? []), visualRole?.aiGuidance]
				.join('\n')
				.toLowerCase()
		).toContain('example');
		expect(
			[visualRole?.longDescription, ...(visualRole?.useWhen ?? []), visualRole?.aiGuidance]
				.join('\n')
				.toLowerCase()
		).toContain('search');
	});

	it('includes both named and broad visual concepts for Python retrieval', () => {
		const slugs = ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug);

		expect(slugs).toEqual(expect.arrayContaining(['python_(mythology)', 'serpent']));
	});

	it('keeps first-pass seed wiki entries review-gated but draft-readable', () => {
		expect(ATLAS_WIKI_SEED_CONCEPTS.every((concept) => concept.status === 'needs_review')).toBe(
			true
		);
		expect(ATLAS_WIKI_SEED_CONCEPTS.every((concept) => concept.maturity === 'draft')).toBe(true);
	});

	it('gives every seeded concept article-grade baseline documentation', () => {
		for (const concept of ATLAS_WIKI_SEED_CONCEPTS) {
			expect(concept.shortDefinition.length).toBeGreaterThan(20);
			expect(concept.longDescription.length).toBeGreaterThan(80);
			expect(concept.useWhen.length).toBeGreaterThan(0);
			expect(concept.doNotUseWhen.length).toBeGreaterThan(0);
			expect(concept.aiGuidance.length).toBeGreaterThan(50);
		}
	});

	it('avoids placeholder-quality default wiki guidance', () => {
		const articleText = ATLAS_WIKI_SEED_CONCEPTS.flatMap((concept) => [
			concept.longDescription,
			...concept.useWhen,
			...concept.doNotUseWhen,
			concept.aiGuidance
		]).join('\n');

		expect(articleText).not.toMatch(/relevant to the asset/i);
		expect(articleText).not.toMatch(/loose association/i);
		expect(articleText).not.toMatch(/todo|placeholder/i);
	});

	it('keeps relationship and classifier references resolvable', () => {
		const slugs = new Set(ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug));
		const refs = ATLAS_WIKI_SEED_CONCEPTS.flatMap((concept) => [
			...concept.broader,
			...concept.narrower,
			...concept.related,
			...concept.confusable,
			...concept.automaticImplications,
			...concept.suggestedImplications,
			...(concept.kind === 'classifier' ? [] : concept.allowedClassifiers)
		]);

		expect(refs.filter((ref) => !slugs.has(ref))).toEqual([]);
	});
});
