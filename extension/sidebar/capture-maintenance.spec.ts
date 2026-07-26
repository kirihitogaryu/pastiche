import { describe, expect, it } from 'vitest';

import { shouldSurfaceContentScriptError } from './capture-maintenance';

describe('capture maintenance errors', () => {
	it('does not surface receiving-end errors for cleanup messages', () => {
		expect(
			shouldSurfaceContentScriptError({
				messageType: 'PASTICHE_CLEAR_SELECTION',
				error: new Error('Could not establish connection. Receiving end does not exist.')
			})
		).toBe(false);
	});

	it('does surface receiving-end errors for capture activation messages', () => {
		expect(
			shouldSurfaceContentScriptError({
				messageType: 'PASTICHE_CAPTURE_ACTIVATE',
				error: new Error('Could not establish connection. Receiving end does not exist.')
			})
		).toBe(true);
	});
});
