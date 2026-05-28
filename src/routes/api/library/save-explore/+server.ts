import { json } from '@sveltejs/kit';
import { getExploreConnectorForItemId } from '$lib/explore/connectors';
import { importLibraryItems } from '$lib/server/library/import';
import type { ExploreItem } from '$lib/explore/types';
import type { ImportRequest } from '$lib/server/library/types';
import { EXTENSION_CORS_HEADERS } from '../../cors';

type SaveExploreRequest = {
	item_id: string;
	destination_folder_id: string | null;
};

export async function POST({ request }: { request: Request }) {
	const body = await readJson(request);
	if (!isSaveExploreRequest(body)) {
		return json(
			{ error: 'Invalid save request' },
			{ status: 400, headers: EXTENSION_CORS_HEADERS }
		);
	}

	try {
		const item = await getExploreConnectorForItemId(body.item_id).getById(body.item_id);
		const payload = exploreItemToImportRequest(item, body.destination_folder_id);
		return json(await importLibraryItems(payload), { headers: EXTENSION_CORS_HEADERS });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Explore item could not be saved' },
			{ status: 502, headers: EXTENSION_CORS_HEADERS }
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

function isSaveExploreRequest(value: unknown): value is SaveExploreRequest {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as SaveExploreRequest).item_id === 'string' &&
		((value as SaveExploreRequest).destination_folder_id === null ||
			typeof (value as SaveExploreRequest).destination_folder_id === 'string')
	);
}

function exploreItemToImportRequest(
	item: ExploreItem,
	destinationFolderId: string | null
): ImportRequest {
	const imageUrl = item.imageUrl ?? item.thumbUrl;
	if (!imageUrl) throw new Error('Explore item has no image URL');

	return {
		destination_folder_id: destinationFolderId,
		items: [
			{
				filename: item.title,
				storage_mode: 'url_reference',
				image_data: null,
				source_image_url: imageUrl,
				mime_type: null,
				natural_width: 1024,
				natural_height: 1024,
				source_url: item.detailUrl,
				page_title: item.title,
				alt_text: item.description,
				captured_at: new Date().toISOString()
			}
		]
	};
}
