# Atlas Ontology Seed Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import five deliberately varied seed images and use them to harden Atlas tag ontology, relation display, classifier behavior, search behavior, and wiki browsing before the tag set becomes too large to reason about.

**Architecture:** Treat the seed images as schema pressure tests, not as a one-off content batch. Existing Atlas tables already support concepts, wiki entries, asset concepts, annotations, annotation concepts, and annotation classifiers, so the first pass should use those surfaces plus wiki relation JSON. Only promote relations into a first-class graph table after the seed corpus proves which relation types are actually needed.

**Tech Stack:** SvelteKit, TypeScript, Vitest, better-sqlite3, existing Atlas wiki seed infrastructure, existing Library import API, local image imports from `/home/kristoph/Downloads/imports/`.

---

## Source Documents

Read these before implementing:

```text
docs/superpowers/specs/2026-06-25-atlas-search-mechanics-design.md
docs/superpowers/specs/2026-06-25-atlas-search-ui-design.md
docs/superpowers/plans/2026-06-25-atlas-search-v1.md
docs/atlas/wiki/tagging-rules.md
docs/atlas/wiki/implication-rules.md
docs/atlas/wiki/artist-entity-style-guide.md
docs/atlas/wiki/ai-agent-tagging-rules.md
docs/atlas/wiki/apollo-killing-python-seed-tag-plan.md
src/lib/server/atlas/schema.ts
src/lib/server/atlas/wikiSeed.ts
src/lib/server/atlas/apolloSeed.ts
src/lib/server/library/import.ts
```

External seed references supplied by the user:

```text
https://danbooru.donmai.us/posts/7806601?q=ordfav%3AMillions_Knives
https://www.artic.edu/artworks/19386/susano-o-no-mikoto-killing-the-eight-headed-dragon
https://danbooru.donmai.us/posts/9692781?q=user%3AMillions_Knives
https://danbooru.donmai.us/posts/9692240?q=user%3AMillions_Knives
https://danbooru.donmai.us/posts/9692641?q=user%3AMillions_Knives
```

Local seed files:

```text
/home/kristoph/Downloads/imports/Susano-o_no_Mikoto_Killing_the_Eight-headed_Dragon.jpg
/home/kristoph/Downloads/imports/__dragonite_and_mega_dragonite_pokemon_drawn_by_deepsea9013__8c357f352c18d0a6549289b04f8d222a.jpg
/home/kristoph/Downloads/imports/__klavier_gavin_and_kristoph_gavin_ace_attorney_and_1_more_drawn_by_lanfengzheyu__8db104fd15ee82f3b88efdccbe0c5463.png
/home/kristoph/Downloads/imports/__original_drawn_by_egretfoooox__ff263959d93080069b4b8c70856409b9.jpg
/home/kristoph/Downloads/imports/__original_drawn_by_nablange__157711c92221e96db5c444d791fd9698.jpg
```

## Product Problem

The current Atlas model is powerful enough to express the ideas, but the live tag set is too sparse to reveal where the ontology bends or breaks.

The five seed subjects should force answers to these questions:

- How does Atlas distinguish an ordinary visual concept such as `dragon` from a named entity such as `yamata_no_orochi`, `charizard`, or `smaug`?
- How does Atlas show specialist dragon kinds such as `wyvern`, `wyrm`, `western_dragon`, `eastern_dragon`, `drake`, `amphitere`, and `hydra` without flattening them into one enormous list?
- How does Atlas keep `Character / IP` from becoming an unusable junk drawer containing Ace Attorney, Ovid's Metamorphoses, Jesus Christ, Dora the Explorer, and American Psycho as visual siblings?
- How does Atlas represent Pokemon species/forms when `Dragonite`, `Mega Dragonite`, and the Pokemon franchise all mean different things?
- How does Atlas represent visual style without implying that franchise style is visible in every fan artwork?
- How does Atlas distinguish `dog` as an animal from `anthro_dog` or an anthro character with dog features?
- Which relationships are search implications, which are sidebar navigation aids, and which are only contextual metadata?

## Ontology Rules To Preserve

Keep these rules intact while adding the seed corpus:

- Visual tags describe visible content: `dragon`, `dog`, `human_figure`, `horns`, `wings`.
- Entities name source-backed people, characters, franchises, works, myths, institutions, artists, and notable named subjects.
- Claims store factual source metadata about one asset: artist, title, source URL, date, medium, rights.
- Classifiers attach attributes to a visible annotation: `dragon.head_count:eight`, `dog.anthro_degree:anthro`, `dragonite.form:mega`.
- Automatic implications must remain conservative and specific-to-broad.
- Related tags and confusables help browsing but must not silently change search results.
- Broad index groups should default compact; selected tag pages should reveal relation detail on demand.
- Source vocabulary conversion must be manually reviewed before it becomes canonical Atlas vocabulary.
- Appearance tags such as `androgynous_subject` are distinct from known identity tags such as `nonbinary_subject` and `intersex_subject`.

## Seed Corpus Roles

