# Pastiche Atlas Metadata and Tag Wiki Design

## Status

Draft for user review.

This document is the source-of-truth design for the first Atlas metadata and tag wiki system. It defines the product stance, governance rules, vocabulary model, wiki standards, AI-agent rules, and phased implementation direction.

It does not define final UI details. It should guide future UI, database, API, search, and agent work.

## Product Position

Pastiche is a local-first artist reference system. The Library remains the practical archive surface: files, folders, projects, imports, saved assets, and ordinary organization.

Atlas is the canonical meaning layer. It describes what assets contain, imply, connect to, and can be used for.

The long-term model is one metadata truth with multiple surfaces:

- Library displays a calm, simple projection of Atlas metadata.
- Inspector exposes more detail when the user needs it.
- Search and filters use Atlas as the source of truth.
- Wiki pages document the vocabulary and teach humans and AI agents how to use it.
- Explore can produce source metadata and tag suggestions, but Atlas decides whether those suggestions become canonical.

The user should not have to think about whether something is a "Library tag" or an "Atlas tag." Library tags should eventually become Atlas-backed metadata assignments.

## Design Goal

Build a metadata system that can become increasingly rich without making the app feel increasingly chaotic.

The default workflow should be:

1. Browse casually.
2. Inspect when useful.
3. Tag progressively.
4. Review uncertain claims.
5. Document new concepts.
6. Search precisely.

Atlas should support deep metadata, but the user should never feel forced to manage an ontology before using the archive.

## Reference Model: Danbooru

Danbooru is a useful reference because it has durable concepts for:

- tag categories
- tag wiki pages
- aliases
- implications
- deprecated tags
- tag groups
- tag search
- tag history and review flows

Pastiche should borrow the precision, not the public-imageboard culture or visual style.

Specific lessons to keep:

- Aliases are for alternate names that mean the same thing.
- Implications are for always-true subset relationships.
- Deprecated tags are useful for blocking bad vocabulary while preserving redirect guidance.
- Wiki pages are the natural place to define usage standards.
- Tag groups are curated domain maps, not pure taxonomies.
- Tag pages should be close to tagging/search workflows.

Specific weaknesses to improve:

- Danbooru makes too many different things tag-shaped.
- Danbooru implications are powerful but can be too blunt.
- Danbooru has limited first-class support for evidence, confidence, and review status.
- Danbooru wiki pages are human-readable but not structured enough for strict AI-agent behavior.
- Danbooru has many compound tags that Pastiche should avoid through classifiers.

## Core Principle

A canonical tag is a reusable research concept with documented usage rules.

If a tag cannot be explained, it should not become canonical yet.

If an AI agent wants to create a tag, it must create a draft wiki page that proves the tag should meaningfully exist.

## Metadata Kinds

Atlas should distinguish five metadata kinds. All five can be searchable, but they should not behave identically.

### Visual Tag

A reusable concept that describes what is visible, how the image is composed, how it reads visually, or what it is useful for as reference.

Examples:

- `horse`
- `shirt`
- `window`
- `standing_pose`
- `crowded_composition`
- `chiaroscuro`
- `somber`
- `costume_reference`

Visual tags can have aliases, implications, related tags, confusable tags, wiki pages, allowed classifiers, and AI rules.

### Entity

A reusable named thing that may be linked to external authority records or source metadata.

Examples:

- artist: Pablo Picasso
- work: Guernica
- institution: The Met
- source collection: Wikimedia Commons
- character: Link
- IP/franchise: The Legend of Zelda

Entities are searchable like tags, but they are not the same kind of claim as `horse` or `shirt`. The UI may show them near tags, but the model should keep them typed.

### Claim

A source-backed or user-entered factual assertion about an asset.

Examples:

- `artist = Pablo Picasso`
- `medium = oil on canvas`
- `year = 1937`
- `rights = public domain`
- `institution = Museo Reina Sofia`

Claims must preserve provenance when possible. A museum record, Wikidata record, user entry, and AI guess are not equal.

