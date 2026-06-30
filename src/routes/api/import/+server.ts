import { json } from '@sveltejs/kit';
import { importLibraryItems } from '$lib/server/library/import';
import type { ImportRequest } from '$lib/server/library/types';
import { EXTENSION_CORS_HEADERS } from '../cors';

export function OPTIONS() {
	return new Response(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

export async function POST({ request }: { request: Request }) {
	const body = await readJson(request);
	if (!isImportRequest(body)) {
		return json(
			{ error: 'Invalid import request' },
			{ status: 400, headers: EXTENSION_CORS_HEADERS }
		);
	}

	try {
		return json(await importLibraryItems(body), { headers: EXTENSION_CORS_HEADERS });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Import failed' },
			{ status: 400, headers: EXTENSION_CORS_HEADERS }
		);
	}
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

function isImportRequest(value: unknown): value is ImportRequest {
	if (!isRecord(value)) return false;
	if (!(value.destination_folder_id === null || typeof value.destination_folder_id === 'string')) {
		return false;
	}
	if (value.create_folder_name !== undefined && typeof value.create_folder_name !== 'string') {
		return false;
	}
	return Array.isArray(value.items) && value.items.every(isImportItem);
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
		(value.rawMetadata === undefined || isRecord(value.rawMetadata))
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
