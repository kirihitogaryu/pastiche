# Pastiche Alpha-Readiness Implementation Plan

## Purpose

This plan takes Pastiche from its current feature-rich prototype into an alpha that is dependable for the core workflow:

1. capture an image at its best available quality;
2. preserve useful source and artist metadata;
3. organize it into folders;
4. tag it with a coherent Atlas vocabulary;
5. retrieve it quickly from desktop, tablet, or phone.

The phases are ordered by dependency. Tag governance must be trustworthy before bulk tagging; bulk operations need a clear result-set model before pagination; responsive polish should exercise those finished workflows; the Studio home can then summarize stable Library and Explore data.

---

## Phase 1 — Atlas Tag and Wiki Reliability

### Goal

Make every human and agent-assisted tag path predictable, reversible, and governed by the same resolver without applying AI-only publication rules to human edits.

### 1.1 Separate human approval from agent promotion

- Introduce an explicit approval policy at the governance boundary.
- Human approval requires:
  - a valid ontology classification;
  - an explicit click by the user;
  - a concept that is not blocked, deleted, merged, or deprecated.
- Human approval may leave the Wiki at `stub` or `draft` maturity and may leave prose/examples incomplete.
- Agent promotion retains the stricter gates:
  - usable short definition;
  - example or approved usage;
  - validated classification;
  - promotion to at least `usable`.
- Keep assignment approval independent from concept maturity. A user can deliberately assign a draft concept to an image without falsely presenting the concept as fully documented.
- Record which policy performed the transition so later audit UI can distinguish human approval from agent promotion.

### 1.2 Make generated Wiki references transactional

- Treat an AI Wiki result as an unsaved client draft only.
- On Save:
  - normalize aliases and relation targets;
  - resolve existing aliases and replacements;
  - create missing relation targets as `needs_review / stub`;
  - mark inferred classification as needing review rather than silently treating the concept as an object;
  - write the Wiki entry and all stubs in one database transaction.
- On Cancel, create nothing.
- Reject self-relations, blocked concepts, deprecated targets without an explicit replacement, tombstoned slugs, invalid automatic implications, and malformed classifier references.
- Return created-stub information with the save response so the editor can explain what entered the review queue.

### 1.3 Repair metadata-derived tag review

- Add a first-class review action for `atlas_tag_suggestions`.
- Resolve every suggestion through the shared Atlas resolver before assignment.
- Present:
  - preferred canonical expression;
  - classifier rewrite when valid;
  - aliases/replacements;
  - nearby alternatives;
  - explicit “create new concept” when no established match exists.
- A high-confidence established correction can be applied immediately after visible confirmation.
- An ambiguous suggestion requires a choice.
- An intentionally accepted unknown concept opens the compact classification draft and creates a reviewable stub only after confirmation.
- Mark the source suggestion accepted/rejected independently of the resulting assignment.
- Make application idempotent and preserve provenance from the original source metadata.

### 1.4 Close resolver gaps in manual entry

- Use the resolver for:
  - Inspect asset concepts;
  - annotation concepts;
  - extension-entered tags;
  - Wiki relationship entry;
  - metadata suggestion approval.
- Never bypass resolution merely because a suggestion was selected from a dropdown.
- Keep exact active concepts ahead of classifier decomposition.
- Keep ambiguous phrases such as `red dragon` user-selected.
- Prevent blocked, deleted, or deprecated concepts from being silently recreated.

### 1.5 Correct Fur Affinity artist attribution

- Prefer the submission byline inside the submission identity block.
- Cross-check the creator against the original `d.furaffinity.net/art/{artist}/...` media URL, which is scoped to the artwork rather than the signed-in navigation.
- Never use a global account/navigation link as a Fur Affinity submission artist fallback.
- Preserve the canonical artist profile URL and username.
- Add signed-in-page fixtures where the viewer and submission artist differ.

### Tests and completion criteria

