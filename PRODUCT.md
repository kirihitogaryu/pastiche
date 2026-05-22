# Product

## Register

product

## Users

Pastiche is for artists and visual creators who collect references, source images, palettes, study material, and moodboard fragments as part of their studio practice.

The primary user context is personal, focused, and iterative: browsing through saved references, saving new material, enriching metadata, comparing colors, and reusing images in artwork or moodboards. iPad portrait is a first-class browsing context because a large share of use will be scrolling through images, selecting references, and inspecting saved material.

## Product Purpose

Pastiche is a local-first personal artist reference operating system. It combines a durable image archive, capture workflow, color-analysis suite, curated art/source browser, and lightweight moodboard canvas.

Success means reference work feels continuous: discover or capture an image, save it, enrich its metadata, analyze color, and reuse it without switching between separate tools.

## Brand Personality

Elegant, archival, studio-minded, and artistic.

The product should feel like a serious creative tool rather than a social feed, a generic SaaS dashboard, or a decorative portfolio site. It should support long sessions of browsing, sorting, and thinking without visual noise.

## Anti-references

- Do not make Pastiche feel like a Pinterest clone or algorithmic social feed.
- Do not make it feel like a generic productivity SaaS dashboard.
- Do not turn the canvas into a full Figma clone.
- Do not hide the user's archive inside proprietary blob storage.
- Do not use decorative glassmorphism, generic purple gradients, oversized marketing hero patterns, or card-heavy landing-page composition for the app shell.
- Do not rely on hover, right-click, or a persistent three-panel desktop layout for core workflows.

## Design Principles

1. Library first, discovery second. Explore is a capture lane into the archive, not the center of gravity.
2. The Inspector is the intelligence layer. It should make each image more useful through metadata, tags, color, related assets, and reuse actions.
3. Files stay real. The archive should remain inspectable, durable, and compatible with ordinary filesystem backup.
4. One adaptive app shell. Modes, tokens, and Inspector content stay consistent while placement changes by viewport.
5. Browsing must stay fluid. Search, breadcrumbs, filters, folders, and image selection should support fast movement through large visual collections.

## Accessibility & Inclusion

Target WCAG AA where practical while preserving the quiet, archival visual tone. The interface should be accessible without becoming harshly high-contrast by default.

Keyboard navigation is a foundational requirement and should be designed from the beginning. Core workflows should support keyboard focus, visible focus states, predictable tab order, and non-pointer alternatives.

Support reduced motion, avoid motion that blocks task flow, and make palette/tag/status states understandable without relying on color alone. Touch layouts should use comfortable target sizes and should not depend on hover-only controls.

## Responsive Shell Direction

The basic shell uses a hybrid of the current desktop mockup and a workspace-first touch model.

- Desktop keeps the strong archive-tool shape: top bar, collapsible sidebar or icon rail, main workspace, and Inspector.
- The sidebar should be retractable across modes, collapsing to a thin icon rail while preserving navigation.
- iPad portrait is the baseline touch browsing model: breadcrumb/file path controls above search and filters, a fast scrolling image grid, and easy reference selection.
- On iPad, selecting an image opens a right-entry Inspector drawer that squeezes the image grid left instead of fully replacing it.
- Phone uses a simplified Pinterest-like browsing view for discovery and folders, with top breadcrumb/search/filter controls and a bottom navigation bar.
- On phone, opening an image pushes a separate inspect screen with a back button that restores the exact previous browsing state.
