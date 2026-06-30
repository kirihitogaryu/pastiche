# Atlas Search Mechanics, Tag Search, and Sidebar Behavior

## Status

Draft for implementation planning.

This document extends the Atlas search browser design with the actual search mechanisms: query syntax, classifier search, implication handling, result ranking, query explanations, and adaptive sidebar behavior.

## Product Goal

Atlas search should feel like a precise research instrument, not a generic text filter.

The search bar is the primary query builder. Sidebar controls, autocomplete suggestions, and editable pills should all modify the same underlying query model. A user should be able to search by typing, clicking related concepts, or editing pills without hidden filter state appearing elsewhere.

The core user promise:

- search terms understand Atlas concepts, aliases, entities, claims, classifiers, implications, evidence, and visual roles
- classifiers stay relational, so `shirt.color:blue` is different from `shirt blue`
- source metadata stays separate from observed visual content
- exclusions remove direct and automatically implied matches
- result explanations make the matching logic visible

## Query Model

Atlas search should compile user text into typed query clauses.

Recommended internal shape:

```ts
type AtlasQueryClause =
	| { kind: 'concept'; slug: string; mode: 'include' | 'exclude' }
	| {
			kind: 'classifier';
			target: string;
			classifier: string;
			values: AtlasQueryValueExpr;
			mode: 'include' | 'exclude';
	  }
	| { kind: 'entity'; entityKind?: string; slug: string; mode: 'include' | 'exclude' }
	| { kind: 'claim'; claimKind: string; value: string; mode: 'include' | 'exclude' }
	| { kind: 'role'; include?: string[]; exclude?: string[] }
	| { kind: 'evidence'; include?: string[]; exclude?: string[] };

type AtlasQueryValueExpr =
	| { op: 'any'; values: string[] }
	| { op: 'all'; values: string[] };
```

The parser should preserve enough source text to explain how each clause was resolved.

## Syntax Rules

Simple terms:

```txt
horse
Picasso
horse saddle
```

Spaces between resolved terms mean `AND` by default.

Exclusion:

```txt
exclude:tree
-tree
exclude:spider
```

Both forms exclude direct matches and automatic implication matches.

Classifiers:

```txt
shirt.color:blue
shirt:blue
horse.coat_color:bay
ball_python.morph:enchi
```

Canonical classifier syntax should use dot notation:

```txt
target.classifier:value
```

Colon shorthand is allowed when Atlas can infer the classifier safely from the target's allowed classifiers:

```txt
shirt:blue -> shirt.color:blue
```

Multi-values:

```txt
ball_python.morph:enchi,albino
ball_python.morph:enchi+albino
```

Comma means `OR`. Plus means combined `AND`.

`ball_python.morph:enchi,albino` returns assets where the target morph is enchi or albino.

`ball_python.morph:enchi+albino` returns assets where the target morph value set contains, directly or by automatic implication, both enchi and albino.

Compound correction:

```txt
blue_shirt -> shirt.color:blue
```

Compound attribute tags should not silently become canonical concepts. Atlas should offer a correction pill when a compound is better represented as a classifier.

Visual role:

```txt
role:focal
role:main
visual_role:focal_point
exclude_role:background_detail,setting_context
```

The UI may expose these as a compact role control, but the query service should represent them as clauses.

## Classifier Semantics

Classifier clauses must match a specific annotation instance.

```txt
shirt.color:blue
```

This should match an annotation that has concept `shirt` and classifier `color = blue`.

It should not match an asset that has a shirt annotation and a separate blue background annotation.

When the target is a named entity with a broader visual form, search should support both if the annotation carries both concepts:

```txt
python_(mythology).state:wounded
serpent.state:wounded
```

This follows the tagging rule that named entities and broad visual forms can coexist on the same annotation.

## Color Semantics

Standalone color searches and relational color searches are distinct.

```txt
blue
```

This should mean the image strongly features blue as a visual/compositional color, color-light-value tag, or later computed color profile.

```txt
shirt.color:blue
```

This should mean a shirt instance is blue.

```txt
shirt blue
```

This is broader than `shirt.color:blue`; it means the asset contains shirt and blue as separate clauses.

## Resolution Pipeline

The search service should resolve each query through these stages:

1. Tokenize the user input while preserving quoted text and punctuation operators.
2. Identify command modes such as `exclude:`, target classifier syntax, role syntax, and claim/entity prefixes.
3. Resolve concepts by exact slug, exact label, alias, prefix, fuzzy match, then relationship-only suggestion.
4. Resolve classifier targets and allowed classifiers from wiki entries.
5. Normalize values through known classifier values, aliases, and automatic implication expansion.
6. Generate corrections for classifier-replaceable compounds such as `blue_shirt`.
7. Produce typed clauses, warnings, unresolved tokens, and suggested alternatives.

Relationship-only matches should not silently become query clauses. They are suggestions.

## Implications

Automatic implications affect matching.

Examples:

```txt
horse -> mammal
mammal -> animal
enchi_albino -> enchi
enchi_albino -> albino
enchi_spider -> spider
```

Inclusion:

```txt
animal
```

Can match `horse` if `horse -> animal` is automatic.

Exclusion:

```txt
exclude:spider
```

Should remove assets with direct `spider` matches and assets whose assigned concepts or classifier values automatically imply `spider`.

Suggested and related relationships must not affect inclusion or exclusion silently. They can rank sidebar suggestions.

## Evidence Handling

Atlas must keep evidence types separate:

- `observed`
- `metadata`
- `prompted`
- `inferred`
- `interpretive`
- `computed`

Default visual search should prioritize observed evidence.

Entity and source searches should prioritize metadata and claims.

Prompt metadata should be searchable, but a prompted token must not count as observed visual evidence unless a visual assignment also exists.

Future syntax can include:

```txt
evidence:observed
prompt:feral
has:ai_metadata
source:met
claim.medium:oil_painting
```

## Ranking

Search should filter first, then rank.

For required clauses, an asset must satisfy every `include` clause unless the clause is unresolved and treated as suggestion-only. Exclusions remove assets before scoring.

Recommended scoring order:

1. annotation concept with `visual_role:focal_point`
2. classifier match on a focal annotation
3. annotation concept with `visual_role:supporting_subject`
4. classifier match on a supporting annotation
5. approved asset-level concept
6. entity match
7. claim/source match
8. prompted metadata match
9. annotation concept with no visual role
10. annotation concept with `background_detail`
11. annotation concept with `setting_context`

Exact query matches should rank above alias matches. Alias matches should rank above fuzzy/prefix matches. Related/confusable matches are suggestions unless explicitly selected.

Multi-clause scoring should reward assets where more clauses are satisfied by focal or supporting annotations, especially when several clauses land on the same annotation.

Example:

```txt
horse saddle
```

An asset with one focal horse annotation and a saddle classifier/object on the same or closely related annotation should rank above an asset with horse as background detail and saddle as a separate incidental object.

## Result Explanations

Every result should return compact explanations.

Examples:

```txt
Matched horse as focal annotation
Matched coat_color:bay on horse
Resolved blue_shirt as shirt.color:blue
Excluded tree because tree matched background_detail
Matched Picasso as source artist entity
Matched spider through implication from enchi_spider
```

The UI should show one primary explanation on the card and expose the rest in inspect/detail views.

## Query UI Behavior

The search input should support typed text and canonical pills.

Autocomplete mode depends on the current token:

- `exclude:` suggests concepts/entities to exclude
- `shirt:` suggests classifier categories or likely values
- `shirt.color:` suggests color values
- `ball_python:` suggests allowed classifier categories
- `ball_python.morph:` suggests morph values
- `blue_shirt` suggests `shirt.color:blue`

Accepted suggestions become editable pills.

The raw text form should remain copyable and shareable. Pill editing should update the canonical text query rather than create a separate hidden state.

## Sidebar Behavior

The left sidebar is an adaptive concept map and query editor, not a generic filter wall.

It has two modes:

### Concept Map Mode

Used for a single dominant concept.

Examples:

- `horse`
- `Picasso`
- `shirt.color:blue` when the target concept is clear

The sidebar is wiki-led and can show curated relationships:

- broader tags
- child/specialist tags
- related objects
- allowed classifiers
- confusables
- movements and themes
- related artists
- works and sources

### Query Facet Mode

Used for multi-clause searches.

Examples:

```txt
horse saddle
shirt.color:blue exclude:tree
Picasso war
ball_python.morph:enchi+albino exclude:spider
```

The sidebar is result-led. It should generate useful refinements from the current result set, using wiki relationships as ranking hints.

For narrow result sets, it can show nearby expansions instead of only refinements.

## Sidebar Item Intent