### Classifier

A controlled attribute applied to a tag, entity instance, annotation, or visible object.

Examples:

- `shirt.color = blue`
- `horse.coat_color = bay`
- `dress.pattern = striped`
- `background.value = dark`
- `face.view = profile`

Classifiers prevent tag explosion. Pastiche should prefer `shirt + color:blue` over `blue_shirt` unless the compound phrase has independent meaning.

### Computed Metadata

Machine-derived facts and profiles.

Examples:

- dimensions
- file size
- perceptual hash
- duplicate candidates
- OCR text
- dominant colors
- palette temperature
- saturation and contrast level
- image embeddings
- color search vectors

Computed metadata can produce suggestions, but it should not become human-approved interpretation without review.

## Tag Categories

Each visual tag should have one canonical category.

Initial categories:

- `subject`
- `object`
- `clothing`
- `animal`
- `plant`
- `architecture`
- `pose`
- `action`
- `composition`
- `color_light_value`
- `style_movement`
- `medium_technique`
- `period_context`
- `theme`
- `mood`
- `symbol_iconography`
- `reference_use`
- `system`

Entity categories:

- `artist`
- `work`
- `character`
- `ip`
- `institution`
- `source`
- `place`
- `species`

Claim categories:

- `rights`
- `medium`
- `date`
- `dimensions`
- `source_metadata`
- `technical_metadata`

These categories are for governance and search. UI can group them differently.

## Display Groups

The Inspector and Library should display Atlas metadata in readable groups rather than one long tag soup.

Recommended display groups:

- Identity
- Source Metadata
- Subjects
- Actions and Poses
- Objects and Clothing
- Composition
- Color, Light, and Value
- Style and Technique
- Period and Context
- Theme
- Mood
- Reference Use
- Relationships
- System

Display groups are not the same as categories. They are a presentation layer over typed metadata.

## Evidence Types

Every assignment should identify its evidence basis.

### Observed

Visible in the image.

Examples:

- `horse`
- `shirt`
- `standing_pose`
- `monochrome`

### Metadata

Confirmed by source record, museum metadata, Wikidata, file metadata, user entry, or import source.

Examples:

- `artist = Pablo Picasso`
- `medium = oil on canvas`
- `institution = The Met`

### Inferred

Reasonably inferred from visible evidence but not certain.

Examples:

- `silk`
- `mourning_clothes`
- `military_uniform`
- `arabian_horse`

Inferred assignments usually require review.

### Interpretive

Theme, symbolism, mood, or art-historical reading.

Examples:

- `grief`
- `alienation`
- `civilian_suffering`
- `sacred`

Interpretive tags are useful, but they should not be treated like literal object tags.

### Computed

Generated by machine analysis.

Examples:

- `high_contrast`
- `muted_palette`
- `dominant_color:#2a2420`
- `duplicate_candidate`

Computed metadata may suggest tags, but must stay distinguishable from human-approved assignments.

## Assignment Status

The status of a tag or entity is separate from the status of its assignment to an asset.

A tag can be active while a specific assignment remains uncertain.

Assignment statuses:

- `approved`
- `suggested`
- `needs_review`
- `rejected`
- `deprecated`

Example:

```txt
tag: silk
evidence: inferred
confidence: 0.48
status: suggested
note: Fabric has sheen and drape, but source does not confirm material.
```

This distinction is critical. Pastiche should not confuse "this tag is allowed" with "this tag is certainly true for this image."

## Tag Status

Tag statuses:

- `active`
- `suggested`
- `needs_review`
- `deprecated`
- `merged`
- `alias`
- `blocked`

### Active

Approved canonical vocabulary.

### Suggested

Created by user, import, or AI, but not reviewed.

### Needs Review

Exists but lacks sufficient documentation, examples, category clarity, or relationship rules.

### Deprecated

Should no longer be applied. Deprecated tags should include replacement guidance.

Example:

```txt
blue_shirt
deprecated
use: shirt + color:blue
```

### Merged

Combined into another canonical tag.

