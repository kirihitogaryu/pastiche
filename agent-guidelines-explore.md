# Agent Guidelines — Pastiche Explore Feature
## API Connectivity & Normalization

These guidelines define implementation constraints, priorities, and decisions for an AI agent working directly in the Pastiche codebase on the Explore page and its API connector system. Read this fully before writing any code related to Explore.

---

## Stack

- **SvelteKit** — Explore is a page within the main Pastiche app.
- **TypeScript throughout.** All types must be explicitly defined — no `any`.
- **Connectors run server-side** (SvelteKit server routes or load functions) to avoid CORS issues and keep API keys out of the client bundle where applicable.
- **No ORM or database required for Explore** — results are fetched live and cached in memory/IndexedDB. Pastiche's local library storage is a separate concern; do not couple them.

---

## Core Principle

**Normalize the output, not the input.** Every API speaks a different query language. Do not attempt to build a universal query translator. Instead, each connector receives a standard `ExploreQuery` object, picks out the fields it understands, ignores the rest, and returns a normalized `ExploreItem[]`. The UI never talks to an API directly — only to connectors.

---

## Shared Types

Define these in `src/lib/explore/types.ts`. All connectors and all UI components import from here. Do not redefine these types anywhere else.

```typescript
// Every item returned from any source is normalized into this shape.
type ExploreItem = {
  // Identity
  id: string                          // format: "{source}-{nativeId}" e.g. "met-437133"
  source: SourceId
  detailUrl: string                   // link back to source page

  // Core display — these must always be present or explicitly null
  title: string
  artistRaw: string | null            // display string, may include prefix e.g. "Attributed to Rembrandt"
  artistBio: string | null            // e.g. "Dutch, 1853–1890"
  artistNationality: string | null
  dateDisplay: string | null          // human-readable, show as-is e.g. "ca. 1665–1670"
  yearStart: number | null            // integer, may be negative (BCE)
  yearEnd: number | null              // integer, may be negative (BCE)
  medium: string | null               // raw string from source, not normalized
  mediumCategory: MediumCategory | null  // normalized bucket — see Medium Normalization
  objectName: string | null           // "Painting", "Vase", "Photograph"
  department: string | null           // source's own department/category label
  culture: string | null              // e.g. "Afghan", "North African"
  period: string | null               // e.g. "Ming dynasty", "Middle Bronze Age"

  // Images
  thumbUrl: string | null             // for grid cards — never use imageUrl for cards
  imageUrl: string                    // full res or IIIF base URL
  additionalImages: string[]          // additional views of the same object
  isIIIF: boolean                     // true = imageUrl is a IIIF base, construct tile URLs from it

  // Optional flavor — only populate when genuinely present
  description: string | null          // curatorial blurb when available

  // Meta
  tags: string[]
  isHighlight: boolean                // source's editorial "important work" flag, when available
  isPublicDomain: boolean | null      // null = unknown

  // Escape hatch — store anything useful that doesn't fit above
  rawMetadata: Record<string, unknown>
}

type MediumCategory =
  | "oil" | "watercolor" | "tempera" | "fresco"
  | "print" | "drawing" | "photograph"
  | "sculpture" | "textile" | "ceramic"
  | "metalwork" | "glass" | "mixed_media" | "other"

type SourceId = "met" | "artic" | "rijksmuseum" | "cleveland" | "europeana"

// What the UI sends to a connector.
type ExploreQuery = {
  keyword?: string
  artist?: string
  yearFrom?: number
  yearTo?: number
  medium?: string
  department?: string
  publicDomainOnly?: boolean
  hasImageOnly?: boolean        // connectors should default this to true
  isHighlightOnly?: boolean
  color?: string                // hex string — connectors ignore if unsupported
  cursor?: string               // for pagination
  limit: number                 // always set by the UI, typically 20
}

// What a connector returns from search().
type ExplorePage = {
  items: ExploreItem[]
  total: number | null          // null if the source doesn't expose a total count
  nextCursor: string | null     // null if no more pages
}

// Declared by each connector to tell the UI what it supports.
type FilterCapability =
  | "keyword" | "artist" | "year_range" | "medium"
  | "department" | "public_domain" | "has_image"
  | "color" | "is_highlight"

// The interface every connector must implement.
interface SourceConnector {
  id: SourceId
  displayName: string
  supportedFilters: FilterCapability[]
  getDepartments(): Promise<{ id: string; label: string }[]>
  search(query: ExploreQuery): Promise<ExplorePage>
  getById(id: string): Promise<ExploreItem>
}
```

