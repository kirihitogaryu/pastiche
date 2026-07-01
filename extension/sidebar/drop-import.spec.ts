import { describe, expect, it } from 'vitest';

import { buildDroppedFilePayload, droppedImageUrlFromDataTransfer } from './drop-import';

describe('sidebar drop import helpers', () => {
	it('extracts image URLs from uri-list drops', () => {
		const url = droppedImageUrlFromDataTransfer({
			getData(type) {
				if (type === 'text/uri-list') return '# source\nhttps://example.com/work.png\n';
				return '';
			}
		});

		expect(url).toBe('https://example.com/work.png');
	});

	it('extracts image URLs from html image drops', () => {
		const url = droppedImageUrlFromDataTransfer({
			getData(type) {
				if (type === 'text/html') return '<img src="https://cdn.example.com/work.jpg">';
				return '';
			}
		});

		expect(url).toBe('https://cdn.example.com/work.jpg');
	});

	it('builds captured payloads for dropped image files', () => {
		const payload = buildDroppedFilePayload({
			dataUrl: 'data:image/png;base64,aaaa',
			fileName: 'novelai-dragon.png',
			mimeType: 'image/png',
			width: 1216,
			height: 832,
			sourceUrl: 'https://novelai.net/image',
			pageTitle: 'NovelAI',
			capturedAt: '2026-07-01T12:00:00.000Z'
		});

		expect(payload).toMatchObject({
			url: 'data:image/png;base64,aaaa',
			inlineData: 'data:image/png;base64,aaaa',
			naturalWidth: 1216,
			naturalHeight: 832,
			mimeType: 'image/png',
			sourceUrl: 'https://novelai.net/image',
			pageTitle: 'NovelAI',
			metadata: {
				title: 'novelai dragon',
				rawPageTitle: 'NovelAI'
			},
			source: {
				sourceLabel: 'Dropped file',
				sourceType: 'unknown'
			}
		});
	});
});
