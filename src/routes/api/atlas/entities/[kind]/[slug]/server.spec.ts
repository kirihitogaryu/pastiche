import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { searchAtlasAssets } from '$lib/server/atlas/search';

describe('GET /api/atlas/entities/[kind]/[slug]', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-entity-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns an artist entity profile with imported works', async () => {
		expect.assertions(2);
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
						creator: 'ExampleArtist',
						artistProfileUrl: 'https://www.deviantart.com/exampleartist',
						artistUsername: 'ExampleArtist'
					}
				}
			]
		});
		const { GET } = await import('./+server');

		const response = await GET({ params: { kind: 'artist', slug: 'exampleartist' } });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.entity).toMatchObject({
			kind: 'artist',
			slug: 'exampleartist',
			links: [expect.objectContaining({ host: 'deviantart.com' })],
			works: [expect.objectContaining({ title: 'Dragon Study' })]
		});
	});

	it('returns 404 for missing entities', async () => {
		expect.assertions(2);
		const { GET } = await import('./+server');

		const response = await GET({ params: { kind: 'artist', slug: 'missing' } });

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'Entity not found' });
	});

	it('updates artist profile fields, aliases, and profile links', async () => {
		expect.assertions(7);
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
						creator: 'ExampleArtist',
						artistProfileUrl: 'https://www.deviantart.com/exampleartist',
						artistUsername: 'ExampleArtist'
					}
				}
			]
		});
		const { PATCH } = await import('./+server');

		const response = await PATCH({
			params: { kind: 'artist', slug: 'exampleartist' },
			request: new Request('http://localhost/api/atlas/entities/artist/exampleartist', {
				method: 'PATCH',
				body: JSON.stringify({
					summary: 'Fantasy illustrator focused on creature design.',
					notes: 'Known for luminous dragons.',
					movements: ['online art', 'digital fantasy'],
					styles: ['painterly', 'high contrast', 'painterly'],
					commonSubjects: ['dragons', 'wyverns'],
					historicalPeriod: 'contemporary',
					media: ['digital painting'],
					aiGuidance:
						'Suggest dragon, creature design, and painterly tags when visually supported.',
					aliases: ['Example Artist', '@DragonPainter', 'Example Artist'],
					links: ['https://www.instagram.com/dragonpainter/']
				})
			})
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.entity).toMatchObject({
			kind: 'artist',
			slug: 'exampleartist',
			summary: 'Fantasy illustrator focused on creature design.',
			notes: 'Known for luminous dragons.',
			movements: ['online art', 'digital fantasy'],
			styles: ['painterly', 'high contrast'],
			commonSubjects: ['dragons', 'wyverns'],
			historicalPeriod: 'contemporary',
			media: ['digital painting'],
			aiGuidance: 'Suggest dragon, creature design, and painterly tags when visually supported.'
		});
		expect(body.entity.aliases).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ alias: 'Example Artist', normalizedAlias: 'example_artist' }),
				expect.objectContaining({ alias: '@DragonPainter', normalizedAlias: 'dragonpainter' })
			])
		);
		expect(body.entity.links).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					url: 'https://instagram.com/dragonpainter',
					host: 'instagram.com',
					username: 'dragonpainter'
				})
			])
		);

		const db = openLibraryDatabase();
		try {
			expect(
				searchAtlasAssets(db, 'artist:(dragonpainter)').results.map((item) => item.id)
			).toHaveLength(1);
			expect(
				searchAtlasAssets(db, 'artist:(example artist)').results.map((item) => item.id)
			).toHaveLength(1);
			expect(searchAtlasAssets(db, 'dragonpainter').entityResults[0]).toMatchObject({
				kind: 'artist',
				slug: 'exampleartist',
				matchLabel: '@DragonPainter'
			});
		} finally {
			db.close();
		}
	});

	it('returns 404 when updating missing artists', async () => {
		expect.assertions(2);
		const { PATCH } = await import('./+server');

		const response = await PATCH({
			params: { kind: 'artist', slug: 'missing' },
			request: new Request('http://localhost/api/atlas/entities/artist/missing', {
				method: 'PATCH',
				body: JSON.stringify({ summary: 'Nope' })
			})
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'Entity not found' });
	});
});
