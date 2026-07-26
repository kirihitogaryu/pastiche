import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLibraryPaths } from './paths';
import {
	extractEmbeddedImageMetadataSync,
	type EmbeddedImageMetadata
} from './embeddedImageMetadata';
import { parseNovelAiGeneration } from './novelAiGeneration';
import { openLibraryDatabase } from './schema';
import type {
	LibraryAsset,
	LibraryAtlasTag,
	LibraryAssetFacts,
	LibraryAssetRecord,
	LibraryProject,
	LibraryImportMetadata,
	LibraryResponse,
	LibrarySourceType,
	LibraryTag,
	LibraryTagFacet,
	SourceTagSuggestion,
	StorageMode
} from './types';
import type { LibraryFolder } from '$lib/types';

type AssetRow = {
	id: string;
	filename: string;
	title: string;
	storage_mode: StorageMode;
	mime_type: string | null;
	width: number;
	height: number;
	original_path: string | null;
	thumbnail_path: string | null;
	source_image_url: string | null;
	source_url: string;
	page_title: string | null;
	alt_text: string | null;
	source_domain: string | null;
	folder_id: string | null;
	imported_at: string;
	captured_at: string;
	modified_at: string | null;
	metadata_json: string | null;
	favorite: number;
};

type FolderRow = {
	id: string;
	name: string;
	parent_id: string | null;
	path: string;
	asset_count: number;
	child_count: number;
};

type TagRow = {
	asset_id?: string;
	id: string;
	facet_id: string;
	facet_name: string;
	facet_slug: string;
	value: string;
	name: string;
	slug: string;
	asset_count: number;
};

type TagFacetRow = {
	id: string;
	name: string;
	slug: string;
	tag_count: number;
};

type ProjectRow = {
	id: string;
	name: string;
	description: string | null;
	pinned: number;
	cover_asset_id: string | null;
	created_at: string;
	updated_at: string;
};

type ProjectFolderRefRow = {
	project_id: string;
	folder_id: string;
	include_subfolders: number;
};

type ProjectAssetRefRow = {
	project_id: string;
	asset_id: string;
};

type MembershipAssetRow = Pick<AssetRow, 'id' | 'folder_id'>;

type AtlasAssignmentRow = {
	asset_id: string;
	annotation_id: string | null;
	id: string;
	slug: string;
	label: string;
	kind: LibraryAtlasTag['kind'];
	category: string;
	display_group: string;
	concept_status: LibraryAtlasTag['status'];
	maturity: LibraryAtlasTag['maturity'];
	assignment_status: LibraryAtlasTag['assignmentStatus'];
};

type AtlasClassifierRow = {
	asset_id: string;
	annotation_id: string;
	id: string;
	classifier_type: string;
	classifier_value: string;
	status: LibraryAtlasTag['assignmentStatus'];
};