| Seed                                               | Source                                                    | Main Schema Pressure                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digital dragon                                     | Danbooru post 7806601 and local original by `nablange`    | Modern artist handling, digital art claims, dragon anatomy classifiers, generic `dragon` vs specialist types, Danbooru artist/tag page adaptation |
| Susano-o no Mikoto killing the eight-headed dragon | Art Institute of Chicago record 19386 and local JPG       | Named mythological artwork, named deity, named/atypical dragon entity, Japanese myth lane, woodblock/print style, source-backed metadata          |
| Pokemon / Mega Dragonite                           | Danbooru post 9692781 and local `deepsea9013` file        | Franchise/entity hierarchy, species vs character vs form, fan art, IP style vs visible artwork style, dragon-like Pokemon boundaries              |
| Human character design                             | Danbooru post 9692240 and local Ace Attorney file         | Named human characters, franchise/IP grouping, clothing/attribute classifiers, visible design traits vs source identity                           |
| Anthro / furry subject                             | Danbooru post 9692641 and local original by `egretfoooox` | Anthro qualifier, species vs anthropomorphic subject, furry retrieval boundaries, preventing animal searches from flooding with anthro results    |

## Relation Vocabulary Draft

Use this vocabulary in wiki seed data and UI copy during the first pass:

```text
broader
narrower
child_specialist
notable_entity
symbolic_form
source_work
franchise_or_ip
character_form
classifier_dimension
related
confusable
automatic_implication
suggested_implication
```

Mapping to current storage:

- `broader` and `narrower` can use existing `broader_json` and `narrower_json`.
- `related`, `confusable`, `automatic_implication`, and `suggested_implication` can use existing wiki fields.
- `child_specialist`, `notable_entity`, `symbolic_form`, `source_work`, `franchise_or_ip`, `character_form`, and `classifier_dimension` should initially be represented in `related_json` with a typed local presentation map in code, or in a small sidecar relation constant.
- Do not add a database table until this corpus proves the relation set is stable.

## Files

Create:

```text
src/lib/server/atlas/ontologySeed.ts
src/lib/server/atlas/ontologySeed.spec.ts
src/lib/atlas/ontologyRelations.ts
src/lib/atlas/ontologyRelations.spec.ts
```

Modify:

```text
docs/atlas/wiki/seed-corpus/2026-06-dragon-character-anthro.md
src/lib/server/library/import.ts
src/lib/server/atlas/wikiSeed.ts
src/lib/server/atlas/wikiSeed.spec.ts
src/lib/server/atlas/search.spec.ts
src/lib/server/atlas/search.ts
src/lib/components/atlas/AtlasWiki.svelte
src/lib/components/atlas/AtlasSearch.svelte
```

Responsibilities:

- `docs/atlas/wiki/seed-corpus/2026-06-dragon-character-anthro.md`: human-readable source manifest and schema notes for the five seed assets.
- `ontologySeed.ts`: fixture matcher and seed applier for the five imported assets, analogous to `apolloSeed.ts` but broader.
- `ontologySeed.spec.ts`: verifies concept creation, annotation classifiers, implications, and search-critical relations.
- `ontologyRelations.ts`: typed presentation buckets for relation display before a graph table exists.
- `ontologyRelations.spec.ts`: verifies relation grouping and compact/collapsed defaults.
- `import.ts`: calls the ontology seed applier after a matching seed asset is imported.
- `wikiSeed.ts`: adds missing reusable concepts, entities, classifiers, and wiki relation fields.
- `AtlasWiki.svelte`: renders the wiki guide tree with compact lanes and relation-aware selected tag sections.
- `AtlasSearch.svelte`: uses the new relation categories for sidebar intent and query refinement.

---

### Task 1: Seed Manifest And Source Audit

**Files:**

- Modify: `docs/atlas/wiki/seed-corpus/2026-06-dragon-character-anthro.md`

- [ ] **Step 1: Verify local files exist**

Run:

```sh
find /home/kristoph/Downloads/imports -maxdepth 1 -type f | sort
```

Expected output includes exactly these five files:

```text
/home/kristoph/Downloads/imports/Susano-o_no_Mikoto_Killing_the_Eight-headed_Dragon.jpg
/home/kristoph/Downloads/imports/__dragonite_and_mega_dragonite_pokemon_drawn_by_deepsea9013__8c357f352c18d0a6549289b04f8d222a.jpg
/home/kristoph/Downloads/imports/__klavier_gavin_and_kristoph_gavin_ace_attorney_and_1_more_drawn_by_lanfengzheyu__8db104fd15ee82f3b88efdccbe0c5463.png
/home/kristoph/Downloads/imports/__original_drawn_by_egretfoooox__ff263959d93080069b4b8c70856409b9.jpg
/home/kristoph/Downloads/imports/__original_drawn_by_nablange__157711c92221e96db5c444d791fd9698.jpg
```

- [ ] **Step 2: Keep the initialized seed manifest current**

The seed manifest has been initialized with user-supplied Danbooru vocabulary. Keep `docs/atlas/wiki/seed-corpus/2026-06-dragon-character-anthro.md` in this shape and update it rather than replacing it:

```md
# Dragon, Character, Pokemon, And Anthro Seed Corpus

## Purpose

This corpus exists to make Atlas ontology decisions concrete. It deliberately mixes public-domain museum material, modern Danbooru-uploaded art, franchise characters, human characters, and anthro subjects so the tag model has to distinguish visual concepts, entities, claims, classifiers, implications, and browsing-only relations.

## Seed Assets

| Key                 | Local file                                                                                                                                                | Source URL                                                                                | Ontology pressure                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| digital_dragon      | `/home/kristoph/Downloads/imports/__original_drawn_by_nablange__157711c92221e96db5c444d791fd9698.jpg`                                                     | `https://danbooru.donmai.us/posts/7806601?q=ordfav%3AMillions_Knives`                     | Digital art, modern artist, generic dragon anatomy, Danbooru-style artist/tag metadata    |
| susanoo_orochi      | `/home/kristoph/Downloads/imports/Susano-o_no_Mikoto_Killing_the_Eight-headed_Dragon.jpg`                                                                 | `https://www.artic.edu/artworks/19386/susano-o-no-mikoto-killing-the-eight-headed-dragon` | Notable work, named deity, named dragon entity, Japanese mythology, color woodblock print |
| mega_dragonite      | `/home/kristoph/Downloads/imports/__dragonite_and_mega_dragonite_pokemon_drawn_by_deepsea9013__8c357f352c18d0a6549289b04f8d222a.jpg`                      | `https://danbooru.donmai.us/posts/9692781?q=user%3AMillions_Knives`                       | Pokemon franchise hierarchy, species/form distinction, IP style vs visible style          |
| ace_attorney_humans | `/home/kristoph/Downloads/imports/__klavier_gavin_and_kristoph_gavin_ace_attorney_and_1_more_drawn_by_lanfengzheyu__8db104fd15ee82f3b88efdccbe0c5463.png` | `https://danbooru.donmai.us/posts/9692240?q=user%3AMillions_Knives`                       | Human character entities, franchise grouping, clothing and design attributes              |
| anthro_subject      | `/home/kristoph/Downloads/imports/__original_drawn_by_egretfoooox__ff263959d93080069b4b8c70856409b9.jpg`                                                  | `https://danbooru.donmai.us/posts/9692641?q=user%3AMillions_Knives`                       | Anthro qualifier, species boundary, furry search separation from ordinary animals         |

## Import Notes

- The Danbooru sources are user-owned uploads from the linked account.
- Danbooru tags are vocabulary hints, not Atlas truth. Convert them through Atlas rules.
- If Danbooru scraping is blocked, unstable, login-gated, or incomplete, ask the user for the tag list for each Danbooru post and record those tags here as source vocabulary hints.
- User-supplied Danbooru tag lists should be stored as source metadata / raw vocabulary, then manually converted into Atlas concepts, entities, classifiers, claims, or rejected notes.
- Source metadata should become claims/entities.
- Visible content should become visual tags or annotation classifiers.
- Franchise/source identity must not imply a visible style.
- Anthro status must be explicit enough that `dog` and `anthro dog` remain meaningfully different searches.

## First-Pass Stop Line

Keep the first pass under 120 new concepts unless a concept is needed by at least two seed assets or directly protects search behavior.
```

- [ ] **Step 3: Validate the manifest path and source URLs**

Run:

```sh
rg -n "digital_dragon|susanoo_orochi|mega_dragonite|ace_attorney_humans|anthro_subject" docs/atlas/wiki/seed-corpus/2026-06-dragon-character-anthro.md
```

Expected: each seed key appears once in the seed table.

- [ ] **Step 4: Confirm or extend Danbooru source vocabulary**

The user supplied first-pass Danbooru tag lists for `digital_dragon`, `mega_dragonite`, `ace_attorney_humans`, and `anthro_subject`. Confirm they remain in the seed manifest under this heading:

```md
## External Vocabulary Hints

### digital_dragon

- Danbooru tags:

### mega_dragonite

- Danbooru tags:

### ace_attorney_humans

- Danbooru tags:

### anthro_subject

- Danbooru tags:
```

If a future scrape succeeds, use it only to fill gaps or verify source metadata. Do not overwrite the user-supplied vocabulary without checking the visual/source mapping first.

---

### Task 2: Relation Presentation Model

**Files:**

- Create: `src/lib/atlas/ontologyRelations.ts`
- Create: `src/lib/atlas/ontologyRelations.spec.ts`

- [ ] **Step 1: Write failing relation grouping tests**

Create `src/lib/atlas/ontologyRelations.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupAtlasOntologyRelations } from './ontologyRelations';

