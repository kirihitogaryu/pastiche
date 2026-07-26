import { describe, expect, it } from 'vitest';
import { parseAtlasSearchQuery } from './searchParser';

describe('parseAtlasSearchQuery', () => {
	it('parses multi-concept search as include concept clauses', () => {
		const parsed = parseAtlasSearchQuery('horse saddle');

		expect(parsed.canonical).toBe('horse saddle');
		expect(parsed.clauses).toEqual([
			{ kind: 'concept', raw: 'horse', slug: 'horse', mode: 'include' },
			{ kind: 'concept', raw: 'saddle', slug: 'saddle', mode: 'include' }
		]);
	});

	it('parses exclude: and dash shorthand as exclude clauses', () => {
		const parsed = parseAtlasSearchQuery('horse exclude:tree -spider');

		expect(parsed.clauses).toContainEqual({
			kind: 'concept',
			raw: 'exclude:tree',
			slug: 'tree',
			mode: 'exclude'
		});
		expect(parsed.clauses).toContainEqual({
			kind: 'concept',
			raw: '-spider',
			slug: 'spider',
			mode: 'exclude'
		});
	});

	it('parses classifier clauses with comma OR and plus AND values', () => {
		const any = parseAtlasSearchQuery('horse.coat_color:bay,gray');
		const all = parseAtlasSearchQuery('ball_python.morph:enchi+albino');
		const colon = parseAtlasSearchQuery('ball_python:morph:enchi');
		const defaultColor = parseAtlasSearchQuery('shirt:blue');
		const incomplete = parseAtlasSearchQuery('drawing_bow.position:');

		expect(any.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'horse.coat_color:bay,gray',
				target: 'horse',
				classifier: 'coat_color',
				values: { op: 'any', values: ['bay', 'gray'] },
				mode: 'include'
			}
		]);
		expect(all.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'ball_python.morph:enchi+albino',
				target: 'ball_python',
				classifier: 'morph',
				values: { op: 'all', values: ['enchi', 'albino'] },
				mode: 'include'
			}
		]);
		expect(colon.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'ball_python:morph:enchi',
				target: 'ball_python',
				classifier: 'morph',
				values: { op: 'any', values: ['enchi'] },
				mode: 'include'
			}
		]);
		expect(defaultColor.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'shirt:blue',
				target: 'shirt',
				classifier: 'color',
				values: { op: 'any', values: ['blue'] },
				mode: 'include'
			}
		]);
		expect(incomplete.clauses).toEqual([
			{
				kind: 'classifier',
				raw: 'drawing_bow.position:',
				target: 'drawing_bow',
				classifier: 'position',
				values: { op: 'any', values: [] },
				mode: 'include'
			}
		]);
		expect(incomplete.canonical).toBe('drawing_bow.position:');
	});

	it('parses visual role clauses', () => {
		const parsed = parseAtlasSearchQuery(
			'horse role:focal exclude_role:background_detail,setting_context'
		);

		expect(parsed.clauses).toContainEqual({
			kind: 'role',
			raw: 'role:focal',
			include: ['focal_point']
		});
		expect(parsed.clauses).toContainEqual({
			kind: 'role',
			raw: 'exclude_role:background_detail,setting_context',
			exclude: ['background_detail', 'setting_context']
		});
	});

	it('parses artist entity filter clauses before classifier shorthand', () => {
		const parenthetical = parseAtlasSearchQuery('artist:(Pablo Picasso)');
		const shorthand = parseAtlasSearchQuery('artist:picasso');

		expect(parenthetical.canonical).toBe('artist:pablo_picasso');
		expect(parenthetical.clauses).toEqual([
			{
				kind: 'entity',
				raw: 'artist:(Pablo Picasso)',
				entityKind: 'artist',
				slug: 'pablo_picasso',
				mode: 'include'
			}
		]);
		expect(shorthand.clauses).toEqual([
			{
				kind: 'entity',
				raw: 'artist:picasso',
				entityKind: 'artist',
				slug: 'picasso',
				mode: 'include'
			}
		]);
	});
});
