import { MAX_CAPTURE_IMAGE_BYTES } from './constants';

export async function readBoundedImageResponse(
	response: Response,
	options: { maxBytes?: number; fallbackMimeType?: string | null } = {}
): Promise<Blob> {
	const maxBytes = options.maxBytes ?? MAX_CAPTURE_IMAGE_BYTES;
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new Error(`Image exceeds the ${formatMegabytes(maxBytes)} capture limit`);
	}
	const responseType = response.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? '';
	const declaredImageType = normalizeImageContentType(responseType);
	const fallbackType = options.fallbackMimeType?.startsWith('image/')
		? options.fallbackMimeType.toLowerCase()
		: null;

	if (!response.body) {
		const blob = await response.blob();
		if (blob.size > maxBytes)
			throw new Error(`Image exceeds the ${formatMegabytes(maxBytes)} capture limit`);
		const sniffedType = await sniffImageMimeType(blob);
		const resolvedType = sniffedType ?? declaredImageType ?? fallbackForOpaqueResponse();
		if (!resolvedType) throw nonImageResponseError(responseType);
		return new Blob([blob], { type: resolvedType });
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			throw new Error(`Image exceeds the ${formatMegabytes(maxBytes)} capture limit`);
		}
		chunks.push(value);
	}
	const downloaded = new Blob(chunks);
	const sniffedType = await sniffImageMimeType(downloaded);
	const resolvedType = sniffedType ?? declaredImageType ?? fallbackForOpaqueResponse();
	if (!resolvedType) throw nonImageResponseError(responseType);
	return new Blob(chunks, { type: resolvedType });

	function fallbackForOpaqueResponse() {
		const normalized = responseType.toLowerCase();
		return !responseType || normalized === 'application/octet-stream' ? fallbackType : null;
	}
}

function formatMegabytes(bytes: number) {
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function normalizeImageContentType(value: string): string | null {
	const normalized = value.trim().toLowerCase();
	if (normalized.startsWith('image/')) return normalized;
	const compact = normalized.replace(/[\s_-]+/g, '');
	if (/^png(?:8|24|32|48|64)?$/.test(compact)) return 'image/png';
	if (compact === 'jpg' || compact === 'jpeg' || compact === 'jfif') return 'image/jpeg';
	if (compact === 'gif' || compact === 'gif87a' || compact === 'gif89a') return 'image/gif';
	if (compact === 'webp') return 'image/webp';
	if (compact === 'avif' || compact === 'avis') return 'image/avif';
	if (compact === 'tif' || compact === 'tiff') return 'image/tiff';
	if (compact === 'bmp') return 'image/bmp';
	if (compact === 'svg' || compact === 'svg+xml') return 'image/svg+xml';
	return null;
}

async function sniffImageMimeType(blob: Blob): Promise<string | null> {
	const bytes = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
	if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return 'image/png';
	}
	if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif';
	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
	if (
		hasPrefix(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
		hasPrefix(bytes, [0x4d, 0x4d, 0x00, 0x2a])
	) {
		return 'image/tiff';
	}
	if (hasPrefix(bytes, [0x42, 0x4d])) return 'image/bmp';
	if (ascii(bytes, 4, 4) === 'ftyp') {
		const brand = ascii(bytes, 8, 4);
		if (brand === 'avif' || brand === 'avis') return 'image/avif';
	}
	const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '').trimStart();
	if (/^(?:<\?xml[\s\S]*?\?>\s*)?<svg(?:\s|>)/i.test(text)) return 'image/svg+xml';
	return null;
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
	return prefix.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
	return String.fromCharCode(...bytes.slice(start, start + length));
}

function nonImageResponseError(responseType: string) {
	return new Error(
		responseType
			? `Selected URL returned ${responseType}, not an image`
			: 'Selected URL did not return a recognizable image'
	);
}