---

## Connector Rules

Each connector lives in `src/lib/explore/connectors/{source}.ts` and exports a single object implementing `SourceConnector`.

**Rules that apply to every connector:**

1. **Always default `hasImages=true`** when calling the source API, unless the user has explicitly disabled it. Imageless results are useless in Pastiche.

2. **Never throw on missing optional fields.** Every field that could be absent must be coalesced to `null` or `[]`. A single malformed API response must not crash the page.

3. **Never pass unsupported query fields to the API.** If a connector doesn't support `color`, it silently ignores `query.color`. It does not error, and it does not pass a garbage parameter to the API.

4. **IDs must be stable and namespaced.** Always `"{source}-{nativeId}"`. The Met's object 437133 is always `"met-437133"`. This is used for deduplication against the local library.

5. **Rate limiting is per-connector.** Implement a simple request queue with configurable concurrency per connector. Do not use a global rate limiter shared across sources. Defaults: Met = 15 concurrent, others = 5 until confirmed safe.

6. **All connector code runs server-side.** No connector should ever be imported into a client-side Svelte component directly. Access connectors through SvelteKit load functions or server routes.

---

## Met Connector — Specific Implementation

The Met is the first connector to implement. Get this right before building the others — it will define the abstraction.

**Base URL:** `https://collectionapi.metmuseum.org/public/collection/v1`
**Auth:** none required.
**Rate limit:** 80 requests/second. Use 15 concurrent object fetches.

### Endpoints Used

| Endpoint | When |
|---|---|
| `GET /search` | Every search query |
| `GET /objects/{id}` | For each ID returned by search |
| `GET /departments` | Once on startup, cached indefinitely |

**Never call `GET /objects` (the full ID dump).** It returns 471k IDs and is not useful for Explore.

### Search Flow

The Met's search returns IDs only, not full records. Every Explore page load is therefore:
1. One `GET /search` call → array of object IDs + total count
2. N parallel `GET /objects/{id}` calls for the current page of IDs

Fetch object details in parallel, up to 15 concurrent. Resolve and normalize each item as its fetch lands — do not wait for all fetches to complete before returning. Stream results to the UI as they arrive.

### Search Parameters

| ExploreQuery field | Met parameter | Notes |
|---|---|---|
| `keyword` | `q` | Required by Met — if empty, use `"*"` |
| `artist` | `artistOrCulture=true&q={artist}` | Searches artist + culture fields together |
| `yearFrom` | `dateBegin` | Integer |
| `yearTo` | `dateEnd` | Integer |
| `medium` | `medium` | Pipe-delimited for multiple values |
| `department` | `departmentIds` | Must be numeric ID, not name — map via departments cache |
| `publicDomainOnly` | `isPublicDomain=true` | Only add when true |
| `hasImageOnly` | `hasImages=true` | Always add unless explicitly false |
| `isHighlightOnly` | `isHighlight=true` | Only add when true |

`color` is not supported by the Met. Ignore it silently.

### Field Mapping

Map Met object fields to `ExploreItem` exactly as follows. Do not deviate.

```typescript
{
  id: `met-${objectID}`,
  source: "met",
  detailUrl: objectURL,

  title: title || "Untitled",
  artistRaw: [artistPrefix, artistDisplayName].filter(Boolean).join(" ") || null,
  artistBio: artistDisplayBio || null,
  artistNationality: artistNationality || null,

  dateDisplay: objectDate || null,
  yearStart: objectBeginDate ?? null,
  yearEnd: objectEndDate ?? null,

  medium: medium || null,
  mediumCategory: normalizeMedium(medium),
  objectName: objectName || null,
  department: department || null,
  culture: culture || null,
  period: period || null,

  thumbUrl: primaryImageSmall || null,
  imageUrl: primaryImage,
  additionalImages: additionalImages ?? [],
  isIIIF: false,

  description: null,            // Met does not provide curatorial descriptions

  tags: tags?.map(t => t.term) ?? [],
  isHighlight: isHighlight ?? false,
  isPublicDomain: isPublicDomain ?? null,

  rawMetadata: {
    dynasty, reign, portfolio,
    artistBeginDate, artistEndDate,
    artistWikidata_URL, artistULAN_URL,
    objectWikidata_URL, constituents,
    accessionNumber, accessionYear
  }
}
```

**Guard against empty image strings.** The Met returns `primaryImage: ""` (empty string, not null) for objects without images. Check `primaryImage && primaryImage.length > 0` before using it. If both `primaryImage` and `primaryImageSmall` are empty, this item should have been filtered by `hasImages=true` — but handle it defensively anyway by skipping the item.