- Human approval succeeds with valid classification but incomplete prose/examples.
- Agent promotion still rejects incomplete entries.
- Saving a Wiki draft with an unknown relation creates one review stub; canceling creates none.
- Wiki save rolls back if any reference is invalid.
- Metadata suggestions show resolver corrections and apply classifier annotations correctly.
- Reapplying a suggestion is idempotent.
- A Fur Affinity fixture with `viewer_account` and `actual_artist` attributes the work to `actual_artist`.
- Focused governance, Wiki, resolver, metadata component/API, extension adapter, typecheck, and build checks pass.

---

## Phase 2 — Bulk Organization and Bulk Tagging

### Goal

Make large image sets manageable without opening each asset, while preserving the distinction between moving a file between folders and globally deleting it.

### 2.1 One shared selection model

- Create a reusable selection controller for Library and Atlas results.
- Support:
  - individual selection;
  - select all on the visible page;
  - select all loaded items in infinite mode;
  - clear selection;
  - a later-compatible “all matching results” token.
- Preserve selection while the action sheet is open.
- Clear or reconcile selection after navigation, filtering, or mutation so hidden selections cannot surprise the user.

### 2.2 Repair move/add-to-folder

- Replace the viewport-overflowing anchored popover with:
  - an anchored, height-bounded popover on wide desktop;
  - a bottom sheet on phone/tablet;
  - internal scrolling and search in both.
- Show the current path, prevent impossible/self moves, and keep nested paths readable with capped visual indentation.
- Moving changes the images’ single Library folder membership.
- “Remove from folder” moves images to the parent or Library root; it never deletes them from Pastiche.
- Keep the operation transactional and show a concise undo affordance where practical.

### 2.3 Add bulk tagging

- Add “Tag selected” to both Library edit mode and Atlas selection mode.
- Use comma-separated multi-entry with tokenized pending tags.
- Resolve all entries before commit and group them into:
  - established;
  - corrected;
  - ambiguous;
  - new.
- Allow selecting a correction once and applying it to all selected assets.
- New concepts use the compact classification draft and remain reviewable.
- Perform the assignments in one validated transaction with idempotent behavior.

### 2.4 Bulk removal and deletion language

- Distinguish:
  - remove from this folder;
  - move to another folder;
  - remove a tag assignment;
  - delete the image from Pastiche.
- Use a single confirmation dialog for global deletion with a visible asset count.
- Do not bury destructive actions beside routine folder moves.

### Tests and completion criteria

- Move sheet fits 320 px phone height/width constraints and remains keyboard navigable.
- Multiple selected assets move together and remain in Atlas.
- Multiple tags, including a classifier expression, apply to every selected asset.
- Partial resolver failures do not partially mutate the batch.
- Folder removal and Pastiche deletion have visibly and behaviorally distinct outcomes.

---

## Phase 3 — Result Windows, Pagination, and Infinite Browsing

### Goal

Give large collections predictable loading, selection, and navigation semantics without forcing one interaction style.

### 3.1 Shared result-window contract

- Add a common query shape for Library and Atlas:
  - `mode: paged | infinite`;
  - `page`;
  - `pageSize: 25 | 50 | 100`;
  - total result count;
  - stable sort;
  - query/filter fingerprint.
- Return the full count even when only a window is loaded.
- Reset to page one when the query, folder, filter, or sort changes.

### 3.2 Paged mode

- Offer 25, 50, and 100 items per page.
- Use compact previous/next controls and a direct page indicator.
- Preserve the query when moving between pages.
- Scroll to the result header—not the browser top—after a page change.

### 3.3 Infinite mode

- Keep mobile-friendly sentinel loading.
- Avoid duplicate rows across cursors.
- Retain loaded results while inspecting an image and returning during the same app session.
- Do not persist exact scroll position after closing the app.
- Expose retry at the failed boundary without discarding already loaded results.

### 3.4 Selection semantics

- Label selection precisely:
  - “Select this page” in paged mode;
  - “Select loaded” in infinite mode;
  - “Select all N results” only when the server supports a query-scoped bulk token.
- Show selection scope before any destructive or bulk mutation.

### Tests and completion criteria

- Counts remain accurate across both modes.
- Page-size changes, filter changes, and folder navigation reset predictably.
- Back from Inspect restores the in-session result collection.
- Select-all language and affected IDs match the visible mode.