export function getLibrarySnapshot(options: { includeAssets?: boolean } = {}): LibraryResponse {
	const db = openLibraryDatabase();
	const includeAssets = options.includeAssets ?? true;
	const folders = db
		.prepare(
			`select
				folders.id,
				folders.name,
				folders.parent_id,
				folders.path,
				(select count(*) from assets where assets.folder_id = folders.id) as asset_count,
				(select count(*) from folders as children where children.parent_id = folders.id) as child_count
			from folders
			order by folders.path`
		)
		.all() as FolderRow[];
	const folderById = new Map(folders.map((folder) => [folder.id, folder]));
	const assets = includeAssets
		? (db.prepare('select * from assets order by imported_at desc').all() as AssetRow[])
		: [];
	for (const asset of assets) cacheEmbeddedImageMetadata(db, asset);
	const membershipAssets: MembershipAssetRow[] = includeAssets
		? assets
		: (db.prepare('select id, folder_id from assets').all() as MembershipAssetRow[]);
	const tagsByAsset = tagsByAssetId(db);
	const atlasTagsByAsset = atlasTagsByAssetId(
		db,
		includeAssets ? assets.map((asset) => asset.id) : []
	);
	const tagFacets = db
		.prepare(
			`select
				tag_facets.id,
				tag_facets.name,
				tag_facets.slug,
				(select count(*) from tags where tags.facet_id = tag_facets.id) as tag_count
			 from tag_facets
			 order by tag_facets.slug`
		)
		.all() as TagFacetRow[];
	const allTags = db
		.prepare(
			`select
				tags.id,
				tags.facet_id,
				tag_facets.name as facet_name,
				tag_facets.slug as facet_slug,
				tags.value,
				tags.name,
				tags.slug,
				(select count(*) from asset_tags where asset_tags.tag_id = tags.id) as asset_count
			 from tags
			 join tag_facets on tag_facets.id = tags.facet_id
			 order by tag_facets.slug, lower(tags.value)`
		)
		.all() as TagRow[];
	const projects = db
		.prepare('select * from projects order by updated_at desc')
		.all() as ProjectRow[];
	const projectAssetRefs = db
		.prepare('select project_id, asset_id from project_asset_refs')
		.all() as ProjectAssetRefRow[];
	const projectFolderRefs = db
		.prepare('select project_id, folder_id, include_subfolders from project_folder_refs')
		.all() as ProjectFolderRefRow[];
	db.close();
	const projectMembership = projectMembershipByAssetId(
		membershipAssets,
		folderById,
		projectAssetRefs,
		projectFolderRefs
	);
	const projectAssetCounts = projectCountsById(projectMembership);
	const assetPreviewById = includeAssets
		? new Map(assets.map((asset) => [asset.id, mapImage(asset).previewUrl]))
		: projectCoverPreviews(projects);

	return {
		assets: assets.map((asset) =>
			mapAsset(
				asset,
				folderById.get(asset.folder_id ?? ''),
				tagsByAsset.get(asset.id) ?? [],
				atlasTagsByAsset.get(asset.id) ?? [],
				projectMembership.get(asset.id) ?? []
			)
		),
		folders: folders.map(mapFolder),
		projects: projects.map((project) =>
			mapProject(
				project,
				projectAssetCounts.get(project.id) ?? 0,
				projectFolderRefs,
				assetPreviewById
			)
		),
		tagFacets: mapTagFacets(tagFacets, allTags),
		stats: {
			assets: membershipAssets.length,
			projects: projects.length,
			folders: folders.length,
			tags: tagFacets.reduce((sum, facet) => sum + facet.tag_count, 0)
		}
	};
}

export function getLibraryStructureSnapshot(): LibraryResponse {
	return getLibrarySnapshot({ includeAssets: false });
}

export function getLibraryAssetPage(options: { limit?: number; cursor?: string | null } = {}) {
	const limit = Math.max(1, Math.min(options.limit ?? 100, 250));
	const offset = nonNegativeInteger(options.cursor);
	const db = openLibraryDatabase();
	try {
		const total = (db.prepare('select count(*) as count from assets').get() as { count: number })
			.count;
		const assets = db
			.prepare('select * from assets order by imported_at desc, id limit ? offset ?')
			.all(limit, offset) as AssetRow[];
		for (const asset of assets) cacheEmbeddedImageMetadata(db, asset);
		const folders = db
			.prepare(
				`select folders.id, folders.name, folders.parent_id, folders.path,
					(select count(*) from assets where assets.folder_id = folders.id) as asset_count,
					(select count(*) from folders as children where children.parent_id = folders.id) as child_count
				 from folders order by folders.path`
			)
			.all() as FolderRow[];
		const folderById = new Map(folders.map((folder) => [folder.id, folder]));
		const tagsByAsset = tagsByAssetId(
			db,
			assets.map((asset) => asset.id)
		);
		const atlasTagsByAsset = atlasTagsByAssetId(
			db,
			assets.map((asset) => asset.id)
		);
		const projectAssetRefs = assetRefsForIds(
			db,
			assets.map((asset) => asset.id)
		);
		const projectFolderRefs = db
			.prepare('select project_id, folder_id, include_subfolders from project_folder_refs')
			.all() as ProjectFolderRefRow[];
		const projectMembership = projectMembershipByAssetId(
			assets,
			folderById,
			projectAssetRefs,
			projectFolderRefs
		);
		const nextOffset = offset + assets.length;
		return {
			assets: assets.map((asset) =>
				mapAsset(
					asset,
					folderById.get(asset.folder_id ?? ''),
					tagsByAsset.get(asset.id) ?? [],
					atlasTagsByAsset.get(asset.id) ?? [],
					projectMembership.get(asset.id) ?? []
				)
			),
			page: {
				limit,
				nextCursor: nextOffset < total ? String(nextOffset) : null,
				total
			}
		};
	} finally {
		db.close();
	}
}

