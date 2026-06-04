import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLibraryPaths } from './paths';
import { openLibraryDatabase } from './schema';
import type {
	LibraryAsset,
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

export function getLibrarySnapshot(): LibraryResponse {
	const db = openLibraryDatabase();
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
	const assets = db.prepare('select * from assets order by imported_at desc').all() as AssetRow[];
	const tagsByAsset = tagsByAssetId(db);
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
	const projects = db.prepare('select * from projects order by updated_at desc').all() as ProjectRow[];
	const projectAssetRefs = db
		.prepare('select project_id, asset_id from project_asset_refs')
		.all() as ProjectAssetRefRow[];
	const projectFolderRefs = db
		.prepare('select project_id, folder_id, include_subfolders from project_folder_refs')
		.all() as ProjectFolderRefRow[];
	db.close();
	const projectMembership = projectMembershipByAssetId(
		assets,
		folderById,
		projectAssetRefs,
		projectFolderRefs
	);
	const projectAssetCounts = projectCountsById(projectMembership);
	const assetPreviewById = new Map(assets.map((asset) => [asset.id, mapImage(asset).previewUrl]));

	return {
		assets: assets.map((asset) =>
			mapAsset(
				asset,
				folderById.get(asset.folder_id ?? ''),
				tagsByAsset.get(asset.id) ?? [],
				projectMembership.get(asset.id) ?? []
			)
		),
		folders: folders.map(mapFolder),
		projects: projects.map((project) =>
			mapProject(project, projectAssetCounts.get(project.id) ?? 0, projectFolderRefs, assetPreviewById)
		),
		tagFacets: mapTagFacets(tagFacets, allTags),
		stats: {
			assets: assets.length,
			projects: projects.length,
			folders: folders.length,
			tags: tagFacets.reduce((sum, facet) => sum + facet.tag_count, 0)
		}
	};
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
	projects: string[]
): LibraryAsset {
	const record = mapAssetRecord(asset, folder, tags, projects);
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
		tags: record.organization.tags.map((tag) => tag.name),
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
	projects: string[]
): LibraryAssetRecord {
	const metadata = parseMetadata(asset.metadata_json);
	const folderPath = folder ? splitPath(folder.path) : ['library', 'unassigned'];
	const image = mapImage(asset);
	const source = mapSource(asset, metadata);
	const facts = mapFacts(metadata);
	const acceptedTagSlugs = new Set(tags.map((tag) => tag.slug));

	return {
		id: asset.id,
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
			sourceTagSuggestions: sourceTagSuggestions(metadata, source.label, acceptedTagSlugs),
			projects,
			favorite: false
		},
		generation: null,
		raw: {
			importer: importerFor(metadata),
			sourceMetadata: metadata?.rawMetadata ?? {}
		}
	};
}

function mapImage(asset: AssetRow): LibraryAssetRecord['image'] {
	const originalAvailable = Boolean(asset.original_path && localFileAvailable(asset.original_path));
	const thumbnailAvailable = Boolean(asset.thumbnail_path && localFileAvailable(asset.thumbnail_path));
	const localThumbUrl = thumbnailAvailable ? imageApiUrl(asset.id, 'thumb') : null;
	const localOriginalUrl = originalAvailable ? imageApiUrl(asset.id, 'original') : null;
	const referenceUrl =
		asset.storage_mode === 'url_reference' || asset.storage_mode === 'lazy_download'
			? asset.source_image_url
			: null;

	return {
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

function importerFor(metadata: LibraryImportMetadata | null): LibraryAssetRecord['raw']['importer'] {
	if (metadata?.sourceType === 'museum' || metadata?.sourceId === 'met') return 'explore';
	if (metadata?.sourceId === 'artic' || metadata?.sourceId === 'wikidata') return 'explore';
	return 'extension';
}

function localFileAvailable(relativePath: string) {
	return existsSync(join(resolveLibraryPaths().root, relativePath));
}

function imageApiUrl(id: string, variant: 'thumb' | 'original') {
	return `/api/library/assets/${encodeURIComponent(id)}/image?variant=${variant}`;
}

function knownSource(domain: string | null):
	| { label: string; type: LibrarySourceType; sourceId: string }
	| null {
	if (!domain) return null;
	const normalized = domain.replace(/^www\./, '');
	if (normalized.endsWith('deviantart.com')) {
		return { label: 'DeviantArt', type: 'artist_site', sourceId: 'deviantart' };
	}
	if (normalized.endsWith('novelai.net')) {
		return { label: 'NovelAI', type: 'ai_generator', sourceId: 'novelai' };
	}
	if (normalized.endsWith('metmuseum.org')) return { label: 'The Met', type: 'museum', sourceId: 'met' };
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

function tagsByAssetId(db: ReturnType<typeof openLibraryDatabase>) {
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
			 order by tag_facets.slug, tags.value`
		)
		.all() as TagRow[];
	const map = new Map<string, LibraryTag[]>();
	for (const row of rows) {
		const tags = map.get(row.asset_id ?? '') ?? [];
		tags.push(mapTag(row));
		map.set(row.asset_id ?? '', tags);
	}
	return map;
}

function projectMembershipByAssetId(
	assets: AssetRow[],
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
			} else if (
				ref.include_subfolders &&
				assetFolder.path.startsWith(`${folder.path}/`)
			) {
				addMembership(membership, asset.id, ref.project_id);
			}
		}
	}
	return membership;
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
