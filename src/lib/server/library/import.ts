import { renameSync, rmSync, writeFileSync } from 'node:fs';
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
import { extractEmbeddedImageMetadata } from './embeddedImageMetadata';
import { openLibraryDatabase } from './schema';
import { sourceDomain, sourceHash } from './source';
import type { ImportItem, ImportRequest, ImportResponse } from './types';

const MAX_IMPORT_ITEMS = 50;
const DEFAULT_MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_IMPORT_BATCH_BYTES = 250 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_PIXELS = 200_000_000;

export function importResourceLimits() {
	return {
		maxImageBytes: positiveIntegerEnv('PASTICHE_MAX_IMAGE_BYTES', DEFAULT_MAX_IMAGE_BYTES),
		maxBatchBytes: positiveIntegerEnv(
			'PASTICHE_MAX_IMPORT_BATCH_BYTES',
			DEFAULT_MAX_IMPORT_BATCH_BYTES
		),
		maxImagePixels: positiveIntegerEnv('PASTICHE_MAX_IMAGE_PIXELS', DEFAULT_MAX_IMAGE_PIXELS)
	};
}

export function validateImportRequestLimits(request: ImportRequest) {
	if (request.items.length > MAX_IMPORT_ITEMS) return 'Import batches are limited to 50 items';
	const { maxBatchBytes } = importResourceLimits();
	const decodedBytes = request.items.reduce(
		(sum, item) => sum + (item.image_data ? decodedBase64ByteLength(item.image_data) : 0),
		0
	);
	if (decodedBytes > maxBatchBytes) {
		return `Import batches are limited to ${formatMegabytes(maxBatchBytes)} of image data`;
	}
	return null;
}

