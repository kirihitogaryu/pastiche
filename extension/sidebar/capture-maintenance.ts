const MAINTENANCE_MESSAGES = new Set(['PASTICHE_CLEAR_SELECTION', 'PASTICHE_DESELECT_ITEM']);

export function shouldSurfaceContentScriptError(input: {
	messageType: string;
	error: unknown;
}): boolean {
	if (!MAINTENANCE_MESSAGES.has(input.messageType)) return true;
	return !isReceivingEndError(input.error);
}

function isReceivingEndError(error: unknown): boolean {
	return error instanceof Error && /receiving end does not exist/i.test(error.message);
}
