import { describe, expect, it, vi } from 'vitest';
import { respondToExtensionMessage } from './message-handler';

describe('extension service worker message response wrapper', () => {
	it('returns handler results for successful messages', async () => {
		expect.assertions(1);

		await expect(
			respondToExtensionMessage({ type: 'PASTICHE_GET_STATUS' }, async () => ({ ok: true }))
		).resolves.toEqual({ ok: true });
	});

	it('converts capture handler failures into explicit error responses', async () => {
		expect.assertions(2);
		const onCaptureError = vi.fn();

		await expect(
			respondToExtensionMessage(
				{ type: 'PASTICHE_ITEM_CAPTURED' },
				async () => {
					throw new Error('Could not enrich capture');
				},
				{ onCaptureError }
			)
		).resolves.toEqual({ ok: false, error: 'Could not enrich capture' });
		expect(onCaptureError).toHaveBeenCalledWith('Could not enrich capture');
	});
});
