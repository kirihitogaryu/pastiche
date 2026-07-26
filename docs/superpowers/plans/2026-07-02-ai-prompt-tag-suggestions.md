# AI Prompt Tag Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NovelAI positive and character prompt tags appear as actionable Atlas suggested tags, with one-click and add-all acceptance, while keeping `artist:` prompt tokens in a separate artist-style reference lane.

**Architecture:** Reuse parsed `AiGenerationMetadata.promptTokens` as the source of truth. Add a small prompt-suggestion view model helper that filters only positive/character positive tag tokens, removes accepted Atlas concepts, and converts display labels to canonical slugs. The Atlas AI metadata component renders the suggestions and emits Atlas patch requests through the existing inspect patch flow.

**Tech Stack:** Svelte 5, TypeScript, Vitest, existing Atlas patch API.

---

## File Map

- Create `src/lib/atlas/aiPromptSuggestions.ts`: pure helper for accepted-slug filtering and display/slug mapping.
- Create `src/lib/atlas/aiPromptSuggestions.spec.ts`: tests for NAI syntax-stripped suggestions, negative prompt exclusion, artist style separation, and accepted-concept filtering.
- Modify `src/lib/components/atlas/AtlasAiMetadataSection.svelte`: render `AI Suggested Tags`, `Add all`, per-pill buttons, and an artist-style reference add field.
- Modify `src/lib/components/atlas/AtlasAssetInspect.svelte`: pass approved concept slugs and patch callback into the AI metadata section.

## Task 1: Prompt Suggestion Helper

- [ ] Write failing tests in `src/lib/atlas/aiPromptSuggestions.spec.ts`.
- [ ] Run `npm run test:unit -- --run src/lib/atlas/aiPromptSuggestions.spec.ts`.
- [ ] Implement `src/lib/atlas/aiPromptSuggestions.ts`.
- [ ] Verify the tests pass.

## Task 2: Atlas AI Metadata Actions

- [ ] Modify `AtlasAiMetadataSection.svelte` to use the helper and render clickable suggestion pills plus `Add all`.
- [ ] Add an artist-style input that emits an `artist_style:<slug>` concept patch for manually assigned styles.
- [ ] Modify `AtlasAssetInspect.svelte` to pass approved slugs and `queueAtlasPatch` to the AI section.
- [ ] Run `npm run check`.

## Task 3: Verification

- [ ] Run `npm run test:unit -- --run src/lib/atlas/aiPromptSuggestions.spec.ts src/lib/server/library/novelAiGeneration.spec.ts`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Commit and push.
