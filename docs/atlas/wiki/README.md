# Atlas Wiki Source

These files are the source drafts for the Pastiche Atlas wiki.

The Atlas wiki defines the vocabulary humans and AI agents use when creating tags, entities, claims, classifiers, relationships, and review notes. The in-app wiki should eventually render these documents, but Markdown remains the reviewable source while the interface is still forming.

## Core Rule Pages

- [Wiki Style Guide](./style-guide.md)
- [Contribution Guidelines](./contribution-guidelines.md)
- [Tagging Rules](./tagging-rules.md)
- [Artist Entity Style Guide](./artist-entity-style-guide.md)
- [Implication Rules](./implication-rules.md)
- [AI Agent Tagging Rules](./ai-agent-tagging-rules.md)
- [Wiki Entry Templates](./wiki-entry-templates.md)
- [Apollo Killing the Python Seed Tag Plan](./apollo-killing-python-seed-tag-plan.md)

## Reference Model

Pastiche borrows useful wiki and tagging patterns from Danbooru: tag pages, tag groups, aliases, implications, meta-wikis, and dense contribution rules. Pastiche does not copy Danbooru's public-imageboard culture, NSFW rules, rating system, or one-size-fits-all tag model.

Useful reference pages:

- Danbooru `howto:tag`
- Danbooru `howto:tag_checklist`
- Danbooru `help:qualifiers`
- Danbooru `tag_groups`
- Danbooru `list_of_meta-wikis`
- Wikidata data model

If a linked external page is unavailable, preserve the principle rather than the exact wording.

## First Principle

Atlas metadata should become richer without becoming less trustworthy.

Every concept should answer three questions:

1. What is it?
2. When should it be used?
3. What nearby thing is a better fit when this is wrong?

## Top-Level Wiki Groups

The wiki sidebar is a browse index, not the ontology truth. A concept may appear in more than one browse path, but every concept opens one canonical page.

Initial top-level groups:

- Identity and Source
- Artists and Makers
- Works
- Series / IP / Copyrighted Worlds
- Characters
- Mythology and Iconography
- Subjects / Visual Entities
- Objects
- Actions and Poses
- Composition
- Medium and Technique
- Style and Movement
- Setting and Architecture
- Color, Light, and Value
- Text and Inscriptions
- Classifiers
- Theme and Mood
- System and Review

Use `Series / IP / Copyrighted Worlds` for reusable fictional source worlds, franchises, and copyrighted properties. This is not the same as rights or copyright status.

Use `Characters` for fictional, mythological, religious, literary, game, anime, and other named narrative figures. Do not mix character entities into ordinary visual subject groups such as `woman`, `dog`, or `tree`.

Use `Mythology and Iconography` for traditions, narrative subjects, and symbolic systems that behave like source context but are not modern IP.