Example:

```txt
horses
merged_into: horse
```

### Alias

Alternate name for a canonical tag.

### Blocked

Known-bad tag that should not be created or applied.

Useful for misleading, ambiguous, or unwanted vocabulary.

## Wiki Pages

The wiki is not a side feature. It is the governance interface for Atlas.

Every canonical visual tag should eventually have a wiki page. AI-created tags must always begin with a draft wiki page.

Wiki pages should be readable by humans and structured enough for AI agents.

### Wiki Maturity

Wiki maturity controls how much authority a page has.

- `stub`: minimal page; do not auto-apply except exact user request.
- `draft`: enough to discuss; AI may suggest but not auto-apply.
- `usable`: sufficient for normal tagging and search.
- `reviewed`: strong guidance with examples and counterexamples.
- `locked`: stable core concept; changes should be deliberate.

### Required Fields

Every serious wiki page should define:

- slug
- label
- metadata kind
- category
- display group
- short definition
- long description
- use when
- do not use when
- aliases
- blocked/deprecated alternatives
- implied tags
- suggested implications
- parent/broader tags
- child/narrower tags
- related tags
- confusable tags
- allowed classifiers
- example assets
- counterexample assets
- evidence rule
- confirmation requirements
- AI auto-apply rule
- AI review rule
- tag creation burden
- external links
- created by
- reviewed by user
- created at
- updated at

### Required Questions

Every strong tag page should answer:

1. What is this?
2. When should it be used?
3. When should it not be used?
4. What does it imply automatically?
5. What might it suggest but not imply?
6. What classifiers can it take?
7. What is it often confused with?
8. What examples are approved?
9. What counterexamples clarify the boundary?
10. Can AI apply this automatically?
11. Does it require source confirmation or human review?
12. What nearby tags were considered?

## Tag Creation Burden

Not every tag needs the same proof.

Recommended burden levels:

- `low`: obvious visible subject or object, such as `horse`.
- `medium`: common but boundary-sensitive visual concept, such as `cloak`.
- `high`: specialist, historical, symbolic, or technical concept, such as `tenebrism`.
- `expert`: requires source confirmation or domain expertise, such as exact animal breed.
- `blocked_without_review`: too sensitive, ambiguous, or risky for automatic creation.

AI-created tags must include a distinctness argument.

The distinctness argument must explain:

- why an existing tag is insufficient
- which existing tags are similar
- which existing tags are close but not equivalent
- whether a classifier would be better than a new tag
- whether the proposed tag should be visual, entity, claim, classifier, or computed metadata

## Tags vs. Classifiers

Tags name concepts. Classifiers describe attributes of concepts or visible instances.

Use tags for:

- visible objects
- subjects
- poses
- actions
- composition
- style
- movement
- medium and technique
- themes
- mood
- iconography
- reference use
- system review states

Use classifiers for:

- color
- material
- pattern
- position
- view
- orientation
- quantity
- state
- animal coat color
- clothing details
- certainty levels

Avoid compound attribute tags unless they have independent conventional meaning.

Usually avoid:

- `blue_shirt`
- `red_hat`
- `white_horse`
- `striped_dress`

Prefer:

- `shirt + color:blue`
- `hat + color:red`
- `horse + coat_color:white`
- `dress + pattern:striped`

Possible exceptions:

- `blue_jeans`
- `little_black_dress`
- `red_cross`
- `blackletter`
- `green_man`
- `equestrian_portrait`

The wiki page must explain why a compound tag is allowed.

## Aliases

Aliases are for alternate names that mean the same thing as a canonical tag or entity.

Examples:

```txt
horses -> horse
equine -> horse, if used casually
b&w -> black_and_white
metropolitan_museum -> the_met
```

Alias rules:

- Aliases redirect to one canonical record.
- Aliases prevent duplicate tag creation.
- Aliases are not broader/narrower relationships.
- Aliases should preserve searchability for old or imported terms.
- Chained aliases should resolve to the final canonical record.

## Implications and Relationships

