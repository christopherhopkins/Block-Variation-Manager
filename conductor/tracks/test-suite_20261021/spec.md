# Spec: Bootstrap Automated Test Suite

## Overview

Stand up the complete testing foundation: JS unit tests (Jest), PHP unit/integration tests (PHPUnit via wp-env), Playwright E2E + visual regression tests against WordPress Playground, multisite coverage, a PHP/WP version matrix in CI — and retrofit tests across **all existing modules** so the whole plugin meets the >80% coverage bar, enabling TDD for every future track.

## Functional Requirements

**FR1 — JS unit harness.** `npm run test:unit` runs Jest via `@wordpress/scripts`.

**FR2 — PHP harness.** `npm run test:php` runs PHPUnit in `@wordpress/env` (Docker); tests in `tests/php/`, bootstrap loads the plugin.

**FR3 — E2E harness.** `npm run test:e2e` runs Playwright (`@wordpress/e2e-test-utils-playwright`) against a `@wp-playground/cli` server mounting the working tree. Core flow: save a block as a variation, apply it, assert the `bvmVariationId` link and the Tools listing.

**FR4 — Full unit coverage (retrofit).** Tests for **all** existing modules:

- JS: every `source/lib/` module (`equality`, `preset`, `class-pairs`, `block-registry`, `rest-path`, `variation-store`), `source/constants.js`, and the testable logic in `source/filters/` via `@wordpress/*` mocks.
- PHP: every class in `includes/` — `Attributes`, `Propagate`, `CPT`, `Rest`, `Render`, `Inserter`, `BlockRegistry`, `Migration`, `Assets`, `Plugin` — including §9.1 slashing round-trips, snapshot in-sync guards, and override preservation.

**FR5 — Visual regression.** Playwright screenshot baselines for key states (variation panel, Tools list, a propagated block front-end render), compared in CI.

**FR6 — Multisite.** PHPUnit runs in multisite mode (wp-env config + multisite test group) covering CPT registration, propagation, and REST per-site isolation.

**FR7 — CI matrix.** GitHub Actions on push/PR: `php -l`, build, Jest, PHPUnit across **PHP 7.4 and 8.3 × WP 6.5 (minimum) and latest**, plus E2E + visual regression on one reference combo. Failures block merge.

**FR8 — Testability refactors.** Plugin code may be refactored where needed for testability (dependency seams, extracting pure functions), provided behavior is unchanged and every §9 invariant is re-checked on each refactored file.

**FR9 — Docs.** TECHNICAL.md §11/§12, README, and `workflow.md` Development Commands updated with real commands, matrix, and baseline-update procedure.

## Non-Functional Requirements

- Jest and E2E run on Windows without Docker; PHPUnit needs Docker locally (CI as fallback runner).
- No change to shipped runtime behavior; committed `build/` only changes if a testability refactor touches `source/` (then rebuilt and committed per CLAUDE.md).
- ≥80% coverage on both JS and PHP suites, enforced in CI.

## Acceptance Criteria

1. All three local commands pass; CI matrix green on the track's PR and demonstrably red on an intentional break.
2. Coverage reports show ≥80% for `source/` (Jest) and `includes/` (PHPUnit).
3. Breaking a known invariant (excluded attr leaking into a preset; unslashed JSON write; override clobbered by propagation) fails a test.
4. Multisite suite passes; visual baselines committed and stable across two consecutive CI runs.
5. Docs updated (FR9).

## Out of Scope

- New product features or UX changes (including the pending children-UX items).
- Performance/load testing; browser matrix beyond Chromium for E2E.
