# Implementation Plan: Full-Plugin Formal Code Review

Track: `code-review_20261021` · Spec: [spec.md](./spec.md)

## Phase 1: Review passes

- [x] Task: Pass 1 — §9 invariant compliance audit (`invariants` skill; every §9 entry vs code; §9.1 slash grep) — all 18 active entries HOLD; 1 finding (INV-1, §9.19 untested)
- [x] Task: Pass 2 — Security review — 11 raw findings (1 med, 7 low, 3 info); REST caps, escaping, SQL, slashing, cron input explicitly clean
- [x] Task: Pass 3 — Correctness/robustness review — 16 raw findings + 5 docs-accuracy (3 med); §9.19, slashing, dedupe, parser edges, multisite clean
- [x] Task: Pass 4 — Code quality review — 31 raw findings (1 high: §9.1 tested on one write path only; 10 med, mostly test-quality)
- [~] Task: Phase Verification & Checkpoint (Refer to workflow.md)

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
