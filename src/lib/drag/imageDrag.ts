const preparedFiles = new Map<string, Promise<File | null>>();
const MAX_PREPARED_FILES = 4;

export async function prepareImageDragFile(imageUrl: string, title: string): Promise<File | null> {
	if (!imageUrl) return null;
	const existing = preparedFiles.get(imageUrl);
	if (existing) return existing;

	const pending = fetch(imageUrl, { credentials: 'same-origin' })
		.then(async (response) => {
			if (!response.ok) return null;
			const blob = await response.blob();
			if (!blob.type.startsWith('image/')) return null;
			return new File([blob], imageFileName(title, blob.type, imageUrl), { type: blob.type });
		})
		.catch(() => null);

	preparedFiles.set(imageUrl, pending);
	trimPreparedFiles();
	return pending;
}

export function writeImageDragPayload(
	event: DragEvent,
	input: { file: File | null; imageUrl: string; title: string }
): boolean {
	const transfer = event.dataTransfer;
	if (!transfer || !input.imageUrl) return false;
	transfer.effectAllowed = 'copy';

	if (input.file) {
		try {
			transfer.items.add(input.file);
		} catch {
			// String fallbacks below still support URL-oriented destinations.
		}
		setDragData(transfer, 'DownloadURL', `${input.file.type}:${input.file.name}:${input.imageUrl}`);
	}

	setDragData(transfer, 'text/uri-list', input.imageUrl);
	setDragData(transfer, 'text/plain', input.imageUrl);
	setDragData(
		transfer,
		'text/html',
		`<img src="${escapeHtml(input.imageUrl)}" alt="${escapeHtml(input.title)}">`
	);
	return true;
}

export function imageFileName(title: string, mimeType: string, imageUrl: string): string {
	const safeTitle =
		title
			.trim()
			.replace(/[\\/:*?"<>|]+/g, '-')
			.replace(/\s+/g, ' ')
			.slice(0, 120) || 'pastiche-image';
	const existingExtension = extensionFromUrl(imageUrl);
	const extension = existingExtension ?? extensionForMimeType(mimeType);
	return existingExtension && safeTitle.toLowerCase().endsWith(existingExtension)
		? safeTitle
		: `${safeTitle}${extension}`;
}

function setDragData(transfer: DataTransfer, type: string, value: string) {
	try {
		transfer.setData(type, value);
	} catch {
		// Some browsers reject non-standard drag types such as DownloadURL.
	}
}

function trimPreparedFiles() {
	while (preparedFiles.size > MAX_PREPARED_FILES) {
		const oldest = preparedFiles.keys().next().value;
		if (typeof oldest !== 'string') return;
		preparedFiles.delete(oldest);
	}
}

function extensionFromUrl(value: string): string | null {
	try {
		const match = new URL(value, window.location.href).pathname.match(
			/\.(avif|bmp|gif|heic|heif|jpe?g|jxl|png|svg|tiff?|webp)$/i
		);
		if (!match) return null;
		const extension = match[1].toLowerCase();
		return `.${extension === 'jpeg' ? 'jpg' : extension === 'tiff' ? 'tif' : extension}`;
	} catch {
		return null;
	}
}

function extensionForMimeType(mimeType: string) {
	if (mimeType === 'image/svg+xml') return '.svg';
	if (mimeType === 'image/png') return '.png';
	if (mimeType === 'image/webp') return '.webp';
	if (mimeType === 'image/gif') return '.gif';
	if (mimeType === 'image/avif') return '.avif';
	if (mimeType === 'image/bmp') return '.bmp';
	if (mimeType === 'image/tiff') return '.tif';
	if (mimeType === 'image/heic') return '.heic';
	if (mimeType === 'image/heif') return '.heif';
	if (mimeType === 'image/jxl') return '.jxl';
	return '.jpg';
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
