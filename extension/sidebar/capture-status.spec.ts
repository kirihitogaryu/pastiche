import { describe, expect, it } from 'vitest';
import {
	captureNoticeForCommandStart,
	captureNoticeForSweepResult,
	captureNoticeFromError
} from './capture-status';

describe('capture status notices', () => {
	it('describes capture commands while they are active', () => {
		expect.assertions(3);

		expect(captureNoticeForCommandStart('batch')).toMatchObject({
			tone: 'working',
			title: 'Scanning page'
		});
		expect(captureNoticeForCommandStart('area')).toMatchObject({
			tone: 'working',
			title: 'Area selection active'
		});
		expect(captureNoticeForCommandStart('pick')).toMatchObject({
			tone: 'working',
			title: 'Pick mode active'
		});
	});

	it('summarizes sweep results with added and empty states', () => {
		expect.assertions(3);

		expect(captureNoticeForSweepResult({ found: 4, delivered: 3 })).toEqual({
			tone: 'success',
			title: 'Added 3 images',
			detail: '4 candidates found on this page.'
		});
		expect(captureNoticeForSweepResult({ found: 0, delivered: 0 })).toEqual({
			tone: 'warning',
			title: 'No images found',
			detail: 'No page images met the 300 px minimum.'
		});
		expect(captureNoticeForSweepResult({ found: 4, delivered: 0 })).toEqual({
			tone: 'warning',
			title: 'No new images',
			detail: '4 candidates were already selected.'
		});
	});

	it('turns capture failures into visible notices', () => {
		expect.assertions(1);

		expect(captureNoticeFromError('No images found in that area.')).toEqual({
			tone: 'error',
			title: 'Capture did not add anything',
			detail: 'No images found in that area.'
		});
	});
});
