# Extension Import Tags And Artist Entities Design

Date: 2026-06-30

## Purpose

The extension import workbench now captures high-quality image candidates and editable metadata. The next step is making imported images enter Pastiche with useful, user-verified tags and creator metadata.

This design covers three related capabilities:

1. Manual Pastiche tag entry with as-you-type suggestions.
2. Source tag extraction from structured webpage tags.
3. Artist entity groundwork for later Atlas artist pages and alias matching.

The first implementation should focus on manual Pastiche tag entry. Source tag extraction and artist entities should be designed now so the first pass does not create a data shape we have to undo later.

## Goals

- Let users add existing Pastiche or Atlas tags from the extension before import.
- Keep import-time tag selection simple: no Atlas search syntax, exclusions, classifiers, or advanced query grammar.
- Store user-selected tags separately from raw page/source tags.
- Require user verification before any scraped source tag becomes an applied Pastiche tag.
- Extract source tags only from structural page signals, not arbitrary keyword guessing.
- Route source artist values toward artist entity matching, not normal tag assignment.
- Prepare for artist aliases and handle-based matching without building full artist pages in the first pass.

## Non-Goals

- Do not build full Atlas artist pages in the first tag-picker pass.
- Do not automatically approve source tags as canonical Atlas concepts.
- Do not infer artist identity from visual style.
- Do not scrape arbitrary page text for keywords.
- Do not parse app initial state blobs when rendered DOM gives reliable structural tag links.
- Do not implement full Atlas search syntax inside the extension.

## Existing Foundations

Relevant existing code:

- `extension/sidebar/components/MetadataEditor.svelte` renders the current metadata fields.
- `extension/shared/candidates.ts` defines `CaptureMetadata`.
- `extension/shared/source-adapters.ts` already extracts simple Danbooru and Tumblr suggested tags and DeviantArt title/artist hints.
- `extension/background/enrich-capture.ts` maps extension metadata into the import payload.
- `src/routes/api/atlas/concepts/+server.ts` exposes concept autocomplete through `searchAtlasConceptsForQuery`.
- `src/lib/server/atlas/mutate.ts` already ranks concept matches by exact slug, alias, prefix, contains, and related matches.
- `docs/atlas/wiki/tagging-rules.md` states that external vocabularies are raw evidence, not approved Atlas tags.
- `docs/atlas/wiki/artist-entity-style-guide.md` states that artist entities are searchable creator records, not normal visual tags.

The first pass should reuse `/api/atlas/concepts?q=<query>&limit=6` rather than building a new search endpoint.

## Data Model Direction

The current `CaptureMetadata` shape has:

```ts
type CaptureMetadata = {
	title: string;
	artist: string | null;
	date: string | null;
	tags: string[];
	suggestedTags: string[];
	description: string | null;
	rawPageTitle: string | null;
	rawAltText: string | null;
};
```

That shape is useful but too ambiguous for the next stage. We should separate user-applied Atlas tags from raw page tags.

Proposed extension metadata additions:

```ts
type CaptureMetadata = {
	title: string;
	artist: string | null;
	date: string | null;
	tags: string[];
	acceptedConceptSlugs: string[];
	suggestedTags: string[];
	sourceTags: SourceTag[];
	description: string | null;
	rawPageTitle: string | null;
	rawAltText: string | null;
};

type SourceTag = {
	source: 'danbooru' | 'deviantart' | 'tumblr' | 'x' | 'bluesky' | 'instagram' | 'generic';
	category: 'tag' | 'artist' | 'character' | 'copyright' | 'meta' | 'hashtag' | 'unknown';
	label: string;
	slug: string;
	url: string | null;
	confidence: 'high' | 'medium' | 'low';
	selectorHint: string;
	deprecated?: boolean;
	count?: number | null;
};
```

For compatibility, `metadata.tags` may continue to exist as a legacy/freeform field during migration, but the extension UI should write user-selected Atlas concepts to `acceptedConceptSlugs`.