**Do not store or display these Met fields anywhere:** `accessionNumber`, `accessionYear`, `creditLine`, `GalleryNumber`, `isTimelineWork`, `metadataDate`, `repository`, `rightsAndReproduction`, `linkResource`, `dimensions`, `measurements`, `geographyType`, `city`, `state`, `county`, `country`, `region`, `subregion`, `locale`, `locus`, `excavation`, `river`, `artistAlphaSort`, `artistSuffix`, `artistRole`, `artistGender`.

---

## Medium Normalization

Implement `normalizeMedium(raw: string | null): MediumCategory | null` in `src/lib/explore/medium.ts`.

This is a simple lookup, not ML or fuzzy matching. Check if the lowercased raw string contains any of these substrings, in this priority order:

| Contains | Category |
|---|---|
| "oil" | `"oil"` |
| "watercolor" / "watercolour" | `"watercolor"` |
| "tempera" | `"tempera"` |
| "fresco" | `"fresco"` |
| "engraving" / "etching" / "lithograph" / "woodcut" / "print" / "aquatint" | `"print"` |
| "pencil" / "chalk" / "charcoal" / "ink" / "drawing" / "pastel" | `"drawing"` |
| "photograph" / "gelatin" / "albumen" / "daguerreotype" | `"photograph"` |
| "marble" / "bronze" / "terracotta" / "wood" / "ivory" / "cast" / "carved" / "sculpt" | `"sculpture"` |
| "silk" / "wool" / "linen" / "cotton" / "embroid" / "tapestry" / "textile" / "woven" | `"textile"` |
| "ceramic" / "porcelain" / "earthenware" / "stoneware" / "faience" | `"ceramic"` |
| "gold" / "silver" / "copper" / "iron" / "steel" / "brass" / "metal" | `"metalwork"` |
| "glass" | `"glass"` |

If no match: return `"other"` if `raw` is non-null, `null` if `raw` is null.

This covers ~80% of Met records adequately. Do not over-engineer this — it's a display/filter aid, not a classification system.

---

## Filter UI — Capability-Aware Rendering

The filter panel must never silently apply a filter that a source doesn't support.

When one or more sources are active, the filter panel renders filters in three states:

- **Fully supported** (all active sources declare this capability) — render normally.
- **Partially supported** (some active sources declare it) — render with a small indicator: "applies to Met, Art Institute". The filter still works; it's just honest about scope.
- **Unsupported** (no active sources declare it) — hide the filter entirely. Do not grey it out and leave it visible; hide it.

Department pickers are always source-specific. When a source is active, its own department list renders as a source-labelled section. Do not attempt to merge or map departments across sources.

---

## Multi-Source Layout

Two layout modes. Both must be implemented. User can toggle between them.

**Tab mode** (default for search): one tab per active source. Each tab has independent search results, pagination, and loading state. Switching tabs does not re-fetch — results are cached per tab.

**Interleaved mode** (default for browse/no-keyword): sources render as labelled row groups within a single scroll. Each group shows its first page of results with a "show more from [source]" control that expands that source inline. Expanding one source does not affect others.

Both modes share the same underlying pagination state model (see below).

---

## Pagination

Each source maintains its own independent pagination state. Do not attempt to merge pagination across sources.

```typescript
type SourcePaginationState = {
  source: SourceId
  queryHash: string           // hash of the ExploreQuery that produced this state
  cursor: string | null
  exhausted: boolean
  loadedItems: ExploreItem[]
  total: number | null
  loading: boolean
  error: string | null
}
```

- In tab mode: trigger next page when user reaches the bottom of the tab scroll.
- In interleaved mode: trigger next page of a source when user reaches the bottom of that source's visible items.
- When `ExploreQuery` changes (new search), reset all pagination states and start fresh.
- When `queryHash` doesn't match the current query, the cached state is stale — discard and re-fetch.

---

## Caching

**HTTP cache headers:** server routes should set browser cache headers. Search pages use `public, max-age=3600, stale-while-revalidate=86400`; individual object records and departments use `public, max-age=86400, stale-while-revalidate=604800`.

**Server request cache (in-memory, LRU + pending de-dupe):** cache upstream search responses for 1 hour and normalized object records for 24 hours. All connector object/detail fetches should go through `ServerCache.getOrFetch()` so duplicate in-flight requests collapse before touching the upstream API.

