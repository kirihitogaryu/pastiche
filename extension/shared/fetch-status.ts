import type { EnrichedItem, FetchStatus } from './types';
import type { StoredImageData } from './image-data-store';

export type ImageDataLoader = (blobKey: string) => Promise<StoredImageData | null>;
export const MISSING_IMAGE_DATA_ERROR = 'Downloaded image data is no longer available';

export function storageSafeFetchStatus(fetchStatus: FetchStatus): FetchStatus {
	if (fetchStatus.state !== 'done' || !fetchStatus.blobKey) return fetchStatus;
	return {
		state: 'done',
		blobKey: fetchStatus.blobKey,
		mimeType: fetchStatus.mimeType
	};
}

export function storageSafeItem(item: EnrichedItem): EnrichedItem {
	return {
		...item,
		fetchStatus: storageSafeFetchStatus(item.fetchStatus),
		candidates: item.candidates.map((candidate) => ({
			...candidate,
			inlineData: candidate.inlineData ? null : candidate.inlineData
		}))
	};
}

export function storageSafeItems(items: EnrichedItem[]): EnrichedItem[] {
	return items.map(storageSafeItem);
}

export async function hydrateFetchStatusForImport(
	fetchStatus: FetchStatus,
	loadImageData: ImageDataLoader = async () => null
): Promise<FetchStatus> {
	if (fetchStatus.state !== 'done' || fetchStatus.base64 || !fetchStatus.blobKey) {
		return fetchStatus;
	}
	const imageData = await loadImageData(fetchStatus.blobKey);
	if (!imageData) {
		return {
			state: 'error',
			error: MISSING_IMAGE_DATA_ERROR
		};
	}
	return {
		...fetchStatus,
		base64: await storedImageDataAsBase64(imageData)
	};
}

export async function hydrateItemForImport(
	item: EnrichedItem,
	loadImageData: ImageDataLoader
): Promise<EnrichedItem> {
	return {
		...item,
		fetchStatus: await hydrateFetchStatusForImport(item.fetchStatus, loadImageData)
	};
}

export async function dataUrlForFetchStatus(
	fetchStatus: FetchStatus,
	loadImageData: ImageDataLoader = async () => null
): Promise<string | null> {
	if (fetchStatus.state !== 'done') return null;
	const stored = fetchStatus.blobKey ? await loadImageData(fetchStatus.blobKey) : null;
	const base64 = fetchStatus.base64 ?? (stored ? await storedImageDataAsBase64(stored) : null);
	return base64 ? `data:${fetchStatus.mimeType};base64,${base64}` : null;
}

async function storedImageDataAsBase64(data: StoredImageData) {
	if (typeof data === 'string') return data;
	const bytes = new Uint8Array(await data.arrayBuffer());
	let binary = '';
	const chunkSize = 8192;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}

export function imageDataBlobKeysForItems(items: EnrichedItem[]): string[] {
	const keys = new Set<string>();
	for (const item of items) {
		if (item.fetchStatus.state === 'done' && item.fetchStatus.blobKey) {
			keys.add(item.fetchStatus.blobKey);
		}
	}
	return [...keys];
}

export function removedImageDataBlobKeys(
	previousItems: EnrichedItem[],
	nextItems: EnrichedItem[]
): string[] {
	const nextKeys = new Set(imageDataBlobKeysForItems(nextItems));
	return imageDataBlobKeysForItems(previousItems).filter((key) => !nextKeys.has(key));
}
