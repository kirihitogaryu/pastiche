import { del, get, set } from 'idb-keyval';

const IMAGE_DATA_PREFIX = 'pastiche:image-data:';
export type StoredImageData = string | Blob;

export function imageDataKeyForItem(itemId: string, url: string): string {
	return `${IMAGE_DATA_PREFIX}${itemId}:${stableKeyPart(url)}`;
}

export async function saveImageData(blobKey: string, data: StoredImageData): Promise<void> {
	await set(blobKey, data);
}

export async function loadImageData(blobKey: string): Promise<StoredImageData | null> {
	const value = await get<StoredImageData>(blobKey);
	return typeof value === 'string' || value instanceof Blob ? value : null;
}

export async function deleteImageData(blobKey: string): Promise<void> {
	await del(blobKey);
}

function stableKeyPart(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0;
	}
	return Math.abs(hash).toString(36);
}