Implications are automatic additions. They must be strict.

Correct direction:

```txt
horse -> mammal
horse -> animal
ponytail -> hair
etching -> printmaking
```

Incorrect direction:

```txt
animal -> horse
mammal -> horse
```

That would imply every animal or mammal is a horse.

### Relationship Strength

Pastiche should support three strengths:

- `automatic`: always true enough to apply or resolve silently.
- `suggested`: often useful, but requires confirmation or review.
- `browsing`: related for navigation, not assignment.

Examples:

```txt
ponytail -> hair
strength: automatic

cubism -> modernism
strength: suggested or browsing

horse related_to saddle
strength: browsing
```

### Implication Rules

Automatic implications should be used only when:

- the source concept is a subset of the target concept
- the relationship is always or nearly always true
- edge cases are understood
- both concepts are mature enough
- the change will not pollute search results

Automatic implications should not be used for:

- loose association
- common co-occurrence
- interpretive relationships
- attributes that should be classifiers
- artist-to-style assumptions
- character-to-IP relationships unless deliberately modeled

Before approving an implication, the UI should eventually preview impact:

```txt
This implication would affect 184 assets.
It would add 184 hair assignments.
12 assets already have hair.
3 affected assignments are inferred, not approved.
```

## Tag Groups

Tag groups are curated domain maps. They help humans and agents discover what vocabulary exists around a concept.

A tag group is not necessarily a hierarchy and not necessarily an implication set.

Examples:

- Horse
- Hair
- Clothing
- Dress
- Image Composition
- Color, Light, and Value
- Architecture
- Printmaking
- Public Domain and Rights
- Source Metadata

Tag groups should include:

- overview
- included tags
- child and specialist tags
- allowed classifiers
- related objects
- common actions
- common confusables
- deprecated alternatives
- example queries
- AI guidance notes

### Horse Tag Group Example

The `horse` wiki/tag group should show the local vocabulary around horses.

Core tag:

```txt
horse
```

Possible broader tags:

```txt
animal
mammal
equine
domesticated_animal
```

Possible child/specialist tags:

```txt
pony
foal
draft_horse
warhorse
carousel_horse
arabian_horse
thoroughbred
```

Some child/specialist tags require source confirmation or specialist review.

Related objects:

```txt
saddle
bridle
reins
stirrup
horseshoe
carriage
stable
```

Allowed classifiers:

```txt
coat_color
markings
gait
pose
view
tack
position
quantity
```

Classifier examples:

```txt
horse.coat_color = bay
horse.markings = blaze
horse.gait = galloping
horse.view = side
horse.tack = bridle
```

Confusable tags:

```txt
pony
donkey
mule
zebra
horse_like_creature
```

Sensitive or confirmation-required traits:

```txt
mare
stallion
gelding
exact breed
exact age
health condition
```

## AI Agent Rules

AI agents may assist with tagging, but the vocabulary decides what becomes canonical.

### Mandatory Rules

AI agents must:

- prefer existing canonical tags and entities
- check aliases before proposing new tags
- check deprecated, merged, and blocked records
- check related and confusable tags
- check classifier alternatives
- separate observed, metadata, inferred, interpretive, and computed claims
- include confidence and review status for uncertain assignments
- create a draft wiki page for every proposed new tag
- include a distinctness argument for every proposed new tag
- avoid compound attribute tags unless the wiki allows them
- avoid protected, sensitive, or personal identity inference unless source-confirmed and relevant
- avoid exact animal breed, sex, age, or health claims unless source-confirmed or specialist-reviewed

AI agents must not:

- silently create canonical tags
- treat source text as visual truth
- treat computed metadata as human-approved interpretation
- infer sensitive identity attributes from images
- apply deprecated or blocked tags
- convert every related tag into an implication
- flood an image with low-confidence tags

### Agent Tag Proposal Shape

Agent proposals should be exportable as structured data.

