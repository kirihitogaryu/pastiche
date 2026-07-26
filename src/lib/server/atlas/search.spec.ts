import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed } from './wiki';
import { searchAtlasAssets, suggestAtlasSearch } from './search';

type TestDb = ReturnType<typeof openLibraryDatabase>;

const NOW = '2026-06-25T00:00:00.000Z';

describe('searchAtlasAssets', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-search-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('requires classifier matches to land on the same annotation', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['shirt', 'background']);
			insertAsset(db, 'blue-shirt', 'Blue Shirt');
			insertAnnotation(db, 'blue-shirt', 'shirt_body', ['shirt'], {
				color: 'blue',
				visual_role: 'focal_point'
			});
			insertAsset(db, 'red-shirt-blue-background', 'Red Shirt Blue Background');
			insertAnnotation(db, 'red-shirt-blue-background', 'shirt_body', ['shirt'], {
				color: 'red',
				visual_role: 'focal_point'
			});
			insertAnnotation(db, 'red-shirt-blue-background', 'blue_background', ['background'], {
				color: 'blue',
				visual_role: 'setting_context'
			});

			const results = searchAtlasAssets(db, 'shirt.color:blue');
			const shorthand = searchAtlasAssets(db, 'shirt:blue');

			expect(results.results.map((result) => result.id)).toEqual(['blue-shirt']);
			expect(shorthand.results.map((result) => result.id)).toEqual(['blue-shirt']);
			expect(results.results[0]?.primaryExplanation).toBe('Matched shirt color blue');
		} finally {
			db.close();
		}
	});

	it('treats comma classifier values as OR and plus classifier values as AND', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['ball_python']);
			insertAsset(db, 'enchi-python', 'Enchi Python');
			insertAnnotation(db, 'enchi-python', 'snake', ['ball_python'], {
				morph: 'enchi',
				visual_role: 'focal_point'
			});
			insertAsset(db, 'albino-python', 'Albino Python');
			insertAnnotation(db, 'albino-python', 'snake', ['ball_python'], {
				morph: 'albino',
				visual_role: 'focal_point'
			});
			insertAsset(db, 'combo-python', 'Combo Python');
			insertAnnotation(db, 'combo-python', 'snake', ['ball_python'], {
				morph: ['enchi', 'albino'],
				visual_role: 'focal_point'
			});

			const either = searchAtlasAssets(db, 'ball_python.morph:enchi,albino');
			const combined = searchAtlasAssets(db, 'ball_python.morph:enchi+albino');

			expect(either.results.map((result) => result.id)).toEqual([
				'albino-python',
				'combo-python',
				'enchi-python'
			]);
			expect(combined.results.map((result) => result.id)).toEqual(['combo-python']);
		} finally {
			db.close();
		}
	});

	it('excludes concepts through direct matches', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse', 'tree']);
			insertAsset(db, 'horse-open-field', 'Horse In Open Field');
			insertAnnotation(db, 'horse-open-field', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});
			insertAsset(db, 'horse-near-tree', 'Horse Near Tree');
			insertAnnotation(db, 'horse-near-tree', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});
			insertAnnotation(db, 'horse-near-tree', 'tree', ['tree'], {
				visual_role: 'background_detail'
			});

			const results = searchAtlasAssets(db, 'horse exclude:tree');

			expect(results.results.map((result) => result.id)).toEqual(['horse-open-field']);
		} finally {
			db.close();
		}
	});

	it('ranks focal annotation matches above background matches', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse']);
			insertAsset(db, 'focal-horse', 'Focal Horse');
			insertAnnotation(db, 'focal-horse', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});
			insertAsset(db, 'background-horse', 'Background Horse');
			insertAnnotation(db, 'background-horse', 'horse', ['horse'], {
				visual_role: 'background_detail'
			});

			const results = searchAtlasAssets(db, 'horse');

			expect(results.results.map((result) => result.id)).toEqual([
				'focal-horse',
				'background-horse'
			]);
			expect(results.results[0]?.score).toBeGreaterThan(results.results[1]?.score ?? 0);
		} finally {
			db.close();
		}
	});

	it('returns stable continuation batches with an exact total', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse']);
			for (const id of ['alpha', 'beta', 'gamma']) {
				insertAsset(db, id, `${id} horse`);
				insertAnnotation(db, id, 'horse', ['horse'], { visual_role: 'focal_point' });
			}

			const first = searchAtlasAssets(db, 'horse', { limit: 2, sort: 'title' });
			const second = searchAtlasAssets(db, 'horse', {
				limit: 2,
				sort: 'title',
				cursor: first.page.nextCursor
			});

			expect(first.page).toMatchObject({ total: 3, nextCursor: '2' });
			expect(first.results.map((result) => result.id)).toEqual(['alpha', 'beta']);
			expect(second.page).toMatchObject({ total: 3, nextCursor: null });
			expect(second.results.map((result) => result.id)).toEqual(['gamma']);
		} finally {
			db.close();
		}
	});

	it('limits guided suggestions to active established vocabulary', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['pink']);
			insertConcept(db, 'pink_draft');
			db.prepare(
				`update atlas_concepts set status = 'needs_review', maturity = 'draft' where slug = 'pink_draft'`
			).run();

			const suggestions = suggestAtlasSearch(db, 'pink');

			expect(suggestions.suggestions).toEqual(
				expect.arrayContaining([expect.objectContaining({ query: 'pink' })])
			);
			expect(suggestions.suggestions).not.toEqual(
				expect.arrayContaining([expect.objectContaining({ query: 'pink_draft' })])
			);
		} finally {
			db.close();
		}
	});

	it('uses single concept context for one resolved concept and multi clause context for combined searches', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse', 'saddle']);
			insertAsset(db, 'horse-with-saddle', 'Horse With Saddle');
			insertAnnotation(db, 'horse-with-saddle', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});
			insertAnnotation(db, 'horse-with-saddle', 'saddle', ['saddle'], {
				visual_role: 'supporting_subject'
			});

			const single = searchAtlasAssets(db, 'horse');
			const combined = searchAtlasAssets(db, 'horse saddle');

			expect(single.context.mode).toBe('single_concept');
			expect(combined.context.mode).toBe('multi_clause');
			expect(single.wikiPreview).toEqual(
				expect.objectContaining({
					slug: 'horse',
					label: 'horse',
					openWikiQuery: 'horse',
					allowedClassifiers: expect.arrayContaining(['pose'])
				})
			);
			expect(combined.wikiPreview).toBeNull();
		} finally {
			db.close();
		}
	});

	it('builds concept-map sidebar sections for a single resolved concept', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['test_horse', 'pony', 'saddle', 'tree']);
			db.prepare(
				`update atlas_wiki_entries
				 set narrower_json = ?, related_json = ?, confusable_json = ?, allowed_classifiers_json = ?
				 where concept_id = (select id from atlas_concepts where slug = 'test_horse')`
			).run(
				JSON.stringify(['pony']),
				JSON.stringify(['saddle']),
				JSON.stringify(['tree']),
				JSON.stringify(['coat_color', 'markings'])
			);
			insertAsset(db, 'horse-with-saddle', 'Horse With Saddle');
			insertAnnotation(db, 'horse-with-saddle', 'horse', ['test_horse'], {
				coat_color: 'bay',
				visual_role: 'focal_point'
			});

			const results = searchAtlasAssets(db, 'test_horse');

			expect(results.sidebar).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						title: 'Classifiers',
						kind: 'classifiers',
						classifierGroups: expect.arrayContaining([
							expect.objectContaining({
								value: 'coat_color',
								query: 'test_horse.coat_color:',
								values: expect.arrayContaining([
									expect.objectContaining({
										value: 'bay',
										count: 1,
										query: 'test_horse.coat_color:bay'
									})
								])
							})
						]),
						items: expect.arrayContaining([
							expect.objectContaining({
								label: 'Coat Color',
								value: 'coat_color',
								intent: 'refine',
								defaultAction: 'add',
								query: 'test_horse.coat_color:'
							})
						])
					}),
					expect.objectContaining({
						title: 'Child / Specialist Tags',
						kind: 'concept_map',
						items: expect.arrayContaining([
							expect.objectContaining({
								label: 'pony',
								value: 'pony',
								intent: 'specialize',
								defaultAction: 'navigate',
								query: 'pony'
							})
						])
					})
				])
			);
		} finally {
			db.close();
		}
	});

	it('builds query-facet sidebar sections for combined searches', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse', 'saddle', 'bridle']);
			insertAsset(db, 'horse-with-saddle', 'Horse With Saddle');
			insertAnnotation(db, 'horse-with-saddle', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});
			insertAnnotation(db, 'horse-with-saddle', 'saddle', ['saddle'], {
				visual_role: 'supporting_subject'
			});
			insertAnnotation(db, 'horse-with-saddle', 'bridle', ['bridle'], {
				visual_role: 'supporting_subject'
			});

			const results = searchAtlasAssets(db, 'horse saddle');

			expect(results.sidebar).toEqual([
				expect.objectContaining({
					title: 'Result Refinements',
					kind: 'query_facet',
					items: expect.arrayContaining([
						expect.objectContaining({
							label: 'bridle',
							value: 'bridle',
							intent: 'refine',
							defaultAction: 'add',
							query: 'horse saddle bridle'
						})
					])
				})
			]);
		} finally {
			db.close();
		}
	});

	it('resolves aliases and unique prefixes to canonical concepts', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['test_horse']);
			updateWikiLists(db, 'test_horse', { aliases: ['equine'] });
			insertAsset(db, 'focal-horse', 'Focal Horse');
			insertAnnotation(db, 'focal-horse', 'horse', ['test_horse'], {
				visual_role: 'focal_point'
			});

			const alias = searchAtlasAssets(db, 'equine');
			const prefix = searchAtlasAssets(db, 'test_hors');

			expect(alias.query.canonical).toBe('test_horse');
			expect(prefix.query.canonical).toBe('test_horse');
			expect(alias.results.map((result) => result.id)).toEqual(['focal-horse']);
			expect(prefix.results.map((result) => result.id)).toEqual(['focal-horse']);
		} finally {
			db.close();
		}
	});

	it('resolves parenthetical wiki slugs from normalized search text', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['apollo_(deity)', 'python_(mythology)', 'serpent']);
			insertAsset(db, 'apollo-python', 'Apollo Killing the Python');
			insertAnnotation(db, 'apollo-python', 'apollo_figure', ['apollo_(deity)'], {
				visual_role: 'focal_point'
			});
			insertAnnotation(db, 'apollo-python', 'python_body', ['python_(mythology)', 'serpent'], {
				visual_role: 'focal_point'
			});

			const parenthetical = searchAtlasAssets(db, 'apollo_(deity)');
			const naturalTitle = searchAtlasAssets(db, 'apollo killing the python');

			expect(parenthetical.query.canonical).toBe('apollo_(deity)');
			expect(parenthetical.results.map((result) => result.id)).toEqual(['apollo-python']);
			expect(naturalTitle.results.map((result) => result.id)).toEqual(['apollo-python']);
		} finally {
			db.close();
		}
	});

	it('matches and excludes concepts through automatic implications', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['test_horse', 'test_animal', 'tree']);
			updateWikiLists(db, 'test_horse', { automaticImplications: ['test_animal'] });
			insertAsset(db, 'horse-open-field', 'Horse In Open Field');
			insertAnnotation(db, 'horse-open-field', 'horse', ['test_horse'], {
				visual_role: 'focal_point'
			});
			insertAsset(db, 'horse-near-tree', 'Horse Near Tree');
			insertAnnotation(db, 'horse-near-tree', 'horse', ['test_horse'], {
				visual_role: 'focal_point'
			});
			insertAnnotation(db, 'horse-near-tree', 'tree', ['tree'], {
				visual_role: 'background_detail'
			});

			const included = searchAtlasAssets(db, 'test_animal');
			const excluded = searchAtlasAssets(db, 'test_animal exclude:test_horse');

			expect(included.results.map((result) => result.id)).toEqual([
				'horse-open-field',
				'horse-near-tree'
			]);
			expect(included.results[0]?.primaryExplanation).toContain('through test horse implication');
			expect(excluded.results).toEqual([]);
		} finally {
			db.close();
		}
	});

	it('keeps broader relationships navigational until an automatic implication is approved', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['test_horse', 'test_animal']);
			updateWikiLists(db, 'test_horse', { broader: ['test_animal'] });
			insertAsset(db, 'focal-horse', 'Focal Horse');
			insertAnnotation(db, 'focal-horse', 'horse', ['test_horse'], {
				visual_role: 'focal_point'
			});

			const navigationalOnly = searchAtlasAssets(db, 'test_animal');

			expect(navigationalOnly.results).toEqual([]);

			updateWikiLists(db, 'test_horse', { automaticImplications: ['test_animal'] });
			applyAtlasWikiSeed(db, NOW);
			const approvedImplication = searchAtlasAssets(db, 'test_animal');

			expect(approvedImplication.results.map((result) => result.id)).toEqual(['focal-horse']);
			expect(approvedImplication.results[0]?.primaryExplanation).toContain(
				'through test horse implication'
			);
		} finally {
			db.close();
		}
	});

	it('expands classifier values through automatic implications', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['ball_python', 'enchi_spider', 'enchi', 'spider']);
			updateWikiLists(db, 'enchi_spider', { automaticImplications: ['enchi', 'spider'] });
			insertAsset(db, 'enchi-spider-python', 'Enchi Spider Python');
			insertAnnotation(db, 'enchi-spider-python', 'snake', ['ball_python'], {
				morph: 'enchi_spider',
				visual_role: 'focal_point'
			});

			const combined = searchAtlasAssets(db, 'ball_python.morph:enchi+spider');
			const excluded = searchAtlasAssets(db, 'ball_python.morph:enchi exclude:spider');

			expect(combined.results.map((result) => result.id)).toEqual(['enchi-spider-python']);
			expect(excluded.results).toEqual([]);
		} finally {
			db.close();
		}
	});

	it('supports title sorting and returns total estimate before limiting', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse']);
			insertAsset(db, 'zebra-title', 'Zebra Title');
			insertAnnotation(db, 'zebra-title', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});
			insertAsset(db, 'alpha-title', 'Alpha Title');
			insertAnnotation(db, 'alpha-title', 'horse', ['horse'], {
				visual_role: 'focal_point'
			});

			const results = searchAtlasAssets(db, 'horse', { limit: 1, sort: 'title' });

			expect(results.page).toMatchObject({ limit: 1, totalEstimate: 2 });
			expect(results.results.map((result) => result.id)).toEqual(['alpha-title']);
		} finally {
			db.close();
		}
	});

	it('returns local thumbnail URLs for downloaded results without remote image URLs', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['dragon']);
			insertLocalAsset(db, archiveRoot, 'local-dragon', 'Local Dragon');
			insertAnnotation(db, 'local-dragon', 'dragon', ['dragon'], {
				visual_role: 'focal_point'
			});

			const results = searchAtlasAssets(db, 'dragon');

			expect(results.results[0]).toEqual(
				expect.objectContaining({
					id: 'local-dragon',
					thumbnailUrl: '/api/library/assets/local-dragon/image?variant=thumb'
				})
			);
		} finally {
			db.close();
		}
	});

	it('matches Atlas entities and claims from plain search terms', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, []);
			insertAsset(db, 'picasso-oil', 'Picasso Oil');
			insertEntity(db, 'picasso-oil', 'artist', 'picasso', 'Pablo Picasso');
			insertClaim(db, 'picasso-oil', 'medium', 'oil_painting', 'Oil Painting');

			const artist = searchAtlasAssets(db, 'picasso');
			const medium = searchAtlasAssets(db, 'oil_painting');

			expect(artist.results.map((result) => result.id)).toEqual(['picasso-oil']);
			expect(artist.results[0]?.primaryExplanation).toBe('Matched picasso as artist entity');
			expect(medium.results.map((result) => result.id)).toEqual(['picasso-oil']);
			expect(medium.results[0]?.primaryExplanation).toBe('Matched oil painting as medium claim');
		} finally {
			db.close();
		}
	});

	it('filters works by artist entity aliases and profile usernames', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, []);
			insertAsset(db, 'picasso-oil', 'Picasso Oil');
			insertAsset(db, 'other-oil', 'Other Oil');
			insertEntity(db, 'picasso-oil', 'artist', 'pablo_picasso', 'Pablo Picasso');
			insertEntityAlias(db, 'artist', 'pablo_picasso', 'picasso');
			insertEntityLink(
				db,
				'artist',
				'pablo_picasso',
				'https://www.instagram.com/pablopicasso',
				'instagram.com',
				'pablopicasso'
			);

			const alias = searchAtlasAssets(db, 'artist:(picasso)');
			const username = searchAtlasAssets(db, 'artist:pablopicasso');

			expect(alias.query.canonical).toBe('artist:picasso');
			expect(alias.results.map((result) => result.id)).toEqual(['picasso-oil']);
			expect(alias.results[0]?.primaryExplanation).toBe('Matched picasso as artist entity');
			expect(username.results.map((result) => result.id)).toEqual(['picasso-oil']);
		} finally {
			db.close();
		}
	});

	it('returns artist entity result cards for plain searches', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, []);
			insertAsset(db, 'picasso-oil', 'Picasso Oil');
			insertAsset(db, 'picasso-sketch', 'Picasso Sketch');
			insertEntity(db, 'picasso-oil', 'artist', 'pablo_picasso', 'Pablo Picasso');
			insertEntity(db, 'picasso-sketch', 'artist', 'pablo_picasso', 'Pablo Picasso');
			insertEntityAlias(db, 'artist', 'pablo_picasso', 'picasso');
			insertEntityLink(
				db,
				'artist',
				'pablo_picasso',
				'https://www.instagram.com/pablopicasso',
				'instagram.com',
				'pablopicasso'
			);

			const results = searchAtlasAssets(db, 'picasso');

			expect(results.entityResults).toEqual([
				expect.objectContaining({
					kind: 'artist',
					slug: 'pablo_picasso',
					label: 'Pablo Picasso',
					matchLabel: 'picasso',
					workCount: 2,
					query: 'artist:(pablo_picasso)',
					links: [
						{
							host: 'instagram.com',
							username: 'pablopicasso',
							url: 'https://www.instagram.com/pablopicasso'
						}
					]
				})
			]);
			expect(results.entityResults[0]?.thumbnailUrls.length).toBeGreaterThan(0);
		} finally {
			db.close();
		}
	});

	it('suggests concepts for exclude mode', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['horse', 'tree']);

			const suggestions = suggestAtlasSearch(db, 'horse exclude:tr');

			expect(suggestions.suggestions).toContainEqual(
				expect.objectContaining({
					kind: 'exclude',
					label: 'tree',
					query: 'horse exclude:tree',
					action: 'submit'
				})
			);
		} finally {
			db.close();
		}
	});

	it('suggests classifiers and classifier values for a target concept', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['test_horse']);
			db.prepare(
				`update atlas_wiki_entries
				 set allowed_classifiers_json = ?
				 where concept_id = (select id from atlas_concepts where slug = 'test_horse')`
			).run(JSON.stringify(['coat_color', 'markings']));
			insertAsset(db, 'bay-horse', 'Bay Horse');
			insertAnnotation(db, 'bay-horse', 'horse', ['test_horse'], {
				coat_color: 'bay',
				visual_role: 'focal_point'
			});
			insertAsset(db, 'brown-horse', 'Brown Horse');
			insertAnnotation(db, 'brown-horse', 'horse', ['test_horse'], {
				coat_color: 'brown',
				visual_role: 'focal_point'
			});

			const classifiers = suggestAtlasSearch(db, 'test_horse.');
			const values = suggestAtlasSearch(db, 'test_horse.coat_color:b');

			expect(classifiers.suggestions).toContainEqual(
				expect.objectContaining({
					kind: 'classifier',
					label: 'Coat Color',
					query: 'test_horse.coat_color:',
					action: 'complete'
				})
			);
			expect(values.suggestions.map((suggestion) => suggestion.query)).toEqual([
				'test_horse.coat_color:bay',
				'test_horse.coat_color:brown'
			]);
		} finally {
			db.close();
		}
	});

	it('suggests classifier values from classifier wiki vocabulary when no matching assets are indexed', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, NOW);

			const suggestions = suggestAtlasSearch(db, 'drawing_bow.position:');
			const actionRoleSuggestions = suggestAtlasSearch(db, 'drawing_bow.action_role:');

			expect(suggestions.suggestions.map((suggestion) => suggestion.query)).toEqual(
				expect.arrayContaining(['drawing_bow.position:left', 'drawing_bow.position:right'])
			);
			expect(actionRoleSuggestions.suggestions.map((suggestion) => suggestion.query)).toEqual(
				expect.arrayContaining([
					'drawing_bow.action_role:attacker',
					'drawing_bow.action_role:target'
				])
			);
		} finally {
			db.close();
		}
	});

	it('keeps incomplete classifier searches in the target concept context', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, NOW);

			const results = searchAtlasAssets(db, 'drawing_bow.position:');
			const classifierSection = results.sidebar.find((section) => section.title === 'Classifiers');

			expect(results.query.canonical).toBe('drawing_bow.position:');
			expect(results.context).toEqual(
				expect.objectContaining({
					mode: 'single_concept',
					dominantConcept: expect.objectContaining({ slug: 'drawing_bow' })
				})
			);
			expect(classifierSection?.classifierGroups).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						value: 'position',
						values: expect.arrayContaining([
							expect.objectContaining({
								value: 'left',
								count: null,
								query: 'drawing_bow.position:left'
							})
						])
					})
				])
			);
		} finally {
			db.close();
		}
	});

	it('suggests intuitive color classifier corrections', () => {
		const db = openLibraryDatabase();
		try {
			seedSearchConcepts(db, ['shirt']);
			insertAsset(db, 'blue-shirt', 'Blue Shirt');
			insertAnnotation(db, 'blue-shirt', 'shirt_body', ['shirt'], {
				color: 'blue',
				visual_role: 'focal_point'
			});

			const compound = suggestAtlasSearch(db, 'blue_shirt');
			const shorthand = suggestAtlasSearch(db, 'shirt:bl');

			expect(compound.suggestions[0]).toEqual(
				expect.objectContaining({
					kind: 'correction',
					query: 'shirt.color:blue',
					action: 'submit'
				})
			);
			expect(shorthand.suggestions).toContainEqual(
				expect.objectContaining({
					kind: 'classifier_value',
					query: 'shirt.color:blue',
					action: 'submit'
				})
			);
		} finally {
			db.close();
		}
	});

	it('discovers approved classifier values from plain-language color searches', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, NOW);
			insertConcept(db, 'scales');
			db.prepare(
				`update atlas_concepts
				 set status = 'active', maturity = 'usable'
				 where slug = 'scales'`
			).run();
			db.prepare(
				`update atlas_wiki_entries set allowed_classifiers_json = ?
				 where concept_id = (select id from atlas_concepts where slug = 'scales')`
			).run(JSON.stringify(['scale_color', 'visual_role']));
			insertAsset(db, 'green-scaled-dragon', 'Green Scaled Dragon');
			insertAnnotation(db, 'green-scaled-dragon', 'dragon_body', ['dragon', 'scales'], {
				scale_color: 'green',
				visual_role: 'focal_point'
			});

			const plain = suggestAtlasSearch(db, 'green');
			const phrase = suggestAtlasSearch(db, 'green scales');
			const shorthand = suggestAtlasSearch(db, 'scales:green');
			const readableClassifier = suggestAtlasSearch(db, 'scale color:green');

			expect(plain.suggestions).toContainEqual(
				expect.objectContaining({
					kind: 'classifier_value',
					label: 'Scale Color: Green',
					query: 'scales.scale_color:green'
				})
			);
			expect(phrase.suggestions[0]).toEqual(
				expect.objectContaining({ query: 'scales.scale_color:green' })
			);
			expect(shorthand.suggestions).toContainEqual(
				expect.objectContaining({ query: 'scales.scale_color:green' })
			);
			expect(readableClassifier.suggestions[0]).toEqual(
				expect.objectContaining({ query: 'scales.scale_color:green' })
			);
		} finally {
			db.close();
		}
	});
});

