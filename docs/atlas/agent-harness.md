# Atlas Agent Harness

The Atlas agent harness lets Codex run a bounded NanoGPT model job from the terminal while keeping Pastiche in control of validation and application.

The harness is for testing models such as DeepSeek, GLM, Kimi, and JSON-repair models against Atlas packets. It does not apply changes to the database.

## Setup

Set your NanoGPT key locally in `.env.local`:

```txt
NANOGPT_API_KEY=your_key_here
```

`.env.local` is ignored by Git. Do not commit this key.

You can also export the key in the shell for a single session:

```bash
export NANOGPT_API_KEY="..."
```

## Commands

List models:

```bash
npm run atlas:agent -- --list-models
```

Filter the model list:

```bash
npm run atlas:agent -- --list-models --q deepseek
npm run atlas:agent -- --list-models --q vision
```

Run asset tagging against a local Atlas asset:

```bash
npm run atlas:agent -- \
  --job asset-tagging \
  --model deepseek-v4-thinking \
  --asset asset_id_here
```

Run from a saved packet file:

```bash
npm run atlas:agent -- \
  --job asset-tagging \
  --model deepseek-v4-thinking \
  --packet .pastiche/exports/olympia-context.md
```

Run a vocabulary audit:

```bash
npm run atlas:agent -- \
  --job vocabulary-audit \
  --model deepseek-v4-thinking \
  --vocabulary
```

Run wiki drafting from a packet:

```bash
npm run atlas:agent -- \
  --job wiki-draft \
  --model glm-latest \
  --packet .pastiche/exports/wiki-stubs.md
```

Use the default model for a job:

```bash
npm run atlas:agent -- \
  --job asset-tagging \
  --model auto \
  --asset asset_id_here
```

List the built-in model tiers:

```bash
npm run atlas:agent -- --list-model-tiers
```

Show local token usage:

```bash
npm run atlas:agent -- --usage-summary
```

## Outputs

Each run writes a directory under:

```txt
.pastiche/exports/agent-runs/
```

Files:

- `system.txt`: system prompt
- `prompt.txt`: user prompt and context packet
- `response.raw.txt`: raw model text
- `response.full.json`: full NanoGPT API response
- `response.extracted.json`: parsed JSON if extraction succeeded
- `response.extract-error.txt`: written when no parseable JSON object is found
- `usage.json`: token estimate/reported usage, model check result, and budget metadata

Codex or the user can inspect `response.extracted.json`, repair it, and paste it into the Atlas batch editor.

Every successful run also appends one JSON record to:

```txt
.pastiche/exports/agent-runs/token-ledger.jsonl
```

This ledger is local runtime data and ignored by Git.

## Token Discipline

Prefer narrow jobs.

Good:

```txt
Tag this one asset using this scoped context packet.
Draft wiki entries for these five missing tags.
Audit this vocabulary export for possible aliases.
Repair this JSON to match the Atlas batch schema.
```

Bad:

```txt
Research this artwork and build the whole ontology.
Read every Atlas document and tag this image.
Explain everything you are doing.
```

Use `--max-context-chars` to keep packets bounded. The default is 60,000 characters.

For routine tagging, start with a scoped asset packet, not the full vocabulary export.

For duplicate prevention or vocabulary cleanup, use the full vocabulary export.

The harness prints a token preflight before each request:

- prompt characters
- estimated prompt tokens
- requested max output tokens
- model cost classification when available

After each request, the harness records NanoGPT-reported token usage when present. If the API response does not include usage, it records an estimate based on character count.

Default project budget:

```txt
ATLAS_WEEKLY_TOKEN_BUDGET=30000000
ATLAS_WARN_AT_TOKENS=25000000
```

You can override these in `.env.local` or per command:

```bash
npm run atlas:agent -- --usage-summary --budget-tokens 30000000 --warn-at-tokens 25000000
```

Paid model guardrails:

- `--free-only` defaults to true.
- Models marked paid or non-free in NanoGPT metadata are refused before a request is sent.
- Models whose metadata matches `x2` subscription patterns are refused before a request is sent.
- The harness has a built-in allowlist based on the current Atlas model roster.
- `ATLAS_ALLOWED_MODELS` can replace that built-in list with a comma-separated exact model allowlist once the preferred model IDs are known.
- `ATLAS_BLOCKED_MODEL_PATTERNS` can add extra comma-separated regex/string block patterns.
- If a model is absent from metadata, the harness refuses it unless `--allow-unknown-model` is passed.
- If pricing metadata is inconclusive, the harness warns and proceeds.

