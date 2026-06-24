# Pastiche Library Metadata And Source Model Design

Date: 2026-06-02

## Purpose

Pastiche Library should preserve where an image came from, what useful metadata was available at import time, and how the user wants to organize it. The current library read layer flattens saved rows into the older mock-era `Asset` UI type, which blurs important distinctions: source versus image host, artwork date versus import date, source tags versus user tags, and local previews versus direct source image URLs.

This design establishes a canonical Library asset read model for the first metadata/source slice. It focuses on making imported assets readable and trustworthy in the inspector before building a full metadata editor.

## Design Goals

- Show a clear human-readable source and make it openable when a source page exists.
- Keep artist/creator simple for now as one display field.
- Preserve the distinction between `Date` for approximate created/produced date and `Imported` for when Pastiche saved the asset.
- Display dimensions reliably.
- Show optional metadata only when it is actually present.
- Inherit Explore source tags as suggestions, not searchable user tags.
- Keep future AI-generation metadata possible without forcing prompts into generic description or tags.
- Introduce a real Library domain model while keeping a compatibility path for existing mock-era UI consumers.

## Canonical Read Model

The server should map stored rows and metadata into a canonical `LibraryAssetRecord`. This record is the source of truth for Library display.

```ts
type LibraryAssetRecord = {
	id: string;
	title: string;
	artist: string | null;
	description: string | null;
	dates: {
		dateDisplay: string | null;
		importedAt: string;
		capturedAt: string;
		modifiedAt: string | null;
	};
	dimensions: {
		width: number;
		height: number;
	};
	source: LibraryAssetSource;
	image: LibraryAssetImage;
	facts: LibraryAssetFacts;
	organization: LibraryAssetOrganization;
	generation: AiGenerationMetadata | null;
	raw: {
		importer: 'explore' | 'extension' | 'manual';
		sourceMetadata: Record<string, unknown>;
	};
};
```

The user-facing inspector label for `dates.dateDisplay` should remain `Date`. The user-facing label for `dates.importedAt` should be `Imported`.

## Source Model

`source` means the human-understandable origin of the image or work. It does not necessarily mean the direct pixel host.

```ts
type LibraryAssetSource = {
	label: string;
	type:
		| 'museum'
		| 'artist_site'
		| 'social'
		| 'gallery'
		| 'ai_generator'
		| 'cdn'
		| 'local'
		| 'unknown';
	pageUrl: string | null;
	imageUrl: string | null;
	imageHost: string | null;
	domain: string | null;
	sourceId: string | null;
};
```

Source resolution should prefer, in order:

1. User-edited source metadata, once edit mode exists.
2. Explore source metadata, such as `The Met` plus the Explore item detail URL.
3. Extension page URL metadata.
4. Known source adapter labels, such as `DeviantArt`, `NovelAI`, or other later adapters.
5. Domain fallback.
6. `Local Library` or `Unknown Source`.

`Open Source` should open `source.pageUrl`. If `source.pageUrl` is missing, the action should be disabled. CDN or image-host domains should only become the source label when no better source information exists.

The inspector may show `Image Host` separately when useful, especially when `source.imageHost` differs from the source page domain.

## Image Model

The image model should expose preview and original semantics directly.

```ts
type LibraryAssetImage = {
	previewUrl: string | null;
	originalUrl: string | null;
	sourceImageUrl: string | null;
	localOriginalAvailable: boolean;
	localThumbnailAvailable: boolean;
};
```

Downloaded imports should use local files first. URL-reference imports should use `sourceImageUrl` for preview and original display. Missing local files should produce `null` local availability and allow the UI to render a clear broken or missing image state.

Thumbnails are previews only. They should not replace or destructively resize the original.

## Metadata Facts

The first version should keep metadata practical and opt-in. General fields are first-class. Source-specific facts are shown only when populated.

```ts
type LibraryAssetFacts = {
	medium?: string;
	type?: string;
	department?: string;
	culture?: string;
	period?: string;
	rights?: string;
};
```

Explore mappings:

- `artistRaw` maps to `artist`.
- `dateDisplay`, `yearStart`, and `yearEnd` map to date metadata.
- `medium`, `mediumCategory`, `objectName`, `department`, `culture`, `period`, and rights/public-domain information map to optional facts.
- `detailUrl`, `source`, and source labels map to `source`.
- `rawMetadata` is preserved under `raw.sourceMetadata`.

Blank optional fields should not be shown in the default inspector. A later edit mode can expose blank optional fields and user-defined fields.

## Tags And Source Tag Suggestions

User organization tags and source-provided tags are separate concepts.

```ts
type LibraryAssetOrganization = {
	folderId: string | null;
	folderPath: string[];
	tags: LibraryTag[];
	sourceTagSuggestions: SourceTagSuggestion[];
	projects: string[];
	favorite: boolean;
};

type LibraryTag = {
	id: string;
	name: string;
	slug: string;
};

type SourceTagSuggestion = {
	name: string;
	slug: string;
	accepted: boolean;
};
```

Library tags are global, searchable, reusable user organization tags. Source tag suggestions are imported context from Explore or future source adapters. They are not searchable by default and do not count as organization tags until accepted.

