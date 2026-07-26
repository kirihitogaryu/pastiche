# Dragon, Character, Pokemon, And Anthro Seed Corpus

## Purpose

This corpus exists to make Atlas ontology decisions concrete.

It deliberately mixes public-domain museum material, modern Danbooru-uploaded art, franchise characters, human characters, and anthro subjects so the tag model has to distinguish visual concepts, entities, claims, classifiers, implications, and browsing-only relations.

## Seed Assets

| Key                 | Local file                                                                                                                                                | Source URL                                                                                | Ontology pressure                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| digital_dragon      | `/home/kristoph/Downloads/imports/__original_drawn_by_nablange__157711c92221e96db5c444d791fd9698.jpg`                                                     | `https://danbooru.donmai.us/posts/7806601?q=ordfav%3AMillions_Knives`                     | Digital art, modern artist, generic dragon anatomy, Danbooru-style artist/tag metadata    |
| susanoo_orochi      | `/home/kristoph/Downloads/imports/Susano-o_no_Mikoto_Killing_the_Eight-headed_Dragon.jpg`                                                                 | `https://www.artic.edu/artworks/19386/susano-o-no-mikoto-killing-the-eight-headed-dragon` | Notable work, named deity, named dragon entity, Japanese mythology, color woodblock print |
| mega_dragonite      | `/home/kristoph/Downloads/imports/__dragonite_and_mega_dragonite_pokemon_drawn_by_deepsea9013__8c357f352c18d0a6549289b04f8d222a.jpg`                      | `https://danbooru.donmai.us/posts/9692781?q=user%3AMillions_Knives`                       | Pokemon franchise hierarchy, species/form distinction, IP style vs visible style          |
| ace_attorney_humans | `/home/kristoph/Downloads/imports/__klavier_gavin_and_kristoph_gavin_ace_attorney_and_1_more_drawn_by_lanfengzheyu__8db104fd15ee82f3b88efdccbe0c5463.png` | `https://danbooru.donmai.us/posts/9692240?q=user%3AMillions_Knives`                       | Human character entities, franchise grouping, clothing and design attributes              |
| anthro_subject      | `/home/kristoph/Downloads/imports/__original_drawn_by_egretfoooox__ff263959d93080069b4b8c70856409b9.jpg`                                                  | `https://danbooru.donmai.us/posts/9692641?q=user%3AMillions_Knives`                       | Anthro qualifier, species boundary, furry search separation from ordinary animals         |

## Imported Seed Assets

| Key            | Asset ID                                     | First-pass status            |
| -------------- | -------------------------------------------- | ---------------------------- |
| digital_dragon | `asset-b19b8754-ec68-42e5-ad5f-eb475fa2d81d` | Imported and manually tagged |

## Import Notes

- The Danbooru sources are user-owned uploads from the linked account.
- Danbooru tags are vocabulary hints, not Atlas truth. Convert them through Atlas rules.
- User-supplied Danbooru tag lists should be stored as source metadata / raw vocabulary, then manually converted into Atlas concepts, entities, classifiers, claims, or rejected notes.
- Future extension scraping should capture source tag rows, artist rows, source links, upload dates, ratings/review metadata if relevant, and commentary fields automatically so this manual transcription step is not required.
- Proposed source-tag conversions and implications must be reviewed manually before they become canonical Atlas vocabulary.
- Source metadata should become claims/entities.
- Visible content should become visual tags or annotation classifiers.
- Franchise/source identity must not imply a visible style.
- Anthro status must be explicit enough that `dog` and `anthro dog` remain meaningfully different searches.

## External Vocabulary Hints

### digital_dragon

- Artist: `nablange`
- Artist row: `nablange`
- Source category: `original`
- Published: `2018-03-20 13:35`
- Danbooru meta/source tags: `commentary_request`
- Danbooru general tags: `animal_focus`, `claws`, `dragon`, `from_side`, `full_body`, `green_scales`, `looking_at_viewer`, `monster`, `no_humans`, `profile`, `red_eyes`, `scales`, `simple_background`, `slit_pupils`, `solo`, `tail`, `western_dragon`, `white_background`, `wings`

### mega_dragonite

- Artist: `deepsea9013`
- IP: `pokemon`
- Character: `dragonite`
- Sub-character / form: `mega_dragonite`
- Published: `2025-07-24 22:35`
- Danbooru meta/source tags: `absurdres`, `commentary`, `english_commentary`, `highres`
- Danbooru general tags: `blue_eyes`, `blue_wings`, `claws`, `colored_skin`, `feathered_wings`, `feathers`, `flying`, `full_body`, `head_wings`, `horns`, `leg_wings`, `mega_pokemon`, `no_humans`, `outstretched_arm`, `pokemon_(creature)`, `pokemon_focus`, `single_horn`, `smoke`, `solo`, `sparkle`, `star_(sky)`, `tail`, `white_background`, `white_feathers`, `wings`, `yellow_skin`

### ace_attorney_humans

- Artist: `lanfengzheyu`
- IP: `ace_attorney`
- Work / game context: `apollo_justice:_ace_attorney`
- Characters: `klavier_gavin`, `kristoph_gavin`
- External artist/source URL: `https://lanfengzheyu.lofter.com/post/201d9033_2bcc0ad99`
- Danbooru meta/source tags: `commentary_request`, `highres`
- Danbooru general tags: `2boys`, `alternate_costume`, `alternate_hairstyle`, `black_jacket`, `blonde_hair`, `brothers`, `collared_jacket`, `from_behind`, `gyaruo`, `hair_ribbon`, `jacket`, `lapels`, `long_hair`, `male_focus`, `medium_hair`, `multiple_boys`, `painterly`, `pink_ribbon`, `popped_collar`, `ribbon`, `siblings`, `sketch`, `sunglasses`, `white_jacket`

