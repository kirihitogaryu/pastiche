import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

describe('GET /api/atlas/entities/suggest', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-entity-suggest-route-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns artist suggestions for a query', async () => {
		expect.assertions(3);
		await seedRouteArtist();
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/api/atlas/entities/suggest?kind=artist&q=example')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.suggestions).toHaveLength(1);
		expect(body.suggestions[0]).toMatchObject({
			kind: 'artist',
			slug: 'exampleartist',
			label: 'ExampleArtist',
			workCount: 1
		});
	});

	it('returns artists for an empty query', async () => {
		expect.assertions(2);
		await seedRouteArtist();
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/api/atlas/entities/suggest?kind=artist')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.suggestions[0]).toMatchObject({ slug: 'exampleartist', matchReason: 'recent' });
	});

	it('rejects unsupported entity kinds for now', async () => {
		expect.assertions(2);
		const { GET } = await import('./+server');

		const response = await GET({
			url: new URL('http://localhost/api/atlas/entities/suggest?kind=character&q=asuka')
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Unsupported entity kind' });
	});
});

async function seedRouteArtist() {
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
				captured_at: '2026-07-01T12:00:00.000Z',
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
}
