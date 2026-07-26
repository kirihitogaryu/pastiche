import { json } from '@sveltejs/kit';
import {
	importLibraryItems,
	ImportJobInProgressError,
	importResourceLimits,
	validateImportRequestLimits
} from '$lib/server/library/import';
import type { ImportRequest } from '$lib/server/library/types';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../localAccess';

export function OPTIONS({ request }: { request: Request }) {
	return trustedLocalPreflight(request);
}

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	let body: unknown;
	try {
		body = await readJson(request);
	} catch (error) {
		if (error instanceof ImportBodyTooLargeError) {
			return json({ error: error.message }, { status: 413, headers: access.headers });
		}
		body = null;
	}
	if (!isImportRequest(body)) {
		return json({ error: 'Invalid import request' }, { status: 400, headers: access.headers });
	}
	const limitError = validateImportRequestLimits(body);
	if (limitError) {
		return json({ error: limitError }, { status: 400, headers: access.headers });
	}

	try {
		return json(await importLibraryItems(body), { headers: access.headers });
	} catch (error) {
		const status = error instanceof ImportJobInProgressError ? 409 : 400;
		return json(
			{ error: error instanceof Error ? error.message : 'Import failed' },
			{ status, headers: access.headers }
		);
	}
}

async function readJson(request: Request): Promise<unknown> {
	const { maxBatchBytes } = importResourceLimits();
	const maxJsonBytes = Math.ceil((maxBatchBytes * 4) / 3) + 16 * 1024 * 1024;
	const contentLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maxJsonBytes) {
		throw new ImportBodyTooLargeError(maxJsonBytes);
	}
	if (!request.body) return null;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxJsonBytes) {
			await reader.cancel();
			throw new ImportBodyTooLargeError(maxJsonBytes);
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

class ImportBodyTooLargeError extends Error {
	constructor(maxBytes: number) {
		super(`Import request bodies are limited to ${Math.round(maxBytes / (1024 * 1024))} MB`);
	}
}

function isImportRequest(value: unknown): value is ImportRequest {
	if (!isRecord(value)) return false;
	if (value.import_job_id !== undefined && !isImportJobId(value.import_job_id)) return false;
	if (!(value.destination_folder_id === null || typeof value.destination_folder_id === 'string')) {
		return false;
	}
	if (value.create_folder_name !== undefined && typeof value.create_folder_name !== 'string') {
		return false;
	}
	return Array.isArray(value.items) && value.items.every(isImportItem);
}

function isImportJobId(value: unknown) {
	return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(value);
}

function isImportItem(value: unknown): value is ImportRequest['items'][number] {
	if (!isRecord(value)) return false;
	return (
		typeof value.filename === 'string' &&
		isStorageMode(value.storage_mode) &&
		isNullableString(value.image_data) &&
		isNullableString(value.source_image_url) &&
		isNullableString(value.mime_type) &&
		typeof value.natural_width === 'number' &&
		typeof value.natural_height === 'number' &&
		typeof value.source_url === 'string' &&
		isNullableString(value.page_title) &&
		isNullableString(value.alt_text) &&
		typeof value.captured_at === 'string' &&
		(value.metadata === undefined || value.metadata === null || isImportMetadata(value.metadata))
	);
}

function isImportMetadata(
	value: unknown
): value is NonNullable<ImportRequest['items'][number]['metadata']> {
	if (!isRecord(value)) return false;
	return (
		isOptionalNullableString(value.sourceId) &&
		isOptionalNullableString(value.sourceName) &&
		(value.sourceType === undefined ||
			value.sourceType === null ||
			isImportSourceType(value.sourceType)) &&
		isOptionalNullableString(value.detailUrl) &&
		isOptionalNullableString(value.creator) &&
		isOptionalNullableString(value.artistProfileUrl) &&
		isOptionalNullableString(value.artistUsername) &&
		isOptionalNullableString(value.dateDisplay) &&
		isOptionalNullableString(value.medium) &&
		isOptionalNullableString(value.objectName) &&
		isOptionalNullableString(value.department) &&
		isOptionalNullableString(value.culture) &&
		isOptionalNullableString(value.period) &&
		isOptionalNullableString(value.rights) &&
		(value.tags === undefined ||
			(Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === 'string'))) &&
		(value.acceptedConceptSlugs === undefined ||
			(Array.isArray(value.acceptedConceptSlugs) &&
				value.acceptedConceptSlugs.every((slug) => typeof slug === 'string'))) &&
		(value.acceptedAnnotations === undefined ||
			(Array.isArray(value.acceptedAnnotations) &&
				value.acceptedAnnotations.every(isAcceptedAnnotation))) &&
		(value.rawMetadata === undefined || isRecord(value.rawMetadata))
	);
}

function isAcceptedAnnotation(value: unknown) {
	return (
		isRecord(value) &&
		typeof value.label === 'string' &&
		Array.isArray(value.concepts) &&
		value.concepts.every((concept) => typeof concept === 'string') &&
		isRecord(value.classifiers) &&
		Object.values(value.classifiers).every((classifier) => typeof classifier === 'string')
	);
}

function isImportSourceType(value: unknown) {
	return (
		value === 'local' ||
		value === 'web' ||
		value === 'social' ||
		value === 'gallery' ||
		value === 'booru' ||
		value === 'museum' ||
		value === 'collection' ||
		value === 'cdn' ||
		value === 'unknown'
	);
}

function isStorageMode(value: unknown) {
	return value === 'download' || value === 'url_reference' || value === 'lazy_download';
}

function isNullableString(value: unknown) {
	return value === null || typeof value === 'string';
}

function isOptionalNullableString(value: unknown) {
	return value === undefined || isNullableString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
