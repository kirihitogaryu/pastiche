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

	it('extracts image URLs from Chromium DownloadURL drops', () => {
		const url = droppedImageUrlFromDataTransfer({
			getData(type) {
				if (type === 'DownloadURL') {
					return 'image/png:work.png:https://cdn.example.com/original/work.png?token=1';
				}
				return '';
			}
		});

		expect(url).toBe('https://cdn.example.com/original/work.png?token=1');
	});

	it('extracts protocol-relative image URLs from html drops', () => {
		const url = droppedImageUrlFromDataTransfer({
			getData(type) {
				if (type === 'text/html') return '<img src="//cdn.example.com/work.webp">';
				return '';
			}
		});

		expect(url).toBe('https://cdn.example.com/work.webp');
	});

	it('extracts Firefox native image URLs', () => {
		const url = droppedImageUrlFromDataTransfer({
			getData(type) {
				if (type === 'text/x-moz-url') {
					return 'https://cdn.example.com/original/work.jpg\nwork.jpg';
				}
				return '';
			}
		});

		expect(url).toBe('https://cdn.example.com/original/work.jpg');
	});

	it('resolves relative HTML image sources against the dragged page', () => {
		const url = droppedImageUrlFromDataTransfer(
			{
				getData(type) {
					if (type === 'text/html') return '<img src="/media/work.jpg?x=1&amp;y=2">';
					return '';
				}
			},
			'https://example.com/gallery/post'
		);

		expect(url).toBe('https://example.com/media/work.jpg?x=1&y=2');
	});

	it('prefers the extension-owned drag URL when native formats are stripped', () => {
		const url = droppedImageUrlFromDataTransfer({
			getData(type) {
				return type === 'application/x-pastiche-image-url'
					? 'https://cdn.example.com/full-size.webp'
					: '';
			}
		});

		expect(url).toBe('https://cdn.example.com/full-size.webp');
	});

	it('builds captured payloads for dropped image files', () => {
		const payload = buildDroppedFilePayload({
			captureUrl: 'pastiche-drop://sha256/abc123',
			storedBlobKey: 'dropped-image:abc123',
			fileName: 'novelai-dragon.png',
			mimeType: 'image/png',
			width: 1216,
			height: 832,
			sourceUrl: 'https://novelai.net/image',
			pageTitle: 'NovelAI',
			capturedAt: '2026-07-01T12:00:00.000Z'
		});

		expect(payload).toMatchObject({
			url: 'pastiche-drop://sha256/abc123',
			inlineData: null,
			storedBlobKey: 'dropped-image:abc123',
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
