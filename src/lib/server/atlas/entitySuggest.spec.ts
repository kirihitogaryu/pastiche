import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { suggestAtlasEntities } from './entitySuggest';

describe('artist entity suggestions', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-entity-suggest-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('matches artists by label, alias, and profile username', async () => {
		expect.assertions(5);
		await seedArtistWorks([
			{
				title: 'Dragon Study',
				creator: 'DamonWildFire',
				profileUrl: 'https://www.deviantart.com/damonwildfire',
				username: 'DamonWildFire',
				sourceName: 'DeviantArt'
			}
		]);
		const db = openLibraryDatabase();
		try {
			db.prepare(
				`insert into atlas_entity_aliases (
					id, entity_id, alias, normalized_alias, source, confidence, created_at
				) values (
					'alias-damon', (select id from atlas_entities where slug = 'damonwildfire'),
					'Damon W. Fire', 'damon_w_fire', 'manual', 'high', '2026-07-01T12:00:00.000Z'
				)`
			).run();

			expect(suggestAtlasEntities(db, { kind: 'artist', query: 'DamonWildFire' })[0]).toMatchObject({
				slug: 'damonwildfire',
				matchReason: 'label'
			});
			expect(suggestAtlasEntities(db, { kind: 'artist', query: 'Damon W' })[0]).toMatchObject({
				slug: 'damonwildfire',
				match: 'Damon W. Fire',
				matchReason: 'alias'
			});
			expect(suggestAtlasEntities(db, { kind: 'artist', query: '@damonwildfire' })[0]).toMatchObject({
				slug: 'damonwildfire'
			});
			expect(suggestAtlasEntities(db, { kind: 'artist', query: 'wildfire' })[0]).toMatchObject({
				slug: 'damonwildfire'
			});
			expect(suggestAtlasEntities(db, { kind: 'artist', query: 'damonwildfire' })[0].links).toEqual(
				[expect.objectContaining({ host: 'deviantart.com', username: 'damonwildfire' })]
			);
		} finally {
			db.close();
		}
	});

	it('ranks exact matches before partial matches, then uses work count', async () => {
		expect.assertions(3);
		await seedArtistWorks([
			{
				title: 'First Floral',
				creator: 'Picasso',
				profileUrl: 'https://www.instagram.com/picasso/',
				username: 'picasso',
				sourceName: 'Instagram'
			},
			{
				title: 'Second Floral',
				creator: 'Picasso',
				profileUrl: 'https://www.instagram.com/picasso/',
				username: 'picasso',
				sourceName: 'Instagram'
			},
			{
				title: 'Castle Sketch',
				creator: 'Picasso Sketch',
				profileUrl: 'https://www.tumblr.com/picasso_sketch',
				username: 'picasso_sketch',
				sourceName: 'Tumblr'
			}
		]);
		const db = openLibraryDatabase();
		try {
			const exact = suggestAtlasEntities(db, { kind: 'artist', query: 'picasso' });
			const partial = suggestAtlasEntities(db, { kind: 'artist', query: 'pica' });

			expect(exact.map((item) => item.slug).slice(0, 2)).toEqual(['picasso', 'picasso_sketch']);
			expect(partial.map((item) => item.slug).slice(0, 2)).toEqual(['picasso', 'picasso_sketch']);
			expect(exact[0]).toMatchObject({ workCount: 2 });
		} finally {
			db.close();
		}
	});

	it('returns recent populated artists for an empty query', async () => {
		expect.assertions(2);
		await seedArtistWorks([
			{
				title: 'Earlier Work',
				creator: 'Earlier Artist',
				profileUrl: 'https://x.com/earlier_artist',
				username: 'earlier_artist',
				sourceName: 'X'
			},
			{
				title: 'Later Work',
				creator: 'Later Artist',
				profileUrl: 'https://x.com/later_artist',
				username: 'later_artist',
				sourceName: 'X'
			}
		]);
		const db = openLibraryDatabase();
		try {
			const suggestions = suggestAtlasEntities(db, { kind: 'artist', query: '', limit: 1 });

			expect(suggestions).toHaveLength(1);
			expect(suggestions[0]).toMatchObject({ slug: 'later_artist', matchReason: 'recent' });
		} finally {
			db.close();
		}
	});
});

async function seedArtistWorks(
	works: Array<{
		title: string;
		creator: string;
		profileUrl: string;
		username: string;
		sourceName: string;
	}>
) {
	await importLibraryItems({
		destination_folder_id: null,
		items: works.map((work, index) => ({
			filename: work.title,
			storage_mode: 'url_reference',
			image_data: null,
			source_image_url: `https://images.example.com/${index}.jpg`,
			mime_type: 'image/jpeg',
			natural_width: 1200,
			natural_height: 900,
			source_url: `${work.profileUrl}/post/${index}`,
			page_title: work.title,
			alt_text: null,
			captured_at: `2026-07-01T12:0${index}:00.000Z`,
			metadata: {
				sourceName: work.sourceName,
				sourceType: 'gallery',
				creator: work.creator,
				artistProfileUrl: work.profileUrl,
				artistUsername: work.username
			}
		}))
	});
}
