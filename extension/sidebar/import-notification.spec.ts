import { describe, expect, it } from 'vitest';
import { importNotificationFromMessage } from './import-notification';

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
});
