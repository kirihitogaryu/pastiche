import type { ImportRequest } from '$lib/server/library/types';

export type AddToLibraryImportItem = ImportRequest['items'][number];

export async function fileToImportItem(
	file: File,
	capturedAt = new Date().toISOString()
): Promise<AddToLibraryImportItem> {
	const dimensions = await readImageDimensions(file);
	return {
		filename: file.name || `clipboard-${capturedAt}.png`,
		storage_mode: 'download',
		image_data: await blobToBase64Payload(file),
		source_image_url: null,
		mime_type: file.type || 'application/octet-stream',
		natural_width: dimensions.width,
		natural_height: dimensions.height,
		source_url: `file://${file.name || 'clipboard-image'}`,
		page_title: file.name || 'Clipboard image',
		alt_text: null,
		captured_at: capturedAt,
		metadata: {
			sourceName: 'Local file',
			sourceType: 'local',
			rawMetadata: { fileName: file.name, fileSize: file.size }
		}
	};
}

export async function urlToImportItem(
	url: string,
	capturedAt = new Date().toISOString()
): Promise<AddToLibraryImportItem> {
	const normalized = new URL(url.trim());
	const dimensions = await readRemoteImageDimensions(normalized.toString());
	const filename = filenameFromUrl(normalized);
	return {
		filename,
		storage_mode: 'url_reference',
		image_data: null,
		source_image_url: normalized.toString(),
		mime_type: mimeTypeFromFilename(filename),
		natural_width: dimensions.width,
		natural_height: dimensions.height,
		source_url: normalized.toString(),
		page_title: filename,
		alt_text: null,
		captured_at: capturedAt,
		metadata: {
			sourceName: normalized.hostname,
			sourceType: 'web',
			detailUrl: normalized.toString()
		}
	};
}

export function buildImportRequest(input: {
	destinationFolderId: string | null;
	items: AddToLibraryImportItem[];
}): ImportRequest {
	return {
		destination_folder_id: input.destinationFolderId,
		items: input.items
	};
}

export async function clipboardImageToFile() {
	if (!navigator.clipboard?.read) {
		throw new Error('Clipboard image import is not available in this browser.');
	}
	const clipboardItems = await navigator.clipboard.read();
	for (const item of clipboardItems) {
		const imageType = item.types.find((type) => type.startsWith('image/'));
		if (!imageType) continue;
		const blob = await item.getType(imageType);
		const extension = extensionFromMimeType(imageType);
		return new File([blob], `clipboard-image.${extension}`, { type: imageType });
	}
	throw new Error('No image found on the clipboard.');
}

export async function blobToBase64Payload(blob: Blob) {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
		reader.readAsDataURL(blob);
	});
	return dataUrl.split(',')[1] ?? '';
}

async function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
	const url = URL.createObjectURL(blob);
	try {
		return await readRemoteImageDimensions(url);
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function readRemoteImageDimensions(src: string): Promise<{ width: number; height: number }> {
	const image = new Image();
	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error('Image dimensions could not be read.'));
		image.src = src;
	});
	const width = Math.round(image.naturalWidth || image.width);
	const height = Math.round(image.naturalHeight || image.height);
	if (width < 1 || height < 1) throw new Error('Image dimensions could not be read.');
	return { width, height };
}

function filenameFromUrl(url: URL) {
	const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '').trim();
	return name || `${url.hostname}.jpg`;
}

function mimeTypeFromFilename(filename: string) {
	const normalized = filename.toLocaleLowerCase();
	if (normalized.endsWith('.png')) return 'image/png';
	if (normalized.endsWith('.webp')) return 'image/webp';
	if (normalized.endsWith('.gif')) return 'image/gif';
	return 'image/jpeg';
}

function extensionFromMimeType(mimeType: string) {
	if (mimeType === 'image/png') return 'png';
	if (mimeType === 'image/webp') return 'webp';
	if (mimeType === 'image/gif') return 'gif';
	return 'jpg';
}
