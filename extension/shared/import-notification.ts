import type { ImportResult } from './types';

export type ImportNotification =
	| { state: 'working'; title: string; detail: string }
	| { state: 'success'; title: string; detail: string }
	| { state: 'queued'; title: string; detail: string }
	| { state: 'error'; title: string; detail: string };

export type StoredImportNotification = ImportNotification & {
	id: string;
	updatedAt: string;
};

export const CONTEXT_IMPORT_NOTIFICATION_KEY = 'pastiche_context_import_notification';
const CONTEXT_IMPORT_NOTIFICATION_TTL_MS = 120_000;

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

export function importNotificationFromResult(result: ImportResult): ImportNotification {
	if (result.error?.toLowerCase().includes('queued')) {
		return {
			state: 'queued',
			title: 'Import queued',
			detail: 'Pastiche is offline'
		};
	}

	const importedCount = result.imported.length;
	const failedCount = result.failed.length;
	if (importedCount > 0) {
		return {
			state: 'success',
			title: 'Imported to Library',
			detail: [
				`${importedCount} image${importedCount === 1 ? '' : 's'} saved`,
				failedCount ? `${failedCount} failed` : ''
			]
				.filter(Boolean)
				.join(', ')
		};
	}

	return {
		state: 'error',
		title: 'Import failed',
		detail: result.error ?? result.failed[0]?.error ?? 'Could not import this image'
	};
}

export function storedImportNotificationFromMessage(
	message: StartedMessage | FinishedMessage,
	options: { id?: string; updatedAt?: string } = {}
): StoredImportNotification {
	const updatedAt = options.updatedAt ?? new Date().toISOString();
	return {
		...importNotificationFromMessage(message),
		id: options.id ?? `context-import:${updatedAt}`,
		updatedAt
	};
}

export function recentStoredImportNotification(
	value: unknown,
	now = Date.now(),
	maxAgeMs = CONTEXT_IMPORT_NOTIFICATION_TTL_MS
): StoredImportNotification | null {
	if (!value || typeof value !== 'object') return null;
	const notification = value as Partial<StoredImportNotification>;
	if (!notification.id || !notification.updatedAt) return null;
	if (!isNotificationState(notification.state)) return null;
	if (typeof notification.title !== 'string' || typeof notification.detail !== 'string')
		return null;

	const updatedAtMs = Date.parse(notification.updatedAt);
	if (Number.isNaN(updatedAtMs)) return null;
	if (now - updatedAtMs > maxAgeMs) return null;

	return notification as StoredImportNotification;
}

function hostLabel(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return 'Selected image';
	}
}

function isNotificationState(state: unknown): state is ImportNotification['state'] {
	return state === 'working' || state === 'success' || state === 'queued' || state === 'error';
}
