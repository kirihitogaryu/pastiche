import type { CapturedItemPayload } from '../shared/types';

type TransferLike = {
	getData(type: string): string;
};

export type DroppedFilePayloadInput = {
	captureUrl: string;
	storedBlobKey: string;
	fileName: string;
	mimeType: string | null;
	width: number;
	height: number;
	sourceUrl: string;
	pageTitle: string;
	capturedAt: string;
};

export function droppedImageUrlFromDataTransfer(
	dataTransfer: TransferLike,
	baseUrl?: string
): string | null {
	return (
		validDroppedUrl(dataTransfer.getData('application/x-pastiche-image-url'), baseUrl) ??
		urlFromDownloadUrl(dataTransfer.getData('DownloadURL'), baseUrl) ??
		firstUrlFromUriList(dataTransfer.getData('text/uri-list'), baseUrl) ??
		firstMozillaUrl(dataTransfer.getData('text/x-moz-url-data'), baseUrl) ??
		firstMozillaUrl(dataTransfer.getData('application/x-moz-file-promise-url'), baseUrl) ??
		firstMozillaUrl(dataTransfer.getData('text/x-moz-url'), baseUrl) ??
		firstImageUrlFromHtml(dataTransfer.getData('text/html'), baseUrl) ??
		validDroppedUrl(dataTransfer.getData('text/plain'), baseUrl)
	);
}

export function droppedImageFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
	return (
		[...dataTransfer.files].find(
			(file) => file.type.startsWith('image/') || imageFilename(file.name)
		) ?? null
	);
}

export async function capturedPayloadForDroppedImageFile(
	file: File,
	context: { sourceUrl: string; pageTitle: string; capturedAt?: string },
	storeImage: (key: string, image: Blob) => Promise<void>
): Promise<CapturedItemPayload> {
	const [dimensions, contentHash] = await Promise.all([
		dimensionsForFile(file),
		sha256ForFile(file)
	]);
	const storedBlobKey = `dropped-image:${contentHash}`;
	await storeImage(storedBlobKey, file);
	return buildDroppedFilePayload({
		captureUrl: `pastiche-drop://sha256/${contentHash}`,
		storedBlobKey,
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
		url: input.captureUrl,
		selectedCandidateId: candidateId,
		candidates: [
			{
				id: candidateId,
				url: input.captureUrl,
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
				inlineData: null,
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
		inlineData: null,
		storedBlobKey: input.storedBlobKey,
		altText: input.fileName,
		sourceUrl: input.sourceUrl,
		pageTitle: input.pageTitle,
		capturedAt: input.capturedAt
	};
}

function firstUrlFromUriList(value: string, baseUrl?: string): string | null {
	for (const line of value.split(/\r?\n/)) {
		const candidate = line.trim();
		if (!candidate || candidate.startsWith('#')) continue;
		const url = validDroppedUrl(candidate, baseUrl);
		if (url) return url;
	}
	return null;
}

function urlFromDownloadUrl(value: string, baseUrl?: string): string | null {
	const parts = value.split(':');
	if (parts.length < 3) return null;
	return validDroppedUrl(parts.slice(2).join(':'), baseUrl);
}

function firstMozillaUrl(value: string, baseUrl?: string): string | null {
	const firstLine = value.split(/\r?\n/, 1)[0]?.trim() ?? '';
	return validDroppedUrl(firstLine, baseUrl);
}

function firstImageUrlFromHtml(value: string, baseUrl?: string): string | null {
	const match = value.match(/<img\b[^>]*\bsrc=(["']?)([^"'\s>]+)\1/i);
	return match ? validDroppedUrl(decodeHtmlUrl(match[2]), baseUrl) : null;
}

function validDroppedUrl(value: string, baseUrl?: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		const candidate = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
		const url = baseUrl ? new URL(candidate, baseUrl) : new URL(candidate);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
	} catch {
		return null;
	}
}

function decodeHtmlUrl(value: string): string {
	return value
		.replace(/&amp;/gi, '&')
		.replace(/&#38;/g, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/g, "'");
}

function imageFilename(value: string): boolean {
	return /\.(?:avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/i.test(value);
}

function dimensionsForFile(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const objectUrl = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(objectUrl);
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		};
		image.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Could not read dropped image dimensions.'));
		};
		image.src = objectUrl;
	});
}

async function sha256ForFile(file: File): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
