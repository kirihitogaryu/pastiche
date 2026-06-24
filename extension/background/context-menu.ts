import type { TabInfo } from '../shared/browser';

export const CONTEXT_MENU_SAVE_IMAGE_ID = 'pastiche-save-image';

export type ImageContextMenuInfo = {
	menuItemId: string | number;
	srcUrl?: string;
	pageUrl?: string;
	linkUrl?: string;
};

export type ImageContextCaptureSource = {
	imageUrl: string;
	sourceUrl: string;
	detailUrl: string | null;
	pageTitle: string;
};

export function imageContextCaptureSource(
	info: ImageContextMenuInfo,
	tab?: Pick<TabInfo, 'title' | 'url'>
): ImageContextCaptureSource | null {
	if (info.menuItemId !== CONTEXT_MENU_SAVE_IMAGE_ID || !info.srcUrl) return null;

	const sourceUrl = info.pageUrl ?? tab?.url ?? info.srcUrl;
	return {
		imageUrl: info.srcUrl,
		sourceUrl,
		detailUrl: validHttpUrl(info.linkUrl) ? info.linkUrl : null,
		pageTitle: tab?.title ?? sourceUrl
	};
}

function validHttpUrl(value: string | undefined): value is string {
	if (!value) return false;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
