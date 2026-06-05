import { json } from '@sveltejs/kit';
import sharp from 'sharp';
import { getExploreConnectorForItemId } from '$lib/explore/connectors';
import { buildIiifImageUrl, normalizeIiifBaseUrl } from '$lib/explore/iiif';
import { importLibraryItems } from '$lib/server/library/import';
import type { ExploreItem } from '$lib/explore/types';
import type { ImportRequest, LibraryImportMetadata } from '$lib/server/library/types';
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
		const payload = await exploreItemToImportRequest(item, body.destination_folder_id);
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
): Promise<ImportRequest> {
	return buildExploreImportRequest(item, destinationFolderId);
}

async function buildExploreImportRequest(
	item: ExploreItem,
	destinationFolderId: string | null
): Promise<ImportRequest> {
	const imageUrl = exploreStorageImageUrl(item);
	if (!imageUrl) throw new Error('Explore item has no image URL');
	const dimensions = await resolveExploreImageDimensions(item, imageUrl);

	return {
		destination_folder_id: destinationFolderId,
		items: [
			{
				filename: item.title,
				storage_mode: 'url_reference',
				image_data: null,
				source_image_url: imageUrl,
				mime_type: null,
				natural_width: dimensions.width,
				natural_height: dimensions.height,
				source_url: item.detailUrl,
				page_title: item.title,
				alt_text: item.description,
				captured_at: new Date().toISOString(),
				metadata: exploreItemMetadata(item)
			}
		]
	};
}

function exploreStorageImageUrl(item: ExploreItem) {
	if (!item.imageUrl) return item.thumbUrl;
	if (item.isIIIF) return buildIiifImageUrl(item.imageUrl, 'full');
	return item.imageUrl;
}

async function resolveExploreImageDimensions(item: ExploreItem, imageUrl: string) {
	const metadataDimensions = dimensionsFromMetadata(item.rawMetadata);
	if (metadataDimensions) return metadataDimensions;
	if (item.isIIIF && item.imageUrl) {
		const iiifDimensions = await dimensionsFromIiifInfo(item.imageUrl);
		if (iiifDimensions) return iiifDimensions;
	}

	try {
		return await dimensionsFromImageUrl(imageUrl);
	} catch (error) {
		if (item.source === 'wikidata') return { width: 1, height: 1 };
		throw error;
	}
}

function dimensionsFromMetadata(metadata: Record<string, unknown>) {
	const commons = isRecord(metadata.commons) ? metadata.commons : null;
	const thumbnail = isRecord(metadata.thumbnail) ? metadata.thumbnail : null;
	for (const record of [commons, thumbnail, metadata]) {
		const dimensions = dimensionsFromRecord(record);
		if (dimensions) return dimensions;
	}
	return null;
}

function dimensionsFromRecord(record: Record<string, unknown> | null) {
	const width = record ? numberOrNull(record.width) : null;
	const height = record ? numberOrNull(record.height) : null;
	return width && height ? { width, height } : null;
}

async function dimensionsFromIiifInfo(baseUrl: string) {
	const response = await fetch(`${normalizeIiifBaseUrl(baseUrl)}/info.json`, {
		signal: AbortSignal.timeout(8_000)
	});
	if (!response.ok)
		throw new Error(`Could not read IIIF image dimensions: HTTP ${response.status}`);
	const info = (await response.json()) as unknown;
	return isRecord(info) ? dimensionsFromRecord(info) : null;
}

async function dimensionsFromImageUrl(imageUrl: string) {
	const response = await fetch(imageUrl, { signal: AbortSignal.timeout(12_000) });
	if (!response.ok) throw new Error(`Could not read image dimensions: HTTP ${response.status}`);
	const buffer = Buffer.from(await response.arrayBuffer());
	const metadata = await sharp(buffer).metadata();
	if (!metadata.width || !metadata.height) {
		throw new Error('Could not read image dimensions.');
	}
	return { width: metadata.width, height: metadata.height };
}

function exploreItemMetadata(item: ExploreItem): LibraryImportMetadata {
	return {
		sourceId: item.source,
		sourceName: sourceLabel(item.source),
		sourceType: 'museum',
		detailUrl: item.detailUrl,
		creator: item.artistRaw,
		dateDisplay: item.dateDisplay,
		medium: item.medium,
		objectName: item.objectName,
		department: item.department,
		culture: item.culture,
		period: item.period,
		rights:
			item.isPublicDomain === true
				? `Public domain image according to ${sourceLabel(item.source)}.`
				: item.isPublicDomain === false
					? `Rights restricted or unknown according to ${sourceLabel(item.source)}.`
					: null,
		tags: item.tags,
		rawMetadata: item.rawMetadata
	};
}

function sourceLabel(source: ExploreItem['source']) {
	if (source === 'artic') return 'Art Institute';
	if (source === 'wikidata') return 'Wikidata';
	return 'The Met';
}

function numberOrNull(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