describe('groupAtlasOntologyRelations', () => {
	it('keeps dragon child types separate from notable entities', () => {
		const groups = groupAtlasOntologyRelations([
			{ slug: 'wyvern', label: 'Wyvern', relation: 'child_specialist' },
			{ slug: 'yamata_no_orochi', label: 'Yamata no Orochi', relation: 'notable_entity' },
			{ slug: 'heraldic_dragon', label: 'Heraldic dragon', relation: 'symbolic_form' }
		]);

		expect(groups.map((group) => group.title)).toEqual([
			'Child / Specialist Tags',
			'Notable Entities',
			'Symbols And Contextual Forms'
		]);
		expect(groups[0].items[0].slug).toBe('wyvern');
		expect(groups[1].items[0].slug).toBe('yamata_no_orochi');
		expect(groups[2].items[0].slug).toBe('heraldic_dragon');
	});

	it('marks broad groups as collapsed by default', () => {
		const groups = groupAtlasOntologyRelations([
			{ slug: 'ace_attorney', label: 'Ace Attorney', relation: 'franchise_or_ip' },
			{ slug: 'ovid_metamorphoses', label: "Ovid's Metamorphoses", relation: 'source_work' }
		]);

		expect(groups.every((group) => group.defaultCollapsed)).toBe(true);
	});
});
```

- [ ] **Step 2: Run relation tests to verify RED**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/atlas/ontologyRelations.spec.ts
```

Expected: FAIL because `src/lib/atlas/ontologyRelations.ts` does not exist.

- [ ] **Step 3: Implement relation grouping**

Create `src/lib/atlas/ontologyRelations.ts`:

```ts
export type AtlasOntologyRelation =
	| 'broader'
	| 'narrower'
	| 'child_specialist'
	| 'notable_entity'
	| 'symbolic_form'
	| 'source_work'
	| 'franchise_or_ip'
	| 'character_form'
	| 'classifier_dimension'
	| 'related'
	| 'confusable'
	| 'automatic_implication'
	| 'suggested_implication';

export type AtlasOntologyRelationItem = {
	slug: string;
	label: string;
	relation: AtlasOntologyRelation;
	count?: number | null;
};

export type AtlasOntologyRelationGroup = {
	key: AtlasOntologyRelation;
	title: string;
	defaultCollapsed: boolean;
	items: AtlasOntologyRelationItem[];
};

const GROUPS: Array<Pick<AtlasOntologyRelationGroup, 'key' | 'title' | 'defaultCollapsed'>> = [
	{ key: 'broader', title: 'Broader Tags', defaultCollapsed: false },
	{ key: 'child_specialist', title: 'Child / Specialist Tags', defaultCollapsed: false },
	{ key: 'classifier_dimension', title: 'Classifier Dimensions', defaultCollapsed: false },
	{ key: 'notable_entity', title: 'Notable Entities', defaultCollapsed: false },
	{ key: 'character_form', title: 'Forms And Variants', defaultCollapsed: false },
	{ key: 'symbolic_form', title: 'Symbols And Contextual Forms', defaultCollapsed: true },
	{ key: 'source_work', title: 'Source Works And Traditions', defaultCollapsed: true },
	{ key: 'franchise_or_ip', title: 'Franchises / IP', defaultCollapsed: true },
	{ key: 'related', title: 'Related Tags', defaultCollapsed: true },
	{ key: 'confusable', title: 'Confusable With', defaultCollapsed: true },
	{ key: 'automatic_implication', title: 'Automatic Implications', defaultCollapsed: true },
	{ key: 'suggested_implication', title: 'Suggested Implications', defaultCollapsed: true },
	{ key: 'narrower', title: 'Narrower Tags', defaultCollapsed: true }
];

export function groupAtlasOntologyRelations(
	items: AtlasOntologyRelationItem[]
): AtlasOntologyRelationGroup[] {
	return GROUPS.map((group) => ({
		...group,
		items: items.filter((item) => item.relation === group.key)
	})).filter((group) => group.items.length > 0);
}
```

- [ ] **Step 4: Run relation tests to verify GREEN**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/atlas/ontologyRelations.spec.ts
```

Expected: PASS.

---

### Task 3: Wiki Concepts And Classifier Seeds

**Files:**

- Modify: `src/lib/server/atlas/wikiSeed.ts`
- Modify: `src/lib/server/atlas/wikiSeed.spec.ts`

- [ ] **Step 1: Add failing wiki seed coverage**

Add tests to `src/lib/server/atlas/wikiSeed.spec.ts`:

```ts
it('includes dragon relation pressure concepts', () => {
	const slugs = new Set(ATLAS_WIKI_SEED_CONCEPTS.map((concept) => concept.slug));

	expect(slugs).toContain('dragon');
	expect(slugs).toContain('wyvern');
	expect(slugs).toContain('yamata_no_orochi');
	expect(slugs).toContain('heraldic_dragon');
	expect(slugs).toContain('head_count');
	expect(slugs).toContain('body_plan');
});

it('keeps anthro concepts separate from ordinary animal concepts', () => {
	const anthro = ATLAS_WIKI_SEED_CONCEPTS.find((concept) => concept.slug === 'anthro');
	const dog = ATLAS_WIKI_SEED_CONCEPTS.find((concept) => concept.slug === 'dog');

	expect(anthro?.kind).toBe('visual_tag');
	expect(dog?.kind).toBe('visual_tag');
	expect(anthro?.automaticImplications).not.toContain('dog');
	expect(dog?.automaticImplications).toContain('animal');
});

