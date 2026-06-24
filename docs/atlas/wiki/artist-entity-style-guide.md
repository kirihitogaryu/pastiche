# Artist Entity Style Guide

## Purpose

Artist entities are searchable creator records. They are not normal visual tags.

Artist pages should help users and AI agents identify works, normalize imported metadata, and avoid attribution mistakes.

## Required Fields

An artist entity page should include:

- canonical name
- name variants and aliases
- life dates, if known
- nationality or place context
- roles
- common media and techniques
- period or movement context
- common subjects and themes
- related artists, workshops, publishers, or followers
- attribution guidance
- source confirmation guidance
- external IDs and links
- example works in the library

## Roles

Use specific roles when source records support them.

Examples:

- artist
- engraver
- painter
- draftsman
- printmaker
- publisher
- designer
- after-artist
- attributed-to artist
- workshop

Do not flatten every relationship into `artist`.

## Attribution Claims

Attribution is a claim with provenance.

Examples:

```txt
artist = Hendrik Goltzius (after)
after_artist = Hendrick Goltzius
institution = LACMA
source_record = https://collections.lacma.org/object/64458
```

Different sources may disagree. Preserve the source of each claim.

## Artist vs. Style

Do not infer style tags automatically from an artist.

Correct:

```txt
artist:hendrick_goltzius
medium:engraving
```

Review before adding:

```txt
mannerism
dutch_mannerism
old_master_print
```

An artist page may suggest common movements, media, and themes, but those suggestions are not automatic assignments for every asset.

## Artist Entry Shape

Use this article structure:

1. Definition
2. Names and aliases
3. Roles and period
4. Use when
5. Do not use when
6. Attribution guidance
7. Common media, themes, and subjects
8. Related artists and entities
9. External authority links
10. Example works
11. AI guidance

## AI Guidance

AI may apply an artist entity only when:

- source metadata names the artist
- the user provides the artist
- an authoritative record links the asset to the artist

AI must not identify an artist by visual style alone unless creating a suggestion marked `inferred` and `needs_review`.

## Example: Hendrick Goltzius

For `hendrick_goltzius`, likely useful fields include:

- aliases: `hendrik_goltzius`
- roles: engraver, printmaker, draftsman, painter
- place context: Dutch
- period context: late sixteenth and early seventeenth century
- common media: engraving, print, drawing
- related concepts: `mannerism`, `old_master_print`, `classical_mythology`
- attribution warning: distinguish `artist`, `after_artist`, `publisher`, and `attributed_to`

Historical details require citation before the page becomes `reviewed`.
