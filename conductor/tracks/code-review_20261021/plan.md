# Implementation Plan: Full-Plugin Formal Code Review

Track: `code-review_20261021` · Spec: [spec.md](./spec.md)

## Phase 1: Review passes

- [ ] Task: Pass 1 — §9 invariant compliance audit (`invariants` skill; every §9 entry vs code; §9.1 slash grep)
- [ ] Task: Pass 2 — Security review (caps, nonces, sanitization/escaping, SQL, REST auth, kses, cron context)
- [ ] Task: Pass 3 — Correctness/robustness review (logic, races, error handling, edge cases, multisite; incl. aux assets + docs accuracy)
- [ ] Task: Pass 4 — Code quality review (duplication, dead code, naming, test quality, CI hygiene)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Verification & report

- [ ] Task: Adversarially verify every raw finding against the code; drop/downgrade what doesn't hold
- [ ] Task: Write `review.md` (severity-ranked, file:line, rule violated, disposition) and link it from the track index
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Fixes (TDD, one finding at a time)

- [ ] Task: Fix every confirmed finding — per finding: failing regression test → fix → suites green → §9 entry when the root cause could recur → commit referencing the finding ID
    - [ ] (sub-tasks enumerated from `review.md` once findings are known)
- [ ] Task: Rebuild + commit `build/` if any `source/` file changed; `php -l` all touched PHP
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Finalize

- [ ] Task: Full suites green locally (Jest, PHPUnit ±multisite, Playwright); §9.1 grep clean; update `review.md` dispositions
- [ ] Task: Push and confirm CI green on `main`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
