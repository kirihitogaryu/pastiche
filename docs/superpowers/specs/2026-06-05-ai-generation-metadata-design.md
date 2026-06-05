# AI Generation Metadata Design

## Status

Draft for user review.

This document defines how Pastiche should extract, store, display, and search AI generation metadata, starting with NovelAI PNG metadata.

## Product Need

Generated images can contain rich embedded metadata that ordinary image managers ignore. Pastiche should preserve and interpret that metadata because it is useful studio information:

- how the image was made
- which prompt tokens were used
- which style references were invoked
- which model/settings can reproduce or vary it
- which prompt tokens can inform Atlas tag suggestions

Prompt metadata is not visual truth. It is provenance and context.

## Initial Source: NovelAI PNG Metadata

NovelAI PNGs can embed JSON in PNG text chunks.

Observed useful fields:

- `prompt`
- `uc`
- `steps`
- `width`
- `height`
- `scale`
- `cfg_rescale`
- `seed`
- `sampler`
- `noise_schedule`
- `v4_prompt.caption.base_caption`
- `v4_prompt.caption.char_captions`
- `v4_negative_prompt.caption.base_caption`
- `v4_negative_prompt.caption.char_captions`
- `Source`
- `Software`
- raw JSON payload

The parser should preserve unknown fields instead of discarding them.

## Internal Model

Store three layers.

### Raw AI Generation Metadata

The original payload, preserved intact.

Examples:

- raw JSON comment
- PNG text fields
- generator software
- model/source string

### Parsed Generation Settings

Structured reproducibility fields.

Examples:

- generator: NovelAI
- model: NovelAI Diffusion V4.5
- seed: `201933412`
- sampler: `k_euler_ancestral`
- steps: `28`
- scale: `6.0`
- cfg_rescale: `0.4`
- noise_schedule: `karras`
- size: `1024 x 1024`

### Parsed Prompt Index

Searchable prompt tokens and prompt text.

Examples:

- `prompt:feral`
- `prompt:animal_focus`
- `prompt:character_design`
- `prompt:full_body`
- `prompt_artist:nightcrow`
- `negative_prompt:human`
- `negative_prompt:extra_arms`
- `species:canine`

Formatted Danbooru-style keywords become queryable prompt tokens. Unstructured prose is stored and full-text searchable, but should not become structured facets by default.

## Prompt Token Parsing

NovelAI weighted syntax examples:

```txt
1.5::character design::
1.4::feral, animal focus, androgynous, solo::
0.9::artist:nightcrow::
species:canine, wolf
```

Parser output should track:

- token text
- normalized slug
- weight if present
- prompt scope: positive, negative, character positive, character negative
- token role: ordinary, artist/style reference, taxonomy/species, quality, technical, negative constraint
- raw segment
- order

Example:

```txt
token                 weight  scope       role              mapping
character_design      1.5     positive    concept           tag candidate
feral                 1.4     positive    subject/style     tag candidate
artist:nightcrow      0.9     positive    style reference   entity candidate
species:canine        1.4     character   taxonomy prompt   classifier/entity candidate
wolf                  1.4     character   subject prompt    tag candidate
```

## Prompted Evidence

Prompt tokens use `prompted` evidence.

Rules:

- Prompt tokens are searchable.
- Prompt tokens may create Atlas suggestions.
- Prompt tokens do not become approved visual tags automatically.
- Negative prompt tokens are searchable as generation constraints, not absent visual facts.
- `artist:` prompt tokens are style references, not creator claims.

Example:

```txt
artist:nightcrow
kind: style_reference
evidence: prompted
status: suggested
not creator
```

## Atlas Asset Inspect UI

AI generation metadata belongs under the image and above related images.

Collapsed row:

- generator
- model
- seed
- sampler
- prompt token count

Expanded sections:

- Summary
- Prompt Tokens
- Positive Prompt
- Negative Prompt
- Character Prompts
- Raw Payload

Prompt tokens should render as rows. Library inspector can show a small `AI metadata available` summary only.

## Search

Future search fields:

```txt
has:ai_metadata
generator:novelai
model:novelai_v4_5
seed:201933412
prompt:feral
prompt_artist:nightcrow
negative_prompt:human
prompt_scope:character
```

Search result explanations must distinguish prompt matches from visual tags.

## Stable Diffusion Later

Stable Diffusion metadata should be another parser that maps into the same internal model.

Do not make the internal schema NovelAI-only. NovelAI is the first parser because it has rich Danbooru-shaped metadata and matches the user's workflow.

## First Implementation Scope

Included:

- parser for NovelAI PNG text JSON when present
- raw payload preservation
- parsed settings
- parsed prompt token rows
- storage attached to asset ID
- read service for Atlas asset inspect
- unit tests with a fixture payload

Deferred:

- Stable Diffusion parser
- prompt-token-to-tag suggestion approval UI
- full prompt search index
- generator-specific editing
- reproduction/export workflow