it('separates androgynous appearance from known identity tags', () => {
	const androgynous = ATLAS_WIKI_SEED_CONCEPTS.find(
		(concept) => concept.slug === 'androgynous_subject'
	);
	const nonbinary = ATLAS_WIKI_SEED_CONCEPTS.find(
		(concept) => concept.slug === 'nonbinary_subject'
	);
	const intersex = ATLAS_WIKI_SEED_CONCEPTS.find((concept) => concept.slug === 'intersex_subject');

	expect(androgynous?.kind).toBe('visual_tag');
	expect(nonbinary).toBeTruthy();
	expect(intersex).toBeTruthy();
	expect(androgynous?.automaticImplications).not.toContain('nonbinary_subject');
	expect(androgynous?.automaticImplications).not.toContain('intersex_subject');
});

it('models Pokemon species and forms as entities with visible companion tags', () => {
	const pokemon = ATLAS_WIKI_SEED_CONCEPTS.find((concept) => concept.slug === 'pokemon');
	const dragonite = ATLAS_WIKI_SEED_CONCEPTS.find((concept) => concept.slug === 'dragonite');
	const megaDragonite = ATLAS_WIKI_SEED_CONCEPTS.find(
		(concept) => concept.slug === 'mega_dragonite'
	);

	expect(pokemon?.kind).toBe('entity');
	expect(dragonite?.kind).toBe('entity');
	expect(megaDragonite?.related).toContain('dragonite');
});
```

- [ ] **Step 2: Run wiki seed tests to verify RED**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/server/atlas/wikiSeed.spec.ts
```

Expected: FAIL on missing seed concepts.

- [ ] **Step 3: Add first-pass reusable concepts**

Modify `src/lib/server/atlas/wikiSeed.ts` by adding a compact seed set for these categories:

```text
Dragon visual concepts:
dragon
wyvern
wyrm
eastern_dragon
western_dragon
drake
hydra
amphitere
serpentine_dragon
heraldic_dragon

Dragon classifiers:
head_count
leg_count
wing_count
body_plan
horn_presence
scale_covering
anthro_degree

Mythology entities:
susanoo_no_mikoto
yamata_no_orochi
japanese_mythology
shinto_mythology
eight_headed_dragon

Pokemon and IP entities:
pokemon
dragonite
mega_dragonite
ace_attorney
klavier_gavin
kristoph_gavin

Human and anthro visual concepts:
human_figure
male_figure
female_subject
androgynous_subject
nonbinary_subject
intersex_subject
anthro
furry_subject
dog
anthro_dog
animal_ears
tail
```

Required relationship rules:

```text
wyvern -> dragon (automatic only if page definition is strictly dragon subtype)
eastern_dragon -> dragon
western_dragon -> dragon
hydra -> multi_headed_creature and dragon only as suggested unless definition is narrowed
yamata_no_orochi -> japanese_mythology
yamata_no_orochi -> dragon as suggested unless the wiki page defines it as dragon for Atlas purposes
dog -> mammal -> animal
anthro_dog -> anthro and dog-like subject; do not make it satisfy plain dog animal search by automatic implication until the search role rule is explicit
mega_dragonite -> dragonite
dragonite -> pokemon
```

Use conservative `suggestedImplications` whenever an implication could damage search.

- [ ] **Step 4: Run wiki seed tests to verify GREEN**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/server/atlas/wikiSeed.spec.ts
```

Expected: PASS.

---

### Task 4: Seed Asset Import And Annotation Fixture

**Files:**

- Create: `src/lib/server/atlas/ontologySeed.ts`
- Create: `src/lib/server/atlas/ontologySeed.spec.ts`
- Modify: `src/lib/server/library/import.ts`

- [ ] **Step 1: Write failing ontology seed tests**

Create `src/lib/server/atlas/ontologySeed.spec.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed } from './wiki';
import { applyOntologySeedForAsset, shouldApplyOntologySeed } from './ontologySeed';

const NOW = '2026-06-25T12:00:00.000Z';

describe('ontology seed corpus', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-ontology-seed-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('matches the five seed sources by source URL or local filename', () => {
		expect(
			shouldApplyOntologySeed({
				title:
					'__dragonite_and_mega_dragonite_pokemon_drawn_by_deepsea9013__8c357f352c18d0a6549289b04f8d222a.jpg',
				sourceUrl: 'https://danbooru.donmai.us/posts/9692781?q=user%3AMillions_Knives'
			})
		).toBe('mega_dragonite');
	});

	it('applies dragon annotations with anatomy classifiers', () => {
		const db = openLibraryDatabase();
		applyAtlasWikiSeed(db, NOW);

		db.prepare(
			`insert into assets (
				id, filename, title, storage_mode, mime_type, width, height, original_path,
				thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
				source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
			) values (
				'asset-digital-dragon', 'dragon.jpg', 'dragon.jpg', 'download', 'image/jpeg', 1200, 1200,
				'originals/dragon.jpg', 'thumbnails/dragon.webp', null,
				'https://danbooru.donmai.us/posts/7806601?q=ordfav%3AMillions_Knives',
				'dragon', null, 'danbooru.donmai.us', 'hash-dragon', null, ?, ?, ?, null
			)`
		).run(NOW, NOW, NOW);

		applyOntologySeedForAsset(db, 'asset-digital-dragon', 'digital_dragon', NOW);

		const concepts = db
			.prepare(
				`select atlas_concepts.slug
				 from atlas_asset_concepts
				 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
				 where atlas_asset_concepts.asset_id = ?
				 order by atlas_concepts.slug`
			)
			.all('asset-digital-dragon') as Array<{ slug: string }>;

		expect(concepts.map((row) => row.slug)).toContain('dragon');
		expect(concepts.map((row) => row.slug)).toContain('digital_art');

		const classifiers = db
			.prepare(
				`select classifier_type, classifier_value
				 from atlas_annotation_classifiers
				 join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
				 where atlas_annotations.asset_id = ?
				 order by classifier_type, classifier_value`
			)
			.all('asset-digital-dragon') as Array<{ classifier_type: string; classifier_value: string }>;

		expect(classifiers).toContainEqual({
			classifier_type: 'visual_role',
			classifier_value: 'focal_point'
		});
	});
});
```

- [ ] **Step 2: Run ontology seed tests to verify RED**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/server/atlas/ontologySeed.spec.ts
```

