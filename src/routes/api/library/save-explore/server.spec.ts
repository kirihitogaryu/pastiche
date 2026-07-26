import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExploreItem } from '$lib/explore/types';

const getById = vi.fn();

vi.mock('$lib/explore/connectors', () => ({
	getExploreConnectorForItemId: () => ({ getById })
}));

const sampleItem: ExploreItem = {
	id: 'met-1',
	source: 'met',
	detailUrl: 'https://www.metmuseum.org/art/collection/search/1',
	title: 'A Study',
	artistRaw: 'An Artist',
	artistBio: null,
	artistNationality: null,
	dateDisplay: '1900',
	yearStart: 1900,
	yearEnd: 1900,
	medium: 'Oil on canvas',
	mediumCategory: 'oil',
	objectName: 'Painting',
	department: 'Paintings',
	culture: null,
	period: null,
	thumbUrl: 'https://images.metmuseum.org/thumb.jpg',
	imageUrl: 'https://images.metmuseum.org/image.jpg',
	additionalImages: [],
	isIIIF: false,
	description: null,
	tags: ['painting'],
	isHighlight: false,
	isPublicDomain: true,
	rawMetadata: {}
};

describe('POST /api/library/save-explore', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-save-explore-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		getById.mockReset();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				const image = await sharp({
					create: {
						width: 17,
						height: 23,
						channels: 3,
						background: '#bada55'
					}
				})
					.jpeg()
					.toBuffer();
				return new Response(new Uint8Array(image), {
					status: 200,
					headers: { 'content-type': 'image/jpeg' }
				});
			})
		);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('saves an Explore item through the shared import service', async () => {
		getById.mockResolvedValue(sampleItem);
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({ item_id: 'met-1', destination_folder_id: null })
			})
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			imported: [{ index: 0, duplicate: false }],
			failed: []
		});
		expect(getById).toHaveBeenCalledWith('met-1');
	});

	it('bookmarks an Explore item without downloading image bytes', async () => {
		getById.mockResolvedValue({
			...sampleItem,
			id: 'danbooru-42',
			source: 'danbooru',
			detailUrl: 'https://danbooru.donmai.us/posts/42',
			imageUrl: 'https://cdn.donmai.us/original/test.png',
			rawMetadata: {
				danbooru: {
					width: 1200,
					height: 900,
					artistTags: ['test_artist']
				}
			}
		});
		const imageFetch = vi.mocked(fetch);
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');
		const { openLibraryDatabase } = await import('$lib/server/library/schema');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({
					item_id: 'danbooru-42',
					destination_folder_id: null,
					storage_mode: 'url_reference'
				})
			})
		});
		const snapshot = getLibrarySnapshot();
		const db = openLibraryDatabase();
		const artistLink = db
			.prepare("select url from atlas_entity_links where host = 'danbooru.donmai.us'")
			.get() as { url: string } | undefined;
		db.close();

		expect(response.status).toBe(200);
		expect(imageFetch).not.toHaveBeenCalled();
		expect(artistLink?.url).toBe('https://danbooru.donmai.us/posts?tags=test_artist');
		expect(snapshot.assets[0]).toMatchObject({
			storageMode: 'url_reference',
			sourceName: 'Danbooru',
			width: 1200,
			height: 900,
			record: {
				source: {
					type: 'booru'
				}
			}
		});
	});

	it('saves the selected image from a multi-image Explore post', async () => {
		getById.mockResolvedValue({
			...sampleItem,
			id: 'bluesky-post',
			source: 'bluesky',
			detailUrl: 'https://bsky.app/profile/did:plc:test/post/3abc',
			imageUrl: 'https://cdn.bsky.app/first.jpg',
			additionalImages: ['https://cdn.bsky.app/second.jpg'],
			rawMetadata: {
				bluesky: {
					authorHandle: 'artist.example',
					authorProfileUrl: 'https://bsky.app/profile/artist.example'
				}
			}
		});
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({
					item_id: 'bluesky-post',
					image_index: 1,
					destination_folder_id: null,
					storage_mode: 'url_reference'
				})
			})
		});

		expect(response.status).toBe(200);
		expect(getLibrarySnapshot().assets[0]).toMatchObject({
			sourceUrl: 'https://bsky.app/profile/did:plc:test/post/3abc',
			sourceImageUrl: 'https://cdn.bsky.app/second.jpg',
			sourceName: 'Bluesky'
		});
	});

	it('preserves DeviantArt artist identity and profile links on import', async () => {
		getById.mockResolvedValue({
			...sampleItem,
			id: 'deviantart-9B52BC18-A3C0-8F6E-9A3D-CC30EE0EB4BC',
			source: 'deviantart',
			detailUrl: 'https://www.deviantart.com/loish/art/teeth-935239062',
			title: 'teeth',
			artistRaw: 'loish',
			imageUrl: 'https://images.example.test/teeth.png',
			rawMetadata: {
				deviantart: {
					width: 700,
					height: 998,
					authorUsername: 'loish',
					authorProfileUrl: 'https://www.deviantart.com/loish'
				}
			}
		});
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');
		const { openLibraryDatabase } = await import('$lib/server/library/schema');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({
					item_id: 'deviantart-9B52BC18-A3C0-8F6E-9A3D-CC30EE0EB4BC',
					destination_folder_id: null,
					storage_mode: 'url_reference'
				})
			})
		});
		const snapshot = getLibrarySnapshot();
		const db = openLibraryDatabase();
		const artistLink = db
			.prepare("select url from atlas_entity_links where host = 'deviantart.com'")
			.get() as { url: string } | undefined;
		db.close();

		expect(response.status).toBe(200);
		expect(fetch).not.toHaveBeenCalled();
		expect(artistLink?.url).toBe('https://deviantart.com/loish');
		expect(snapshot.assets[0]).toMatchObject({
			storageMode: 'url_reference',
			sourceName: 'DeviantArt',
			width: 700,
			height: 998,
			record: {
				source: {
					type: 'gallery'
				}
			}
		});
	});

	it('stores real image dimensions and Explore metadata instead of placeholder dimensions', async () => {
		getById.mockResolvedValue({
			...sampleItem,
			title: 'Félicien Rops',
			artistRaw: 'Frères Ghemar',
			dateDisplay: '1860s–70s',
			medium: 'Albumen silver print from glass negative',
			objectName: 'Photograph',
			department: 'Photographs',
			description: 'Public domain image according to The Met.',
			tags: ['photograph', 'portrait']
		});
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({ item_id: 'met-1', destination_folder_id: null })
			})
		});
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(200);
		expect(snapshot.assets[0]).toMatchObject({
			title: 'Félicien Rops',
			storageMode: 'download',
			creator: 'Frères Ghemar',
			year: '1860s–70s',
			medium: 'Albumen silver print from glass negative',
			sourceName: 'The Met',
			sourceUrl: 'https://www.metmuseum.org/art/collection/search/1',
			sourceType: 'museum',
			width: 17,
			height: 23,
			tags: [],
			description: 'Public domain image according to The Met.'
		});
		expect(snapshot.assets[0].record?.organization.sourceTagSuggestions).toEqual([
			expect.objectContaining({ name: 'source: The Met', slug: 'source-the-met' }),
			expect.objectContaining({
				name: 'medium: Albumen silver print from glass negative',
				slug: 'medium-albumen-silver-print-from-glass-negative'
			}),
			expect.objectContaining({ name: 'style/era: 1860s–70s', slug: 'style-era-1860s-70s' }),
			expect.objectContaining({ name: 'department: Photographs', slug: 'department-photographs' }),
			expect.objectContaining({ name: 'subject: photograph', slug: 'subject-photograph' }),
			expect.objectContaining({ name: 'subject: portrait', slug: 'subject-portrait' })
		]);
	});

	it('normalizes safe Explore metadata into Atlas records while keeping source tags suggested', async () => {
		getById.mockResolvedValue({
			...sampleItem,
			title: 'Picasso metadata study',
			artistRaw: 'Pablo Picasso',
			dateDisplay: '1937',
			medium: 'Oil on canvas',
			objectName: 'Painting',
			department: 'Paintings',
			description: 'Public domain image according to The Met.',
			tags: ['horse', 'mourning']
		});
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');
		const { getAtlasAssetSummary } = await import('$lib/server/atlas/read');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({ item_id: 'met-1', destination_folder_id: null })
			})
		});
		const snapshot = getLibrarySnapshot();
		const summary = getAtlasAssetSummary(snapshot.assets[0].id);

		expect(response.status).toBe(200);
		expect(summary.entities).toEqual([
			expect.objectContaining({ kind: 'artist', slug: 'pablo_picasso' }),
			expect.objectContaining({ kind: 'source', slug: 'the_met' })
		]);
		expect(summary.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'date', slug: '1937' }),
				expect.objectContaining({ kind: 'medium', slug: 'oil_on_canvas' }),
				expect.objectContaining({ kind: 'rights', slug: 'public_domain' })
			])
		);
		expect(summary.tagSuggestions).toEqual([
			expect.objectContaining({ slug: 'horse', status: 'suggested' }),
			expect.objectContaining({ slug: 'mourning', status: 'suggested' })
		]);
		expect(snapshot.assets[0].tags).toEqual([]);
	});

	it('falls back to the Art Institute thumbnail when the full IIIF image is unavailable', async () => {
		const image = await sharp({
			create: { width: 843, height: 1280, channels: 3, background: '#bada55' }
		})
			.jpeg()
			.toBuffer();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: string | URL | Request) =>
				String(input).includes('/full/full/')
					? new Response(null, { status: 403 })
					: new Response(new Uint8Array(image), {
							status: 200,
							headers: { 'content-type': 'image/jpeg' }
						})
			)
		);
		getById.mockResolvedValue({
			...sampleItem,
			id: 'artic-27992',
			source: 'artic',
			detailUrl: 'https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte',
			title: 'A Sunday on La Grande Jatte',
			imageUrl: 'https://www.artic.edu/iiif/2/abc123',
			thumbUrl: 'https://www.artic.edu/iiif/2/abc123/full/400,/0/default.jpg',
			isIIIF: true,
			rawMetadata: {
				thumbnail: {
					width: 843,
					height: 1280
				}
			}
		});
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({ item_id: 'artic-27992', destination_folder_id: null })
			})
		});
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(200);
		expect(snapshot.assets[0]).toMatchObject({
			sourceName: 'Art Institute',
			sourceUrl: 'https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte',
			width: 843,
			height: 1280
		});
	});

	it('does not create a fragile URL-only Wikimedia asset when the image download is throttled', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 429 }))
		);
		getById.mockResolvedValue({
			...sampleItem,
			id: 'wikidata-Q12418',
			source: 'wikidata',
			detailUrl: 'https://www.wikidata.org/wiki/Q12418',
			title: 'Mona Lisa',
			imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/mona.jpg',
			thumbUrl: null,
			isIIIF: false,
			rawMetadata: {}
		});
		const { POST } = await import('./+server');
		const { getLibrarySnapshot } = await import('$lib/server/library/read');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({ item_id: 'wikidata-Q12418', destination_folder_id: null })
			})
		});
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(502);
		expect(snapshot.assets).toHaveLength(0);
	});

	it('rejects remote image downloads that exceed the configured size limit', async () => {
		vi.stubEnv('PASTICHE_MAX_IMAGE_BYTES', `${1024 * 1024}`);
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(null, { status: 200, headers: { 'content-length': `${2 * 1024 * 1024}` } })
			)
		);
		getById.mockResolvedValue(sampleItem);
		const { POST } = await import('./+server');

		const response = await POST({
			request: new Request('http://localhost/api/library/save-explore', {
				method: 'POST',
				body: JSON.stringify({ item_id: 'met-1', destination_folder_id: null })
			})
		});

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			error: 'Remote images are limited to 1 MB'
		});
	});
});