export function getLibraryAssetById(id: string): LibraryAsset | null {
	const db = openLibraryDatabase();
	try {
		const asset = db.prepare('select * from assets where id = ?').get(id) as AssetRow | undefined;
		if (!asset) return null;
		cacheEmbeddedImageMetadata(db, asset);
		const folders = db
			.prepare(
				`select
					folders.id,
					folders.name,
					folders.parent_id,
					folders.path,
					(select count(*) from assets where assets.folder_id = folders.id) as asset_count,
					(select count(*) from folders as children where children.parent_id = folders.id) as child_count
				from folders
				order by folders.path`
			)
			.all() as FolderRow[];
		const folderById = new Map(folders.map((folder) => [folder.id, folder]));
		const projectAssetRefs = db
			.prepare('select project_id, asset_id from project_asset_refs where asset_id = ?')
			.all(asset.id) as ProjectAssetRefRow[];
		const projectFolderRefs = db
			.prepare('select project_id, folder_id, include_subfolders from project_folder_refs')
			.all() as ProjectFolderRefRow[];
		const projectMembership = projectMembershipByAssetId(
			[asset],
			folderById,
			projectAssetRefs,
			projectFolderRefs
		);
		return mapAsset(
			asset,
			folderById.get(asset.folder_id ?? ''),
			tagsForAssetId(db, asset.id),
			atlasTagsByAssetId(db, [asset.id]).get(asset.id) ?? [],
			projectMembership.get(asset.id) ?? []
		);
	} finally {
		db.close();
	}
}

export function getAssetImageFile(id: string, variant: 'thumb' | 'original') {
	const db = openLibraryDatabase();
	const asset = db
		.prepare('select original_path, thumbnail_path, mime_type from assets where id = ?')
		.get(id) as
		| {
				original_path: string | null;
				thumbnail_path: string | null;
				mime_type: string | null;
		  }
		| undefined;
	db.close();
	if (!asset) return null;

	const relativePath =
		variant === 'thumb' ? asset.thumbnail_path || asset.original_path : asset.original_path;
	if (!relativePath) return null;

	const path = join(resolveLibraryPaths().root, relativePath);
	if (!existsSync(path)) return null;
	return {
		path,
		contentType:
			variant === 'thumb' && asset.thumbnail_path ? 'image/webp' : asset.mime_type || 'image/jpeg'
	};
}

function mapAsset(
	asset: AssetRow,
	folder: FolderRow | undefined,
	tags: LibraryTag[],
	atlasTags: LibraryAtlasTag[],
	projects: string[]
): LibraryAsset {
	const record = mapAssetRecord(asset, folder, tags, atlasTags, projects);
	const legacySourceType =
		record.source.type === 'museum' ? 'museum' : record.source.type === 'local' ? 'local' : 'web';

	return {
		id: record.id,
		title: record.title,
		creator: record.artist ?? '',
		year: record.dates.dateDisplay ?? '',
		medium: record.facts.medium ?? '',
		sourceName: record.source.label,
		sourceUrl: record.source.pageUrl ?? undefined,
		sourceType: legacySourceType,
		imageUrl: record.image.previewUrl ?? '',
		width: record.dimensions.width,
		height: record.dimensions.height,
		tags: uniqueStrings([
			...record.organization.tags.map((tag) => tag.name),
			...(record.organization.atlasTags ?? []).map((tag) => tag.expression)
		]),
		palette: [],
		description: record.description ?? '',
		notes: undefined,
		favorite: record.organization.favorite,
		saved: true,
		projects: record.organization.projects,
		folderPath: record.organization.folderPath,
		storageMode: asset.storage_mode,
		sourceImageUrl: record.image.sourceImageUrl,
		importedAt: record.dates.importedAt,
		capturedAt: record.dates.capturedAt,
		record
	};
}

