import { dataUrlForFetchStatus, type ImageDataLoader } from '../shared/fetch-status';
import type { EnrichedItem } from '../shared/types';

export type ImageDataUrlMap = Record<string, string>;

export function createImageDataUrlRefresher(
	loadImageData: ImageDataLoader,
	apply: (imageDataUrls: ImageDataUrlMap) => void
): (items: EnrichedItem[]) => Promise<void> {
	let revision = 0;
	return async (items: EnrichedItem[]) => {
		const currentRevision = ++revision;
		const imageDataUrls = await imageDataUrlsForItems(items, loadImageData);
		if (currentRevision === revision) apply(imageDataUrls);
	};
}

export async function imageDataUrlsForItems(
	items: EnrichedItem[],
	loadImageData: ImageDataLoader
): Promise<ImageDataUrlMap> {
	const entries = await Promise.all(
		items.map(async (item) => {
			const dataUrl = await dataUrlForFetchStatus(item.fetchStatus, loadImageData);
			return [item.id, dataUrl] as const;
		})
	);
	const imageDataUrls: ImageDataUrlMap = {};
	for (const [id, dataUrl] of entries) {
		if (dataUrl) imageDataUrls[id] = dataUrl;
	}
	return imageDataUrls;
}