Clicking an original/source tag should create or reuse a plain global library tag with the same name. Once accepted, it behaves exactly like any other tag. Pastiche does not need to preserve special provenance for accepted tags in the first version.

For the first read-model slice, `metadata_json.tags` can populate `organization.sourceTagSuggestions`. Later, tag tables should store real user tags and asset tag membership.

## AI Generation Metadata

AI-generation details should have their own optional section instead of being forced into description or tags.

```ts
type AiGenerationMetadata = {
	provider: 'novelai' | 'stable_diffusion' | 'midjourney' | 'dalle' | 'unknown';
	prompt: string | null;
	negativePrompt: string | null;
	model: string | null;
	seed: string | number | null;
	sampler: string | null;
	steps: number | null;
	cfgScale: number | null;
	rawParameters: Record<string, unknown>;
	promptTagSuggestions: string[];
};
```

Prompts should be preserved faithfully. Prompt-derived tags should be suggestions, not automatic library tags.

## Inspector Display Rules

The default inspector should show useful populated fields and avoid empty museum-specific placeholders.

Default fields:

- Title.
- Artist, only when present.
- Preview image, with a clear missing-image state when no preview is available.
- Source, with `Open Source` enabled only when `source.pageUrl` exists.
- `Date`, only when `dates.dateDisplay` exists.
- `Imported`.
- Dimensions.
- Optional facts only when populated.
- Library tags.
- Original/source tag suggestions, only when suggestions exist.
- Description, only when present.
- Generation details, only when AI metadata exists.

Example museum import:

```text
Source       The Met
Date         1860s-70s
Medium       Albumen silver print from glass negative
Type         Photograph
Department   Photographs
Imported     May 27, 2026
Dimensions   1600 x 1600
```

Example generic extension import:

```text
Source       DeviantArt
Artist       SomeArtist
Imported     May 27, 2026
Dimensions   1600 x 1600
Image Host   wixmp-ed30a86b8c4ca887773594c2.wixmp.com
```

Example AI-generated image:

```text
Source       NovelAI
Imported     May 27, 2026
Dimensions   832 x 1216
Model        nai-diffusion-4
Seed         123456789
```

Long labels, domains, and metadata values should wrap or truncate gracefully. Source/date/dimensions should not collide in the inspector layout.

## Compatibility Strategy

Existing UI components consume the older global `Asset` type. The first implementation should introduce the canonical Library read model while keeping a compatibility bridge for current cards, grids, and mobile surfaces.

Recommended first implementation shape:

- Add `LibraryAssetRecord` to Library-specific shared types.
- Map database rows into `LibraryAssetRecord` on the server.
- Derive legacy `Asset` fields from the canonical record during the transition.
- Move `AssetInspector.svelte` first to the canonical fields because the inspector is where metadata/source bugs are most visible.
- Keep unrelated browse and mock data changes minimal until the Library surface is ready for a broader type migration.

## First Implementation Slice

Phase 1 should include:

- Server-side row-to-`LibraryAssetRecord` mapper.
- Tests for Explore imports with museum metadata, generic extension imports, URL-reference imports, downloaded local imports, and missing local image files.
- Separate `previewUrl` and `originalUrl` semantics.
- Source label and page URL resolution.
- `Open Source` behavior in the inspector.
- Inspector layout changes for `Date`, `Imported`, optional facts, source versus image host, and original tag suggestions.

Phase 1 should not include:

- A giant metadata editor.
- User-defined custom fields.
- AI metadata extraction.
- Prompt tag parsing.
- Full tag/folder management routes.
- Many-to-many folders.

## Later Storage Evolution

The `assets` table can remain the core table. Later phases should add relational storage for source, metadata, and user tags:

```sql
asset_sources (
	asset_id text primary key references assets(id),
	source_label text,
	source_type text,
	source_id text,
	page_url text,
	image_url text,
	domain text,
	raw_json text
);

asset_metadata (
	asset_id text primary key references assets(id),
	artist text,
	date_display text,
	medium text,
	type text,
	description text,
	rights text,
	object_name text,
	department text,
	culture text,
	period text,
	raw_json text
);

tags (
	id text primary key,
	name text not null,
	slug text not null unique,
	created_at text not null
);

asset_tags (
	asset_id text not null references assets(id),
	tag_id text not null references tags(id),
	primary key (asset_id, tag_id)
);
```

Source tag suggestions can remain in raw/source metadata for the first slice. If later bulk acceptance, deduplication, or source-vocabulary browsing becomes important, add a dedicated `asset_source_tag_suggestions` table.

## Success Criteria

- Imported Explore assets show useful titles, sources, artist/date/facts, and original tag suggestions.
- Generic extension imports do not show raw CDN domains as the primary source when a page URL gives a better source.
- `Date` and `Imported` are distinct in the UI and data model.
- `Open Source` opens the source page and is disabled when no page URL exists.
- The inspector separates source from image host.
- Source tags are visible as suggestions but are not searchable user tags until accepted.
- Existing Library browsing can continue working through a compatibility bridge while the canonical model is adopted.