Expected: FAIL because `ontologySeed.ts` does not exist.

- [ ] **Step 3: Implement seed matching and annotation application**

Create `src/lib/server/atlas/ontologySeed.ts` with this shape:

```ts
import type Database from 'better-sqlite3';
import { applyAtlasWikiSeed } from './wiki';

export type AtlasOntologySeedKey =
	| 'digital_dragon'
	| 'susanoo_orochi'
	| 'mega_dragonite'
	| 'ace_attorney_humans'
	| 'anthro_subject';

export function shouldApplyOntologySeed(input: {
	title?: string | null;
	sourceUrl?: string | null;
}): AtlasOntologySeedKey | null {
	const haystack = `${input.title ?? ''} ${input.sourceUrl ?? ''}`.toLowerCase();
	if (haystack.includes('7806601') || haystack.includes('nablange')) return 'digital_dragon';
	if (haystack.includes('artic.edu/artworks/19386') || haystack.includes('eight-headed_dragon')) {
		return 'susanoo_orochi';
	}
	if (haystack.includes('9692781') || haystack.includes('mega_dragonite')) return 'mega_dragonite';
	if (haystack.includes('9692240') || haystack.includes('ace_attorney'))
		return 'ace_attorney_humans';
	if (haystack.includes('9692641') || haystack.includes('egretfoooox')) return 'anthro_subject';
	return null;
}

export function applyOntologySeedForAsset(
	db: Database.Database,
	assetId: string,
	seedKey: AtlasOntologySeedKey,
	now = new Date().toISOString()
) {
	applyAtlasWikiSeed(db, now);

	const fixture = ONTOLOGY_SEED_FIXTURES[seedKey];
	// Implement the same insert patterns as src/lib/server/atlas/apolloSeed.ts.
	// Asset concepts use fixture.assetConcepts.
	// Annotations use fixture.annotations.
	// Annotation concepts and classifiers use the exact annotation labels below.
}
```

Fixture minimums:

```text
digital_dragon:
asset concepts: dragon, digital_art
annotation: dragon_body -> dragon, visual_role:focal_point, body_plan:quadruped_or_serpentine_review

susanoo_orochi:
asset concepts: susanoo_no_mikoto, yamata_no_orochi, dragon, japanese_mythology, color_woodblock_print
annotation: orochi_body -> yamata_no_orochi, dragon, head_count:eight, visual_role:focal_point
annotation: susanoo_figure -> susanoo_no_mikoto, male_figure, action_role:attacker, visual_role:focal_point

mega_dragonite:
asset concepts: pokemon, dragonite, mega_dragonite, fan_art
annotation: dragonite -> dragonite, visual_role:focal_point
annotation: mega_dragonite -> mega_dragonite, dragonite, visual_role:focal_point

ace_attorney_humans:
asset concepts: ace_attorney, klavier_gavin, kristoph_gavin, human_figure, male_figure
annotation: klavier_gavin -> klavier_gavin, human_figure, visual_role:focal_point
annotation: kristoph_gavin -> kristoph_gavin, human_figure, visual_role:focal_point

anthro_subject:
asset concepts: anthro, furry_subject
annotation: anthro_subject -> anthro, anthro_degree:anthro, visual_role:focal_point
```

- [ ] **Step 4: Hook seed application into import**

Modify `src/lib/server/library/import.ts`:

```ts
import { applyOntologySeedForAsset, shouldApplyOntologySeed } from '$lib/server/atlas/ontologySeed';
```

After the Apollo seed block, add:

```ts
const ontologySeed = shouldApplyOntologySeed({
	title: item.filename,
	sourceUrl: item.source_url
});
if (ontologySeed) {
	applyOntologySeedForAsset(db, assetId, ontologySeed, now);
}
```

