# Atlas Batch Editor Guide

The Atlas batch editor accepts strict JSON only. Do not paste YAML, Markdown, JavaScript objects, comments, trailing commas, or prose around the JSON block.

Use this format when an external AI agent needs to hand Pastiche a database-readable metadata update.

## Required Shape

The root value must be a JSON object. All top-level keys are optional, but unknown keys are ignored by policy and should not be used.

```json
{
	"identity": {},
	"concepts": [],
	"entities": [],
	"claims": [],
	"annotations": []
}
```

## Identity

Use `identity` for plain asset fields.

```json
{
	"identity": {
		"title": "Phoebus Apollo kills the Python",
		"artist": "Antoine Verard",
		"year": "1494",
		"medium": "Book illumination",
		"source": "British Library",
		"rights": "Additional permissions needed for non-editorial use.",
		"description": "Illumination from Ovid's Metamorphoses."
	}
}
```

Do not put visual tags in `identity`.

## Concepts

Use `concepts` for asset-level tags. Prefer annotation concepts when the tag describes a specific visible entity.

```json
{
	"concepts": [
		{ "slug": "book_illumination", "evidence": "metadata", "status": "approved" },
		{ "slug": "greek_mythology", "evidence": "metadata", "status": "approved" }
	]
}
```

Allowed `evidence` values:

- `observed`
- `metadata`
- `prompted`
- `inferred`
- `interpretive`
- `computed`

Allowed `status` values:

- `approved`
- `suggested`
- `needs_review`
- `rejected`
- `deprecated`

To remove an asset-level concept:

```json
{
	"concepts": [{ "slug": "apollo_deity", "action": "remove" }]
}
```

## Entities

Use `entities` for reusable named things that are not ordinary visual tags: artists, works, characters, institutions, sources, places, species, IPs.

```json
{
	"entities": [
		{ "kind": "artist", "label": "Antoine Verard" },
		{ "kind": "institution", "label": "British Library" },
		{ "kind": "character", "label": "Apollo" }
	]
}
```

Allowed entity kinds:

- `artist`
- `work`
- `character`
- `ip`
- `institution`
- `source`
- `place`
- `species`

## Claims

Use `claims` for source or technical facts.

```json
{
	"claims": [
		{ "kind": "date", "value": "1494" },
		{ "kind": "medium", "value": "Illumination; painting; book illumination" },
		{ "kind": "rights", "value": "Additional permissions needed for non-editorial use." }
	]
}
```

Allowed claim kinds:

- `rights`
- `medium`
- `date`
- `dimensions`
- `source_metadata`
- `technical_metadata`
- `ai_generation`

## Annotations

Use `annotations` for specific visible regions or entities in the image.

```json
{
	"annotations": [
		{
			"label": "apollo_archer",
			"concepts": ["apollo_(deity)", "male_figure"],
			"classifiers": {
				"visual_role": "focal_point",
				"action_role": "attacker",
				"pose": "standing",
				"position": "left"
			}
		},
		{
			"label": "python_as_dragon",
			"concepts": ["python_(mythology)", "dragon"],
			"classifiers": {
				"visual_role": "focal_point",
				"state": "wounded",
				"position": "right"
			}
		}
	]
}
```

Allowed `visual_role` values:

- `focal_point`
- `supporting_subject`
- `background_detail`
- `setting_context`

Use `background_detail` for visible objects that should not make the asset a strong example of that tag. Use `setting_context` for place-setting or contextual elements.

## What Will Work

```json
{
	"concepts": [{ "slug": "dragon", "evidence": "observed", "status": "approved" }],
	"annotations": [
		{
			"label": "dragon_body",
			"concepts": ["dragon"],
			"classifiers": {
				"visual_role": "focal_point",
				"position": "right"
			}
		}
	]
}
```

## What Will Not Work

This is invalid because JSON cannot contain comments:

```json
{
	// add the main subject
	"concepts": [{ "slug": "dragon" }]
}
```

This is invalid because JSON cannot use trailing commas:

```json
{
	"concepts": [{ "slug": "dragon" }]
}
```

This is valid JSON but bad Atlas practice because it creates an attribute compound tag:

```json
{
	"concepts": [{ "slug": "red_dragon" }]
}
```

Prefer:

```json
{
	"annotations": [
		{
			"label": "dragon_body",
			"concepts": ["dragon"],
			"classifiers": {
				"color": "red"
			}
		}
	]
}
```

## External AI Agent Prompt Pattern

When asking an external AI agent to draft Atlas metadata, provide:

- the image or source page
- the current known tag list, if available
- the current wiki entry for important tags, if available
- the required JSON shape from this guide
- a rule that observed, metadata, inferred, and interpretive claims must be separated
- a rule that new tags should be minimized and explained

Ask the agent to return only JSON. Paste that JSON into the batch editor and use Parse Preview before applying.

Future Atlas tools should expose a compact "AI context packet" containing canonical slugs, labels, categories, display groups, aliases, allowed classifiers, and common confusables for the currently relevant tag group. That packet would be ideal for web ChatGPT or other non-codebase agents.