function mapAssetRecord(
	asset: AssetRow,
	folder: FolderRow | undefined,
	tags: LibraryTag[],
	atlasTags: LibraryAtlasTag[],
	projects: string[]
): LibraryAssetRecord {
	const metadata = parseMetadata(asset.metadata_json);
	const folderPath = folder ? splitPath(folder.path) : ['library', 'unassigned'];
	const image = mapImage(asset);
	const source = mapSource(asset, metadata);
	const facts = mapFacts(metadata);
	const acceptedTagSlugs = new Set(tags.map((tag) => tag.slug));
	const embeddedMetadata = embeddedImageMetadataFor(metadata);

	return {
		id: asset.id,
		filename: asset.filename,
		title: displayTitle(asset, metadata),
		artist: cleanString(metadata?.creator),
		description: cleanString(asset.alt_text),
		dates: {
			dateDisplay: cleanString(metadata?.dateDisplay),
			importedAt: asset.imported_at,
			capturedAt: asset.captured_at,
			modifiedAt: asset.modified_at
		},
		dimensions: {
			width: asset.width,
			height: asset.height
		},
		source,
		image,
		facts,
		organization: {
			folderId: asset.folder_id,
			folderPath,
			tags,
			atlasTags,
			sourceTagSuggestions: sourceTagSuggestions(metadata, source.label, acceptedTagSlugs),
			projects,
			favorite: Boolean(asset.favorite)
		},
		generation: embeddedMetadata ? parseNovelAiGeneration(embeddedMetadata) : null,
		raw: {
			importer: importerFor(metadata),
			sourceMetadata: metadata?.rawMetadata ?? {}
		}
	};
}

function mapImage(asset: AssetRow): LibraryAssetRecord['image'] {
	const originalAvailable = Boolean(asset.original_path && localFileAvailable(asset.original_path));
	const thumbnailAvailable = Boolean(
		asset.thumbnail_path && localFileAvailable(asset.thumbnail_path)
	);
	const localThumbUrl = thumbnailAvailable ? imageApiUrl(asset.id, 'thumb') : null;
	const localOriginalUrl = originalAvailable ? imageApiUrl(asset.id, 'original') : null;
	const referenceUrl =
		asset.storage_mode === 'url_reference' || asset.storage_mode === 'lazy_download'
			? asset.source_image_url
			: null;

	return {
		mimeType: asset.mime_type,
		previewUrl: localThumbUrl ?? localOriginalUrl ?? referenceUrl,
		originalUrl: localOriginalUrl ?? referenceUrl,
		sourceImageUrl: asset.source_image_url,
		localOriginalAvailable: originalAvailable,
		localThumbnailAvailable: thumbnailAvailable
	};
}

function mapSource(asset: AssetRow, metadata: LibraryImportMetadata | null) {
	const pageUrl = cleanString(metadata?.detailUrl) ?? cleanString(asset.source_url);
	const imageUrl = cleanString(asset.source_image_url);
	const pageDomain = pageUrl ? urlHostname(pageUrl) : null;
	const imageHost = imageUrl ? urlHostname(imageUrl) : null;
	const known = knownSource(pageDomain);
	const label =
		cleanString(metadata?.sourceName) ??
		known?.label ??
		pageDomain ??
		imageHost ??
		(asset.storage_mode === 'download' ? 'Local Library' : 'Unknown Source');
	const type = sourceType(metadata, known?.type, label, pageDomain, imageHost, asset);

	return {
		label,
		type,
		pageUrl,
		imageUrl,
		imageHost,
		domain: pageDomain,
		sourceId: cleanString(metadata?.sourceId) ?? known?.sourceId ?? null
	};
}

function sourceType(
	metadata: LibraryImportMetadata | null,
	knownType: LibrarySourceType | undefined,
	label: string,
	pageDomain: string | null,
	imageHost: string | null,
	asset: AssetRow
): LibrarySourceType {
	if (metadata?.sourceType === 'museum') return 'museum';
	if (metadata?.sourceType === 'local') return 'local';
	if (metadata?.sourceType === 'social') return 'social';
	if (metadata?.sourceType === 'gallery') return 'gallery';
	if (metadata?.sourceType === 'booru') return 'booru';
	if (metadata?.sourceType === 'cdn') return 'cdn';
	if (metadata?.sourceType === 'collection') return 'gallery';
	if (knownType) return knownType;
	if (!pageDomain && asset.storage_mode === 'download') return 'local';
	if (!pageDomain && imageHost && label === imageHost) return 'cdn';
	return 'unknown';
}

