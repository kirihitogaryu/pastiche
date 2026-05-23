---
name: Pastiche
status: seed
register: product
iconSystem: Phosphor
colorMode: dark
---

# Overview

Pastiche is an elegant, archival, studio-minded artist reference tool. The interface should feel like a quiet creative archive: image-first, dense when useful, and calm enough for long browsing sessions.

The design system is seeded from the current mockups and should be refreshed after real components exist.

# Color

Use a restrained dark product palette with warm neutral surfaces. Avoid pure black and pure white. Prefer tinted neutrals, quiet borders, and a small warm accent for selected states and primary actions.

Suggested CSS token direction:

```css
:root {
  --color-bg: oklch(13% 0.01 70);
  --color-surface: oklch(17% 0.01 70);
  --color-surface-raised: oklch(22% 0.012 70);
  --color-border: oklch(100% 0 0 / 0.11);
  --color-text: oklch(90% 0.01 75);
  --color-muted: oklch(70% 0.012 75);
  --color-dim: oklch(52% 0.012 75);
  --color-accent: oklch(78% 0.08 78);
  --color-danger: oklch(62% 0.18 28);
}
```

# Typography

Use Crimson Text for headings and the restrained italic wordmark. Use Montserrat for body text, controls, labels, and metadata.

# Layout

Use responsive, image-first layouts:

- phone: bottom navigation, masonry browsing, separate inspect screen
- iPad portrait: browse-first with drawer inspection
- iPad landscape and desktop: rail, workspace, optional sidebar, persistent Inspector

# Components

Core components:

- Phosphor icon buttons
- mode rail and bottom nav
- breadcrumb path
- search field
- filter chips
- image cards
- Inspector sections
- palette row
- Add drawer/popover
- selection action bar
- focused preview overlay

Desktop browse uses the top bar as the command surface. Category/source/tag filtering should live in the Filter modal rather than persistent chip strips that reduce browsing space.

# Motion

Use short, stateful transitions only. Drawer, Inspector, selection bar, and preview overlay motion should orient the user without delaying browsing.

# Do's And Don'ts

Do use abstract art mockups to test density and visual rhythm.
Do preserve keyboard navigation and visible focus states.
Do make image browsing feel fast and calm.
Do keep Phosphor icons consistent.

Do not use Material icons as placeholders.
Do not use generic dashboard cards for Home.
Do not make Explore feel like an algorithmic feed.
Do not rely on hover or right-click for core workflows.
