# Implementation Plan: Full-Plugin Formal Code Review

Track: `code-review_20261021` · Spec: [spec.md](./spec.md)

## Phase 1: Review passes

- [x] Task: Pass 1 — §9 invariant compliance audit (`invariants` skill; every §9 entry vs code; §9.1 slash grep) — all 18 active entries HOLD; 1 finding (INV-1, §9.19 untested)
- [x] Task: Pass 2 — Security review — 11 raw findings (1 med, 7 low, 3 info); REST caps, escaping, SQL, slashing, cron input explicitly clean
- [x] Task: Pass 3 — Correctness/robustness review — 16 raw findings + 5 docs-accuracy (3 med); §9.19, slashing, dedupe, parser edges, multisite clean
- [x] Task: Pass 4 — Code quality review — 31 raw findings (1 high: §9.1 tested on one write path only; 10 med, mostly test-quality)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — user confirmed 2026-10-21

## Phase 2: Verification & report [checkpoint: dc5abb9]

- [x] Task: Adversarially verify every raw finding against the code; drop/downgrade what doesn't hold — 2 refuted (INV-1, QUA-7); SEC-3 and COR-11 confirmed empirically
- [x] Task: Write `review.md` (severity-ranked, file:line, rule violated, disposition) and link it from the track index
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — user confirmed 2026-10-21

## Phase 3: Fixes (TDD, one finding at a time) [checkpoint: 13101cb]

- [x] Task: Fix every confirmed finding — per finding: failing regression test → fix → suites green → §9 entry when the root cause could recur → commit referencing the finding ID
    - [x] Cluster 1 — PHP security/REST `1a48189` (SEC-4 refuted during fixing; defense-in-depth kept)
    - [x] Cluster 2 — Propagate core `1a48189`
    - [x] Cluster 3 — JS source/store `be7dba1` (build/ rebuilt + committed)
    - [x] Cluster 4 — Test quality `292d0ae` (QUA-1 in 1a48189)
    - [x] Cluster 5 — E2E (see commit for the two extra hardenings found en route)
    - [x] Cluster 6 — CI/scripts `86c3c01`
    - [x] Cluster 7 — Docs + §9 upkeep `86c3c01` (§9.5/§9.7 extended, NEW §9.20; §10(b) resolved maintainer-approved)
- [x] Task: Rebuild + commit `build/` if any `source/` file changed (done in cluster 3); `php -l` all touched PHP (clean)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — user confirmed 2026-10-22

## Phase 4: Finalize

- [x] Task: Full suites green locally (Jest, PHPUnit ±multisite, Playwright); §9.1 grep clean; update `review.md` dispositions
- [x] Task: Push and confirm CI green on `main`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
