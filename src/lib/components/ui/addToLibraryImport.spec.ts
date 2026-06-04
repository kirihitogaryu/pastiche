import { describe, expect, it } from 'vitest';
import { buildImportRequest, type AddToLibraryImportItem } from './addToLibraryImport';

describe('buildImportRequest', () => {
	it('targets the active folder and preserves import items', () => {
		const item: AddToLibraryImportItem = {
			filename: 'study.png',
			storage_mode: 'download',
			image_data: 'abc',
			source_image_url: null,
			mime_type: 'image/png',
			natural_width: 100,
			natural_height: 200,
			source_url: 'file://study.png',
			page_title: 'study.png',
			alt_text: null,
			captured_at: '2026-06-04T00:00:00.000Z',
			metadata: { sourceName: 'Local file', sourceType: 'local' }
		};

		const request = buildImportRequest({
			destinationFolderId: 'folder-reference',
			items: [item]
		});

		expect(request.destination_folder_id).toBe('folder-reference');
		expect(request.items[0]?.filename).toBe('study.png');
	});
});
