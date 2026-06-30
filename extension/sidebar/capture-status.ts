import type { CaptureCommandId } from './capture-commands';

export type CaptureNoticeTone = 'working' | 'success' | 'warning' | 'error';

export type CaptureNotice = {
	tone: CaptureNoticeTone;
	title: string;
	detail: string;
};

export type SweepCaptureResult = {
	found?: number;
	delivered?: number;
};

export function captureNoticeForCommandStart(command: CaptureCommandId): CaptureNotice {
	switch (command) {
		case 'pick':
			return {
				tone: 'working',
				title: 'Pick mode active',
				detail: 'Waiting for an image click on the page.'
			};
		case 'area':
			return {
				tone: 'working',
				title: 'Area selection active',
				detail: 'Waiting for a region selection on the page.'
			};
		case 'batch':
			return {
				tone: 'working',
				title: 'Scanning page',
				detail: 'Looking for images above 300 px.'
			};
		case 'visible':
			return {
				tone: 'working',
				title: 'Capturing visible area',
				detail: 'Preparing a viewport capture.'
			};
		case 'tab':
			return {
				tone: 'working',
				title: 'Capturing URL',
				detail: 'Checking whether the current tab is an image.'
			};
		default:
			return {
				tone: 'working',
				title: 'Capture active',
				detail: 'Waiting for capture results.'
			};
	}
}

export function captureNoticeForSweepResult(result: SweepCaptureResult): CaptureNotice {
	const found = result.found ?? 0;
	const delivered = result.delivered ?? 0;

	if (delivered > 0) {
		return {
			tone: 'success',
			title: `Added ${delivered} image${delivered === 1 ? '' : 's'}`,
			detail: `${found} candidate${found === 1 ? '' : 's'} found on this page.`
		};
	}

	if (found > 0) {
		return {
			tone: 'warning',
			title: 'No new images',
			detail: `${found} candidate${found === 1 ? ' was' : 's were'} already selected.`
		};
	}

	return {
		tone: 'warning',
		title: 'No images found',
		detail: 'No page images met the 300 px minimum.'
	};
}

export function captureNoticeFromError(error: string): CaptureNotice {
	return {
		tone: 'error',
		title: 'Capture did not add anything',
		detail: error
	};
}
