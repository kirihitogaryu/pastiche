# Artist Resolution Pickers Design

## Goal

Reduce duplicate artist entities by making existing artist identities easy to choose wherever artist metadata is entered or imported.

## Scope

This pass covers artist suggestion/search and picker integration. It does not implement artist merge, artist review queues, or external artist enrichment.

## Behavior

- Add an artist suggestion API that searches artist labels, slugs, aliases, and profile usernames.
- Suggestions show enough context to make a choice: label, slug, work count, matching alias/profile username, and source links.
- The extension import artist field remains editable, but typing opens existing artist suggestions.
- Selecting an artist in the extension updates the visible artist text and carries profile URL/username hints when available.
- Atlas metadata entity add flow gets artist suggestions when adding `kind=artist`.
- Existing artist links in Atlas keep opening artist profiles.
- Artist profile source evidence becomes more readable by showing source label/host, username, confidence, and first-seen/last-seen details where available.

## Data Flow

The server reads artist entities from `atlas_entities`, joins aliases from `atlas_entity_aliases`, links from `atlas_entity_links`, and work counts from `atlas_asset_entities`. It returns a lightweight suggestion payload. UI components consume the same payload rather than inventing separate matching rules.

## Validation

The suggestion API rejects unsupported kinds. Empty queries return the most-used artists by work count. Non-empty queries rank exact label/slug matches first, then aliases, then usernames, then substring matches.

## Testing

- Unit tests for artist suggestion matching/ranking.
- Route tests for `/api/atlas/entities/suggest?kind=artist&q=...`.
- Component-level verification through `npm run check`.
- Focused extension/sidebar tests where existing metadata state helpers change.
