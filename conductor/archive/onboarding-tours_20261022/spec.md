# Specification: Interactive Onboarding Tours

## Overview

Add interactive, step-by-step guided tours (intro.js-style spotlight + popover
walkthroughs) using **driver.js** (MIT-licensed, ~5 kB, dependency-free —
chosen over intro.js, whose license is AGPL/commercial). Tours auto-start once
per user per surface and can be revisited at will. Completion state is stored
in per-user meta via REST, so it follows the user across browsers and devices.

## Functional Requirements

### FR-1: Tour engine

- Bundle `driver.js` via npm/webpack into the existing build (committed
  `build/` artifacts per project convention).
- A thin wrapper module (`source/tours/`) defines tours as declarative step
  lists (selector, title, text) so adding steps later needs no engine
  knowledge.
- Popover styling aligned with WP admin (admin color scheme variables where
  practical); all strings translatable via `@wordpress/i18n`.

### FR-2: Management-screen tour (Tools → Block Variations list table)

- Steps covering: what variations are, the Block / Pages columns, Add New, and
  row actions (edit, trash).
- A **"Start tour"** button rendered near the page title launches/relaunches
  the tour anytime.

### FR-3: Editor tour (block editor, Variation panel)

- Launched from a "Take the tour" help link inside the Variation panel; also
  auto-starts once when the user first opens the panel region with a block
  selected.
- Steps covering: saving a block as a variation, applying/linking an existing
  variation, override tracking, and detach.
- Steps whose anchor element isn't present (e.g., no variation exists yet) are
  skipped gracefully.

### FR-4: Variation-editor tour (editing a `bvm_variation` post)

- Short tour: the variation name field, the single-root rule, and how saving
  propagates to linked instances.
- Auto-starts once; revisit via a "Take the tour" link in the usage panel.

### FR-5: Trigger & persistence

- Per-user, per-tour completion flags stored in user meta (one key, JSON map
  of `tourId → completed`), registered via `register_meta` with
  `show_in_rest` + `auth_callback` (own user only), written through the core
  `/wp/v2/users/me` endpoint — no new REST routes.
- Auto-start fires only when the tour's flag is unset; dismissing (X / Esc) or
  finishing marks it complete. Manual relaunch always works regardless of
  state.
- Any PHP-side writes of JSON-ish meta follow TECHNICAL.md §9.1
  (`wp_slash()`).

## Non-Functional Requirements

- No new PHP dependencies; driver.js is the only new JS dependency
  (version-pinned, MIT).
- Tours never block interaction when dismissed; zero impact on the front end
  (admin/editor only).
- i18n-complete; keyboard dismissible; respects `prefers-reduced-motion` for
  transitions.

## Acceptance Criteria

1. A fresh user visiting Tools → Block Variations sees the tour once; it never
   auto-repeats after dismissal/completion, including in a different browser.
2. The "Start tour" button and panel/usage-panel links relaunch the relevant
   tour on demand.
3. The editor tour walks through save → apply → override → detach anchored to
   real panel controls; missing anchors are skipped without errors.
4. Completion state round-trips through user meta REST; no console errors;
   `php -l` clean; Jest + PHPUnit suites pass with ≥80% coverage on new code.
5. E2E (Playwright) verifies auto-start-once and manual relaunch on the
   management screen.

## Out of Scope

- Front-end (site visitor) tours.
- Multisite network-level controls.
- Tour content authoring UI.
- Video/media in steps.
- Translating tour copy beyond standard i18n readiness.
