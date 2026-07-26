# Artist Profile Editing Design

## Goal

Make Atlas artist entities curatable inside the existing Atlas Wiki surface. Artist profiles should remain part of Atlas rather than becoming a separate admin area.

## Scope

This slice adds read/write editing for artist profile metadata and simple synonym/link curation:

- Summary and notes.
- Style, movement, common subject, and media lists.
- Historical period.
- AI tagging guidance.
- Aliases used for artist search and deduplication.
- Profile links used for username/profile URL matching.

Full artist merge workflows are out of scope. Search should immediately benefit from added aliases and links, but merging two existing artist entities into one deserves its own careful pass.

## Architecture

The server will add a focused PATCH path to `src/routes/api/atlas/entities/[kind]/[slug]/+server.ts`, backed by helpers in `src/lib/server/atlas/entityProfile.ts`. Updates will write the existing `atlas_entity_profiles`, `atlas_entity_aliases`, and `atlas_entity_links` tables, then return the same `AtlasEntityProfile` shape used by the current GET endpoint.

The UI will extend the current artist profile branch in `src/lib/components/atlas/AtlasWiki.svelte`. It will use a compact edit mode similar to concept wiki editing, with newline/comma-separated list fields for profile lists and small controls for aliases and profile URLs.

## Validation

The API will reject unsupported entity kinds and missing entities with the current route semantics. List fields will be normalized by trimming empty entries and deduplicating case-insensitively. Alias normalization and profile URL normalization will reuse existing artist identity rules so search behavior stays consistent.

## Testing

Tests will cover:

- Updating profile fields through the route.
- Adding aliases and profile links through the route.
- Confirming new aliases/profile usernames resolve in `artist:(...)` search.
- Existing GET behavior and full Svelte type checking.
