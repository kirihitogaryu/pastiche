import { json } from '@sveltejs/kit';
import { getExploreConnectorForItemId } from '$lib/explore/connectors';
import { buildIiifImageUrl } from '$lib/explore/iiif';
import { fetchFurAffinityImage } from '$lib/server/explore/furaffinityImage';
import { importLibraryItems, importResourceLimits } from '$lib/server/library/import';
import type { ExploreItem } from '$lib/explore/types';
import type { StorageMode } from '$lib/library/types';
import type { ImportRequest, LibraryImportMetadata } from '$lib/server/library/types';
import { requireTrustedLocalAccess } from '../../localAccess';

type SaveExploreRequest = {
	item_id: string;
	destination_folder_id: string | null;
	storage_mode?: 'download' | 'url_reference';
	image_index?: number;
};

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;

	const body = await readJson(request);
	if (!isSaveExploreRequest(body)) {
		return json({ error: 'Invalid save request' }, { status: 400, headers: access.headers });
	}

	try {
		const fetchedItem = await getExploreConnectorForItemId(body.item_id).getById(body.item_id);
		const item = selectExploreImage(fetchedItem, body.image_index ?? 0);
		const payload = await exploreItemToImportRequest(
			item,
			body.destination_folder_id,
			body.storage_mode ?? 'download'
		);
		return json(await importLibraryItems(payload), { headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Explore item could not be saved' },
			{ status: 502, headers: access.headers }
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
			typeof (value as SaveExploreRequest).destination_folder_id === 'string') &&
		((value as SaveExploreRequest).storage_mode === undefined ||
			(value as SaveExploreRequest).storage_mode === 'download' ||
			(value as SaveExploreRequest).storage_mode === 'url_reference') &&
		((value as SaveExploreRequest).image_index === undefined ||
			(Number.isInteger((value as SaveExploreRequest).image_index) &&
				(value as SaveExploreRequest).image_index! >= 0 &&
				(value as SaveExploreRequest).image_index! <= 20))
	);
}

function selectExploreImage(item: ExploreItem, index: number): ExploreItem {
	if (index === 0) return item;
	const imageUrl = item.additionalImages[index - 1];
	if (!imageUrl) throw new Error(`Image ${index + 1} is not available on this Explore result.`);
	return {
		...item,
		title: `${item.title} · image ${index + 1}`,
		thumbUrl: imageUrl,
		imageUrl,
		additionalImages: [],
		isIIIF: false,
		rawMetadata: {
			...item.rawMetadata,
			exploreSelection: {
				imageIndex: index,
				imageCount: item.additionalImages.length + 1
			}
		}
	};
}

function exploreItemToImportRequest(
	item: ExploreItem,
	destinationFolderId: string | null,
	storageMode: Extract<StorageMode, 'download' | 'url_reference'>
): Promise<ImportRequest> {
	return buildExploreImportRequest(item, destinationFolderId, storageMode);
}

