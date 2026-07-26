import type { ImportResult } from '../shared/types';

export class HttpImportError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'HttpImportError';
	}
}

export function shouldQueueImportError(error: unknown): boolean {
	if (error instanceof HttpImportError) return false;
	if (error instanceof DOMException && error.name === 'TimeoutError') return true;
	if (error instanceof TypeError) return true;
	return false;
}

export function importErrorResult(error: unknown, itemCount: number): ImportResult {
	const message = error instanceof Error ? error.message : 'Import failed';
	return {
		ok: false,
		imported: [],
		failed: Array.from({ length: itemCount }, (_, index) => ({
			index,
			ok: false,
			error: message
		})),
		error: message
	};
}
