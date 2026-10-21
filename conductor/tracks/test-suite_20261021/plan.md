# Implementation Plan: Bootstrap Automated Test Suite

Track: `test-suite_20261021` · Spec: [spec.md](./spec.md)

## Phase 1: JS unit harness & retrofit

- [x] Task: Configure Jest via `@wordpress/scripts` (`test:unit`, coverage thresholds ≥80% for `source/`) `0569183`
- [x] Task: Seed tests for pure modules `9f6431f`
    - [x] Write failing tests for `source/lib/equality.js`
    - [x] Write failing tests for `source/lib/preset.js` (incl. excluded-attrs invariant)
    - [x] Write failing tests for `source/lib/class-pairs.js`
    - [x] Fix/confirm implementations until green
- [x] Task: Retrofit remaining JS modules `acbd389`
    - [x] Tests for `source/lib/block-registry.js`, `rest-path.js`, `variation-store.js` (mock `@wordpress/*`)
    - [x] Tests for `source/constants.js` and testable `source/filters/` logic (no FR8 extraction needed — all filters, components, and admin modules tested directly via stubs; coverage 96.9%/88.1%)
    - [x] Rebuild and commit `build/` if any `source/` file changed (no `source/` changes made)
- [~] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: PHP harness & retrofit

- [ ] Task: Configure `@wordpress/env` + PHPUnit (`test:php`, bootstrap loads plugin, coverage ≥80% for `includes/`)
- [ ] Task: Seed invariant tests
    - [ ] Write failing tests: `Attributes` excluded-attrs/preset derivation; §9.1 slashing round-trips
    - [ ] Write failing tests: `Propagate` snapshot in-sync guards + override preservation
    - [ ] Confirm green
- [ ] Task: Retrofit remaining PHP classes
    - [ ] Tests for `CPT`, `Rest` (route auth/validation), `Render` (render-time merge)
    - [ ] Tests for `Inserter`, `BlockRegistry` (wrapper chains), `Migration`, `Assets`, `Plugin`
    - [ ] Testability refactors as needed (FR8) — re-check §9 per touched file, `php -l` all touched files
- [ ] Task: Multisite coverage — wp-env multisite config + multisite test group (CPT, propagation, REST isolation)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: E2E & visual regression

- [ ] Task: Playwright harness (`test:e2e`) against `@wp-playground/cli` mounting the working tree
- [ ] Task: Core-flow E2E — save variation → apply → assert `bvmVariationId` + Tools listing
- [ ] Task: Visual regression — baselines for variation panel, Tools list, propagated front-end render; document baseline-update procedure
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: CI

- [ ] Task: GitHub Actions workflow — `php -l`, build, Jest; PHPUnit matrix PHP 7.4/8.3 × WP 6.5/latest; E2E + visual on reference combo; coverage gates
- [ ] Task: Prove the gate — intentional break fails CI, revert, confirm green and baseline stability across two runs
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Documentation

- [ ] Task: Update TECHNICAL.md §11/§12, README, and `workflow.md` Development Commands (real commands, matrix, baseline procedure)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
