import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import {
	applyAtlasIngestionProposal,
	createAtlasIngestionProposal
} from '$lib/server/atlas/ingest';
import { applyAtlasAssetPatch } from '$lib/server/atlas/mutate';
import {
	applyApolloPythonSeedForAsset,
	shouldApplyApolloPythonSeed
} from '$lib/server/atlas/apolloSeed';
import { ensureLibraryArchive, resolveLibraryPaths } from './paths';
import { resolveDestinationFolder } from './folders';
import { openLibraryDatabase } from './schema';
import { sourceDomain, sourceHash } from './source';
import type { ImportItem, ImportRequest, ImportResponse } from './types';

export async function importLibraryItems(request: ImportRequest): Promise<ImportResponse> {
	const db = openLibraryDatabase();
	const paths = ensureLibraryArchive(resolveLibraryPaths());
	const imported: ImportResponse['imported'] = [];
	const failed: ImportResponse['failed'] = [];
	const now = new Date().toISOString();

	try {
		const destinationFolder = resolveDestinationFolder(
			db,
			request.destination_folder_id,
			request.create_folder_name,
			now
		);

		const importOne = async (item: ImportItem, index: number) => {
			const validated = validateImportItem(item);
			const hash = sourceHash(item.source_image_url, item.source_url);
			if (validated) throw new ImportItemError(validated, hash, item.filename);

			const duplicate = Boolean(
				db.prepare('select 1 from assets where source_hash = ? limit 1').get(hash)
			);
			const assetId = `asset-${crypto.randomUUID()}`;
			const originalPath =
				item.storage_mode === 'download' ? writeOriginal(paths.root, assetId, item) : null;
			const thumbnailPath =
				item.storage_mode === 'download' ? await writeThumbnail(paths.root, assetId, item) : null;

			db.prepare(
				`insert into assets (
					id, filename, title, storage_mode, mime_type, width, height, original_path,
					thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
					source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
				) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).run(
				assetId,
				item.filename.trim(),
				item.filename.trim(),
				item.storage_mode,
				item.mime_type,
				item.natural_width,
				item.natural_height,
				originalPath,
				thumbnailPath,
				item.source_image_url,
				item.source_url,
				item.page_title,
				item.alt_text,
				sourceDomain(item.source_image_url, item.source_url),
				hash,
				destinationFolder?.id ?? null,
				now,
				item.captured_at,
				now,
				serializeMetadata(item.metadata)
			);

			if (item.storage_mode === 'lazy_download' && item.source_image_url) {
				db.prepare(
					`insert into lazy_download_jobs (
						id, asset_id, source_image_url, status, created_at, updated_at, last_error
					) values (?, ?, ?, 'queued', ?, ?, null)`
				).run(`lazy-${crypto.randomUUID()}`, assetId, item.source_image_url, now, now);
			}

			if (item.metadata) {
				const proposal = createAtlasIngestionProposal({
					assetId,
					source: atlasSourceForImport(item.metadata),
					sourceId: item.metadata.sourceId ?? null,
					sourceName: item.metadata.sourceName ?? null,
					detailUrl: item.metadata.detailUrl ?? null,
					creator: item.metadata.creator ?? null,
					artistProfileUrl: item.metadata.artistProfileUrl ?? null,
					artistUsername: item.metadata.artistUsername ?? null,
					dateDisplay: item.metadata.dateDisplay ?? null,
					medium: item.metadata.medium ?? null,
					objectName: item.metadata.objectName ?? null,
					department: item.metadata.department ?? null,
					culture: item.metadata.culture ?? null,
					period: item.metadata.period ?? null,
					rights: item.metadata.rights ?? null,
					tags: item.metadata.tags ?? [],
					rawMetadata: item.metadata.rawMetadata ?? {},
					now
				});
				applyAtlasIngestionProposal(db, proposal);

				const acceptedConceptSlugs = normalizeAcceptedConceptSlugs(
					item.metadata.acceptedConceptSlugs
				);
				if (acceptedConceptSlugs.length) {
					applyAtlasAssetPatch(
						db,
						assetId,
						{
							concepts: acceptedConceptSlugs.map((slug) => ({
								slug,
								evidence: 'observed',
								status: 'approved'
							}))
						},
						now
					);
				}
			}

			if (shouldApplyApolloPythonSeed({ title: item.filename, sourceUrl: item.source_url })) {
				applyApolloPythonSeedForAsset(db, assetId, now);
			}

			imported.push({ index, asset_id: assetId, source_hash: hash, duplicate });
		};

		for (const [index, item] of request.items.entries()) {
			try {
				await importOne(item, index);
			} catch (error) {
				const failure = itemFailure(error, item);
				db.prepare(
					`insert into asset_import_failures (id, source_hash, filename, error, created_at)
					 values (?, ?, ?, ?, ?)`
				).run(
					`failure-${crypto.randomUUID()}`,
					failure.sourceHash,
					failure.filename,
					failure.error,
					now
				);
				failed.push({ index, error: failure.error });
			}
		}
	} catch (error) {
		db.close();
		throw error;
	}

	db.close();
	return { imported, failed };
}

function validateImportItem(item: ImportItem) {
	if (!item.filename.trim()) return 'Filename is required';
	if (!Number.isInteger(item.natural_width) || item.natural_width < 1) {
		return 'natural_width must be a positive integer';
	}
	if (!Number.isInteger(item.natural_height) || item.natural_height < 1) {
		return 'natural_height must be a positive integer';
	}
	if (!item.source_url.trim()) return 'source_url is required';
	if (Number.isNaN(Date.parse(item.captured_at))) return 'captured_at must be an ISO timestamp';
	if (item.storage_mode === 'download' && !item.image_data) {
		return 'Downloaded imports require image_data';
	}
	if (
		(item.storage_mode === 'url_reference' || item.storage_mode === 'lazy_download') &&
		!item.source_image_url
	) {
		return 'Reference imports require source_image_url';
	}
	return null;
}

function writeOriginal(archiveRoot: string, assetId: string, item: ImportItem) {
	const extension = extensionForMimeType(item.mime_type);
	const relativePath = `originals/${assetId}.${extension}`;
	writeFileSync(join(archiveRoot, relativePath), decodeBase64(item.image_data ?? ''));
	return relativePath;
}

async function writeThumbnail(archiveRoot: string, assetId: string, item: ImportItem) {
	const relativePath = `thumbnails/${assetId}.webp`;
	await sharp(decodeBase64(item.image_data ?? ''))
		.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 82 })
		.toFile(join(archiveRoot, relativePath));
	return relativePath;
}

function decodeBase64(value: string) {
	const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
	return Buffer.from(base64, 'base64');
}

function extensionForMimeType(mimeType: string | null) {
	switch (mimeType) {
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		case 'image/gif':
			return 'gif';
		case 'image/jpeg':
		case 'image/jpg':
		default:
			return 'jpg';
	}
}

function serializeMetadata(metadata: ImportItem['metadata']) {
	if (!metadata) return null;
	return JSON.stringify(metadata);
}

function normalizeAcceptedConceptSlugs(value: string[] | undefined) {
	if (!value) return [];
	const seen = new Set<string>();
	const slugs: string[] = [];
	for (const item of value) {
		const slug = normalizeAtlasSlug(item);
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		slugs.push(slug);
	}
	return slugs;
}

function atlasSourceForImport(
	metadata: NonNullable<ImportItem['metadata']>
): 'explore' | 'extension' | 'manual' | 'import' {
	if (metadata.sourceType === 'museum' || metadata.sourceType === 'collection') return 'explore';
	if (metadata.sourceType === 'local') return 'manual';
	if (metadata.sourceType === 'web' || metadata.sourceType === 'social') return 'extension';
	if (metadata.sourceType === 'gallery' || metadata.sourceType === 'booru') return 'extension';
	if (metadata.sourceType === 'cdn' || metadata.sourceType === 'unknown') return 'extension';
	return metadata.sourceId ? 'explore' : 'import';
}

class ImportItemError extends Error {
	constructor(
		message: string,
		readonly sourceHash: string | null,
		readonly filename: string | null
	) {
		super(message);
	}
}

function itemFailure(error: unknown, item: ImportItem) {
	if (error instanceof ImportItemError) {
		return { error: error.message, sourceHash: error.sourceHash, filename: error.filename };
	}
	return {
		error: error instanceof Error ? error.message : 'Import failed',
		sourceHash: safeSourceHash(item),
		filename: item.filename
	};
}

function safeSourceHash(item: ImportItem) {
	try {
		return sourceHash(item.source_image_url, item.source_url);
	} catch {
		return null;
	}
}
