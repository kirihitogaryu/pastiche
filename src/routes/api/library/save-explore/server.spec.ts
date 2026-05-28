import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
		vi.resetModules();
	});

	afterEach(() => {
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
});
