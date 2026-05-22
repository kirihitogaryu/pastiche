# Pastiche Project Organization Design

Date: 2026-05-22

## Purpose

Pastiche is moving from loose planning files into a serious project workspace. The first setup pass should make the project easy to navigate, preserve existing product/design context, and avoid prematurely committing to application code before the responsive shell, storage model, and first metadata schema are written down.

This setup establishes `/home/kristoph/Desktop/pastiche` as the standalone project root.

## Recommended Approach

Use a documentation-first project skeleton now, then scaffold the application after the next design decisions are clearer.

This keeps the current handoff brief and HTML mockup as first-class reference material while creating obvious places for product notes, design work, architecture decisions, and future implementation files.

## Repository Boundary

The Pastiche project should have its own Git repository rooted at:

```text
/home/kristoph/Desktop/pastiche
```

This prevents project commits, status checks, and future automation from interacting with unrelated files elsewhere in the user home directory.

## Target Folder Layout

```text
pastiche/
  README.md
  .gitignore
  docs/
    project-organization.md
    architecture/
    decisions/
      README.md
    design/
      mockups/
        pastiche_ui_v3.html
    product/
      pastiche-app-handoff.md
    superpowers/
      specs/
        2026-05-22-project-organization-design.md
  src/
```

## Folder Responsibilities

`README.md`

The front door for the project. It should explain what Pastiche is, where important files live, and what the next planned work is.

`docs/project-organization.md`

The working map for contributors and future sessions. It should describe naming conventions, where to put new planning files, where mockups live, and what should not be committed.

`docs/product/`

Product direction, handoff notes, user workflows, scope decisions, and feature sequencing.

`docs/design/`

Design language, responsive shell notes, visual references, mockups, and interaction specifications.

`docs/design/mockups/`

Preserved mockup artifacts. The current `pastiche_ui_v3.html` belongs here because it is reference material, not production source code.

`docs/architecture/`

System architecture notes, storage model, backend shape, data flow, and technical sketches.

`docs/decisions/`

Architecture decision records and durable technical choices. Start with a README that explains the convention; add numbered decision files later as choices are made.

`docs/superpowers/specs/`

Design specs written during planning workflows.

`src/`

Reserved for future application source. It can remain empty until the SvelteKit project is scaffolded or another implementation structure is chosen.

## Git Ignore Policy

The initial `.gitignore` should anticipate a future SvelteKit/Node app without hiding important planning artifacts.

It should ignore:

- dependency folders such as `node_modules/`
- build output such as `.svelte-kit/`, `build/`, and `dist/`
- environment files such as `.env` and `.env.*`
- logs and temporary files
- local archive/runtime data such as `workspace.sqlite`, `originals/`, `thumbnails/`, `palettes-cache/`, `imports/`, and `exports/`

It should not ignore:

- docs
- mockups
- design specs
- future source code
- sample schemas or fixtures that are intentionally checked in

## File Move Rules

The two existing root files should be moved without changing their content:

```text
pastiche-app-handoff.md -> docs/product/pastiche-app-handoff.md
pastiche_ui_v3.html -> docs/design/mockups/pastiche_ui_v3.html
```

Links in new docs should point to the moved locations.

## Out Of Scope For This Setup

This setup should not scaffold SvelteKit, install dependencies, create a database schema, implement the UI, or rewrite the HTML mockup.

Those belong in later specs/plans after the responsive shell, archive/storage model, and metadata schema decisions are captured.

## Success Criteria

- `/home/kristoph/Desktop/pastiche` is its own Git repository.
- The project has a clear README.
- Existing planning and mockup files live in documented homes.
- The folder structure makes future product, design, architecture, and implementation work easy to place.
- Local runtime/archive data is excluded from Git by default.
- No application framework is scaffolded yet.
