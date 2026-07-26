import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from './import';
import { addProjectAssetRef, createProject, createTag } from './organization';
import { openLibraryDatabase } from './schema';
import { getLibraryAssetById, getLibrarySnapshot } from './read';

describe('library read service', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-read-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('maps URL-reference imports into Library assets', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Mira character ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/mira.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1200,
					natural_height: 1800,
					source_url: 'https://example.com/mira',
					page_title: 'Mira | Toyhouse',
					alt_text: 'Full-body reference sheet',
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const snapshot = getLibrarySnapshot();

		expect(snapshot.assets).toHaveLength(1);
		expect(snapshot.assets[0]).toMatchObject({
			id: imported.imported[0].asset_id,
			title: 'Mira | Toyhouse',
			sourceName: 'example.com',
			sourceType: 'web',
			sourceUrl: 'https://example.com/mira',
			imageUrl: 'https://example.com/mira.jpg',
			width: 1200,
			height: 1800,
			storageMode: 'url_reference',
			sourceImageUrl: 'https://example.com/mira.jpg',
			saved: true,
			folderPath: ['library', 'unassigned']
		});
		expect(snapshot.assets[0].record).toMatchObject({
			title: 'Mira | Toyhouse',
			artist: null,
			dates: {
				dateDisplay: null,
				capturedAt: '2026-05-27T12:00:00.000Z'
			},
			source: {
				label: 'example.com',
				type: 'unknown',
				pageUrl: 'https://example.com/mira',
				imageUrl: 'https://example.com/mira.jpg',
				imageHost: 'example.com'
			},
			image: {
				previewUrl: 'https://example.com/mira.jpg',
				originalUrl: 'https://example.com/mira.jpg',
				sourceImageUrl: 'https://example.com/mira.jpg',
				localOriginalAvailable: false,
				localThumbnailAvailable: false
			},
			organization: {
				folderPath: ['library', 'unassigned'],
				tags: [],
				sourceTagSuggestions: [
					{
						name: 'source: example.com',
						slug: 'source-example-com',
						facetName: 'source',
						facetSlug: 'source',
						value: 'example.com',
						accepted: false,
						useful: true
					}
				]
			}
		});
		expect(snapshot.stats.assets).toBe(1);
		expect(snapshot.stats.folders).toBe(0);
		expect(snapshot.stats.tags).toBe(0);
	});

	it('reads one library asset record by id without requiring a full snapshot', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Single asset',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/single.jpg',
					mime_type: 'image/jpeg',
					natural_width: 800,
					natural_height: 600,
					source_url: 'https://example.com/page',
					page_title: 'Single Asset',
					alt_text: null,
					captured_at: '2026-07-06T12:00:00.000Z'
				}
			]
		});

		const asset = getLibraryAssetById(imported.imported[0].asset_id);

		expect(asset?.title).toBe('Single Asset');
		expect(asset?.record?.image.previewUrl).toBe('https://example.com/single.jpg');
		expect(getLibraryAssetById('missing')).toBeNull();
	});

	it('maps Explore museum metadata into canonical Library records', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'MET_1987_1100_original.jpg',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://images.metmuseum.org/CRDImages/ph/original/DP1100.jpg',
					mime_type: 'image/jpeg',
					natural_width: 1600,
					natural_height: 1600,
					source_url: 'https://www.metmuseum.org/art/collection/search/123',
					page_title: 'After the Flood',
					alt_text: 'Albumen silver print from glass negative',
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: {
						sourceId: 'met',
						sourceName: 'The Met',
						sourceType: 'museum',
						detailUrl: 'https://www.metmuseum.org/art/collection/search/123',
						creator: 'Julia Margaret Cameron',
						dateDisplay: '1860s-70s',
						medium: 'Albumen silver print from glass negative',
						objectName: 'Photograph',
						department: 'Photographs',
						rights: 'Public domain image according to The Met.',
						tags: ['Photographs', 'Portraits', 'Albumen silver prints'],
						rawMetadata: {
							accessionNumber: '1987.1100'
						}
					}
				}
			]
		});

		const snapshot = getLibrarySnapshot();
		const asset = snapshot.assets[0];

		expect(asset.id).toBe(imported.imported[0].asset_id);
		expect(asset.record).toMatchObject({
			title: 'After the Flood',
			artist: 'Julia Margaret Cameron',
			description: 'Albumen silver print from glass negative',
			dates: {
				dateDisplay: '1860s-70s',
				capturedAt: '2026-05-27T12:00:00.000Z'
			},
			dimensions: {
				width: 1600,
				height: 1600
			},
			source: {
				label: 'The Met',
				type: 'museum',
				sourceId: 'met',
				pageUrl: 'https://www.metmuseum.org/art/collection/search/123',
				imageUrl: 'https://images.metmuseum.org/CRDImages/ph/original/DP1100.jpg',
				imageHost: 'images.metmuseum.org',
				domain: 'www.metmuseum.org'
			},
			facts: {
				medium: 'Albumen silver print from glass negative',
				type: 'Photograph',
				department: 'Photographs',
				rights: 'Public domain image according to The Met.'
			},
			organization: {
				tags: [],
				sourceTagSuggestions: [
					expect.objectContaining({
						name: 'source: The Met',
						slug: 'source-the-met',
						facetName: 'source',
						useful: true
					}),
					expect.objectContaining({
						name: 'medium: Albumen silver print from glass negative',
						slug: 'medium-albumen-silver-print-from-glass-negative',
						facetName: 'medium',
						useful: true
					}),
					expect.objectContaining({
						name: 'style/era: 1860s-70s',
						slug: 'style-era-1860s-70s',
						facetName: 'style/era',
						useful: true
					}),
					expect.objectContaining({
						name: 'department: Photographs',
						slug: 'department-photographs',
						facetName: 'department',
						useful: false
					}),
					expect.objectContaining({
						name: 'subject: Photographs',
						slug: 'subject-photographs',
						facetName: 'subject',
						useful: true
					}),
					expect.objectContaining({
						name: 'subject: Portraits',
						slug: 'subject-portraits',
						facetName: 'subject',
						useful: true
					}),
					expect.objectContaining({
						name: 'subject: Albumen silver prints',
						slug: 'subject-albumen-silver-prints',
						facetName: 'subject',
						useful: true
					})
				]
			},
			raw: {
				importer: 'explore',
				sourceMetadata: {
					accessionNumber: '1987.1100'
				}
			}
		});
		expect(asset.tags).toEqual([]);
		expect(asset.sourceName).toBe('The Met');
		expect(asset.year).toBe('1860s-70s');
	});

	it('uses local image API URLs for downloaded images', async () => {
		await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Downloaded ref',
					storage_mode: 'download',
					image_data: tinyPngBase64(),
					source_image_url: 'https://example.com/image.jpg',
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://example.com/page',
					page_title: 'Downloaded Reference',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const asset = getLibrarySnapshot().assets[0];
		expect(asset.record).toBeDefined();

		expect(asset.record!.image).toMatchObject({
			previewUrl: `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=thumb`,
			originalUrl: `/api/library/assets/${encodeURIComponent(asset.id)}/image?variant=original`,
			sourceImageUrl: 'https://example.com/image.jpg',
			localOriginalAvailable: true,
			localThumbnailAvailable: true
		});
		expect(asset.imageUrl).toBe(asset.record!.image.previewUrl);
	});

	it('persists embedded NovelAI metadata and exposes generation records', async () => {
		await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'novelai-dragon.png',
					storage_mode: 'download',
					image_data: novelAiPngBase64(),
					source_image_url: null,
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://novelai.net/image',
					page_title: 'NovelAI dragon',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const asset = getLibrarySnapshot().assets[0];

		expect(asset.record?.raw.sourceMetadata).toMatchObject({
			embeddedImageMetadata: {
				kind: 'png',
				pngText: {
					Software: 'NovelAI'
				}
			}
		});
		expect(asset.record?.generation).toMatchObject({
			provider: 'novelai',
			prompt: 'artist:nightcrow, western dragon, opal scales',
			negativePrompt: 'lowres, blurry',
			seed: 3468250285,
			promptTagSuggestions: ['western dragon', 'opal scales']
		});
		expect(asset.record?.generation?.promptTokens).toContainEqual(
			expect.objectContaining({
				text: 'artist:nightcrow',
				normalized: 'nightcrow',
				role: 'artist_style_reference'
			})
		);
	});

	it('falls back to local originals for generation metadata on older imports', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'legacy-novelai.png',
					storage_mode: 'download',
					image_data: novelAiPngBase64(),
					source_image_url: null,
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://novelai.net/image',
					page_title: 'Legacy NovelAI',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z',
					metadata: {
						rawMetadata: {}
					}
				}
			]
		});
		const db = openLibraryDatabase();
		db.prepare('update assets set metadata_json = ? where id = ?').run(
			JSON.stringify({ rawMetadata: {} }),
			imported.imported[0].asset_id
		);
		db.close();

		const asset = getLibrarySnapshot().assets[0];

		expect(asset.record?.raw.sourceMetadata).toMatchObject({
			embeddedImageMetadata: { kind: 'png' }
		});
		expect(asset.record?.generation).toMatchObject({
			provider: 'novelai',
			prompt: 'artist:nightcrow, western dragon, opal scales',
			negativePrompt: 'lowres, blurry'
		});
	});

	it('returns General tags before grouped tags with tag values', () => {
		createTag({ value: 'favorite' });
		createTag({ facet: 'Subject', value: 'hands' });

		const snapshot = getLibrarySnapshot();
		const general = snapshot.tagFacets[0];

		expect(general.slug).toBe('general');
		expect(general.kind).toBe('general');
		expect(general.tags).toEqual([
			expect.objectContaining({ value: 'favorite', facetSlug: 'general' })
		]);
		expect(snapshot.tagFacets.find((group) => group.slug === 'subject')?.tags).toEqual([
			expect.objectContaining({ value: 'hands', facetSlug: 'subject' })
		]);
	});

	it('returns project cover preview urls when the cover asset exists', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Cover ref',
					storage_mode: 'download',
					image_data: tinyPngBase64(),
					source_image_url: 'https://example.com/cover.jpg',
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://example.com/page',
					page_title: 'Cover Reference',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});
		const project = createProject({ name: 'Cover board' });
		addProjectAssetRef(project.id, imported.imported[0].asset_id);

		const snapshot = getLibrarySnapshot();
		const coverProject = snapshot.projects.find((item) => item.id === project.id);

		expect(coverProject?.coverPreviewUrl).toMatch(
			/^\/api\/library\/assets\/.+\/image\?variant=thumb$/
		);
	});

	it('reports missing local image files without falling back to a missing archive URL', async () => {
		await importLibraryItems({
			destination_folder_id: null,
			items: [
				{
					filename: 'Missing local ref',
					storage_mode: 'download',
					image_data: tinyPngBase64(),
					source_image_url: null,
					mime_type: 'image/png',
					natural_width: 1,
					natural_height: 1,
					source_url: 'https://example.com/page',
					page_title: 'Missing Local Reference',
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		rmSync(join(archiveRoot, 'originals'), { recursive: true, force: true });
		rmSync(join(archiveRoot, 'thumbnails'), { recursive: true, force: true });

		const asset = getLibrarySnapshot().assets[0];
		expect(asset.record).toBeDefined();

		expect(asset.record!.image).toMatchObject({
			previewUrl: null,
			originalUrl: null,
			sourceImageUrl: null,
			localOriginalAvailable: false,
			localThumbnailAvailable: false
		});
		expect(asset.imageUrl).toBe('');
	});

	it('maps top-level folders and direct folder asset paths', async () => {
		await importLibraryItems({
			destination_folder_id: null,
			create_folder_name: 'Character refs',
			items: [
				{
					filename: 'Foldered ref',
					storage_mode: 'url_reference',
					image_data: null,
					source_image_url: 'https://example.com/foldered.jpg',
					mime_type: 'image/jpeg',
					natural_width: 900,
					natural_height: 900,
					source_url: 'https://example.com/foldered',
					page_title: null,
					alt_text: null,
					captured_at: '2026-05-27T12:00:00.000Z'
				}
			]
		});

		const snapshot = getLibrarySnapshot();

		expect(snapshot.folders).toEqual([
			expect.objectContaining({
				name: 'Character refs',
				path: ['library', 'character-refs'],
				assetCount: 1,
				childFolderCount: 0
			})
		]);
		expect(snapshot.assets[0].folderPath).toEqual(['library', 'character-refs']);
	});
});

function tinyPngBase64() {
	return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
}

function novelAiPngBase64() {
	return pngWithTextChunks({
		Software: 'NovelAI',
		Source: 'NovelAI Diffusion V4.5 4BDE2A90',
		Description: 'artist:nightcrow, western dragon, opal scales',
		Comment: JSON.stringify({
			prompt: 'artist:nightcrow, western dragon, opal scales',
			uc: 'lowres, blurry',
			steps: 25,
			width: 1216,
			height: 832,
			scale: 6,
			seed: 3468250285,
			sampler: 'k_euler_ancestral',
			v4_prompt: {
				caption: {
					base_caption: 'artist:nightcrow, western dragon, opal scales'
				}
			},
			v4_negative_prompt: {
				caption: {
					base_caption: 'lowres, blurry'
				}
			}
		})
	}).toString('base64');
}

function pngWithTextChunks(text: Record<string, string>) {
	const base = Buffer.from(tinyPngBase64(), 'base64');
	const endIndex = base.length - 12;
	const chunks = Object.entries(text).map(([keyword, value]) =>
		pngChunk('tEXt', Buffer.from(`${keyword}\0${value}`, 'latin1'))
	);
	return Buffer.concat([base.subarray(0, endIndex), ...chunks, base.subarray(endIndex)]);
}

function pngChunk(type: string, data: Buffer) {
	const typeBuffer = Buffer.from(type, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
	return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}