function mapFacts(metadata: LibraryImportMetadata | null): LibraryAssetFacts {
	const facts: LibraryAssetFacts = {};
	const medium = cleanString(metadata?.medium);
	const type = cleanString(metadata?.objectName);
	const department = cleanString(metadata?.department);
	const culture = cleanString(metadata?.culture);
	const period = cleanString(metadata?.period);
	const rights = cleanString(metadata?.rights);

	if (medium) facts.medium = medium;
	if (type) facts.type = type;
	if (department) facts.department = department;
	if (culture) facts.culture = culture;
	if (period) facts.period = period;
	if (rights) facts.rights = rights;
	return facts;
}

function sourceTagSuggestions(
	metadata: LibraryImportMetadata | null,
	sourceLabel: string,
	acceptedTagSlugs: Set<string>
): SourceTagSuggestion[] {
	const seen = new Set<string>();
	const suggestions: SourceTagSuggestion[] = [];
	const add = (facetName: string, value: string | null | undefined, useful: boolean) => {
		const cleanValue = cleanString(value);
		if (!cleanValue) return;
		const facetSlug = slugify(facetName);
		const valueSlug = slugify(cleanValue);
		if (!facetSlug || !valueSlug) return;
		const tagSlug = `${facetSlug}-${valueSlug}`;
		if (seen.has(tagSlug)) return;
		seen.add(tagSlug);
		suggestions.push({
			name: `${facetName}: ${cleanValue}`,
			slug: tagSlug,
			facetName,
			facetSlug,
			value: cleanValue,
			accepted: acceptedTagSlugs.has(tagSlug),
			useful
		});
	};

	add('source', sourceLabel, true);
	add('medium', metadata?.medium, true);
	add('style/era', metadata?.period ?? metadata?.dateDisplay, true);
	add('department', metadata?.department, false);
	add('culture', metadata?.culture, false);
	for (const tag of metadata?.tags ?? []) {
		add('subject', tag, true);
	}
	return suggestions;
}

function displayTitle(asset: AssetRow, metadata: LibraryImportMetadata | null) {
	const rawTitle = cleanString(asset.title);
	const pageTitle = cleanString(asset.page_title);
	const objectName = cleanString(metadata?.objectName);
	return pageTitle ?? rawTitle ?? objectName ?? asset.filename;
}

function importerFor(
	metadata: LibraryImportMetadata | null
): LibraryAssetRecord['raw']['importer'] {
	if (metadata?.sourceType === 'museum' || metadata?.sourceId === 'met') return 'explore';
	if (metadata?.sourceId === 'artic' || metadata?.sourceId === 'wikidata') return 'explore';
	return 'extension';
}

function localFileAvailable(relativePath: string) {
	return existsSync(localFilePath(relativePath));
}

function localFilePath(relativePath: string) {
	return join(resolveLibraryPaths().root, relativePath);
}

function embeddedImageMetadataFor(
	metadata: LibraryImportMetadata | null
): EmbeddedImageMetadata | null {
	const stored = metadata?.rawMetadata?.embeddedImageMetadata;
	if (isEmbeddedImageMetadata(stored)) return stored;
	return null;
}

function cacheEmbeddedImageMetadata(db: ReturnType<typeof openLibraryDatabase>, asset: AssetRow) {
	const metadata = parseMetadata(asset.metadata_json);
	if (isEmbeddedImageMetadata(metadata?.rawMetadata?.embeddedImageMetadata)) return;
	if (!asset.original_path || !localFileAvailable(asset.original_path)) return;
	const embedded = extractEmbeddedImageMetadataSync(localFilePath(asset.original_path));
	const updated: LibraryImportMetadata = {
		...(metadata ?? {}),
		rawMetadata: {
			...(metadata?.rawMetadata ?? {}),
			embeddedImageMetadata: embedded
		}
	};
	asset.metadata_json = JSON.stringify(updated);
	db.prepare('update assets set metadata_json = ? where id = ?').run(asset.metadata_json, asset.id);
}

function isEmbeddedImageMetadata(value: unknown): value is EmbeddedImageMetadata {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const candidate = value as Partial<EmbeddedImageMetadata>;
	return (
		(candidate.kind === 'png' || candidate.kind === 'unknown') &&
		Boolean(candidate.pngText) &&
		typeof candidate.pngText === 'object' &&
		!Array.isArray(candidate.pngText) &&
		Array.isArray(candidate.warnings)
	);
}