## Phase 1: Manual Tag Picker

### User Experience

Replace the extension's current freeform `Tags` textarea with a compact tag picker:

- User types a tag query.
- The extension calls `/api/atlas/concepts?q=<query>&limit=6`.
- Suggestions show slug, label or definition, and match type when helpful.
- Selecting a suggestion adds it as a removable chip.
- Enter accepts the highlighted suggestion when one exists.
- Selected chips are imported with the image.

This field is for final user-applied Pastiche tags. It is not the raw source-tag field.

### Unknown Tags

For the first implementation, prefer existing Atlas concepts only.

If the user types an unmatched value and presses Enter, the UI should:

- keep the text in the input, and
- show "No matching tag" in the suggestion area.

Do not create new Atlas concepts from the extension in the first pass. New concept creation can be added after the Atlas governance flow is clearer.

### Import Behavior

When the user imports an item, `acceptedConceptSlugs` should be sent to Pastiche and applied as approved asset-level Atlas concepts.

The import path should treat these differently from source-derived suggestions because the user explicitly chose them.

Target behavior:

```txt
acceptedConceptSlugs -> atlas_asset_concepts, status approved, evidence observed
sourceTags -> raw import metadata only
suggestedTags -> optional suggestions, not approved assignments
```

For the first pass, all manually selected concepts should use `evidence: observed`. A later UI may let the user choose a different evidence type.

## Phase 2: Source Tag Extraction

Source tags are raw page vocabulary. They should be shown separately from applied Pastiche tags and must require user acceptance before they become actual tags.

### UI Shape

The extension metadata area should eventually have:

- `Tags`: user-applied Pastiche tags.
- `Tag Suggestions`: canonical Atlas concepts matched from source tags.
- `Source Tags`: raw scraped page tags grouped by source/category.

The first source-tag UI can be read-only chips with an "add" button on matched suggestions.

### Matching Rules

Conservative matching only:

1. Exact slug match.
2. Exact label match.
3. Exact alias match.
4. Prefix/contains results only when the user is typing in the manual picker, not automatic source conversion.

Unmatched source tags should remain raw source metadata.

## Source Adapter Rules

### Danbooru

Danbooru exposes stable tag categories and canonical tag slugs.

Selector:

```css
.tag-list.categorized-tag-list li[data-tag-name]
```

Category inference:

```txt
ul.artist-tag-list    -> artist
ul.copyright-tag-list -> copyright
ul.character-tag-list -> character
ul.general-tag-list   -> tag
ul.meta-tag-list      -> meta
```

Extraction:

```ts
{
	source: 'danbooru',
	category,
	label: searchTag.textContent.trim(),
	slug: li.dataset.tagName,
	url: searchTag.href,
	deprecated: li.dataset.isDeprecated === 'true',
	count: numberFromPostCount,
	confidence: 'high',
	selectorHint: '.tag-list.categorized-tag-list li[data-tag-name]'
}
```

Danbooru artist tags should feed artist candidate matching, not normal tag assignment. Character and copyright tags should later feed entity matching.

### DeviantArt

DeviantArt exposes rendered tag links with stable tag attributes.

Selector:

```css
a[data-tagname][href*="/tag/"]
```

Fallback selector:

```css
a[href*="/tag/"]
```

Extraction:

```ts
{
	source: 'deviantart',
	category: 'tag',
	label: anchor.dataset.tagname ?? decodedTagPath,
	slug: normalizeSourceTag(label),
	url: anchor.href,
	confidence: anchor.dataset.tagname ? 'high' : 'medium',
	selectorHint: 'a[data-tagname][href*="/tag/"]'
}
```

DeviantArt title and artist extraction should continue using existing metadata hints where available.

### Tumblr

Tumblr exposes rendered post tag links.

Selector:

```css
a[data-testid="tag-link"][href*="/tagged/"]
```

Extraction:

