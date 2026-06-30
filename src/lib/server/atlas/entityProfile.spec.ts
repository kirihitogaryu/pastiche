import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { importLibraryItems } from '$lib/server/library/import';
import { readAtlasEntityProfile } from './entityProfile';

describe('Atlas entity profile reads', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-entity-profile-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns artist profile links, aliases, and imported works', async () => {
		expect.assertions(5);
		await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Dragon Study',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://images.example.com/dragon.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 900,
					source_url: 'https://www.deviantart.com/exampleartist/art/dragon-study',
					page_title: 'Dragon Study',
					alt_text: null,
					captured_at: '2026-06-30T12:00:00.000Z',
					metadata: {
						sourceName: 'DeviantArt',
						sourceType: 'gallery',
						detailUrl: 'https://www.deviantart.com/exampleartist/art/dragon-study',
						creator: 'ExampleArtist',
						artistProfileUrl: 'https://www.deviantart.com/exampleartist',
						artistUsername: 'ExampleArtist'
					}
				}
			]
		});

		const db = new Database(join(archiveRoot, 'workspace.sqlite'));
		try {
			db.prepare(
				`insert into atlas_entity_profiles (
					entity_id, summary, notes, movements_json, styles_json, common_subjects_json,
					historical_period, media_json, ai_guidance, updated_at
				) values (
					(select id from atlas_entities where slug = 'exampleartist'),
					'Digital illustrator.', null, '["online art"]', '["painterly"]',
					'["dragons"]', 'contemporary', '["digital art"]', null, '2026-06-30T12:00:00.000Z'
				)`
			).run();

			const profile = readAtlasEntityProfile(db, 'artist', 'exampleartist');

			expect(profile).toMatchObject({
				kind: 'artist',
				slug: 'exampleartist',
				label: 'ExampleArtist',
				summary: 'Digital illustrator.',
				movements: ['online art'],
				styles: ['painterly'],
				commonSubjects: ['dragons'],
				historicalPeriod: 'contemporary',
				media: ['digital art']
			});
			expect(profile?.links).toEqual([
				expect.objectContaining({
					host: 'deviantart.com',
					username: 'exampleartist',
					url: 'https://deviantart.com/exampleartist'
				})
			]);
			expect(profile?.aliases.map((alias) => alias.normalizedAlias)).toEqual([
				'exampleartist'
			]);
			expect(profile?.works).toEqual([
				expect.objectContaining({
					title: 'Dragon Study',
					thumbnailUrl: 'https://images.example.com/dragon.jpg',
					sourceUrl: 'https://www.deviantart.com/exampleartist/art/dragon-study'
				})
			]);
			expect(readAtlasEntityProfile(db, 'artist', 'missing')).toBeNull();
		} finally {
			db.close();
		}
	});
});