- [ ] **Step 5: Run focused seed tests**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/server/atlas/ontologySeed.spec.ts src/routes/api/import/server.spec.ts
```

Expected: PASS.

---

### Task 5: Search Behavior Tests For Ontology Boundaries

**Files:**

- Modify: `src/lib/server/atlas/search.spec.ts`
- Modify: `src/lib/server/atlas/search.ts`

- [ ] **Step 1: Add failing search boundary tests**

Add tests to `src/lib/server/atlas/search.spec.ts` that prove these behaviors:

```ts
it('finds named dragon entities through dragon search but explains the entity match', () => {
	// Seed susanoo_orochi.
	// Search "dragon".
	// Expect the Susano-o/Orochi asset to appear.
	// Expect explanation to include "Matched dragon" or "Matched Yamata no Orochi as related dragon entity".
});

it('does not treat franchise style as observed visual style', () => {
	// Seed mega_dragonite with pokemon and fan_art.
	// Search "pokemon".
	// Expect result.
	// Search a visible style tag that is not assigned.
	// Expect no result unless the style was explicitly tagged.
});

it('keeps anthro animal searches distinct from ordinary animal searches', () => {
	// Seed anthro_subject.
	// Search "anthro".
	// Expect result.
	// Search "dog role:focal" should not match unless the annotation has dog or anthro_dog under approved rules.
});

it('supports form-specific search for Mega Dragonite', () => {
	// Seed mega_dragonite.
	// Search "mega_dragonite".
	// Expect the seed result.
	// Search "dragonite" should also find it through direct related/form assignment.
});
```

Write these with the helper style already used in `src/lib/server/atlas/search.spec.ts`.

- [ ] **Step 2: Run search tests to verify RED or document existing GREEN**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/server/atlas/search.spec.ts
```

Expected: Some tests fail until relation-aware matching and explanation text are tightened.

- [ ] **Step 3: Implement only required search changes**

Modify `src/lib/server/atlas/search.ts` so:

- Automatic implications affect filtering.
- Suggested/related relations affect sidebar and ranking only.
- Entity matches can explain themselves as entity matches.
- `anthro` does not collapse into ordinary animal search unless explicit search semantics are added.
- Form/entity searches can match assets where the form entity and base entity are both assigned.

- [ ] **Step 4: Run search tests to verify GREEN**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/server/atlas/search.spec.ts
```

Expected: PASS.

---

### Task 6: Wiki Guide And Selected Tag UI

**Files:**

- Modify: `src/lib/components/atlas/AtlasWiki.svelte`
- Modify: `src/lib/components/atlas/AtlasSearch.svelte`

- [ ] **Step 1: Update the wiki guide structure**

Adjust the default Wiki Guide so broad groups are compact by default:

```text
Animals And Creatures
  Dragon
  Dog
  Anthro

Mythology And Religion
  Japanese Mythology
  Susano-o no Mikoto
  Yamata no Orochi

Franchises / IP
  Pokemon
  Ace Attorney

Characters
  Dragonite
  Mega Dragonite
  Klavier Gavin
  Kristoph Gavin

Artists And Makers
  Egretfoooox
  Deepsea9013
  Lanfengzheyu
  Nablange
  Torii Kiyomasu II
```

The guide should look like a compact index with collapsible lanes, not a long tag soup.

- [ ] **Step 2: Update selected tag relation sections**

For `dragon`, render relation groups in this order:

```text
Broader Tags
Child / Specialist Tags
Classifier Dimensions
Notable Entities
Symbols And Contextual Forms
Related Tags
Confusable With
```

For `pokemon`, render:

```text
Franchises / IP
Characters And Species
Forms And Variants
Related Visual Tags
Confusable With
```

For `anthro`, render:

```text
Broader Tags
Species Forms
Classifier Dimensions
Related Tags
Confusable With
```

- [ ] **Step 3: Keep node map scoped**

Add a placeholder-free visual design target for the future graph view:

```text
Default guide map:
  broad collapsed clusters only

Selected tag map:
  selected tag centered
  one-hop relation groups visible
  second-hop nodes hidden behind expand controls

Search result map:
  current query clauses as anchors
  result-set facets as nearby nodes
```

Do not build a full force-directed graph in this task unless the simple relation UI is already stable.

- [ ] **Step 4: Run UI verification**

Run:

```sh
PATH=/usr/bin:/bin npm run check
PATH=/usr/bin:/bin npm run build
```

Expected: both commands pass.

Then visually inspect:

```text
Atlas > Wiki > Guide
Atlas > Wiki > dragon
Atlas > Search > dragon
Atlas > Search > anthro
Atlas > Search > mega_dragonite
```

Expected:

- broad groups are compact
- no endless sea of IPs appears by default
- `dragon` shows child/specialist tags separately from notable entities
- `heraldic_dragon` is not presented as an individual entity
- `Yamata no Orochi` is presented as a notable entity or named mythological creature
- search sidebar items still support refine vs navigate behavior

---

### Task 7: Import The Five Local Assets

**Files:**

- No source file changes expected after Tasks 1-6.

- [ ] **Step 1: Start the dev server**

Run with the system Node path to avoid the `better-sqlite3` ABI mismatch:

```sh
PATH=/usr/bin:/bin pastiche
```

Expected:

```text
App:       http://127.0.0.1:5173
```

- [ ] **Step 2: Import through the app or import API**

Import the five files from:

```text
/home/kristoph/Downloads/imports/
```

Use source URLs from the manifest. Use `storage_mode: download` so thumbnails are local and search result cards do not depend on remote image loading.

- [ ] **Step 3: Verify seed application**

Search these queries:

```text
dragon
yamata_no_orochi
mega_dragonite
ace_attorney
anthro
```

Expected:

- each query returns at least one seed result
- the wiki preview uses the first local example image when available
- `dragon` result/sidebar has child/specialist and notable entity structure
- `anthro` result/sidebar does not present itself as ordinary animal browsing

---

### Task 8: Documentation And Stop-Line Review

**Files:**

- Modify: `docs/atlas/wiki/seed-corpus/2026-06-dragon-character-anthro.md`
- Modify if reality changes: `docs/atlas/wiki/tagging-rules.md`
- Modify if reality changes: `docs/atlas/wiki/implication-rules.md`

- [ ] **Step 1: Record final ontology decisions**

Append this section to the seed corpus doc:

```md
## Decisions After First Import

