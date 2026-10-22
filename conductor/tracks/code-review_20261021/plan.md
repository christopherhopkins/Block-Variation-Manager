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

## Phase 3: Fixes (TDD, one finding at a time)

- [~] Task: Fix every confirmed finding — per finding: failing regression test → fix → suites green → §9 entry when the root cause could recur → commit referencing the finding ID
    - [x] Cluster 1 — PHP security/REST `1a48189` (SEC-4 refuted during fixing; defense-in-depth kept)
    - [x] Cluster 2 — Propagate core `1a48189`
    - [ ] Cluster 3 — JS source/store: COR-4, COR-5, COR-9, COR-10, COR-11, QUA-20, QUA-22, QUA-27a (+ rebuild build/)
    - [ ] Cluster 4 — Test quality: QUA-1, QUA-2, QUA-3, QUA-8, QUA-9, QUA-12..18, QUA-21
    - [ ] Cluster 5 — E2E: QUA-4, QUA-5, QUA-6, QUA-19, QUA-28
    - [ ] Cluster 6 — CI/scripts: QUA-10, SEC-7 cluster, COR-12, COR-14
    - [ ] Cluster 7 — Docs + §9 upkeep: COR-3, COR-D2..D5, QUA-11, §10 residuals, new §9 entries
- [ ] Task: Rebuild + commit `build/` if any `source/` file changed; `php -l` all touched PHP
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Finalize

- [ ] Task: Full suites green locally (Jest, PHPUnit ±multisite, Playwright); §9.1 grep clean; update `review.md` dispositions
- [ ] Task: Push and confirm CI green on `main`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