function seedSearchConcepts(db: TestDb, slugs: string[]) {
	applyAtlasWikiSeed(db, NOW);
	for (const slug of slugs) {
		insertConcept(db, slug);
	}
}

function insertConcept(db: TestDb, slug: string) {
	db.prepare(
		`insert into atlas_concepts (
			id, slug, label, kind, category, display_group, status, maturity, short_definition,
			created_by, created_at, updated_at
		) values (?, ?, ?, 'visual_tag', 'object', 'Objects', 'active', 'reviewed', ?, 'test', ?, ?)
		on conflict(slug) do nothing`
	).run(`concept-${slug}`, slug, labelFor(slug), `Test concept for ${labelFor(slug)}.`, NOW, NOW);
	db.prepare(
		`update atlas_concepts set status = 'active', maturity = 'reviewed' where slug = ?`
	).run(slug);
	db.prepare(
		`insert into atlas_wiki_entries (
			concept_id, long_description, use_when_json, do_not_use_when_json, aliases_json,
			broader_json, narrower_json, related_json, confusable_json, automatic_implications_json,
			suggested_implications_json, allowed_classifiers_json, examples_json, counterexamples_json,
			ai_guidance, citations_json, updated_at
		) values (
			(select id from atlas_concepts where slug = ?), '', '[]', '[]', '[]', '[]', '[]', '[]',
			'[]', '[]', '[]', ?, '[]', '[]', '', '[]', ?
		)
		on conflict(concept_id) do nothing`
	).run(slug, JSON.stringify(['color', 'morph', 'visual_role']), NOW);
}

