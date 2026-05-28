import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('extension settings', () => {
	it('normalizes missing settings to defaults', () => {
		expect(normalizeSettings()).toEqual(DEFAULT_SETTINGS);
	});

	it('rejects invalid ports and rounds positive thresholds', () => {
		expect(normalizeSettings({ pastichePort: 99999, sizeThreshold: 320.6 })).toMatchObject({
			pastichePort: 5173,
			sizeThreshold: 321
		});
	});
});
