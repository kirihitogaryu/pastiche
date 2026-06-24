import { describe, expect, it } from 'vitest';
import { CONTEXT_MENU_SAVE_IMAGE_ID, imageContextCaptureSource } from './context-menu';

describe('image context menu import', () => {
	it('maps a clicked image context menu event into a capture source', () => {
		expect.assertions(1);

		expect(
			imageContextCaptureSource(
				{
					menuItemId: CONTEXT_MENU_SAVE_IMAGE_ID,
					srcUrl: 'https://pbs.twimg.com/media/HI7vWX8a4AA_7qb?format=jpg&name=large',
					pageUrl: 'https://x.com/haemooowo/status/2057846073469829591',
					linkUrl: 'https://x.com/haemooowo/status/2057846073469829591/photo/1'
				},
				{ title: 'haemooowo on Twitter', url: 'https://x.com/haemooowo/status/2057846073469829591' }
			)
		).toEqual({
			imageUrl: 'https://pbs.twimg.com/media/HI7vWX8a4AA_7qb?format=jpg&name=large',
			sourceUrl: 'https://x.com/haemooowo/status/2057846073469829591',
			detailUrl: 'https://x.com/haemooowo/status/2057846073469829591/photo/1',
			pageTitle: 'haemooowo on Twitter'
		});
	});

	it('falls back to the image URL when the browser does not provide page context', () => {
		expect.assertions(1);

		expect(
			imageContextCaptureSource(
				{
					menuItemId: CONTEXT_MENU_SAVE_IMAGE_ID,
					srcUrl: 'https://cdn.donmai.us/original/work.png'
				},
				{}
			)
		).toEqual({
			imageUrl: 'https://cdn.donmai.us/original/work.png',
			sourceUrl: 'https://cdn.donmai.us/original/work.png',
			detailUrl: null,
			pageTitle: 'https://cdn.donmai.us/original/work.png'
		});
	});

	it('ignores unrelated menu clicks and menu events without an image URL', () => {
		expect.assertions(2);

		expect(
			imageContextCaptureSource({ menuItemId: 'other', srcUrl: 'https://example.com/work.jpg' }, {})
		).toBeNull();
		expect(imageContextCaptureSource({ menuItemId: CONTEXT_MENU_SAVE_IMAGE_ID }, {})).toBeNull();
	});
});