function insertAsset(db: TestDb, id: string, title: string) {
	db.prepare(
		`insert into assets (
			id, filename, title, storage_mode, mime_type, width, height, original_path,
			thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
			source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
		) values (?, ?, ?, 'url_reference', 'image/jpeg', 800, 600, null, null, ?, ?, ?, null,
			'example.com', ?, null, ?, ?, ?, ?)`
	).run(
		id,
		`${id}.jpg`,
		title,
		`https://example.com/${id}.jpg`,
		`https://example.com/${id}`,
		title,
		`hash-${id}`,
		NOW,
		NOW,
		NOW,
		JSON.stringify({ creator: 'Test Artist', dateDisplay: '2026', sourceName: 'Test Source' })
	);
}

function insertLocalAsset(db: TestDb, archiveRoot: string, id: string, title: string) {
	mkdirSync(join(archiveRoot, 'originals'), { recursive: true });
	mkdirSync(join(archiveRoot, 'thumbnails'), { recursive: true });
	writeFileSync(join(archiveRoot, 'originals', `${id}.png`), 'original');
	writeFileSync(join(archiveRoot, 'thumbnails', `${id}.webp`), 'thumb');
	db.prepare(
		`insert into assets (
			id, filename, title, storage_mode, mime_type, width, height, original_path,
			thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
			source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
		) values (?, ?, ?, 'download', 'image/png', 800, 600, ?, ?, null, ?, ?, null,
			'example.com', ?, null, ?, ?, ?, ?)`
	).run(
		id,
		`${id}.png`,
		title,
		`originals/${id}.png`,
		`thumbnails/${id}.webp`,
		`https://example.com/${id}`,
		title,
		`hash-${id}`,
		NOW,
		NOW,
		NOW,
		JSON.stringify({ creator: 'Test Artist', dateDisplay: '2026', sourceName: 'Test Source' })
	);
}

