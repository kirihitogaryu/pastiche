import { describe, expect, it } from 'vitest';
import { normalizeMedium } from './medium';

describe('normalizeMedium', () => {
	it('maps common Met medium strings into display buckets', () => {
		expect(normalizeMedium('Oil on canvas')).toBe('oil');
		expect(normalizeMedium('Watercolour over graphite')).toBe('watercolor');
		expect(normalizeMedium('Etching and aquatint')).toBe('print');
		expect(normalizeMedium('Pen and ink drawing')).toBe('drawing');
		expect(normalizeMedium('Gelatin silver photograph')).toBe('photograph');
		expect(normalizeMedium('Bronze with marble base')).toBe('sculpture');
		expect(normalizeMedium('Silk embroidery')).toBe('textile');
		expect(normalizeMedium('Porcelain with glass')).toBe('ceramic');
	});

	it('returns other for unknown non-empty media and null for missing media', () => {
		expect(normalizeMedium('Pressed leaves')).toBe('other');
		expect(normalizeMedium('')).toBe('other');
		expect(normalizeMedium(null)).toBeNull();
	});
});
