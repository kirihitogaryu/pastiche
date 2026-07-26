import { describe, expect, it } from 'vitest';
import { capturedPayloadForVisibleScreenshot } from './screenshot-capture';

describe('visible screenshot capture payload', () => {
	it('labels visible viewport screenshots as rendered fallback captures', () => {
		expect.assertions(8);

		const payload = capturedPayloadForVisibleScreenshot({
			dataUrl: 'data:image/png;base64,abc123',
			pageUrl: 'https://www.instagram.com/p/example/',
			pageTitle: 'Example post',
			width: 1440,
			height: 900,
			capturedAt: '2026-06-30T12:00:00.000Z'
		});

		expect(payload.url).toBe('data:image/png;base64,abc123');
		expect(payload.inlineData).toBe('data:image/png;base64,abc123');
		expect(payload.mimeType).toBe('image/png');
		expect(payload.naturalWidth).toBe(1440);
		expect(payload.naturalHeight).toBe(900);
		expect(payload.candidates?.[0]).toMatchObject({
			kind: 'screenshot',
			width: 1440,
			height: 900,
			scoreReasons: ['visible screenshot fallback']
		});
		expect(payload.metadata).toMatchObject({
			title: 'Visible capture - Example post',
			tags: ['rendered capture'],
			suggestedTags: ['screenshot fallback']
		});
		expect(payload.source).toMatchObject({
			pageUrl: 'https://www.instagram.com/p/example/',
			sourceLabel: 'Instagram',
			sourceType: 'social',
			pageHost: 'instagram.com',
			imageHost: null
		});
	});
});