function imageApiUrl(id: string, variant: 'thumb' | 'original') {
	return `/api/library/assets/${encodeURIComponent(id)}/image?variant=${variant}`;
}

function knownSource(
	domain: string | null
): { label: string; type: LibrarySourceType; sourceId: string } | null {
	if (!domain) return null;
	const normalized = domain.replace(/^www\./, '');
	if (normalized.endsWith('deviantart.com')) {
		return { label: 'DeviantArt', type: 'artist_site', sourceId: 'deviantart' };
	}
	if (normalized.endsWith('novelai.net')) {
		return { label: 'NovelAI', type: 'ai_generator', sourceId: 'novelai' };
	}
	if (normalized.endsWith('metmuseum.org'))
		return { label: 'The Met', type: 'museum', sourceId: 'met' };
	if (normalized.endsWith('artic.edu')) {
		return { label: 'Art Institute', type: 'museum', sourceId: 'artic' };
	}
	if (normalized.endsWith('wikidata.org')) {
		return { label: 'Wikidata', type: 'museum', sourceId: 'wikidata' };
	}
	return null;
}

function parseMetadata(value: string | null): LibraryImportMetadata | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as LibraryImportMetadata;
		return parsed && typeof parsed === 'object' ? parsed : null;
	} catch {
		return null;
	}
}

function mapFolder(folder: FolderRow): LibraryFolder {
	return {
		id: folder.id,
		name: folder.name,
		path: splitPath(folder.path),
		assetCount: folder.asset_count,
		childFolderCount: folder.child_count,
		parentId: folder.parent_id ?? undefined
	};
}

function tagsByAssetId(db: ReturnType<typeof openLibraryDatabase>, assetIds?: string[]) {
	if (assetIds?.length === 0) return new Map<string, LibraryTag[]>();
	const where = assetIds
		? `where asset_tags.asset_id in (${sqlPlaceholders(assetIds.length)})`
		: '';
	const rows = db
		.prepare(
			`select
				asset_tags.asset_id,
				tags.id,
				tags.facet_id,
				tag_facets.name as facet_name,
				tag_facets.slug as facet_slug,
				tags.value,
				tags.name,
				tags.slug,
				(select count(*) from asset_tags as tag_count where tag_count.tag_id = tags.id)
					as asset_count
			 from asset_tags
			 join tags on tags.id = asset_tags.tag_id
			 join tag_facets on tag_facets.id = tags.facet_id
			 ${where}
			 order by tag_facets.slug, tags.value`
		)
		.all(...(assetIds ?? [])) as TagRow[];
	const map = new Map<string, LibraryTag[]>();
	for (const row of rows) {
		const tags = map.get(row.asset_id ?? '') ?? [];
		tags.push(mapTag(row));
		map.set(row.asset_id ?? '', tags);
	}
	return map;
}