export async function importLibraryItems(request: ImportRequest): Promise<ImportResponse> {
	const db = openLibraryDatabase();
	const paths = ensureLibraryArchive(resolveLibraryPaths());
	const imported: ImportResponse['imported'] = [];
	const failed: ImportResponse['failed'] = [];
	const now = new Date().toISOString();
	let claimedJobId: string | null = null;

	try {
		if (request.import_job_id) {
			const claim = claimImportJob(db, request.import_job_id, now);
			if (claim.cached) return claim.cached;
			claimedJobId = request.import_job_id;
		}
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
			const files = emptyWrittenFiles();
			let committed = false;
			try {
				const originalImage =
					item.storage_mode === 'download' ? decodeBase64(item.image_data ?? '') : null;
				const inspectedImage = originalImage
					? await inspectDownloadedImage(originalImage, item.mime_type)
					: null;
				const metadata = originalImage
					? await metadataWithEmbeddedImage(item.metadata, originalImage)
					: item.metadata;
				if (originalImage && inspectedImage) {
					files.tempOriginalPath = writeOriginal(
						paths.root,
						`${assetId}.tmp`,
						inspectedImage.extension,
						originalImage
					);
					files.finalOriginalPath = finalOriginalPath(assetId, inspectedImage.extension);
					files.tempThumbnailPath = await writeThumbnail(
						paths.root,
						`${assetId}.tmp`,
						originalImage
					);
					files.finalThumbnailPath = `thumbnails/${assetId}.webp`;
				}

				const applyOne = db.transaction(() => {
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
						inspectedImage?.mimeType ?? item.mime_type,
						inspectedImage?.width ?? item.natural_width,
						inspectedImage?.height ?? item.natural_height,
						files.finalOriginalPath,
						files.finalThumbnailPath,
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
						serializeMetadata(metadata)
					);

					if (item.storage_mode === 'lazy_download' && item.source_image_url) {
						db.prepare(
							`insert into lazy_download_jobs (
								id, asset_id, source_image_url, status, created_at, updated_at, last_error
							) values (?, ?, ?, 'queued', ?, ?, null)`
						).run(`lazy-${crypto.randomUUID()}`, assetId, item.source_image_url, now, now);
					}

					if (metadata) {
						const proposal = createAtlasIngestionProposal({
							assetId,
							source: atlasSourceForImport(metadata),
							sourceId: metadata.sourceId ?? null,
							sourceName: metadata.sourceName ?? null,
							detailUrl: metadata.detailUrl ?? null,
							creator: metadata.creator ?? null,
							artistProfileUrl: metadata.artistProfileUrl ?? null,
							artistUsername: metadata.artistUsername ?? null,
							dateDisplay: metadata.dateDisplay ?? null,
							medium: metadata.medium ?? null,
							objectName: metadata.objectName ?? null,
							department: metadata.department ?? null,
							culture: metadata.culture ?? null,
							period: metadata.period ?? null,
							rights: metadata.rights ?? null,
							tags: metadata.tags ?? [],
							rawMetadata: metadata.rawMetadata ?? {},
							now
						});
						applyAtlasIngestionProposal(db, proposal);

						const acceptedConceptSlugs = normalizeAcceptedConceptSlugs(
							metadata.acceptedConceptSlugs
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
						if (metadata.acceptedAnnotations?.length) {
							applyAtlasAssetPatch(
								db,
								assetId,
								{
									annotations: metadata.acceptedAnnotations.map((annotation) => ({
										label: annotation.label,
										concepts: annotation.concepts,
										classifiers: annotation.classifiers
									}))
								},
								now
							);
						}
					}

					if (shouldApplyApolloPythonSeed({ title: item.filename, sourceUrl: item.source_url })) {
						applyApolloPythonSeedForAsset(db, assetId, now);
					}
				});

				applyOne();
				committed = true;
				promoteWrittenFiles(paths.root, files);
			} catch (error) {
				cleanupWrittenFiles(paths.root, files);
				if (committed) deleteCommittedAsset(db, assetId);
				throw error;
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
		const response = { imported, failed } satisfies ImportResponse;
		if (claimedJobId) completeImportJob(db, claimedJobId, response, new Date().toISOString());
		return response;
	} catch (error) {
		if (claimedJobId) releaseImportJob(db, claimedJobId);
		throw error;
	} finally {
		db.close();
	}
}

export class ImportJobInProgressError extends Error {
	constructor() {
		super('This import job is already in progress; retry it shortly');
	}
}

function claimImportJob(
	db: ReturnType<typeof openLibraryDatabase>,
	jobId: string,
	now: string
): { cached: ImportResponse | null } {
	return db.transaction(() => {
		const existing = db
			.prepare('select response_json, updated_at from import_jobs where id = ?')
			.get(jobId) as { response_json: string | null; updated_at: string } | undefined;
		if (existing?.response_json) {
			return { cached: JSON.parse(existing.response_json) as ImportResponse };
		}
		if (existing) {
			const staleBefore = Date.now() - 10 * 60 * 1000;
			if (Date.parse(existing.updated_at) > staleBefore) throw new ImportJobInProgressError();
			db.prepare('update import_jobs set updated_at = ? where id = ?').run(now, jobId);
			return { cached: null };
		}
		db.prepare(
			'insert into import_jobs (id, response_json, created_at, updated_at) values (?, null, ?, ?)'
		).run(jobId, now, now);
		return { cached: null };
	})();
}

function completeImportJob(
	db: ReturnType<typeof openLibraryDatabase>,
	jobId: string,
	response: ImportResponse,
	now: string
) {
	db.prepare('update import_jobs set response_json = ?, updated_at = ? where id = ?').run(
		JSON.stringify(response),
		now,
		jobId
	);
}

function releaseImportJob(db: ReturnType<typeof openLibraryDatabase>, jobId: string) {
	db.prepare('delete from import_jobs where id = ? and response_json is null').run(jobId);
}

function validateImportItem(item: ImportItem) {
	const limits = importResourceLimits();
	if (!item.filename.trim()) return 'Filename is required';
	if (!Number.isInteger(item.natural_width) || item.natural_width < 1) {
		return 'natural_width must be a positive integer';
	}
	if (!Number.isInteger(item.natural_height) || item.natural_height < 1) {
		return 'natural_height must be a positive integer';
	}
	if (!item.source_url.trim()) return 'source_url is required';
	if (Number.isNaN(Date.parse(item.captured_at))) return 'captured_at must be an ISO timestamp';
	if (
		item.storage_mode !== 'download' &&
		item.natural_width * item.natural_height > limits.maxImagePixels
	) {
		return `Images are limited to ${formatMegapixels(limits.maxImagePixels)}`;
	}
	if (item.storage_mode === 'download' && !item.image_data) {
		return 'Downloaded imports require image_data';
	}
	if (item.storage_mode === 'download' && item.image_data) {
		const byteLength = decodedBase64ByteLength(item.image_data);
		if (byteLength > limits.maxImageBytes) {
			return `Downloaded images are limited to ${formatMegabytes(limits.maxImageBytes)}`;
		}
	}
	if (
		(item.storage_mode === 'url_reference' || item.storage_mode === 'lazy_download') &&
		!item.source_image_url
	) {
		return 'Reference imports require source_image_url';
	}
	return null;
}

function writeOriginal(archiveRoot: string, assetId: string, extension: string, image: Buffer) {
	const relativePath = `originals/${assetId}.${extension}`;
	writeFileSync(join(archiveRoot, relativePath), image);
	return relativePath;
}

type WrittenImportFiles = {
	tempOriginalPath: string | null;
	finalOriginalPath: string | null;
	tempThumbnailPath: string | null;
	finalThumbnailPath: string | null;
};

function emptyWrittenFiles(): WrittenImportFiles {
	return {
		tempOriginalPath: null,
		finalOriginalPath: null,
		tempThumbnailPath: null,
		finalThumbnailPath: null
	};
}

function finalOriginalPath(assetId: string, extension: string) {
	return `originals/${assetId}.${extension}`;
}

function promoteWrittenFiles(archiveRoot: string, files: WrittenImportFiles) {
	if (files.tempOriginalPath && files.finalOriginalPath) {
		renameSync(
			join(archiveRoot, files.tempOriginalPath),
			join(archiveRoot, files.finalOriginalPath)
		);
		files.tempOriginalPath = null;
	}
	if (files.tempThumbnailPath && files.finalThumbnailPath) {
		renameSync(
			join(archiveRoot, files.tempThumbnailPath),
			join(archiveRoot, files.finalThumbnailPath)
		);
		files.tempThumbnailPath = null;
	}
}

function cleanupWrittenFiles(archiveRoot: string, files: WrittenImportFiles) {
	for (const relativePath of [
		files.tempOriginalPath,
		files.finalOriginalPath,
		files.tempThumbnailPath,
		files.finalThumbnailPath
	]) {
		if (!relativePath) continue;
		rmSync(join(archiveRoot, relativePath), { force: true });
	}
}

function deleteCommittedAsset(db: ReturnType<typeof openLibraryDatabase>, assetId: string) {
	db.prepare('delete from lazy_download_jobs where asset_id = ?').run(assetId);
	db.prepare('delete from assets where id = ?').run(assetId);
}

async function writeThumbnail(archiveRoot: string, assetId: string, image: Buffer) {
	const { maxImagePixels } = importResourceLimits();
	const relativePath = `thumbnails/${assetId}.webp`;
	await sharp(image, { limitInputPixels: maxImagePixels, pages: 1 })
		.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 82 })
		.toFile(join(archiveRoot, relativePath));
	return relativePath;
}