async function buildExploreImportRequest(
	item: ExploreItem,
	destinationFolderId: string | null,
	storageMode: Extract<StorageMode, 'download' | 'url_reference'>
): Promise<ImportRequest> {
	const imageUrl = exploreStorageImageUrl(item);
	if (!imageUrl) throw new Error('Explore item has no image URL');
	const image =
		storageMode === 'download'
			? await downloadExploreImage(item, imageUrl, item.thumbUrl)
			: { bytes: Buffer.alloc(0), mimeType: null };

	return {
		destination_folder_id: destinationFolderId,
		items: [
			{
				filename: item.title,
				storage_mode: storageMode,
				image_data: storageMode === 'download' ? image.bytes.toString('base64') : null,
				source_image_url: imageUrl,
				mime_type: image.mimeType,
				natural_width: rawDimension(item, 'width'),
				natural_height: rawDimension(item, 'height'),
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

async function downloadExploreImage(
	item: ExploreItem,
	primaryUrl: string,
	fallbackUrl: string | null
) {
	const candidates = [primaryUrl, fallbackUrl].filter(
		(url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index
	);
	let lastError: unknown;
	for (const url of candidates) {
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
				throw new Error('Explore image URLs must use HTTP or HTTPS');
			}
			const response =
				item.source === 'furaffinity'
					? await fetchFurAffinityImage(parsed.toString(), item.detailUrl)
					: await fetch(parsed, { signal: AbortSignal.timeout(30_000) });
			if (!response.ok)
				throw new Error(`Could not download Explore image: HTTP ${response.status}`);
			const bytes = await readBoundedResponse(response, importResourceLimits().maxImageBytes);
			return { bytes, mimeType: normalizedImageMimeType(response.headers.get('content-type')) };
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Explore image could not be downloaded');
}

async function readBoundedResponse(response: Response, maxBytes: number) {
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new Error(`Remote images are limited to ${formatMegabytes(maxBytes)}`);
	}
	if (!response.body) return Buffer.alloc(0);

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			throw new Error(`Remote images are limited to ${formatMegabytes(maxBytes)}`);
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks, total);
}

function normalizedImageMimeType(value: string | null) {
	const mimeType = value?.split(';', 1)[0]?.trim().toLowerCase();
	return mimeType?.startsWith('image/') ? mimeType : null;
}

function formatMegabytes(bytes: number) {
	return `${Math.max(1, Math.floor(bytes / (1024 * 1024)))} MB`;
}

function exploreItemMetadata(item: ExploreItem): LibraryImportMetadata {
	const danbooruArtist = item.source === 'danbooru' ? firstDanbooruArtistTag(item) : null;
	const deviantArtArtist = item.source === 'deviantart' ? deviantArtArtistMetadata(item) : null;
	const blueskyArtist = item.source === 'bluesky' ? blueskyArtistMetadata(item) : null;
	const furAffinityArtist = item.source === 'furaffinity' ? furAffinityArtistMetadata(item) : null;
	return {
		sourceId: item.source,
		sourceName: sourceLabel(item.source),
		sourceType:
			item.source === 'danbooru'
				? 'booru'
				: item.source === 'deviantart'
					? 'gallery'
					: item.source === 'bluesky' || item.source === 'furaffinity'
						? 'gallery'
						: 'museum',
		detailUrl: item.detailUrl,
		creator: item.artistRaw,
		artistProfileUrl:
			item.source === 'danbooru' && danbooruArtist
				? `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(danbooruArtist)}`
				: (deviantArtArtist?.profileUrl ??
					blueskyArtist?.profileUrl ??
					furAffinityArtist?.profileUrl ??
					null),
		artistUsername:
			danbooruArtist ??
			deviantArtArtist?.username ??
			blueskyArtist?.username ??
			furAffinityArtist?.username ??
			null,
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
	if (source === 'danbooru') return 'Danbooru';
	if (source === 'deviantart') return 'DeviantArt';
	if (source === 'bluesky') return 'Bluesky';
	if (source === 'furaffinity') return 'Fur Affinity';
	return 'The Met';
}

function rawDimension(item: ExploreItem, key: 'width' | 'height') {
	for (const provider of ['danbooru', 'deviantart', 'bluesky', 'furaffinity'] as const) {
		const metadata = item.rawMetadata[provider];
		if (typeof metadata === 'object' && metadata !== null) {
			const value = (metadata as Record<string, unknown>)[key];
			if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
				return Math.round(value);
			}
		}
	}
	return 1;
}

function firstDanbooruArtistTag(item: ExploreItem) {
	const danbooru = item.rawMetadata.danbooru;
	if (typeof danbooru !== 'object' || danbooru === null) return null;
	const tags = (danbooru as Record<string, unknown>).artistTags;
	if (!Array.isArray(tags)) return null;
	return (
		tags.find((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) ?? null
	);
}

function deviantArtArtistMetadata(item: ExploreItem) {
	const metadata = item.rawMetadata.deviantart;
	if (typeof metadata !== 'object' || metadata === null) return null;
	const record = metadata as Record<string, unknown>;
	const username =
		typeof record.authorUsername === 'string' && record.authorUsername.trim()
			? record.authorUsername.trim()
			: null;
	const profileUrl =
		typeof record.authorProfileUrl === 'string' && record.authorProfileUrl.trim()
			? record.authorProfileUrl.trim()
			: username
				? `https://www.deviantart.com/${encodeURIComponent(username)}`
				: null;
	return username || profileUrl ? { username, profileUrl } : null;
}

function blueskyArtistMetadata(item: ExploreItem) {
	return providerArtistMetadata(item, 'bluesky', 'authorHandle', 'authorProfileUrl');
}

function furAffinityArtistMetadata(item: ExploreItem) {
	return providerArtistMetadata(item, 'furaffinity', 'authorUsername', 'authorProfileUrl');
}

function providerArtistMetadata(
	item: ExploreItem,
	provider: 'bluesky' | 'furaffinity',
	usernameKey: string,
	profileKey: string
) {
	const metadata = item.rawMetadata[provider];
	if (typeof metadata !== 'object' || metadata === null) return null;
	const record = metadata as Record<string, unknown>;
	const username =
		typeof record[usernameKey] === 'string' && record[usernameKey].trim()
			? record[usernameKey].trim()
			: null;
	const profileUrl =
		typeof record[profileKey] === 'string' && record[profileKey].trim()
			? record[profileKey].trim()
			: null;
	return username || profileUrl ? { username, profileUrl } : null;
}