function atlasTagsByAssetId(db: ReturnType<typeof openLibraryDatabase>, assetIds?: string[]) {
	const result = new Map<string, LibraryAtlasTag[]>();
	if (assetIds?.length === 0) return result;
	const where = assetIds
		? `and atlas_asset_concepts.asset_id in (${sqlPlaceholders(assetIds.length)})`
		: '';
	const assetAssignments = db
		.prepare(
			`select
				atlas_asset_concepts.asset_id,
				null as annotation_id,
				atlas_concepts.id,
				atlas_concepts.slug,
				atlas_concepts.label,
				atlas_concepts.kind,
				atlas_concepts.category,
				atlas_concepts.display_group,
				atlas_concepts.status as concept_status,
				atlas_concepts.maturity,
				atlas_asset_concepts.status as assignment_status
			 from atlas_asset_concepts
			 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
			 where atlas_asset_concepts.status not in ('rejected', 'deprecated')
				${where}`
		)
		.all(...(assetIds ?? [])) as AtlasAssignmentRow[];
	const annotationWhere = assetIds
		? `and atlas_annotations.asset_id in (${sqlPlaceholders(assetIds.length)})`
		: '';
	const annotationAssignments = db
		.prepare(
			`select
				atlas_annotations.asset_id,
				atlas_annotations.id as annotation_id,
				atlas_concepts.id,
				atlas_concepts.slug,
				atlas_concepts.label,
				atlas_concepts.kind,
				atlas_concepts.category,
				atlas_concepts.display_group,
				atlas_concepts.status as concept_status,
				atlas_concepts.maturity,
				atlas_annotation_concepts.status as assignment_status
			 from atlas_annotation_concepts
			 join atlas_annotations on atlas_annotations.id = atlas_annotation_concepts.annotation_id
			 join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
			 where atlas_annotation_concepts.status not in ('rejected', 'deprecated')
				${annotationWhere}`
		)
		.all(...(assetIds ?? [])) as AtlasAssignmentRow[];
	const classifiers = db
		.prepare(
			`select
				atlas_annotations.asset_id,
				atlas_annotations.id as annotation_id,
				atlas_annotation_classifiers.id,
				atlas_annotation_classifiers.classifier_type,
				atlas_annotation_classifiers.classifier_value,
				atlas_annotation_classifiers.status
			 from atlas_annotation_classifiers
			 join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
			 where atlas_annotation_classifiers.status not in ('rejected', 'deprecated')
				${annotationWhere}`
		)
		.all(...(assetIds ?? [])) as AtlasClassifierRow[];
	const annotationConcepts = new Map<string, AtlasAssignmentRow[]>();

	for (const row of [...assetAssignments, ...annotationAssignments]) {
		addAtlasLibraryTag(result, row.asset_id, {
			id: row.id,
			slug: row.slug,
			label: row.label,
			expression: row.slug,
			kind: row.kind,
			category: row.category,
			displayGroup: row.display_group,
			status: row.concept_status,
			maturity: row.maturity,
			assignmentStatus: row.assignment_status,
			scope: row.annotation_id ? 'annotation' : 'asset'
		});
		if (row.annotation_id) {
			const concepts = annotationConcepts.get(row.annotation_id) ?? [];
			concepts.push(row);
			annotationConcepts.set(row.annotation_id, concepts);
		}
	}

	for (const classifier of classifiers) {
		const expressions = [
			`${classifier.classifier_type}:${classifier.classifier_value}`,
			...(annotationConcepts.get(classifier.annotation_id) ?? []).map(
				(concept) => `${concept.slug}.${classifier.classifier_type}:${classifier.classifier_value}`
			)
		];
		for (const expression of expressions) {
			addAtlasLibraryTag(result, classifier.asset_id, {
				id: `${classifier.id}:${expression}`,
				slug: expression,
				label: expression,
				expression,
				kind: 'classifier',
				category: classifier.classifier_type,
				displayGroup: 'Classifiers',
				status: 'active',
				maturity: 'usable',
				assignmentStatus: classifier.status,
				scope: 'annotation'
			});
		}
	}

	return result;
}

function addAtlasLibraryTag(
	target: Map<string, LibraryAtlasTag[]>,
	assetId: string,
	tag: LibraryAtlasTag
) {
	const tags = target.get(assetId) ?? [];
	if (!tags.some((item) => item.expression === tag.expression)) tags.push(tag);
	target.set(assetId, tags);
}

function assetRefsForIds(db: ReturnType<typeof openLibraryDatabase>, assetIds: string[]) {
	if (!assetIds.length) return [];
	return db
		.prepare(
			`select project_id, asset_id from project_asset_refs
			 where asset_id in (${sqlPlaceholders(assetIds.length)})`
		)
		.all(...assetIds) as ProjectAssetRefRow[];
}

function sqlPlaceholders(count: number) {
	return Array.from({ length: count }, () => '?').join(', ');
}

