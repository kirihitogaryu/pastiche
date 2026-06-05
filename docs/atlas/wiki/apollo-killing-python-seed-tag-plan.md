# Apollo Killing the Python Seed Tag Plan

## Purpose

Use `Apollo Killing the Python` as the first dense Atlas tagging fixture.

This image is useful because it includes source metadata, artist attribution complexity, named mythological entities, visible action, medium/technique, inscription text, and annotation candidates.

Primary sources:

- LACMA object record: `https://collections.lacma.org/object/64458`
- Wikimedia Commons file: `https://commons.wikimedia.org/wiki/File:Apollo_Killing_the_Python_LACMA_54.70.1i.jpg`
- Hendrick Goltzius background: `https://en.wikipedia.org/wiki/Hendrick_Goltzius`

## Scope

First pass target: fewer than 50 seed concepts.

This is not exhaustive. The goal is to create enough branching concepts to test the wiki, tagging, search, and inspect model.

## Source Claims

These are asset claims, not normal visual tags.

1. `title = Apollo Killing the Python`
2. `institution = LACMA`
3. `source = Wikimedia Commons`
4. `source_record = LACMA object 64458`
5. `accession_number = 54.70.1i`
6. `medium = engraving`
7. `classification = print`
8. `date = 1589`
9. `rights = public_domain_or_source_claim`
10. `dimensions = source_record_dimensions`

## Entity Seeds

1. `hendrick_goltzius`
   - kind: entity
   - type: artist
   - evidence: metadata
   - note: distinguish `artist`, `after_artist`, and source wording

2. `apollo_(deity)`
   - kind: entity
   - type: mythological_figure
   - evidence: metadata / iconographic

3. `python_(mythology)`
   - kind: entity
   - type: mythological_creature
   - evidence: metadata / iconographic

4. `apollo_killing_the_python`
   - kind: entity
   - type: narrative_subject
   - evidence: metadata

5. `greek_mythology`
   - kind: entity or context tag
   - type: tradition
   - evidence: metadata / iconographic

6. `classical_mythology`
   - kind: context tag
   - evidence: metadata / iconographic

7. `lacma`
   - kind: entity
   - type: institution
   - evidence: metadata

8. `wikimedia_commons`
   - kind: entity
   - type: source
   - evidence: metadata

## Visual Tag Seeds

1. `male_figure`
2. `serpent`
3. `bow`
4. `arrow`
5. `inscription`
6. `landscape`
7. `tree`
8. `cloud`
9. `cityscape`
10. `rock`
11. `standing_pose`
12. `reclining_creature`
13. `drawing_bow`
14. `shooting_arrow`
15. `wounded_creature`
16. `wide_composition`
17. `diagonal_composition`
18. `figure_left_composition`
19. `creature_right_composition`
20. `monochrome`
21. `line_art`
22. `hatching`
23. `cross_hatching`
24. `mythological_scene`

## Theme and Mood Seeds

1. `violence`
2. `heroic_mood`

## Medium and Technique Seeds

1. `engraving`
2. `printmaking`
3. `print`
4. `old_master_print`

Proposed automatic implications:

```txt
engraving -> printmaking
old_master_print -> print
```

Review before approving:

```txt
engraving -> print
```

The exact relationship between medium, technique, and classification should be source-aware.

## Classifier Seeds

1. `position`
   - likely values: `left`, `right`, `center`, `foreground`, `background`

2. `action_role`
   - likely values: `attacker`, `target`, `victim`

3. `language`
   - likely values: `latin`, `unknown`

4. `state`
   - likely values: `wounded`, `dead`, `active`, `reclining`

5. `view`
   - likely values: `front`, `profile`, `three_quarter`

6. `scale`
   - likely values: `dominant`, `large`, `small`

7. `technique_visibility`
   - likely values: `hatching`, `cross_hatching`, `linework`

## Annotation Targets

Create annotation candidates for:

1. Apollo figure
2. Python head
3. Python body
4. bow
5. arrows
6. Latin inscription
7. background city
8. landscape valley
9. tree and foliage
10. arrow wounds

The inscription is a priority annotation because it can support OCR, transcription, translation, and narrative confirmation.

## Confusable and Boundary Checks

- `python_(mythology)` vs. `serpent`
- `serpent` vs. `dragon`
- `apollo_(deity)` vs. generic `male_figure`
- `engraving` vs. `etching`
- `print` vs. `printmaking`
- `artist` vs. `after_artist`
- `mythological_scene` vs. `religious_scene`
- `heroic_mood` vs. subjective praise

## First Wiki Pages To Write

Highest priority:

1. `hendrick_goltzius`
2. `apollo_(deity)`
3. `python_(mythology)`
4. `serpent`
5. `bow`
6. `arrow`
7. `engraving`
8. `inscription`
9. `mythological_scene`
10. `after_artist`

## Stop Line

Do not exceed 50 seed concepts in the first implementation pass unless the user explicitly approves expansion.

If a branch creates too many possible tags, record it as a future tag group instead of expanding immediately.