function insertAnnotation(
	db: TestDb,
	assetId: string,
	label: string,
	concepts: string[],
	classifiers: Record<string, string | string[]>
) {
	const annotationId = `annotation-${assetId}-${label}`;
	db.prepare(
		`insert into atlas_annotations (
			id, asset_id, label, region_json, source, confidence, status, note, created_at, updated_at
		) values (?, ?, ?, null, 'test', null, 'approved', null, ?, ?)`
	).run(annotationId, assetId, label, NOW, NOW);

	for (const slug of concepts) {
		db.prepare(
			`insert into atlas_annotation_concepts (
				annotation_id, concept_id, evidence, provenance, status, created_at
			) values (?, (select id from atlas_concepts where slug = ?), 'observed', 'test', 'approved', ?)`
		).run(annotationId, slug, NOW);
	}

	for (const [type, rawValue] of Object.entries(classifiers)) {
		const values = Array.isArray(rawValue) ? rawValue : [rawValue];
		for (const value of values) {
			db.prepare(
				`insert into atlas_annotation_classifiers (
					id, annotation_id, classifier_type, classifier_value, evidence, status, created_at
				) values (?, ?, ?, ?, 'observed', 'approved', ?)`
			).run(`classifier-${annotationId}-${type}-${value}`, annotationId, type, value, NOW);
		}
	}
}

