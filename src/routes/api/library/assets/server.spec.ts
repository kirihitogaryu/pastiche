import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/library/assets', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-assets-page-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('returns bounded pages with a continuation cursor', async () => {
		const { importLibraryItems } = await import('$lib/server/library/import');
		await importLibraryItems({
			destination_folder_id: null,
			items: [1, 2, 3].map((index) => referenceItem(index))
		});
		const { GET } = await import('./+server');
		const first = await GET({
			request: new Request('http://localhost/api/library/assets?limit=2')
		});
		const firstBody = await first.json();
		const second = await GET({
			request: new Request(
				`http://localhost/api/library/assets?limit=2&cursor=${firstBody.page.nextCursor}`
			)
		});
		const secondBody = await second.json();

		expect(firstBody.assets).toHaveLength(2);
		expect(firstBody.page).toEqual({ limit: 2, nextCursor: '2', total: 3 });
		expect(secondBody.assets).toHaveLength(1);
		expect(secondBody.page.nextCursor).toBeNull();
	});
});

function referenceItem(index: number) {
	return {
		filename: `Asset ${index}`,
		storage_mode: 'url_reference' as const,
		image_data: null,
		source_image_url: `https://example.com/${index}.jpg`,
		mime_type: 'image/jpeg',
		natural_width: 8,
		natural_height: 6,
		source_url: `https://example.com/${index}`,
		page_title: `Asset ${index}`,
		alt_text: null,
		captured_at: `2026-07-22T12:00:0${index}.000Z`
	};
}
