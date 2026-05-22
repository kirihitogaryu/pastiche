# Information Architecture And Home Hub

Date: 2026-05-22

## Purpose

This document defines the first product information architecture for Pastiche and explains the role of Home as a workspace hub.

The goal is to avoid treating Pastiche as only a file browser. Pastiche is an archive, but it is also an artist workspace where references, canvases, notes, colors, and project planning can connect.

## Core Vocabulary

### Library

Library is the global archive.

It contains everything that is an image, file, or saved asset by default. Users can narrow Library through folders, tags, smart folders, search, filters, ratings, favorites, and metadata.

Library answers:

```text
What exists in my archive?
```

### Folders

Folders are structural organization inside the Library.

Folders are useful for browsing and storage-like navigation. They are not the same thing as Projects.

Folders answer:

```text
Where is this stored or grouped structurally?
```

### Projects

Projects are discrete creative workspaces.

A Project is a focused collection of related assets, canvases, notes, color direction, and planning material for a specific artwork, series, study, commission, or creative goal.

Projects answer:

```text
What am I working on?
```

Projects are not top-level folders, though they can feel folder-like in navigation. They are contextual workspaces layered over the global Library.

### Assets

Assets are images or files saved into Pastiche.

An asset belongs to the global Library by default and can also belong to one or more Projects.

An image can belong to multiple Projects because Projects are contexts, not ownership containers.

### Tags

Tags are global by default.

Global tags keep the archive convenient to search and organize. Project-specific tag views or filters can exist later, but the base vocabulary should remain global unless a later workflow proves otherwise.

### Canvases

Canvases are visual planning surfaces.

They are expected to play a major role inside Projects because they connect inspiration images, notes, reminders, color direction, and visual relationships.

Canvases are where Pastiche becomes an artist workspace rather than only an art curation or image-file system.

### Notes

Notes can attach to Projects, Canvases, or Assets.

Notes should support reminders, planning fragments, source thoughts, visual analysis, and practical art-making context.

### Colors

Color tools are global, contextual, and project-aware.

Colors can be opened from an image, palette, or Project. In Projects, the color engine should eventually help represent intended palette direction for the work.

## Relationship Model

Initial relationship rules:

- Every saved image/file is part of Library.
- Library can be narrowed by folders, tags, metadata, and smart folders.
- Projects collect related assets, canvases, notes, and color direction.
- Assets can belong to multiple Projects.
- Tags are global by default.
- Canvases can be associated with Projects.
- Project canvases can include Library assets without duplicating files.
- Explore saves or stages external assets into Library and optionally into a Project.

## Project Role

Projects are an artist feature.

They provide an organized workspace for the specific thing the user is working on, so the user does not have to wade through everything or rely on broad tag searches to find relevant material.

A Project may include:

- referenced assets
- canvases
- notes
- reminders
- color palettes
- saved searches
- project-specific collections
- later connection nodes or relationship maps

Projects should make it easy to gather and shape inspiration, not only store images.

## Canvas Role In Projects

Canvases are likely the core of Project organization.

They should eventually support:

- placing inspiration images
- arranging and resizing references
- visual relationship mapping
- notes and reminders
- color palette blocks
- project planning fragments
- exporting project boards

The first implementation can be simpler, but the information architecture should assume canvases become central to project work.

## Home Hub

Home is the app-level workspace hub.

Home is not a generic dashboard and not a marketing landing page. It should feel like a studio table: a practical place to resume, orient, and choose what to work on.

Home answers:

```text
Where do I want to go next?
```

## Home Content

Useful Home sections can include:

- pinned Projects
- recent Projects
- recent Canvases
- recent imports
- continue where you left off
- quick Add/import button
- Library entry points
- smart folders or saved views
- folder and tag hierarchy overview
- storage/archive health

The design should stay focused. Home should not become a generic metrics dashboard.

## Empty Home State

When empty, Home should greet the user and offer simple starts.

Example shape:

```text
Hi, [username].
Start your archive by importing images or creating a Project.
```

Primary actions:

- Import images
- Create Project
- Explore sources

Avoid a long SaaS onboarding checklist. Keep the tone personal and studio-minded.

## Full Home State

When the archive is active, Home should prioritize continuation.

Useful surfaces:

- pinned Projects first
- recently opened Project or Canvas
- recent imports that still need tags
- untagged or unsorted items
- active palettes or color references
- quick links into Library and Explore

Home should help the user re-enter creative work quickly.

## Navigation Implications

The primary app modes are:

- Home
- Library
- Explore
- Canvas
- Colors
- Resources

On phone, bottom navigation may not have room for every top-level mode. It can use:

```text
Library / Explore / Add / Canvas / Resources
```

Home can remain available through the wordmark, a More menu, or a later navigation decision. On tablet and desktop, Home belongs in the left rail.

## Open Questions

- Should Home have a permanent bottom-nav slot on phone, or live behind the wordmark/More menu?
- Can a Canvas exist outside a Project?
- Can a Project have nested folders, or only collections/views?
- How should Project assets appear inside the global Library?
- Does adding an image to a Project imply tagging or folder movement?
- How should project-specific color direction be represented?
- What is the first simple version of connection nodes?

## Success Criteria

- Library is understood as the global archive.
- Projects are understood as creative workspaces, not folders.
- Assets can belong to multiple Projects.
- Tags remain global by default.
- Canvases are planned as central Project surfaces.
- Home gives users a practical studio hub without becoming a generic dashboard.
- Empty Home gives a clear first action without overexplaining.
