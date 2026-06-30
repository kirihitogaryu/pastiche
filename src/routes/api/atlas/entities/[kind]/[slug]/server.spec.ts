import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';

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
});