function nonNegativeInteger(value: string | null | undefined) {
	const parsed = Number.parseInt(value ?? '0', 10);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function tagsForAssetId(db: ReturnType<typeof openLibraryDatabase>, assetId: string) {
	const rows = db
		.prepare(
			`select
				asset_tags.asset_id,
				tags.id,
				tags.facet_id,
				tag_facets.name as facet_name,
				tag_facets.slug as facet_slug,
				tags.value,
				tags.name,
				tags.slug,
				(select count(*) from asset_tags as tag_count where tag_count.tag_id = tags.id)
					as asset_count
			 from asset_tags
			 join tags on tags.id = asset_tags.tag_id
			 join tag_facets on tag_facets.id = tags.facet_id
			 where asset_tags.asset_id = ?
			 order by tag_facets.slug, tags.value`
		)
		.all(assetId) as TagRow[];
	return rows.map(mapTag);
}

function projectMembershipByAssetId(
	assets: MembershipAssetRow[],
	folderById: Map<string, FolderRow>,
	assetRefs: ProjectAssetRefRow[],
	folderRefs: ProjectFolderRefRow[]
) {
	const membership = new Map<string, string[]>();
	const assetById = new Map(assets.map((asset) => [asset.id, asset]));
	for (const ref of assetRefs) {
		if (assetById.has(ref.asset_id)) addMembership(membership, ref.asset_id, ref.project_id);
	}
	for (const ref of folderRefs) {
		const folder = folderById.get(ref.folder_id);
		if (!folder) continue;
		for (const asset of assets) {
			if (!asset.folder_id) continue;
			const assetFolder = folderById.get(asset.folder_id);
			if (!assetFolder) continue;
			if (assetFolder.id === folder.id) {
				addMembership(membership, asset.id, ref.project_id);
			} else if (ref.include_subfolders && assetFolder.path.startsWith(`${folder.path}/`)) {
				addMembership(membership, asset.id, ref.project_id);
			}
		}
	}
	return membership;
}

function projectCoverPreviews(projects: ProjectRow[]) {
	const coverIds = uniqueStrings(
		projects.map((project) => project.cover_asset_id).filter((id): id is string => Boolean(id))
	);
	if (!coverIds.length) return new Map<string, string | null>();
	const db = openLibraryDatabase();
	try {
		const rows = db
			.prepare('select * from assets where id in (select value from json_each(?))')
			.all(JSON.stringify(coverIds)) as AssetRow[];
		return new Map(rows.map((asset) => [asset.id, mapImage(asset).previewUrl]));
	} finally {
		db.close();
	}
}

function uniqueStrings(values: string[]) {
	return [...new Set(values)];
}

function addMembership(map: Map<string, string[]>, assetId: string, projectId: string) {
	const existing = map.get(assetId) ?? [];
	if (!existing.includes(projectId)) map.set(assetId, [...existing, projectId]);
}

function projectCountsById(membership: Map<string, string[]>) {
	const counts = new Map<string, number>();
	for (const projects of membership.values()) {
		for (const projectId of projects) counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
	}
	return counts;
}

function mapProject(
	project: ProjectRow,
	assetCount: number,
	folderRefs: ProjectFolderRefRow[],
	assetPreviewById: Map<string, string | null>
): LibraryProject {
	return {
		id: project.id,
		name: project.name,
		description: project.description,
		pinned: Boolean(project.pinned),
		coverAssetId: project.cover_asset_id,
		coverPreviewUrl: project.cover_asset_id
			? (assetPreviewById.get(project.cover_asset_id) ?? null)
			: null,
		assetCount,
		folderCount: folderRefs.filter((ref) => ref.project_id === project.id).length,
		createdAt: project.created_at,
		updatedAt: project.updated_at
	};
}

function mapTagFacets(facets: TagFacetRow[], tags: TagRow[]): LibraryTagFacet[] {
	const tagsByFacet = new Map<string, LibraryTag[]>();
	for (const tag of tags) {
		const list = tagsByFacet.get(tag.facet_id) ?? [];
		list.push(mapTag(tag));
		tagsByFacet.set(tag.facet_id, list);
	}

	return facets
		.map((facet) => ({
			id: facet.id,
			name: facet.name,
			slug: facet.slug,
			tagCount: facet.tag_count,
			kind: facet.slug === 'general' ? ('general' as const) : ('facet' as const),
			tags: tagsByFacet.get(facet.id) ?? []
		}))
		.sort((a, b) => {
			if (a.slug === 'general') return -1;
			if (b.slug === 'general') return 1;
			return a.name.localeCompare(b.name);
		});
}

function mapTag(row: TagRow): LibraryTag {
	return {
		id: row.id,
		facetId: row.facet_id,
		facetName: row.facet_name,
		facetSlug: row.facet_slug,
		value: row.value,
		name: row.name,
		slug: row.slug,
		assetCount: row.asset_count
	};
}

function splitPath(path: string) {
	return path.split('/').filter(Boolean);
}

function urlHostname(value: string) {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return null;
	}
}

function cleanString(value: string | null | undefined) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
