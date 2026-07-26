const CAPTURE_MESSAGE_TYPES = new Set([
	'PASTICHE_ITEM_CAPTURED',
	'PASTICHE_SWEEP_RESULTS',
	'PASTICHE_LASSO_RESULTS',
	'PASTICHE_CAPTURE_TAB_IMAGE'
]);

export async function respondToExtensionMessage(
	message: { type?: string },
	handler: () => Promise<unknown>,
	options: { onCaptureError?: (error: string) => void } = {}
): Promise<unknown> {
	try {
		return await handler();
	} catch (error) {
		const messageText = error instanceof Error ? error.message : 'Extension message failed';
		if (message.type && CAPTURE_MESSAGE_TYPES.has(message.type)) {
			options.onCaptureError?.(messageText);
			return { ok: false, error: messageText };
		}
		return { ok: false, error: messageText };
	}
}
