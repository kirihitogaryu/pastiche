# Artist Entities Design

## Goal

Make artists first-class Atlas entities without turning them into a separate app surface. Artist entities should behave like classifiers: distinct enough to have their own fields, search behavior, and editing rules, but still part of the same Atlas wiki/search/library flow.

The primary user goals are:

- find artists easily by canonical name, username, alias, profile URL, or `artist:(name)` search
- document who made a work without turning artist names into ordinary visual tags
- merge many usernames and source profiles into one artist identity when the evidence is strong
- browse every imported work by a known artist from search, Atlas inspect, Library, and the entity wiki

## Product Shape

Artists remain Atlas entities with `kind = "artist"`. The existing Atlas metadata panel, wiki, and search surfaces should link to artist entities instead of creating a separate Artists section.

Artist pages are an entity mode of the Atlas wiki. They should share the visual language and navigation model of Atlas wiki pages, but render artist-specific fields and a works grid instead of tag-specific usage examples/counterexamples.

Artist pages should show:

- canonical display name
- aliases and usernames
- source/profile links
- short notes or biography
- movements, styles, common subjects, historical period, media, and other artist-specific descriptors
- a grid of imported works attached to the artist entity, showing up to the available count
- links/actions to run Atlas search for that artist

Artist pages should not need a "bad examples" section. Showing the artist's imported works is sufficient for the first pass.

## Data Model

Keep `atlas_entities` as the canonical identity row:

- `kind`: `artist`
- `slug`: canonical slug
- `label`: canonical display name
- `external_url`: optional primary profile URL, retained for compatibility

Add entity-oriented profile tables rather than overloading `atlas_wiki_entries`, which is concept/tag-oriented.

`atlas_entity_profiles`:

- `entity_id`
- `summary`
- `notes`
- `movements_json`
- `styles_json`
- `common_subjects_json`
- `historical_period`
- `media_json`
- `ai_guidance`
- `updated_at`

`atlas_entity_aliases`:

- `entity_id`
- `alias`
- `normalized_alias`
- `source`
- `confidence`
- `created_at`

`atlas_entity_links`:

- `entity_id`
- `url`
- `normalized_url`
- `host`
- `username`
- `source_label`
- `confidence`
- `first_seen_asset_id`
- `last_seen_at`
- `created_at`

The profile fields can start as plain strings/string arrays. Later, movement/style/common-subject values can link to Atlas concepts where useful, but that should not block the first pass.

## Import Behavior

When importing an asset with artist metadata, Pastiche should:

1. Resolve or create an `artist` entity.
2. Attach the asset to that entity via `atlas_asset_entities`.
3. Record source profile links/usernames in `atlas_entity_links` when available.
4. Record observed usernames/handles in `atlas_entity_aliases`.
5. Avoid unsafe merges when only a loose display name matches.

Resolution priority:

1. Exact normalized profile URL match.
2. Same host plus same normalized username.
3. Existing source-specific alias with high confidence.
4. Exact canonical slug/label match.
5. Otherwise create a new artist entity or queue a possible merge for review.

Imports should preserve provenance. For example, an artist inferred from a DeviantArt byline should record that provenance separately from an artist typed manually by the user.

## Username And URL Synonyms

Usernames and profile URLs are identity evidence, not ordinary tags.

Examples:

- `https://www.deviantart.com/exampleartist`
- `@exampleartist`
- `exampleartist`
- `https://twitter.com/exampleartist`
- `https://x.com/exampleartist`

These may all point to the same artist, but source and host matter. The system should merge automatically only when the URL/username evidence is strong. Ambiguous display-name matches should be reviewable.

The first implementation should normalize common social/profile URLs:

- DeviantArt profile URLs
- Tumblr blog URLs
- X/Twitter profile URLs
- Instagram profile URLs
- Bluesky profile URLs
- Danbooru artist tag/profile URLs where available
- Wikipedia/Wikidata links for historical artists

## Search Behavior

Artist search should be integrated with Atlas search.

Required syntax:

- `artist:(picasso)`
- `artist:(cakiada)`
- `artist:(@exampleartist)`

Plain text search for an artist name should also surface artist entity results, similar to how current search can surface entity/claim matches. Searching `picasso` should show:

- matching imported works
- an artist/entity result card
- artist-specific metadata where available

The artist result card should include:

- name
- aliases or profile hosts
- movement/style/period snippets when present
- imported work count
- a few thumbnail previews

Selecting an artist search result should open the Atlas entity wiki mode for that artist. The result card should also offer a secondary "show works" action that runs the equivalent `artist:(slug)` asset search.

## Linking

Every artist mention that has an entity should be clickable:

- Atlas metadata panel artist rows
- Library inspector artist/creator display
- imported asset detail views
- search result metadata
- entity wiki cross-links

Missing artist entities should degrade gracefully. Plain text can remain plain text until the artist is resolved.

## UI Integration

Do not create a separate top-level Artist app surface for the first pass.

Use the existing Atlas surfaces:

- Atlas wiki gets entity mode rendering for artist entities.
- Atlas search gets artist result rows/cards.
- Atlas inspect links source artist entities to the entity wiki.
- Library inspector links artist metadata when an entity exists.

This should feel like a more capable Atlas wiki/search mode, not a new navigation system.

## AI Tagging Boundary

AI can help later by suggesting:

- likely style/movement descriptors
- common subject summaries
- profile-page summaries
- possible duplicate artist identities

AI should not silently merge artists. AI-suggested aliases, links, styles, movements, and subjects should be reviewable.

## First Implementation Slice

The first implementation should stop before broad AI enrichment.

Scope:

1. Add entity profile, alias, and link storage.
2. Update extension/import ingestion to record artist profile URLs/usernames where available.
3. Add artist entity resolution by profile URL, host+username, alias, and exact canonical name.
4. Add API reads for an artist entity profile plus imported works.
5. Make Atlas metadata artist/entity rows open the artist entity wiki mode.
6. Add `artist:(...)` search behavior and artist result cards.
7. Add tests for URL/username synonym resolution and artist-work browsing.

Out of scope for first slice:

- automatic AI enrichment
- complex merge-review UI
- fully curated historical-artist biographies
- a separate artist navigation section
