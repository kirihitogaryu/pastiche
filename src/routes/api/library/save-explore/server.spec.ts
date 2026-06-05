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

	it('uses Art Institute thumbnail dimensions when IIIF info is unavailable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 403 }))
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

	it('saves Wikimedia items with fallback dimensions when remote image probing is throttled', async () => {
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

		expect(response.status).toBe(200);
		expect(snapshot.assets[0]).toMatchObject({
			sourceName: 'Wikidata',
			sourceUrl: 'https://www.wikidata.org/wiki/Q12418',
			width: 1,
			height: 1
		});
	});
});
