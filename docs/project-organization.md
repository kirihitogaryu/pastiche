# Project Organization

This document explains where Pastiche project files belong.

## Root

- `README.md`: project overview and entry point.
- `.gitignore`: ignored local, build, dependency, and archive/runtime files.
- `src/`: future application source. Keep this empty until the app is scaffolded.

## Documentation

- `docs/product/`: product direction, handoff notes, workflows, and feature sequencing.
- `docs/design/`: visual design, responsive layout notes, interaction design, and design tokens.
- `docs/design/mockups/`: preserved design mockups and prototypes that are reference material rather than production source.
- `docs/architecture/`: system architecture, storage model, backend shape, data flow, and technical sketches.
- `docs/decisions/`: architecture decision records for durable technical choices.
- `docs/superpowers/specs/`: design specs created before implementation planning.
- `docs/superpowers/plans/`: task-by-task implementation plans.

## Naming Conventions

- Use lowercase kebab-case for new Markdown files.
- Prefix dated specs and plans with `YYYY-MM-DD`.
- Keep preserved external artifacts under the closest matching docs folder instead of leaving them at the project root.

## Git Policy

Commit documentation, source code, design specs, implementation plans, sample fixtures, and intentional mockups.

Do not commit local archive contents, generated thumbnails, cache directories, runtime databases, dependency folders, build output, logs, or secret environment files.
