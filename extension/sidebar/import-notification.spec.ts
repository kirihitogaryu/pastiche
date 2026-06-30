import { describe, expect, it } from 'vitest';
import {
	CONTEXT_IMPORT_NOTIFICATION_KEY,
	importNotificationFromMessage,
	importNotificationFromResult,
	recentStoredImportNotification,
	storedImportNotificationFromMessage
} from '../shared/import-notification';

describe('extension import notification state', () => {
	it('shows a working notification when a context-menu import starts', () => {
		expect.assertions(1);

		expect(
			importNotificationFromMessage({
				type: 'PASTICHE_CONTEXT_IMPORT_STARTED',
				sourceImageUrl: 'https://pbs.twimg.com/media/work?format=jpg&name=large'
			})
		).toEqual({
			state: 'working',
			title: 'Downloading image',
			detail: 'pbs.twimg.com'
		});
	});

	it('summarizes successful, queued, and failed context-menu import results', () => {
		expect.assertions(4);

		expect(
			importNotificationFromMessage({
				type: 'PASTICHE_CONTEXT_IMPORT_FINISHED',
				result: { ok: true, imported: [{ index: 0, ok: true, duplicate: false }], failed: [] }
			})
		).toMatchObject({ state: 'success', title: 'Imported to Library' });

		expect(
			importNotificationFromMessage({
				type: 'PASTICHE_CONTEXT_IMPORT_FINISHED',
				result: {
					ok: false,
					imported: [],
					failed: [{ index: 0, ok: false, error: 'Queued — Pastiche offline' }],
					error: 'Pastiche is offline. Import queued.'
				}
			})
		).toMatchObject({ state: 'queued', title: 'Import queued' });

		expect(
			importNotificationFromMessage({
				type: 'PASTICHE_CONTEXT_IMPORT_FINISHED',
				result: { ok: false, imported: [], failed: [], error: 'HTTP 403' }
			})
		).toEqual({ state: 'error', title: 'Import failed', detail: 'HTTP 403' });

		expect(
			importNotificationFromMessage({
				type: 'PASTICHE_CONTEXT_IMPORT_FINISHED',
				result: {
					ok: true,
					imported: [],
					failed: [{ index: 0, ok: false, error: 'Unsupported image data' }]
				}
			})
		).toEqual({ state: 'error', title: 'Import failed', detail: 'Unsupported image data' });
	});

	it('stores and restores recent context-menu import feedback for closed sidebars', () => {
		expect.assertions(5);

		const stored = storedImportNotificationFromMessage(
			{
				type: 'PASTICHE_CONTEXT_IMPORT_STARTED',
				sourceImageUrl: 'https://img.example.com/full/work.jpg'
			},
			{ id: 'activity-1', updatedAt: '2026-06-30T12:00:00.000Z' }
		);

		expect(CONTEXT_IMPORT_NOTIFICATION_KEY).toBe('pastiche_context_import_notification');
		expect(stored).toMatchObject({
			id: 'activity-1',
			updatedAt: '2026-06-30T12:00:00.000Z',
			state: 'working',
			title: 'Downloading image',
			detail: 'img.example.com'
		});
		expect(recentStoredImportNotification(stored, Date.parse('2026-06-30T12:00:20.000Z'))).toEqual(
			stored
		);
		expect(
			recentStoredImportNotification(stored, Date.parse('2026-06-30T12:02:01.000Z'))
		).toBeNull();
		expect(recentStoredImportNotification({ ...stored, state: 'mystery' })).toBeNull();
	});

	it('summarizes manual sidebar import results after imported items are removed', () => {
		expect.assertions(4);

		expect(
			importNotificationFromResult({
				ok: true,
				imported: [{ index: 0, ok: true, duplicate: false }],
				failed: []
			})
		).toEqual({
			state: 'success',
			title: 'Imported to Library',
			detail: '1 image saved'
		});

		expect(
			importNotificationFromResult({
				ok: true,
				imported: [
					{ index: 0, ok: true, duplicate: false },
					{ index: 1, ok: true, duplicate: true }
				],
				failed: [{ index: 2, ok: false, error: 'HTTP 403' }]
			})
		).toEqual({
			state: 'success',
			title: 'Imported to Library',
			detail: '2 images saved, 1 failed'
		});

		expect(
			importNotificationFromResult({
				ok: false,
				imported: [],
				failed: [{ index: 0, ok: false, error: 'Queued — Pastiche offline' }],
				error: 'Pastiche is offline. Import queued.'
			})
		).toMatchObject({ state: 'queued', title: 'Import queued' });

		expect(
			importNotificationFromResult({
				ok: false,
				imported: [],
				failed: [{ index: 0, ok: false, error: 'Unsupported image data' }]
			})
		).toEqual({
			state: 'error',
			title: 'Import failed',
			detail: 'Unsupported image data'
		});
	});
});
