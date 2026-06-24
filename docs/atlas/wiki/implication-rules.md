# Implication Rules

## Purpose

Implications are automatic relationships. They must be conservative.

A bad implication can damage search results across the library.

## Direction

Implications go from specific to broader.

Correct:

```txt
horse -> mammal
mammal -> animal
etching -> printmaking
engraving -> printmaking
```

Incorrect:

```txt
animal -> horse
printmaking -> engraving
```

The broader concept does not imply the narrower one.

## Automatic vs. Suggested

Use three relationship strengths.

- `automatic`: always true enough to apply silently
- `suggested`: often useful, but needs confirmation
- `related`: useful for browsing only

Examples:

```txt
engraving -> printmaking
strength: automatic

apollo_(deity) -> bow
strength: suggested

serpent related_to dragon
strength: related
```

## Safe Implications

Good automatic implications usually express:

- subtype to parent
- technique to broader technique
- named entity to broad entity class
- exact medium to broader medium category

Examples:

```txt
apollo_(deity) -> mythological_figure
python_(mythology) -> mythological_creature
engraving -> printmaking
old_master_print -> print
```

## Unsafe Implications

Do not automatically imply:

- visual content from source context
- mood or theme from artist
- art movement from artist
- attributes that should be classifiers
- associated objects that are merely common
- specific species, breed, identity, or material from weak visual evidence

Examples:

```txt
hendrick_goltzius -> mannerism
status: suggested, not automatic

apollo_(deity) -> bow
status: suggested, not automatic

python_(mythology) -> serpent
status: suggested unless page rule proves it is safe
```

## Classifiers Are Not Implications

Do not use implications for attributes.

Avoid:

```txt
blue_shirt -> shirt
```

Prefer:

```txt
shirt + color:blue
```

## Implication Review Checklist

Before approving an implication, answer:

1. Is it always true?
2. Is the direction specific-to-broad?
3. Would it damage search if applied to every asset with the source tag?
4. Is this really an attribute classifier?
5. Is this really a source claim?
6. Is this only a common association?
7. Does the wiki page explain the rule?

If uncertain, use `suggested`.
