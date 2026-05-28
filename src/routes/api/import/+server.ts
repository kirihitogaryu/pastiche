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
		typeof value.captured_at === 'string'
	);
}

function isStorageMode(value: unknown) {
	return value === 'download' || value === 'url_reference' || value === 'lazy_download';
}

function isNullableString(value: unknown) {
	return value === null || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
