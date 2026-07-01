import type { CapturedItemPayload } from '../shared/types';

type TransferLike = {
	getData(type: string): string;
};

export type DroppedFilePayloadInput = {
	dataUrl: string;
	fileName: string;
	mimeType: string | null;
	width: number;
	height: number;
	sourceUrl: string;
	pageTitle: string;
	capturedAt: string;
};

export function droppedImageUrlFromDataTransfer(dataTransfer: TransferLike): string | null {
	return (
		firstUrlFromUriList(dataTransfer.getData('text/uri-list')) ??
		validDroppedUrl(dataTransfer.getData('text/plain')) ??
		firstImageUrlFromHtml(dataTransfer.getData('text/html'))
	);
}

export function droppedImageFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
	return [...dataTransfer.files].find((file) => file.type.startsWith('image/')) ?? null;
}

export async function capturedPayloadForDroppedImageFile(
	file: File,
	context: { sourceUrl: string; pageTitle: string; capturedAt?: string }
): Promise<CapturedItemPayload> {
	const dataUrl = await readFileAsDataUrl(file);
	const dimensions = await dimensionsForDataUrl(dataUrl);
	return buildDroppedFilePayload({
		dataUrl,
		fileName: file.name,
		mimeType: file.type || mimeTypeFromFileName(file.name),
		width: dimensions.width,
		height: dimensions.height,
		sourceUrl: context.sourceUrl,
		pageTitle: context.pageTitle,
		capturedAt: context.capturedAt ?? new Date().toISOString()
	});
}

export function buildDroppedFilePayload(input: DroppedFilePayloadInput): CapturedItemPayload {
	const title = titleFromFilename(input.fileName) ?? input.fileName;
	const candidateId = `dropped-file-${hashish(input.fileName)}-${input.width}x${input.height}`;
	const pageHost = hostnameFrom(input.sourceUrl) ?? '';

	return {
		url: input.dataUrl,
		selectedCandidateId: candidateId,
		candidates: [
			{
				id: candidateId,
				url: input.dataUrl,
				kind: 'link',
				width: input.width,
				height: input.height,
				visibleWidth: null,
				visibleHeight: null,
				mimeType: input.mimeType,
				byteSize: null,
				altText: input.fileName,
				sourceElementPath: null,
				detailUrl: null,
				inlineData: input.dataUrl,
				score: 100,
				confidence: 'high',
				rejectionReasons: [],
				scoreReasons: ['dropped image file']
			}
		],
		source: {
			pageUrl: input.sourceUrl,
			canonicalPageUrl: null,
			detailUrl: null,
			sourceLabel: 'Dropped file',
			sourceType: 'unknown',
			pageHost,
			imageHost: null
		},
		metadata: {
			title,
			artist: null,
			artistProfileUrl: null,
			artistUsername: null,
			date: null,
			tags: [],
			acceptedConceptSlugs: [],
			suggestedTags: [],
			sourceTags: [],
			description: null,
			rawPageTitle: input.pageTitle,
			rawAltText: input.fileName
		},
		detailUrl: null,
		naturalWidth: input.width,
		naturalHeight: input.height,
		mimeType: input.mimeType,
		inlineData: input.dataUrl,
		altText: input.fileName,
		sourceUrl: input.sourceUrl,
		pageTitle: input.pageTitle,
		capturedAt: input.capturedAt
	};
}

function firstUrlFromUriList(value: string): string | null {
	for (const line of value.split(/\r?\n/)) {
		const candidate = line.trim();
		if (!candidate || candidate.startsWith('#')) continue;
		const url = validDroppedUrl(candidate);
		if (url) return url;
	}
	return null;
}

function firstImageUrlFromHtml(value: string): string | null {
	const match = value.match(/<img\b[^>]*\bsrc=(["']?)([^"'\s>]+)\1/i);
	return match ? validDroppedUrl(match[2]) : null;
}

function validDroppedUrl(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
	} catch {
		return null;
	}
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('Could not read dropped image file.'));
		reader.onload = () =>
			typeof reader.result === 'string'
				? resolve(reader.result)
				: reject(new Error('Dropped image file could not be read as a data URL.'));
		reader.readAsDataURL(file);
	});
}

function dimensionsForDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => reject(new Error('Could not read dropped image dimensions.'));
		image.src = dataUrl;
	});
}

function titleFromFilename(fileName: string): string | null {
	const title = fileName
		.replace(/\.[a-z0-9]{2,5}$/i, '')
		.replace(/[-_]+/g, ' ')
		.trim();
	return title || null;
}

function mimeTypeFromFileName(fileName: string): string | null {
	const lower = fileName.toLowerCase();
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.gif')) return 'image/gif';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	return null;
}

function hostnameFrom(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

function hashish(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0;
	}
	return Math.abs(hash).toString(36);
}