Example local model policy:

```txt
ATLAS_ALLOWED_MODELS=zai-org/glm-5,deepseek/deepseek-v3.2,deepseek/deepseek-v4-flash,xiaomi/mimo-v2.5
ATLAS_BLOCKED_MODEL_PATTERNS=\\bx2\\b,x2 subscription,subscription x2
```

## Model Roles

The harness uses named tiers instead of roulette:

- `routineText`: ordinary asset tagging, JSON normalization, and wiki drafts.
- `deeperText`: thinking/reasoning models for context-heavy artworks, persistent disappointing results, or difficult distinction/duplication problems.
- `visionSweep`: first-pass visual observation models.
- `visionFallback`: slower or more expensive vision models when the first visual sweep misses important content.

`--model auto` picks a conservative default for the job. Use `--model-tier deeperText` only when the task has significant background/context or earlier results are weak.

GLM-5 is the preferred routine text model for structured draft packets and wiki drafting when the job needs stronger instruction-following and context use. Keep the packet narrow and require strict JSON only.

DeepSeek Thinking is a good candidate for routine asset tagging, duplicate checks, and relationship reasoning.

GLM and Kimi thinking models are escalation choices for longer wiki draft prose, difficult art-historical context, or stubborn schema mistakes. They should receive narrow jobs because they can spend a lot of tokens.

Kimi is worth testing for long-context synthesis.

Cheap fast models may be useful for JSON repair, schema cleanup, and sanity checks.

## Vision

Not every NanoGPT model has vision support. Use the model list command and check the provider metadata before sending images.

Use vision as a separate sweep when possible:

1. Vision model: describe only visible subjects, objects, actions, positions, and visual roles in Atlas batch JSON.
2. Text/reasoning model: normalize that sweep against the vocabulary, add metadata/contextual concepts, and draft missing wiki entries.
3. Pastiche/Codex: validate, canonicalize, and decide what can be applied.

The vision prompt should be much smaller than a full wiki prompt. It should not draft wiki prose or perform art-historical interpretation unless specifically asked.

## Quality Rules For Agent Runs

Use these rules when writing or reviewing packets for external agents.

### Approval Status

`approved` means the slug already exists in the supplied Atlas vocabulary/context packet as a canonical concept.

It does not mean "the model is confident."

If a model invents a useful new tag, the tag must be `needs_review` or `suggested`.

If the packet has no explicit `Relevant Vocabulary` section, no concept or entity should be marked `approved`.

Museum keywords, source metadata tags, current image labels, and vision-model labels are not canonical vocabulary proof.

### New Tags

New tags are allowed when they are useful, distinct, and not better represented as classifiers.

Good new-tag candidates:

```txt
heraldic_shield
scrollwork
floral_ornament
female_nude
```

Bad new-tag candidates:

```txt
dark_background
left_bed
reclining_woman
black_cat
```

Use classifiers instead:

```txt
background + color:black + value:dark
bed + position:left
female_figure + pose:reclining
cat + color:black
```

### Source Prose

Do not turn every named person, artwork, exhibition, or institution from source prose into an entity.

Default entity candidates are:

- creator or maker
- source or holding institution
- depicted named subject
- named fictional or mythological character
- rights/source entity
- context entity the user explicitly requested

Other source prose can become claims when useful.

### Source Keywords

Source keyword lists are hints. They are not automatic Atlas tags.

Only keep a source keyword as a concept when it is visible, central, a real identity/metadata field, or clearly useful for retrieval.

### Text And Signatures

Do not tag `text_region`, signatures, watermarks, labels, or inscriptions unless OCR/text analysis is requested or the text is a focal part of the image.

### Backgrounds

A dark or black background is not a tag.

Use:

```json
{
	"label": "background",
	"concepts": ["background"],
	"classifiers": {
		"visual_role": "setting_context",
		"color": "black",
		"value": "dark",
		"state": "shadowed"
	}
}
```

### Annotation Shape

Every annotation should have a concept and classifier object.

```json
{
	"label": "winged creature",
	"concepts": ["mythological_creature"],
	"classifiers": {
		"visual_role": "focal_point",
		"position": "right"
	}
}
```
