# Implementation Plan: Interactive Onboarding Tours

## Phase 1: Foundation — tour engine wrapper & persistence [checkpoint: ff6824a]

- [x] Task: Tour wrapper module (`source/tours/`) `3db6fc5`
  - [x] Write failing Jest tests: step-list normalization, missing-anchor
        skipping, reduced-motion handling, driver.js invocation contract
        (mocked)
  - [x] Add `driver.js` (pinned, MIT) to package.json; implement wrapper that
        builds a driver tour from a declarative step list
  - [x] Verify tests pass; coverage ≥80%
- [x] Task: Per-user tour-state meta (PHP) `102c12b`
  - [x] Write failing PHPUnit tests: meta registered with `show_in_rest`, auth
        restricted to own user, sanitization of the JSON map, REST round-trip
        via `/wp/v2/users/me`
  - [x] Implement `includes/class-tours.php` (register_meta + sanitize
        callback); `php -l` clean; §9.1 audit on any slashed writes
  - [x] Verify tests pass
- [x] Task: JS tour-state store `ff6824a`
  - [x] Write failing Jest tests: read flag, mark complete (optimistic +
        persisted), auto-start gating logic
  - [x] Implement store/helpers in `source/tours/state.js` via
        `@wordpress/api-fetch` against core `/wp/v2/users/me` (core-data is
        not an installed package in this repo — api-fetch is the established
        pattern)
  - [x] Verify tests pass
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Management-screen tour [checkpoint: 524e245]

- [x] Task: Tour definition + "Start tour" button on Tools → Block Variations `524e245`
  - [x] Write failing Jest tests: step definitions resolve to expected
        selectors, button mounts, relaunch ignores completed flag, auto-start
        fires only when unset
  - [x] Implement admin entry (enqueue on the `edit-bvm_variation` screen
        only), steps, button beside the page title; admin-scheme-aligned
        styles
  - [x] Verify tests pass; `npm run build`, commit regenerated `build/`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Editor tours [checkpoint: 313eafa]

- [x] Task: Variation panel tour (post editor) `5081a5d`
  - [x] Write failing Jest tests: "Take the tour" link renders in
        VariationPanel, auto-start-once on first panel open with block
        selected, anchor-skip when no variations exist
  - [x] Implement steps (save / apply / overrides / detach) + link in
        `VariationPanel.js`
  - [x] Verify tests pass
- [x] Task: Variation-editor tour (`bvm_variation` post screen) `313eafa`
  - [x] Write failing Jest tests: auto-start gating on the variation editor,
        link in usage panel
  - [x] Implement short tour (name field, single-root rule, propagation note)
  - [x] Verify tests pass; rebuild + commit `build/`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E, docs & release polish [checkpoint: af39a60]

- [x] Task: Playwright E2E `c583b19`
  - [x] Write failing E2E: management-screen tour auto-starts for a fresh
        user, completing it prevents re-auto-start after reload, "Start tour"
        relaunches
  - [x] Stabilize selectors/fixtures until green — the red E2E exposed a real
        bug (driver.js skips onDestroyed on early dismissal → persistence
        lost; fixed via onDestroyStarted, §9.21). variation-panels baselines
        regenerated (new link); tools-listing-row refreshed for environment
        drift (reproduced with tours disabled); variation-panels-linux.png
        deleted per §11.1 — regenerate from CI artifacts on next push
- [x] Task: Documentation `af39a60`
  - [x] TECHNICAL.md: tours architecture section (§3.6, §4.7, file tables) +
        new §9.21 invariant (landed with `c583b19`); README feature blurb
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md)
