import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importLibraryItems } from '$lib/server/library/import';
import { createFolder, createProject } from '$lib/server/library/organization';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { POST as createFolderPost } from './folders/+server';
import { POST as createProjectPost } from './projects/+server';
import { POST as createTagGroupPost } from './tag-groups/+server';
import { POST as createTagPost } from './tags/+server';
import { PATCH as updateAssetPatch } from './assets/[id]/+server';
import { DELETE as bulkDeleteAssets, PATCH as bulkMoveAssets } from './assets/bulk/+server';
import { POST as attachTagPost } from './assets/[id]/tags/+server';
import { POST as acceptSourceTagPost } from './assets/[id]/source-tags/+server';
import { POST as addProjectAssetPost } from './projects/[id]/assets/+server';
import { POST as addProjectFolderPost } from './projects/[id]/folders/+server';
import { POST as setProjectCoverPost } from './projects/[id]/cover/+server';
import { DELETE as deleteFolderRoute, PATCH as renameFolderRoute } from './folders/[id]/+server';

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
		expect(folderResponse.status).toBe(201);
		expect(folderBody.folder).toMatchObject({ name: 'Character Poses ✨' });
		expect(existsSync(join(archiveRoot, 'library/character-poses'))).toBe(true);

		const projectResponse = await createProjectPost({
			request: jsonRequest({ name: 'Hand study' })
		});
		const projectBody = await projectResponse.json();
		expect(projectResponse.status).toBe(201);
		expect(projectBody.project).toMatchObject({ name: 'Hand study', assetCount: 0 });

		const tagResponse = await createTagPost({
			request: jsonRequest({ label: 'usage intent: lighting study' })
		});
		const tagBody = await tagResponse.json();
		expect(tagResponse.status).toBe(201);
		expect(tagBody.tag).toMatchObject({
			name: 'Usage Intent: lighting study',
			facetName: 'Usage Intent',
			assetCount: 0
		});
		expect(getLibrarySnapshot().stats.tags).toBe(1);
	});

	it('creates an empty user tag group without creating a tag', async () => {
		const response = await createTagGroupPost({
			request: jsonRequest({ name: 'Texture' })
		});
		const body = await response.json();
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(201);
		expect(snapshot.tagFacets.some((group: { slug: string }) => group.slug === 'texture')).toBe(
			true
		);
		expect(
			snapshot.tagFacets.find((group: { slug: string }) => group.slug === 'texture')?.tagCount
		).toBe(0);
		expect(snapshot.stats.tags).toBe(0);
		expect(body.tagGroup).toMatchObject({ name: 'Texture' });
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
		expect(attachResponse.status).toBe(200);
		expect(getLibrarySnapshot().assets[0].record?.organization.tags).toEqual([
			expect.objectContaining({ name: 'Subject: hands' })
		]);

		const acceptResponse = await acceptSourceTagPost({
			params: { id: assetId },
			request: jsonRequest({ name: 'source: The Met', facet: 'source', value: 'The Met' })
		});
		expect(acceptResponse.status).toBe(200);
		const acceptedAsset = getLibrarySnapshot().assets[0];
		expect(acceptedAsset.record?.organization.tags).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'Subject: hands' }),
				expect.objectContaining({ name: 'Source: The Met' })
			])
		);
		expect(
			acceptedAsset.record?.organization.sourceTagSuggestions.find(
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
		expect(folderRefResponse.status).toBe(200);
		expect(getLibrarySnapshot().projects[0]).toMatchObject({ assetCount: 1, folderCount: 1 });

		const assetRefResponse = await addProjectAssetPost({
			params: { id: project.id },
			request: jsonRequest({ asset_id: imported.imported[0].asset_id })
		});
		expect(assetRefResponse.status).toBe(200);
		const assetRefSnapshot = getLibrarySnapshot();
		expect(assetRefSnapshot.projects[0]).toMatchObject({ assetCount: 1 });
		expect(assetRefSnapshot.assets[0].projects).toEqual([project.id]);
	});

	it('sets a project cover and adds the asset to the project when needed', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [referenceImport('Cover hand', 'https://example.com/cover.jpg')]
		});
		const project = createProject({ name: 'Cover board' });

		const response = await setProjectCoverPost({
			params: { id: project.id },
			request: jsonRequest({ asset_id: imported.imported[0].asset_id })
		});
		const body = await response.json();
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(200);
		expect(snapshot.projects[0]).toMatchObject({
			id: project.id,
			coverAssetId: imported.imported[0].asset_id,
			coverPreviewUrl: 'https://example.com/cover.jpg',
			assetCount: 1
		});
		expect(snapshot.assets[0].projects).toEqual([project.id]);
		expect(body.project).toMatchObject({ id: project.id });
	});

	it('favorites assets and moves them between folders', async () => {
		const folder = createFolder({ name: 'Moved refs' });
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [referenceImport('Movable ref', 'https://example.com/move.jpg')]
		});
		const assetId = imported.imported[0].asset_id;

		const favoriteResponse = await updateAssetPatch({
			params: { id: assetId },
			request: jsonRequest({ favorite: true })
		});
		const favoriteBody = await favoriteResponse.json();

		expect(favoriteResponse.status).toBe(200);
		expect(favoriteBody.asset).toMatchObject({ id: assetId, favorite: true });
		expect(favoriteBody.asset.record.organization.favorite).toBe(true);

		const moveResponse = await updateAssetPatch({
			params: { id: assetId },
			request: jsonRequest({ folder_id: folder.id })
		});
		const moveBody = await moveResponse.json();

		expect(moveResponse.status).toBe(200);
		expect(moveBody.asset.record.organization.folderId).toBe(folder.id);
		expect(moveBody.asset.folderPath).toEqual(['library', 'moved-refs']);
	});

	it('renames folder paths and preserves nested membership', async () => {
		const parent = createFolder({ name: 'Old parent' });
		const child = createFolder({ name: 'Child', parentId: parent.id });
		await importLibraryItems({
			destination_folder_id: child.id,
			items: [referenceImport('Nested ref', 'https://example.com/nested-rename.jpg')]
		});

		const response = await renameFolderRoute({
			params: { id: parent.id },
			request: jsonRequest({ name: 'New parent' })
		});
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(200);
		expect(snapshot.folders.find((folder) => folder.id === parent.id)?.path).toEqual([
			'library',
			'new-parent'
		]);
		expect(snapshot.folders.find((folder) => folder.id === child.id)?.path).toEqual([
			'library',
			'new-parent',
			'child'
		]);
		expect(snapshot.assets[0].folderPath).toEqual(['library', 'new-parent', 'child']);
	});

	it('deletes a folder without deleting images and reparents child folders', async () => {
		const parent = createFolder({ name: 'Temporary' });
		const child = createFolder({ name: 'Keep child', parentId: parent.id });
		const direct = await importLibraryItems({
			destination_folder_id: parent.id,
			items: [referenceImport('Direct ref', 'https://example.com/direct-delete-folder.jpg')]
		});
		await importLibraryItems({
			destination_folder_id: child.id,
			items: [referenceImport('Child ref', 'https://example.com/child-delete-folder.jpg')]
		});

		const response = deleteFolderRoute({
			params: { id: parent.id },
			request: jsonRequest({})
		});
		const snapshot = getLibrarySnapshot();

		expect(response.status).toBe(200);
		expect(snapshot.assets).toHaveLength(2);
		expect(
			snapshot.assets.find((asset) => asset.id === direct.imported[0].asset_id)?.record
				?.organization.folderId
		).toBeNull();
		expect(snapshot.folders.find((folder) => folder.id === child.id)).toMatchObject({
			parentId: undefined,
			path: ['library', 'keep-child']
		});
	});

	it('bulk moves and deletes selected assets', async () => {
		const folder = createFolder({ name: 'Bulk target' });
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [
				referenceImport('First', 'https://example.com/bulk-first.jpg'),
				referenceImport('Second', 'https://example.com/bulk-second.jpg')
			]
		});
		const ids = imported.imported.map((item) => item.asset_id);

		const moveResponse = await bulkMoveAssets({
			request: jsonRequest({ asset_ids: ids, folder_id: folder.id })
		});
		expect(moveResponse.status).toBe(200);
		expect(
			getLibrarySnapshot().assets.every(
				(asset) => asset.record?.organization.folderId === folder.id
			)
		).toBe(true);

		const deleteResponse = await bulkDeleteAssets({
			request: jsonRequest({ asset_ids: ids })
		});
		expect(deleteResponse.status).toBe(200);
		expect(getLibrarySnapshot().assets).toHaveLength(0);
	});

	it('does not partially update an asset when one requested field is invalid', async () => {
		const imported = await importLibraryItems({
			destination_folder_id: null,
			items: [referenceImport('Atomic ref', 'https://example.com/atomic.jpg')]
		});
		const assetId = imported.imported[0].asset_id;

		const response = await updateAssetPatch({
			params: { id: assetId },
			request: jsonRequest({ favorite: true, folder_id: 'missing-folder' })
		});
		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const row = db.prepare('select favorite, folder_id from assets where id = ?').get(assetId) as {
			favorite: number;
			folder_id: string | null;
		};
		db.close();

		expect(response.status).toBe(400);
		expect(row).toEqual({ favorite: 0, folder_id: null });
	});

	it('does not leave a project behind when its starting folder is invalid', () => {
		expect(() =>
			createProject({ name: 'Invalid project', startFolderId: 'missing-folder' })
		).toThrow('Folder not found');
		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const count = db.prepare('select count(*) as count from projects').get() as { count: number };
		db.close();

		expect(count.count).toBe(0);
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
