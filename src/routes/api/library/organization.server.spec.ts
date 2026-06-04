import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { createFolder, createProject } from '$lib/server/library/organization';
import { POST as createFolderPost } from './folders/+server';
import { POST as createProjectPost } from './projects/+server';
import { POST as createTagGroupPost } from './tag-groups/+server';
import { POST as createTagPost } from './tags/+server';
import { POST as attachTagPost } from './assets/[id]/tags/+server';
import { POST as acceptSourceTagPost } from './assets/[id]/source-tags/+server';
import { POST as addProjectAssetPost } from './projects/[id]/assets/+server';
import { POST as addProjectFolderPost } from './projects/[id]/folders/+server';

describe('library organization routes', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-organization-routes-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('creates empty folders, projects, and standalone tags', async () => {
		const folderResponse = await createFolderPost({
			request: jsonRequest({ name: 'Character Poses ✨' })
		});
		const folderBody = await folderResponse.json();
		expect(folderResponse.status).toBe(200);
		expect(folderBody.folder).toMatchObject({ name: 'Character Poses ✨' });
		expect(existsSync(join(archiveRoot, 'library/character-poses'))).toBe(true);

		const projectResponse = await createProjectPost({
			request: jsonRequest({ name: 'Hand study' })
		});
		const projectBody = await projectResponse.json();
		expect(projectResponse.status).toBe(200);
		expect(projectBody.project).toMatchObject({ name: 'Hand study', assetCount: 0 });

		const tagResponse = await createTagPost({
			request: jsonRequest({ label: 'usage intent: lighting study' })
		});
		const tagBody = await tagResponse.json();
		expect(tagResponse.status).toBe(200);
		expect(tagBody.tag).toMatchObject({
			name: 'Usage Intent: lighting study',
			facetName: 'Usage Intent',
			assetCount: 0
		});
		expect(tagBody.snapshot.stats.tags).toBe(1);
	});

	it('creates an empty user tag group without creating a tag', async () => {
		const response = await createTagGroupPost({
			request: jsonRequest({ name: 'Texture' })
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.snapshot.tagFacets.some((group: { slug: string }) => group.slug === 'texture')).toBe(
			true
		);
		expect(
			body.snapshot.tagFacets.find((group: { slug: string }) => group.slug === 'texture')?.tagCount
		).toBe(0);
		expect(body.snapshot.stats.tags).toBe(0);
	});

	it('attaches tags and accepts source tag suggestions for assets', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [referenceImport('Met ref', 'https://images.metmuseum.org/source.jpg')]
		});
		const assetId = imported.imported[0].asset_id;

		const attachResponse = await attachTagPost({
			params: { id: assetId },
			request: jsonRequest({ facet: 'subject', value: 'hands' })
		});
		const attachBody = await attachResponse.json();
		expect(attachResponse.status).toBe(200);
		expect(attachBody.snapshot.assets[0].record.organization.tags).toEqual([
			expect.objectContaining({ name: 'Subject: hands' })
		]);

		const acceptResponse = await acceptSourceTagPost({
			params: { id: assetId },
			request: jsonRequest({ name: 'source: The Met', facet: 'source', value: 'The Met' })
		});
		const acceptBody = await acceptResponse.json();
		expect(acceptResponse.status).toBe(200);
		expect(acceptBody.snapshot.assets[0].record.organization.tags).toEqual(expect.arrayContaining([
			expect.objectContaining({ name: 'Subject: hands' }),
			expect.objectContaining({ name: 'Source: The Met' })
		]));
		expect(
			acceptBody.snapshot.assets[0].record.organization.sourceTagSuggestions.find(
				(tag: { slug: string }) => tag.slug === 'source-the-met'
			)
		).toMatchObject({ accepted: true });
	});

	it('adds direct asset and live direct folder refs to projects', async () => {
		const folder = createFolder({ name: 'Hands' });
		const imported = await importLibraryItems({
			destination_folder_id: folder.id,
			items: [referenceImport('Direct hand', 'https://example.com/direct.jpg')]
		});
		const project = createProject({ name: 'Hand board' });

		const folderRefResponse = await addProjectFolderPost({
			params: { id: project.id },
			request: jsonRequest({ folder_id: folder.id })
		});
		const folderRefBody = await folderRefResponse.json();
		expect(folderRefResponse.status).toBe(200);
		expect(folderRefBody.snapshot.projects[0]).toMatchObject({ assetCount: 1, folderCount: 1 });

		const assetRefResponse = await addProjectAssetPost({
			params: { id: project.id },
			request: jsonRequest({ asset_id: imported.imported[0].asset_id })
		});
		const assetRefBody = await assetRefResponse.json();
		expect(assetRefResponse.status).toBe(200);
		expect(assetRefBody.snapshot.projects[0]).toMatchObject({ assetCount: 1 });
		expect(assetRefBody.snapshot.assets[0].projects).toEqual([project.id]);
	});
});

function jsonRequest(body: unknown) {
	return new Request('http://localhost/api/library/test', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

function referenceImport(filename: string, sourceImageUrl: string) {
	return {
		filename,
		storage_mode: 'url_reference' as const,
		image_data: null,
		source_image_url: sourceImageUrl,
		mime_type: 'image/jpeg',
		natural_width: 800,
		natural_height: 600,
		source_url: 'https://www.metmuseum.org/art/collection/search/1',
		page_title: filename,
		alt_text: null,
		captured_at: '2026-05-27T12:00:00.000Z',
		metadata: {
			sourceId: 'met',
			sourceName: 'The Met',
			sourceType: 'museum' as const,
			detailUrl: 'https://www.metmuseum.org/art/collection/search/1',
			tags: ['hands']
		}
	};
}