function insertEntity(db: TestDb, assetId: string, kind: string, slug: string, label: string) {
	db.prepare(
		`insert into atlas_entities (id, kind, slug, label, external_url, created_at, updated_at)
		 values (?, ?, ?, ?, null, ?, ?)
		 on conflict(kind, slug) do nothing`
	).run(`entity-${kind}-${slug}`, kind, slug, label, NOW, NOW);
	db.prepare(
		`insert into atlas_asset_entities (
			asset_id, entity_id, evidence, provenance, status, created_at
		) values (?, (select id from atlas_entities where kind = ? and slug = ?), 'metadata', 'test', 'approved', ?)`
	).run(assetId, kind, slug, NOW);
}

function insertEntityAlias(db: TestDb, kind: string, slug: string, alias: string) {
	db.prepare(
		`insert into atlas_entity_aliases (
			id, entity_id, alias, normalized_alias, source, confidence, created_at
		) values (
			?, (select id from atlas_entities where kind = ? and slug = ?), ?, ?, 'test', 'high', ?
		)`
	).run(`entity-alias-${kind}-${slug}-${alias}`, kind, slug, alias, displaySlug(alias), NOW);
}

function insertEntityLink(
	db: TestDb,
	kind: string,
	slug: string,
	url: string,
	host: string,
	username: string
) {
	db.prepare(
		`insert into atlas_entity_links (
			id, entity_id, url, normalized_url, host, username, source_label, confidence,
			first_seen_asset_id, last_seen_at, created_at
		) values (
			?, (select id from atlas_entities where kind = ? and slug = ?), ?, ?, ?, ?, 'test',
			'high', null, ?, ?
		)`
	).run(`entity-link-${kind}-${slug}-${username}`, kind, slug, url, url, host, username, NOW, NOW);
}

function insertClaim(db: TestDb, assetId: string, kind: string, slug: string, label: string) {
	db.prepare(
		`insert into atlas_claims (
			id, asset_id, kind, slug, label, value, source_text, evidence, provenance, status,
			created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, 'metadata', 'test', 'approved', ?, ?)`
	).run(`claim-${assetId}-${kind}-${slug}`, assetId, kind, slug, label, label, label, NOW, NOW);
}

function updateWikiLists(
	db: TestDb,
	slug: string,
	input: {
		aliases?: string[];
		broader?: string[];
		automaticImplications?: string[];
	}
) {
	db.prepare(
		`update atlas_wiki_entries
		 set aliases_json = coalesce(?, aliases_json),
			 broader_json = coalesce(?, broader_json),
			 automatic_implications_json = coalesce(?, automatic_implications_json)
		 where concept_id = (select id from atlas_concepts where slug = ?)`
	).run(
		input.aliases ? JSON.stringify(input.aliases) : null,
		input.broader ? JSON.stringify(input.broader) : null,
		input.automaticImplications ? JSON.stringify(input.automaticImplications) : null,
		slug
	);
}

function labelFor(slug: string) {
	return slug.replace(/_/g, ' ');
}

function displaySlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}
