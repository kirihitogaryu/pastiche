# Project Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/home/kristoph/Desktop/pastiche` into a standalone, documentation-first project workspace with clear homes for product notes, design references, architecture notes, and future application code.

**Architecture:** This setup creates a lightweight project skeleton without scaffolding an application framework. Existing planning and mockup files are preserved as reference artifacts under `docs/`, while `src/` is reserved for future app code.

**Tech Stack:** Git, Markdown documentation, static HTML mockup reference, future-ready Node/SvelteKit ignore patterns.

---

## File Structure

- Create `/home/kristoph/Desktop/pastiche/README.md`: project overview, current status, important paths, and next work.
- Create `/home/kristoph/Desktop/pastiche/.gitignore`: future Node/SvelteKit build ignores plus local archive/runtime data ignores.
- Create `/home/kristoph/Desktop/pastiche/docs/project-organization.md`: durable guide to where files belong.
- Create `/home/kristoph/Desktop/pastiche/docs/decisions/README.md`: architecture decision record convention.
- Create `/home/kristoph/Desktop/pastiche/docs/architecture/.gitkeep`: preserve the architecture docs folder until first architecture note exists.
- Create `/home/kristoph/Desktop/pastiche/src/.gitkeep`: preserve the future source folder before app scaffolding.
- Move `/home/kristoph/Desktop/pastiche/pastiche-app-handoff.md` to `/home/kristoph/Desktop/pastiche/docs/product/pastiche-app-handoff.md`.
- Move `/home/kristoph/Desktop/pastiche/pastiche_ui_v3.html` to `/home/kristoph/Desktop/pastiche/docs/design/mockups/pastiche_ui_v3.html`.

### Task 1: Create Documentation Skeleton

**Files:**

- Create: `/home/kristoph/Desktop/pastiche/README.md`
- Create: `/home/kristoph/Desktop/pastiche/docs/project-organization.md`
- Create: `/home/kristoph/Desktop/pastiche/docs/decisions/README.md`
- Create: `/home/kristoph/Desktop/pastiche/docs/architecture/.gitkeep`
- Create: `/home/kristoph/Desktop/pastiche/src/.gitkeep`

- [x] **Step 1: Create required directories**

Run:

```bash
mkdir -p docs/architecture docs/decisions docs/design/mockups docs/product src
```

Expected: command exits successfully.

- [x] **Step 2: Add project README**

Create `/home/kristoph/Desktop/pastiche/README.md` with:

```markdown
# Pastiche

Pastiche is a local-first personal artist reference operating system: image archive, capture tool, color suite, curated source browser, and moodboard canvas.

The project is currently in a documentation-first setup phase. The next major work is to specify the responsive app shell, archive/storage model, and first metadata schema before scaffolding the SvelteKit application.

## Current Project State

- The product handoff brief lives at `docs/product/pastiche-app-handoff.md`.
- The current HTML design mockup lives at `docs/design/mockups/pastiche_ui_v3.html`.
- Project organization rules live at `docs/project-organization.md`.
- Planning specs live at `docs/superpowers/specs/`.
- Implementation plans live at `docs/superpowers/plans/`.

## Near-Term Direction

1. Finish the project organization setup.
2. Write the responsive shell spec.
3. Convert the current mockup into design tokens and layout rules.
4. Define the archive/storage model.
5. Define the first metadata schema.
6. Scaffold the app once those decisions are documented.
```

- [x] **Step 3: Add project organization guide**

Create `/home/kristoph/Desktop/pastiche/docs/project-organization.md` with:

```markdown
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
```

- [x] **Step 4: Add decision record guide**

Create `/home/kristoph/Desktop/pastiche/docs/decisions/README.md` with:

````markdown
# Architecture Decisions

Use this folder for durable project decisions that future contributors should not have to rediscover.

Decision files should use this naming pattern:

```text
0001-short-decision-title.md
```
````

Each decision should include:

- status
- context
- decision
- consequences

Start a new decision record when the project chooses a framework, storage model, database ownership rule, capture protocol, or similarly durable technical direction.

````

- [x] **Step 5: Preserve empty future folders**

Create empty marker files:

```bash
touch docs/architecture/.gitkeep src/.gitkeep
````

Expected: both files exist.

### Task 2: Add Ignore Rules And Move Existing Artifacts

**Files:**

- Create: `/home/kristoph/Desktop/pastiche/.gitignore`
- Move: `/home/kristoph/Desktop/pastiche/pastiche-app-handoff.md`
- Move: `/home/kristoph/Desktop/pastiche/pastiche_ui_v3.html`

- [x] **Step 1: Add `.gitignore`**

Create `/home/kristoph/Desktop/pastiche/.gitignore` with:

```gitignore
# Dependencies
node_modules/

# Build output
.svelte-kit/
build/
dist/
.vite/

# Environment and secrets
.env
.env.*
!.env.example

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*

# OS/editor noise
.DS_Store
Thumbs.db
.idea/
.vscode/

# Local archive/runtime data
workspace.sqlite
workspace.sqlite-*
originals/
thumbnails/
palettes-cache/
imports/
exports/
moodboards/
```

- [x] **Step 2: Move product handoff brief**

Run:

```bash
mv pastiche-app-handoff.md docs/product/pastiche-app-handoff.md
```

Expected: the handoff brief exists only at `docs/product/pastiche-app-handoff.md`.

- [x] **Step 3: Move design mockup**

Run:

```bash
mv pastiche_ui_v3.html docs/design/mockups/pastiche_ui_v3.html
```

Expected: the mockup exists only at `docs/design/mockups/pastiche_ui_v3.html`.

### Task 3: Verify And Commit Setup

**Files:**

- Verify all files created or moved in Tasks 1 and 2.

- [x] **Step 1: Check expected file list**

Run:

```bash
find . -maxdepth 4 -type f | sort
```

Expected output includes:

```text
./.gitignore
./README.md
./docs/architecture/.gitkeep
./docs/decisions/README.md
./docs/design/mockups/pastiche_ui_v3.html
./docs/product/pastiche-app-handoff.md
./docs/project-organization.md
./docs/superpowers/plans/2026-05-22-project-organization.md
./docs/superpowers/specs/2026-05-22-project-organization-design.md
./src/.gitkeep
```

- [x] **Step 2: Check Git status**

Run:

```bash
git status --short
```

Expected: only intentional setup files are untracked or modified.

- [ ] **Step 3: Commit setup**

Run:

```bash
git add .
git commit -m "Set up project workspace"
```

Expected: commit succeeds.
