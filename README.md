# Pastiche

Pastiche is a local-first personal artist reference operating system: image archive, capture tool, color suite, curated source browser, and moodboard canvas.

The project is currently building its first frontend vertical slice: a SvelteKit shell with mock data, responsive Library and Explore surfaces, Inspector behavior, and mobile interaction states.

## Current Project State

- Product design context for UI work lives at `PRODUCT.md`.
- Seed visual-system context lives at `DESIGN.md`.
- The product handoff brief lives at `docs/product/pastiche-app-handoff.md`.
- The current HTML design mockup lives at `docs/design/mockups/pastiche_ui_v3.html`.
- The mobile interface plan lives at `docs/design/mobile-interface-plan.md`.
- The tablet/desktop interface plan lives at `docs/design/tablet-desktop-interface-plan.md`.
- The information architecture and Home hub plan lives at `docs/product/information-architecture-home-hub.md`.
- Project organization rules live at `docs/project-organization.md`.
- Planning specs live at `docs/superpowers/specs/`.
- Implementation plans live at `docs/superpowers/plans/`.

## Development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Run checks and tests:

```sh
npm run check
npm run test
```

Build the app:

```sh
npm run build
```

## Near-Term Direction

1. Build the first frontend vertical slice.
2. Verify responsive shell behavior across phone, iPad portrait, iPad landscape, and desktop.
3. Iterate on the visual system from the running app.
4. Define the archive/storage model.
5. Define the first metadata schema.
6. Add real local/server persistence after the shell direction feels right.