### Dragon

- Child/specialist tags:
- Notable entities:
- Symbolic/contextual forms:
- Classifier dimensions:
- Search implications approved:
- Search implications rejected:

### Pokemon

- Franchise/IP model:
- Species/entity model:
- Form/variant model:
- Style boundary:

### Human Characters

- Character entity model:
- Visible attribute model:
- Franchise grouping model:

### Anthro

- Anthro qualifier model:
- Animal search boundary:
- Species-form model:
- Gendered/androgynous subject boundary:
```

Fill each line with the implemented decision. If the decision is still unresolved, record the exact query or UI behavior that remains ambiguous.

- [ ] **Step 2: Run final verification**

Run:

```sh
PATH=/usr/bin:/bin npm run test:unit -- --run src/lib/atlas/ontologyRelations.spec.ts src/lib/server/atlas/ontologySeed.spec.ts src/lib/server/atlas/wikiSeed.spec.ts src/lib/server/atlas/search.spec.ts
PATH=/usr/bin:/bin npm run check
PATH=/usr/bin:/bin npm run build
git diff --check
```

Expected: all pass.

---

## Acceptance Criteria

- The five seed files are importable from `/home/kristoph/Downloads/imports/`.
- Each seed asset has source metadata, at least one identity/entity assignment, at least one visible concept assignment, and at least one annotation with `visual_role`.
- Proposed source-tag conversions are documented for human review before becoming canonical concepts, classifiers, aliases, or implications.
- `dragon` has separated relation sections for child/specialist tags, notable entities, symbolic/contextual forms, classifiers, related tags, and confusables.
- `Yamata no Orochi` is not flattened into generic `dragon`; it remains a named mythological entity that can also support dragon retrieval.
- `Pokemon`, `Dragonite`, and `Mega Dragonite` can be represented without claiming that every Pokemon image uses official Pokemon style.
- Human character tags separate named characters, franchise/IP, and visible design attributes.
- Anthro/furry subjects are searchable without poisoning ordinary animal searches.
- `androgynous_subject`, `nonbinary_subject`, and `intersex_subject` are kept separate by appearance-vs-identity rules.
- Broad index groups are compact by default.
- Search/sidebar behavior can refine or navigate from a relation item without hard-coding one action per section title.

## Non-Goals

- Do not build a universal ontology for all fictional characters.
- Do not mirror Danbooru wholesale.
- Do not implement a full graph database yet.
- Do not make automated tagging decisions from Danbooru tags without Atlas review.
- Do not make franchise or artist style an observed style unless the artwork visibly supports it.
- Do not solve mass tagging UI in this slice.
- Do not build full Danbooru scraping in this slice, but preserve the requirement that future extension capture should store raw external tag rows and source metadata automatically.

## Open Questions To Resolve With The Seed Corpus

- Should `anthro` be a visual tag, classifier dimension, or both?
- Should `anthro_dog` imply `dog`, or should it only imply `anthro` plus a species-like qualifier?
- Should `androgynous_subject` be a visual tag, classifier value, or both?
- Which sub-tags or classifier values are needed for different kinds of androgynous presentation?
- Should `hydra` automatically imply `dragon`, or only relate to `dragon`?
- Should `yamata_no_orochi` be a `character`, `mythological_creature`, `notable_entity`, or a more specific entity kind once entity kinds expand?
- Should Pokemon species be `character`, `species`, or a new entity kind such as `fictional_species`?
- Should modern Danbooru artists become normal `artist` entities with source URL claims, or should they have a lighter creator/source identity until reviewed?
- When a search has multiple unrelated tags, should the sidebar use result-set facets first and wiki relations second?

## Execution Notes

- Use `PATH=/usr/bin:/bin` for npm and dev commands in this repo until the Node/better-sqlite3 ABI mismatch is permanently resolved.
- Keep existing dirty worktree changes intact. Do not revert unrelated files.
- Prefer focused tests after each task. Do not wait until the end to find ontology breakage.
- If a relation feels tempting but could damage search, mark it `related` or `suggested`, not `automatic`.