function decodeBase64(value: string) {
	const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
	return Buffer.from(base64, 'base64');
}

function decodedBase64ByteLength(value: string) {
	const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
	return Buffer.byteLength(base64, 'base64');
}

type InspectedImage = {
	width: number;
	height: number;
	mimeType: string;
	extension: string;
};

async function inspectDownloadedImage(
	image: Buffer,
	claimedMimeType: string | null
): Promise<InspectedImage> {
	const { maxImageBytes, maxImagePixels } = importResourceLimits();
	if (image.byteLength > maxImageBytes) {
		throw new Error(`Downloaded images are limited to ${formatMegabytes(maxImageBytes)}`);
	}
	let metadata: sharp.Metadata;
	try {
		metadata = await sharp(image, { limitInputPixels: maxImagePixels, pages: 1 }).metadata();
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Image could not be decoded: ${error.message}`
				: 'Image could not be decoded',
			{ cause: error }
		);
	}
	if (!metadata.width || !metadata.height || !metadata.format) {
		throw new Error('Downloaded data is not a supported image');
	}
	const frameHeight = metadata.pageHeight ?? metadata.height;
	const frames = metadata.pages ?? 1;
	const decodedPixels = metadata.width * frameHeight * frames;
	if (decodedPixels > maxImagePixels) {
		throw new Error(`Images are limited to ${formatMegapixels(maxImagePixels)} across all frames`);
	}
	return {
		width: metadata.width,
		height: frameHeight,
		mimeType: mimeTypeForSharpFormat(metadata.format, claimedMimeType),
		extension: extensionForSharpFormat(metadata.format, claimedMimeType)
	};
}

function mimeTypeForSharpFormat(format: string, claimedMimeType: string | null) {
	if (format === 'jpeg') return 'image/jpeg';
	if (format === 'svg') return 'image/svg+xml';
	if (format === 'tiff') return 'image/tiff';
	if (format === 'heif') {
		return claimedMimeType === 'image/avif' ? 'image/avif' : 'image/heic';
	}
	return `image/${format}`;
}

function extensionForSharpFormat(format: string, claimedMimeType: string | null) {
	if (format === 'jpeg') return 'jpg';
	if (format === 'tiff') return 'tif';
	if (format === 'heif') return claimedMimeType === 'image/avif' ? 'avif' : 'heic';
	return format.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'image';
}

function positiveIntegerEnv(name: string, fallback: number) {
	const value = Number.parseInt(process.env[name] ?? '', 10);
	return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function formatMegabytes(bytes: number) {
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatMegapixels(pixels: number) {
	return `${Math.round(pixels / 1_000_000)} megapixels`;
}

function serializeMetadata(metadata: ImportItem['metadata']) {
	if (!metadata) return null;
	return JSON.stringify(metadata);
}

async function metadataWithEmbeddedImage(
	metadata: ImportItem['metadata'],
	image: Buffer
): Promise<ImportItem['metadata']> {
	const embedded = await extractEmbeddedImageMetadata(image);
	return {
		...(metadata ?? {}),
		rawMetadata: {
			...(metadata?.rawMetadata ?? {}),
			embeddedImageMetadata: embedded
		}
	};
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