### anthro_subject

- Artist: `egretfoooox`
- Source category: `original`
- External artist/source URL: `https://twitter.com/Egretfoooox/status/1609189513787748352`
- Published: `2022-12-31 14:07`
- Danbooru meta/source tags: `commentary_request`, `highres`
- Danbooru general tags: `1other`, `animal_nose`, `arms_up`, `black_boots`, `blonde_hair`, `bodysuit`, `boots`, `brown_coat`, `coat`, `dog_tail`, `full_body`, `furry`, `grey_eyes`, `hair_between_eyes`, `hair_over_shoulder`, `high_ponytail`, `lace-up_boots`, `latex`, `latex_bodysuit`, `long_coat`, `medium_hair`, `multiple_views`, `open_clothes`, `open_coat`, `ponytail`, `purple_eyes`, `scarf`, `simple_background`, `sketch`, `skin_tight`, `tail`, `tongue`, `tongue_out`, `white_background`

## Conversion Notes

### digital_dragon

- `dragon`, `western_dragon`, `claws`, `wings`, `tail`, `scales`, and `monster` are visible concepts or child/specialist tags.
- `green_scales`, `red_eyes`, and `slit_pupils` should become classifiers on the dragon annotation where possible.
- `from_side`, `profile`, `full_body`, `solo`, and `looking_at_viewer` are good classifier candidates, not necessarily standalone tags.
- `nablange` should become an artist entity or creator claim, not a visual tag.
- `green_dragon` should not become a free-standing visual tag by default. Prefer a search correction or parser alias from `green_dragon` to `dragon.scale_color:green` or `dragon.color:green`, so the color remains attached to the dragon annotation.
- Even simple creature art can carry many useful annotation-level attributes: slit pupils, spade tail tip, quadrupedal body plan, crouched stance, webbed/membranous wings rather than avian wings, gray underbelly, several horns, dorsal spines, and a long hooked snout.

### digital_dragon first-pass Atlas tags

Asset-level concepts:

- `dragon`
- `western_dragon`
- `simple_background`

Entities:

- artist: `nablange`
- source: `Danbooru`

Claims:

- published date: `2018-03-20 13:35`
- Danbooru post: `7806601`
- source category: `original`
- dimensions: `700 x 528 px`

Annotations:

```txt
dragon_body
concepts:
  dragon
  western_dragon
  monster
  claws
  wing
  tail
  scales
  horns
  spines
  snout
  underbelly
classifiers:
  visual_role: focal_point
  body_plan: quadruped
  pose: standing
  stance: crouched
  view: profile
  body_extent: full_body
  scale_color: green
  underbelly_color: gray
  eye_color: red
  pupil_shape: slit
  gaze: looking_at_viewer
  wing_position: raised
  wing_type: webbed_membrane
  tail_position: curved_up
  tail_tip_shape: spade
  horn_count: several
  spine_presence: dorsal_spines
  snout_shape: long_hooked
  head_position: lowered
  subject_count: solo

background_field
concepts:
  background
  simple_background
classifiers:
  visual_role: setting_context
  color: white
  complexity: simple
```

Deliberately not converted:

- `green_scales` as a standalone tag
- `red_eyes` as a standalone tag
- `slit_pupils` as a standalone tag
- `from_side` as a standalone tag
- `full_body` as a standalone tag
- `no_humans` as a normal visual tag

### mega_dragonite

- `pokemon` is an IP/franchise entity.
- `dragonite` is the base character/species entity.
- `mega_dragonite` is a form/sub-character entry tied to `dragonite`, not an unrelated character.
- `mega_pokemon` is a useful franchise/form category, but it should not imply visual style.
- `blue_wings`, `white_feathers`, `yellow_skin`, `single_horn`, and `head_wings` are classifier/detail candidates on the visible Dragonite annotations.

### ace_attorney_humans

- `ace_attorney` and `apollo_justice:_ace_attorney` are IP/work entities.
- `klavier_gavin` and `kristoph_gavin` are character entities.
- `brothers` and `siblings` are relationship/context tags or source-backed entity relations, not ordinary visible anatomy.
- Clothing, hair, and pose tags should become visual concepts or classifiers on the visible character annotations.
- `painterly` and `sketch` are visible style/technique tags, not implied by the IP.

### anthro_subject

- `furry` and `animal_nose` support an explicit anthro model.
- `dog_tail` is a species-form clue, but the asset should not automatically satisfy ordinary `dog` animal searches unless the search boundary explicitly allows anthro matches.
- Outfit tags such as `latex_bodysuit`, `long_coat`, `boots`, and `scarf` should be visible clothing concepts/classifiers.
- `multiple_views` is useful for reference search and should probably be a composition/reference tag or classifier.
- This seed should test gendered-subject rules: `androgynous_subject` is observed appearance, while `nonbinary_subject` and `intersex_subject` require known identity/source context.
- Ordinary non-anthro animals should not receive gender tags unless source-confirmed, unusually clear, or materially useful for retrieval.

## First-Pass Stop Line

Keep the first pass under 120 new concepts unless a concept is needed by at least two seed assets or directly protects search behavior.
