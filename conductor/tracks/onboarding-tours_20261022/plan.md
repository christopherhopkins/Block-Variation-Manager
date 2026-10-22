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

## Phase 3: Editor tours

- [ ] Task: Variation panel tour (post editor)
  - [ ] Write failing Jest tests: "Take the tour" link renders in
        VariationPanel, auto-start-once on first panel open with block
        selected, anchor-skip when no variations exist
  - [ ] Implement steps (save / apply / overrides / detach) + link in
        `VariationPanel.js`
  - [ ] Verify tests pass
- [ ] Task: Variation-editor tour (`bvm_variation` post screen)
  - [ ] Write failing Jest tests: auto-start gating on the variation editor,
        link in usage panel
  - [ ] Implement short tour (name field, single-root rule, propagation note)
  - [ ] Verify tests pass; rebuild + commit `build/`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: E2E, docs & release polish

- [ ] Task: Playwright E2E
  - [ ] Write failing E2E: management-screen tour auto-starts for a fresh
        user, completing it prevents re-auto-start after reload, "Start tour"
        relaunches
  - [ ] Stabilize selectors/fixtures until green (visual baselines only if UI
        chrome changed)
- [ ] Task: Documentation
  - [ ] TECHNICAL.md: tours architecture section + any new §9 invariants
        discovered; README feature blurb
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