```ts
type AtlasTagProposal = {
  proposedSlug: string;
  proposedLabel: string;
  metadataKind: 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'computed';
  category: string;
  displayGroup: string;
  evidenceRule: 'observed' | 'metadata' | 'inferred' | 'interpretive' | 'computed';
  confidence: number;
  requiresReview: boolean;
  reasonForCreation: string;
  distinctnessArgument: string;
  existingTagsConsidered: string[];
  similarButNotEquivalent: string[];
  classifierAlternative?: {
    entityTag: string;
    classifierType: string;
    classifierValue: string;
  };
  draftWiki: DraftWikiEntry;
  exampleAssetId?: string;
  region?: ImageRegion;
};
```

### AI Guidance Export

Pastiche should eventually support exporting a compact guidance packet for external AI agents.

This allows regular ChatGPT or other non-integrated agents to help without direct app integration.

The packet should include:

- global tagging rules
- relevant wiki excerpts
- canonical tag list subset
- aliases
- deprecated and blocked tags
- classifier vocabularies
- evidence rules
- required output schema
- examples and counterexamples

External agents should return suggestions, not direct database mutations.

## Search Model

Search should support simple search and explicit syntax.

Simple search:

```txt
horse blue
```

Simple search can match tags, entities, claims, classifiers, computed metadata, and source text, but results must be explainable.

Example match reasons:

- `horse` matched approved visual tag
- `blue` matched `shirt.color`
- `blue` matched computed palette
- `blue` matched source title text

Explicit search:

```txt
tag:horse
artist:pablo_picasso
work:guernica
ip:zelda
rights:public_domain
source:wikimedia_commons
shirt.color:blue
horse.coat_color:bay
theme:grief
composition:crowded_composition
is:untagged
needs:review
has:variants
```

Search principle:

A visual tag means the thing is visually present.

Metadata text search is separate from visual tag search.

Example:

```txt
tag:red_hat
```

means a red hat is visually present.

```txt
text:"red hat"
```

means source text, title, notes, OCR, or metadata mention red hat.

## Library Integration

Library should consume Atlas metadata without exposing all Atlas complexity by default.

Current Library tag groups can evolve into Atlas display groups and metadata projections.

The first implementation should bridge existing Library tags into Atlas rather than immediately migrating or deleting the current tables. Existing Library tags should remain readable while new Atlas services become the preferred write path for new metadata work. Once Atlas-backed display, search, and assignment flows are stable, a later migration can consolidate legacy Library tags into Atlas records.

Library should show:

- approved tags and entities first
- source metadata as clear identity/fact rows
- suggested tags only in review affordances
- computed metadata in technical/color sections
- deprecated or rejected assignments only when managing metadata

Library should not maintain a separate long-term tag vocabulary once Atlas is in place.

## Explore Integration

Explore can import metadata and source tags, but Atlas decides how they resolve.

Explore source metadata should become:

- source-backed claims
- entities when normalized
- tag suggestions when visual or conceptual
- raw metadata when unmapped

Example:

An imported Picasso work can create or resolve:

- `artist` entity: Pablo Picasso
- `work` entity: Guernica, if source identifies it
- `medium` claim: oil on canvas
- `rights` claim: public domain or unknown rights
- visual tag suggestions only when source tags or analysis justify them

## Customization and Future Users

Pastiche is local-first and personal. Users may eventually want their own vocabulary systems.

The model should support:

- core schema
- default vocabulary pack
- user vocabulary
- imported vocabulary packs
- project-specific specialist vocabulary
- export/import of wiki and vocabulary data

The first implementation can optimize for one user's local system, but should avoid hard-coding the ontology as if it were universal.

## Review Queues

Future Atlas management should include queues for:

- AI-created tags needing review
- tags with no wiki page
- wiki stubs
- tags with no examples
- tags with no category
- tags with no relationships
- tags used only once
- possible duplicate tags
- deprecated tags still in use
- blocked tag attempts
- low-confidence assignments
- inferred assignments needing review
- classifier values outside controlled vocabulary
- external metadata conflicts
- implications with large impact

These queues should make cleanup calm and deliberate.