```ts
{
	source: 'tumblr',
	category: 'tag',
	label: decodedFinalTaggedPathSegment,
	slug: normalizeSourceTag(label),
	url: anchor.href,
	confidence: 'high',
	selectorHint: 'a[data-testid="tag-link"][href*="/tagged/"]'
}
```

Do not parse Tumblr initial state in the first implementation. The rendered DOM is sufficient and lower maintenance.

### Generic HTML

Generic extraction should include:

- `meta[property="article:tag"]`
- `a[rel~="tag"]`
- JSON-LD `keywords` when present and clearly tag-like

Confidence should be `medium` unless the structure is clearly a tag link.

### X, Bluesky, And Instagram

These sites can use hashtag extraction as a medium-confidence fallback.

Rules:

- Prefer anchor links that route to hashtag or search pages.
- Limit text scanning to likely post/caption containers near the captured image.
- Do not scan the entire document for arbitrary `#word` text.
- Store hashtag results as source tags with `category: 'hashtag'`.

Examples:

```txt
#BlackHair -> source tag black_hair
#myart -> source tag myart
```

These remain raw source tags until matched and accepted by the user.

## Phase 3: Artist Entities

Artist pages should be Atlas entities, not normal tags.

The eventual artist model should support:

- canonical display name
- slug
- aliases and historical names
- social handles by source
- external profile links
- roles
- source confirmation guidance
- common media, themes, movements, and subjects
- related artists and entities
- all imported works by that artist in the user's library

First artist-specific implementation should be smaller:

- Extend source adapters to emit artist candidates.
- Add an artist field with as-you-type matching.
- Match by canonical artist slug, alias, and source handle.
- Let unknown artists remain as raw artist text until artist creation/linking exists.

Artist entity pages and alias management should be a separate Atlas implementation after tag import works.

## Error Handling

- If the Pastiche server is offline, manual tag autocomplete should show no suggestions and keep typed/selected chips locally in the tray.
- If `/api/atlas/concepts` fails, the extension should not block import.
- If source-tag extraction fails, capture should still succeed with empty `sourceTags`.
- If a source adapter returns duplicate tags, dedupe by `source`, `category`, and `slug`.
- If a source tag is marked deprecated, preserve it but do not promote it to suggestions automatically.

## Testing

Unit tests:

- Tag picker state helpers add, remove, dedupe, and serialize selected concept slugs.
- Source adapter extraction for Danbooru categorized tags.
- Source adapter extraction for DeviantArt `data-tagname` links.
- Source adapter extraction for Tumblr `data-testid="tag-link"` links.
- Generic HTML extraction for `article:tag` and `rel=tag`.
- Hashtag extraction ignores unrelated document text and handles likely post containers.
- Import enrichment preserves `acceptedConceptSlugs` and `sourceTags`.

Integration tests:

- Extension import payload applies `acceptedConceptSlugs` as approved Atlas concepts.
- Source tags remain raw metadata and do not become approved concepts without user action.
- Manual tag autocomplete uses `/api/atlas/concepts` and displays exact/alias matches first.

Rendered UI checks:

- Tag chips fit in the extension sidebar.
- Suggestions dropdown does not hide the import button.
- Keyboard entry, selection, and removal are usable in a narrow sidebar.

## Implementation Order

1. Add `acceptedConceptSlugs` and `sourceTags` to extension metadata storage and import wire types.
2. Build a small tag picker component for the extension using `/api/atlas/concepts`.
3. Apply selected concepts during import.
4. Add source-tag extraction helpers and tests.
5. Add Danbooru, DeviantArt, and Tumblr source adapters.
6. Add read-only source-tag UI and matched suggestion chips.
7. Design the artist entity implementation as a separate Atlas feature.

## Deferred Decisions

- Unmatched manual tag creation is deferred. First pass only accepts existing Atlas concepts.
- Accepted source-tag matches should remain user-confirmed before becoming asset-level concepts. The exact future UI can be decided during the source-tag phase.
- Artist alias management belongs to the later Atlas artist entity design, not this first implementation plan.
