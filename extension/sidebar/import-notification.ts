import type { ImportResult } from '../shared/types';

export type ImportNotification =
	| { state: 'working'; title: string; detail: string }
	| { state: 'success'; title: string; detail: string }
	| { state: 'queued'; title: string; detail: string }
	| { state: 'error'; title: string; detail: string };

type StartedMessage = {
	type: 'PASTICHE_CONTEXT_IMPORT_STARTED';
	sourceImageUrl: string;
};

type FinishedMessage = {
	type: 'PASTICHE_CONTEXT_IMPORT_FINISHED';
	result: ImportResult;
};

export function importNotificationFromMessage(
	message: StartedMessage | FinishedMessage
): ImportNotification {
	if (message.type === 'PASTICHE_CONTEXT_IMPORT_STARTED') {
		return {
			state: 'working',
			title: 'Downloading image',
			detail: hostLabel(message.sourceImageUrl)
		};
	}

	const { result } = message;
	if (result.error?.toLowerCase().includes('queued')) {
		return {
			state: 'queued',
			title: 'Import queued',
			detail: 'Pastiche is offline'
		};
	}

	if (result.failed.length > 0 && result.imported.length === 0) {
		return {
			state: 'error',
			title: 'Import failed',
			detail: result.failed[0]?.error ?? result.error ?? 'Could not import this image'
		};
	}

	if (result.ok) {
		const duplicate = result.imported.some((item) => item.ok && item.duplicate);
		return {
			state: 'success',
			title: duplicate ? 'Already in Library' : 'Imported to Library',
			detail: result.failed.length ? `${result.failed.length} failed` : 'Saved from context menu'
		};
	}

	return {
		state: 'error',
		title: 'Import failed',
		detail: result.error ?? result.failed[0]?.error ?? 'Could not import this image'
	};
}

function hostLabel(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return 'Selected image';
	}
}