## Initial Implementation Phases

### Phase 1: Atlas Foundations

Create the core model and service layer:

- canonical tags
- entities
- wiki entries
- aliases
- relationships
- assignments
- evidence
- status
- normalization
- resolution

Goal: Atlas can become the canonical metadata layer.

### Phase 2: Wiki Standards

Create the internal wiki model:

- required fields
- maturity levels
- tag group pages
- examples
- counterexamples
- AI guidance sections
- distinctness argument for new tags

Goal: wiki pages become usable governance records.

### Phase 3: Assignment Workflow

Support:

- approved assignments
- suggested assignments
- rejected assignments
- evidence
- confidence
- notes
- source
- review queues

Goal: AI and imports can assist without polluting canonical metadata.

### Phase 4: Classifiers and Annotations

Add:

- visual entity annotations
- controlled classifier vocabularies
- classifier assignments
- compound-tag deprecation rules
- explicit classifier search

Goal: avoid tag explosion and support precise visual attributes.

### Phase 5: Search

Add:

- simple search over Atlas metadata
- explicit query syntax
- explainable match reasons
- implication expansion
- review/status filters

Goal: make Atlas useful for retrieval.

### Phase 6: Color and Image Relationships

Add:

- color profiles
- palette search
- duplicate candidates
- visual similarity
- same-work links
- variants
- crops
- sequence/series relationships
- reference-used-for relationships

Goal: extend Atlas beyond tags into visual research and reuse.

## Initial Service Boundaries

Implementation should keep Atlas logic out of Svelte components.

Suggested modules:

```txt
src/lib/atlas/tags.ts
src/lib/atlas/entities.ts
src/lib/atlas/wiki.ts
src/lib/atlas/tagGroups.ts
src/lib/atlas/normalization.ts
src/lib/atlas/resolution.ts
src/lib/atlas/assignments.ts
src/lib/atlas/classifiers.ts
src/lib/atlas/relationships.ts
src/lib/atlas/searchQuery.ts
src/lib/atlas/agentGuidance.ts
src/lib/server/atlas/schema.ts
src/lib/server/atlas/read.ts
src/lib/server/atlas/write.ts
```

Required service functions:

```ts
normalizeAtlasSlug(input: string): string;
resolveAtlasTerm(input: string): AtlasResolution;
suggestExistingAtlasTerms(input: string): AtlasSuggestion[];
createDraftTag(input: DraftTagInput): AtlasTag;
createDraftWikiEntry(input: DraftWikiEntryInput): TagWikiEntry;
applyAtlasAssignment(assetId: string, targetId: string, assignment: AssignmentInput): void;
applyClassifier(annotationId: string, classifier: ClassifierInput): void;
resolveAutomaticImplications(targetId: string): AtlasTarget[];
parseAtlasSearchQuery(query: string): ParsedAtlasQuery;
exportAgentGuidance(input: AgentGuidanceInput): AgentGuidancePacket;
```

## Open Design Questions

These can be answered during implementation planning:

1. Should entities and visual tags share a physical table with a `metadata_kind`, or should they use separate tables?
2. How much of the wiki should be stored as structured fields versus markdown body?
3. Should implication expansion create stored assignments, virtual search expansion, or both?
4. Should tag groups be wiki pages, structured records, or both?
5. How should vocabulary packs be exported and versioned?

## Recommendation

Start with Atlas as a parallel canonical layer that the Library can read from, then migrate Library tag creation and display onto Atlas-backed services.

Do not start with AI integration inside the app. Start with agent guidance exports and structured suggestion imports. This gives external AI agents strict rules without giving them direct authority over the database.

Do not build every metadata surface at once. The first implementation should prove:

- canonical vocabulary exists
- wiki pages govern vocabulary
- aliases prevent duplicates
- implications are strict and reviewable
- assignments preserve evidence/status/confidence
- Library can display Atlas metadata calmly

Once that works, classifiers, color profiles, image relationships, and advanced search can build on a stable foundation.
