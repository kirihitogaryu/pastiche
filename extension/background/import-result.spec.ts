import { describe, expect, it } from 'vitest';
import { HttpImportError, importErrorResult, shouldQueueImportError } from './import-result';

describe('extension import result handling', () => {
	it('queues network-style failures for later replay', () => {
		expect.assertions(2);

		expect(shouldQueueImportError(new TypeError('Failed to fetch'))).toBe(true);
		expect(shouldQueueImportError(new DOMException('Timed out', 'TimeoutError'))).toBe(true);
	});

	it('does not queue server-side import errors', () => {
		expect.assertions(2);
		const error = new HttpImportError('Invalid import request', 400);

		expect(shouldQueueImportError(error)).toBe(false);
		expect(importErrorResult(error, 2)).toEqual({
			ok: false,
			imported: [],
			failed: [
				{ index: 0, ok: false, error: 'Invalid import request' },
				{ index: 1, ok: false, error: 'Invalid import request' }
			],
			error: 'Invalid import request'
		});
	});
});