**Persistent client cache (IndexedDB via `idb-keyval`):** use the established key namespaces:
- `explore:search:{source}:{queryHash}` for search pages, 1 hour fresh TTL plus a 24 hour stale-while-revalidate window.
- `explore:object:{source}-{nativeId}` for normalized object records, 7 day TTL.
- `explore:thumb:{source}-{nativeId}` for thumbnail bytes, 30 day TTL.

Do not use `localStorage` for Explore API or thumbnail data. It is too small and synchronous for image-heavy browsing.

When a query changes, abort obsolete client-side Explore search, pagination, and prefetch requests with `AbortController`. Do not surface aborts as user-facing errors.

---

## Explore Page — UX Constraints

These are product decisions. Do not change them without explicit instruction.

**Import is only available from the detail view**, not from grid cards. The flow is: grid card click → detail view → import. This is intentional — the detail view is where the user sees full resolution and confirms intent. Do not add import buttons to grid cards.

**"Already in library" state:** when rendering Explore results, check each item's `id` against a Set of locally imported item IDs. If matched, show a subtle indicator on the card ("In library"). In the detail view, replace the import button with "View in library" that navigates to that item in the local library. The local ID Set should be fetched once on Explore page mount and treated as read-only during the session.

**Skeleton loading:** when a search fires, show a skeleton grid immediately using the `total` count returned from the search endpoint (before object detail fetches resolve). Fill in cards as individual fetches resolve. Never show a blank page while fetching.

**Default browse state (no query entered):** show department tiles as an entry point, pre-filtered to `isHighlight=true` for the Met. Do not show a blank search box with no context — new users need a starting point.

**Empty search results:** show an explicit empty state with the query echoed back. Do not show a blank grid.

---

## Build Order

Implement in this order. Do not skip ahead.

1. **Define all shared types** in `src/lib/explore/types.ts`. Get these right before any connector code.
2. **Define the `SourceConnector` interface** and the medium normalization utility.
3. **Implement the Met connector** fully — search, object fetch, field mapping, rate limiting, department fetch.
4. **Implement the filter UI** against the Met connector only. Get capability-aware rendering working.
5. **Implement the grid and detail view** UI components against the Met connector only.
6. **Add the Art Institute connector.** It has different API shape — use it to validate that the abstraction holds without changes to the UI layer. If the UI layer needs changes to accommodate it, fix the abstraction, not the UI.
7. **Add the Rijksmuseum connector** — introduces color filter capability, stress-tests partial filter support rendering.
8. **Add Cleveland and Europeana** — messiest data, good to have normalization solid first.

Do not add a new connector until the previous one is fully working and tested.

---

## IIIF Integration

IIIF (International Image Interoperability Framework) is a set of open standards implemented by many of the institutions Pastiche connects to. Two of its six APIs are relevant here.

### Image API — Integrate Now

When `isIIIF: true` on an `ExploreItem`, `imageUrl` is a IIIF base URL, not a direct image URL. Construct image requests by appending:

```
{imageUrl}/{region}/{size}/{rotation}/{quality}.{format}
```

Example — a 600px wide version of an Art Institute painting:
```
https://www.artic.edu/iiif/2/{identifier}/full/600,/0/default.jpg
```

The practical value for Pastiche is **deep zoom without downloading the full image**. A IIIF server serves any arbitrary region at any resolution — for a reference tool where users want to zoom into brushwork or detail, this means requesting only the tiles the user is actually viewing, not loading a 40MB TIFF. Use **OpenSeadragon** as the tile viewer in the detail view for IIIF sources — it is lightweight, well-maintained, and handles IIIF tile construction natively.

IIIF image sources in the current connector set: Art Institute of Chicago, Rijksmuseum, Europeana, Cleveland. The **Met does not implement IIIF** — their images are plain JPEGs. `isIIIF` must always be `false` for Met items.

Thumb URLs for IIIF sources should always be constructed at a fixed small size (e.g. `full/300,/0/default.jpg`) — never use the base URL directly as a `thumbUrl`.

### Presentation API (Manifests) — Use in Detail View

A IIIF manifest is a structured JSON document describing a complete object: all images including multiple views, metadata, rights, and how images relate to each other. For sources that support it, fetch the manifest in the detail view alongside the regular API data.

Art Institute manifest URL pattern:
```
https://api.artic.edu/api/v1/artworks/{id}/manifest.json
```

Use the manifest to populate `additionalImages` more completely than the regular API provides — sculpture, drawings, and decorative arts objects often have recto/verso or multiple-angle sequences only exposed in the manifest. Each image in the manifest's canvas sequence is individually importable in the detail view.