Sidebar items should not have one hard-coded action by section title.

Each item gets an inferred intent:

```ts
type SidebarItemIntent =
	| 'refine'
	| 'navigate'
	| 'specialize'
	| 'context'
	| 'ambiguous';
```

Intent is derived from:

- current query type
- relationship type
- concept kind
- whether the item is inside the current concept or adjacent to it
- whether adding it would create a valid Atlas clause
- whether it has its own meaningful page/wiki context
- result count and specificity

Primary click uses the best inferred action.

Every item should expose a common action menu:

- Search this tag/entity
- Add to query
- Exclude from query
- Open wiki

If intent confidence is low, default to the action menu instead of guessing.

## Sidebar Examples

For `horse`:

- `coat_color > bay`: add `horse.coat_color:bay`
- `tack > bridle`: add `horse.tack:bridle`
- `pony`: navigate to `pony` by default, with add/exclude menu
- `foal`: navigate to `foal` by default, with add/exclude menu
- `saddle`: add to query by default, because it is a related object refinement
- `donkey`: likely navigate or show confusable context, not add by default

For `Picasso`:

- `Cubism`: add to query as movement/style refinement
- `War`: add to query as theme refinement
- `1930s`: add to query as period refinement
- `Oil Painting`: add to query as medium refinement
- `Georges Braque`: navigate to artist by default
- `Guernica`: navigate to work by default
- `Museo Reina Sofia`: navigate to source/institution by default
- `blue period`: ambiguous; likely action menu or navigate depending on wiki kind

For `Picasso war`:

The sidebar should be result-led. It may surface:

- `Guernica`
- `monochrome`
- `suffering`
- `1930s`
- `anti_war`
- source/institution facets

These suggestions come from the intersection of the result set, not just Picasso's wiki page.

## External Controls

External controls should remain minimal:

- role: any, main subject, exclude background
- results per page: 25, 50, 100, infinite
- sort: relevance, newest, title
- evidence: any, observed only, source metadata only, later

All other controls should edit query clauses.

## API Shape

Suggested endpoints:

```txt
GET /api/atlas/search?q=...&limit=50&cursor=...
GET /api/atlas/search/suggest?q=...&cursorPosition=...
GET /api/atlas/search/parse?q=...
```

The search response should include:

```ts
type AtlasSearchResponse = {
	query: {
		raw: string;
		canonical: string;
		clauses: AtlasQueryClause[];
		warnings: AtlasQueryWarning[];
		corrections: AtlasQueryCorrection[];
	};
	context: {
		mode: 'single_concept' | 'multi_clause' | 'unresolved';
		dominantConcept?: AtlasConceptSummary;
	};
	sidebar: AtlasSidebarSection[];
	results: AtlasSearchResult[];
	page: {
		limit: number;
		nextCursor: string | null;
		totalEstimate: number;
	};
};
```

## First Implementation Scope

Included:

- parser for concepts, exclusions, classifier clauses, comma OR, plus AND, role clauses
- concept resolution through slug, label, alias, prefix
- direct and automatic implication matching
- same-annotation classifier matching
- role-weighted result ranking
- single concept vs multi-clause context mode
- adaptive sidebar sections backed by wiki relationships and result facets
- result explanations

Deferred:

- full free-text search over prose
- prompt metadata search
- computed color search
- vector similarity
- saved searches
- advanced parentheses/Boolean grammar
- agent-facing search packets

## Tests

Parser tests:

- `horse saddle` produces two include concept clauses
- `exclude:tree` and `-tree` produce equivalent exclude clauses
- `shirt.color:blue` produces a classifier clause
- `shirt:blue` resolves to `shirt.color:blue` when color is an allowed classifier
- `blue_shirt` produces a classifier correction
- comma values produce `op: any`
- plus values produce `op: all`

Search service tests:

- `shirt.color:blue` requires shirt and color on the same annotation
- standalone `blue` does not equal `shirt.color:blue`
- `exclude:tree` removes direct and implied tree matches
- `ball_python.morph:enchi+albino` matches a combined implied value
- suggested relationships do not silently include or exclude
- focal annotation matches outrank supporting, asset-level, and background matches

Sidebar tests:

- single concept search uses concept map mode
- multi-clause search uses query facet mode
- classifier values add classifier clauses
- ambiguous sidebar items expose the action menu model
- related artist/work items default to navigation for artist/entity context