---

## Phase 4 — Responsive, Touch, and Accessibility Hardening

### Goal

Make the completed core workflows dependable across desktop, iPad, and phone rather than merely fitting them into a small viewport.

### 4.1 Explore mode rail

- Make the source/mode rail a true horizontal touch scroller.
- Ensure parents do not intercept horizontal gestures.
- Add edge padding and scroll snapping only if it does not resist free touch movement.
- Keep every source reachable without requiring precision swipes.

### 4.2 Library mobile optimization

- Keep images visually dominant.
- Collapse the folder tree into a searchable drawer.
- Keep compact breadcrumb, search, filter, and edit controls above the non-sticky subfolder strip.
- Use capped visual indentation while preserving arbitrary stored nesting.
- Open Inspect only on asset click and close it with a clear `×`.
- Avoid stacked toolbars and keep primary targets at least 44 px.

### 4.3 Shared mobile navigation behavior

- Hide the bottom navigation while scrolling down and reveal it immediately on upward intent.
- Support window scrolling and internal scroll containers through the same controller.
- Respect reduced motion.
- Keep focus order stable when rails, drawers, or sheets appear.

### 4.4 Accessibility and state sweep

- Keyboard-test all popovers, sheets, selection controls, Wiki actions, and tag correction choices.
- Add visible focus, semantic labels, live status for async work, and non-color status cues.
- Theme native selects or replace them with the established accessible dark control where platform styling leaks through.
- Verify empty, offline, error, slow, and partial-result states.

### Tests and completion criteria

- Phone, compact phone, iPad portrait/landscape, laptop, and wide desktop smoke matrices pass.
- Explore pills are reachable with touch.
- Bottom navigation behavior is consistent on every screen that renders it.
- No action sheet or picker escapes the viewport.
- Core workflows work with keyboard only and screen-reader labels are meaningful.

---

## Phase 5 — Studio Home and Alpha Surface Cleanup

### Goal

Replace the mock dashboard with a quiet, useful starting point built from real Library and Explore state.

### 5.1 Recently added

- Show a compact recent-image strip/grid.
- Blur images with NSFW, nudity, or equivalent controlled Atlas/source tags by default.
- Reveal sensitive previews only through an explicit user action.
- Use the same image card and Inspect behavior as Library.

### 5.2 Pinned folders

- Allow folders to be pinned/unpinned from Library.
- Show a small cover mosaic, name, path context, and item count.
- Open directly into the folder.
- Use an empty state that points to the Library pin action instead of mock content.

### 5.3 Saved-search updates, only if reliable

- Defer this card unless Explore sources expose stable identity and timestamp data.
- If included, show only saved searches with genuinely new items since the user’s last visit.
- Never run expensive source refreshes merely to render Home.

### 5.4 Remove mock and obsolete surfaces

- Delete placeholder projects, faux metrics, and dashboard actions that are not wired to real workflows.
- Keep Home as navigation plus useful recent context, not a second search or project-management interface.

### Tests and completion criteria

- Home renders entirely from real persisted state.
- Sensitive recent items are blurred by default.
- Pinned folders remain valid after rename/move and handle deletion gracefully.
- The page is useful and compact at phone width.

---

## Optional follow-on — Explore Blocking Rules

This is intentionally outside the alpha critical path, but the data model should avoid blocking it.

- User-scoped rules:
  - source tag;
  - artist identity/profile;
  - normalized title substring.
- Apply locally after provider normalization where provider-side filtering is unavailable.
- Show hidden-result counts and allow temporary reveal.
- Keep Danbooru’s native blacklist support, but normalize its representation into the same UI.
- Do not claim complete NSFW protection on sources whose metadata is absent or unreliable.

---

## Delivery order

1. Complete Phase 1 and run focused regression tests.
2. Implement the shared selection/action-sheet foundation, then Phase 2.
3. Define the result-window API before adding Phase 3 UI.
4. Run Phase 4 as a cross-feature hardening pass against Phases 1–3.
5. Build Phase 5 only from stable, real data.

Each phase ends with a manual desktop, iPad, and phone smoke pass before the next begins.