**Do not make the manifest fetch load-bearing.** If it fails, fall back to whatever `additionalImages` the regular API provided. The manifest is enrichment, not a required data source.

Do not fetch manifests for grid cards — only on detail view open.

---

## Linked Art — Future Consideration

Linked Art (https://linked.art/api/1.0/) is a standardized JSON-LD schema for describing cultural heritage objects across institutions. Instead of every museum inventing their own field names, Linked Art defines shared patterns: a production event, an artist reference, a time span — consistent across every institution that implements it.

Adopters as of 2026 include Yale, the Rijksmuseum, Getty Research Institute, National Gallery of Art, the Met, MoMA, Frick Collection, Philadelphia Museum of Art, Princeton, Smithsonian, and V&A — real and growing coverage.

**Do not build a Linked Art connector yet.** The standard is solid but the institutions that have adopted it have done so at varying depths, and there is no public cross-institution search endpoint yet. The value proposition — one connector for all Linked Art institutions — does not fully materialize without a search layer, which does not exist as a public service at time of writing.

**Do store Linked Art data when encountered.** When a source returns JSON-LD that follows the Linked Art model, store the raw response in `rawMetadata` intact. Do not discard it. When Linked Art search infrastructure matures — likely within one to two years given the adoption trajectory — a proper connector can be added without having lost any data. The `SourceConnector` interface already accommodates it.

The relationship between the two standards: **IIIF handles the images, Linked Art handles the knowledge about those images.** Pastiche's architecture is aligned with both and should remain so.

---

## What Not To Do

- Do not import connectors in client-side Svelte components — all connector calls go through server routes or load functions.
- Do not attempt to unify or cross-map department taxonomies across sources. Each source's departments are independent.
- Do not show a filter and silently ignore it when the active source doesn't support it — hide it.
- Do not wait for all object detail fetches to resolve before rendering — stream results to the UI as they land.
- Do not use `width` / `height` HTML attributes anywhere in image handling — always natural dimensions.
- Do not add import buttons to grid cards — import is detail-view only.
- Do not call `GET /objects` (the Met's full ID dump endpoint) — it is not useful for Explore.
- Do not store API keys in client-side code — all authenticated connector calls run server-side.
- Do not hardcode department IDs — fetch from `/departments` on startup and cache.
- Do not normalize medium strings with fuzzy matching or ML — use the simple substring lookup table defined above.
- Do not couple Explore's caching or state to Pastiche's local library storage — they are separate concerns.
- Do not use a IIIF base URL directly as a `thumbUrl` — always construct a sized URL explicitly.
- Do not set `isIIIF: true` on Met items — the Met does not implement IIIF.
- Do not fetch IIIF manifests for grid cards — manifests are detail-view only.
- Do not make the IIIF manifest fetch load-bearing — always fall back to regular API data if it fails.
- Do not build a Linked Art connector until a public cross-institution search endpoint exists — store Linked Art JSON-LD in `rawMetadata` and wait.

---

## File Structure (Suggested)

```
src/lib/explore/
  types.ts                    # all shared types — ExploreItem, ExploreQuery, etc.
  medium.ts                   # normalizeMedium() utility
  server-cache.ts             # server TTL cache + pending request de-dupe
  client-cache.ts             # IndexedDB search/object/thumb cache helpers
  iiif.ts                     # IIIF URL construction helpers + manifest fetching
  connectors/
    met.ts                    # Met connector
    artic.ts                  # Art Institute connector
    rijksmuseum.ts            # Rijksmuseum connector
    cleveland.ts              # Cleveland connector
    europeana.ts              # Europeana connector
    index.ts                  # connector registry — maps SourceId to connector instance

src/routes/explore/
  +page.svelte                # Explore page
  +page.server.ts             # server load — initial data, department fetch
  api/
    search/+server.ts         # POST handler — proxies to connector search()
    item/[id]/+server.ts      # GET handler — proxies to connector getById()
    departments/+server.ts    # GET handler — returns departments per source

src/lib/components/explore/
  ExploreGrid.svelte           # grid of ExploreCards
  ExploreCard.svelte           # individual result card
  ExploreDetail.svelte         # full detail view + import trigger
  IIIFViewer.svelte            # OpenSeadragon wrapper for IIIF deep zoom
  FilterPanel.svelte           # capability-aware filter UI
  DepartmentBrowser.svelte     # default browse entry point
  SourceTabs.svelte            # tab mode layout
  InterleavedLayout.svelte     # interleaved mode layout
```
