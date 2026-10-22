# Spec: Full-Plugin Formal Code Review

## Overview

A formal, full-codebase review of Block Variation Manager — all runtime PHP (`includes/`), the editor bundle (`source/`), the test suites and CI added by track `test-suite_20261021`, and the auxiliary assets (blueprint, playground scripts, build config, docs accuracy). The review runs as four independent dimension passes, produces a committed severity-ranked report, and **every confirmed finding is fixed in this track** (TDD: regression test first), with §9 updated wherever a root cause could recur.

## Functional Requirements

**FR1 — Dimension passes.** Four independent review passes over the full scope, each with fresh eyes (separate review agents where available):

1. **§9 invariant compliance** — every TECHNICAL.md §9 entry audited against the code (incl. the §9.1 slash-grep), per the project `invariants` skill.
2. **Security** — capabilities, nonces, sanitization/escaping, SQL preparation, REST auth surfaces, kses handling, cron contexts.
3. **Correctness/robustness** — logic errors, race conditions (cron batching, editor sync), error handling, edge cases (empty/malformed content, unregistered blocks, multisite).
4. **Code quality** — duplication, dead code, naming, test quality (assertions that can't fail, over-mocking, gaps in coverage), CI workflow hygiene.

**FR2 — Verification.** Every raw finding is adversarially verified against the actual code before it enters the report; unverifiable or speculative findings are dropped or marked informational.

**FR3 — Report.** `conductor/tracks/code-review_20261021/review.md`, linked from the track index: per-dimension sections, each finding with severity (high/medium/low/info), file:line, the §9 rule or principle violated, and resolution status.

**FR4 — Fixes.** All confirmed findings are fixed in this track regardless of severity (info-only items may be logged as accepted with justification). Each fix follows the workflow: failing regression test → fix → suite green; JS fixes rebuild and commit `build/`; PHP fixes `php -l`.

**FR5 — §9 upkeep.** Any fix whose root cause could recur at another call site adds or amends a §9 entry in the same commit, per the `invariants` skill.

**FR6 — Aux assets.** blueprint.json, `scripts/*.mjs`, `webpack.config.cjs`, `jest.config.cjs`, `playwright.config.cjs`, `.wp-env.json`, the CI workflow, and documentation accuracy (TECHNICAL.md claims vs actual behavior) are in the correctness/quality passes.

## Non-Functional Requirements

- No behavior changes except where a finding demands one; every behavioral fix carries a regression test.
- Full suites (Jest, PHPUnit single+multisite, Playwright) green locally and in CI after fixes.
- Coverage gates (80%) must still pass after any refactors.

## Acceptance Criteria

1. `review.md` committed with all four dimensions complete and every finding dispositioned (fixed / accepted-with-justification).
2. Every fix commit references its finding ID and includes its regression test; §9 updated where required.
3. All suites green locally; CI green on `main` after the final push.
4. The §9.1 audit grep comes back clean.

## Out of Scope

- New features or UX changes (including the pending children-UX items).
- Dependency upgrades not demanded by a finding.
- Performance profiling beyond what the correctness pass surfaces.
