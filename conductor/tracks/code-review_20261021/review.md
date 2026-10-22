# Formal Code Review — Block Variation Manager

Track `code-review_20261021` · 2026-10-21 · Scope: `includes/`, `source/`, `tests/`, CI, aux assets, docs accuracy.
Method: four independent passes (§9 invariants; security; correctness/robustness; quality), every raw finding adversarially verified against the code — two claims verified empirically (SEC-3 via a live anonymous REST probe, COR-11 via the editor store in Playground). Raw pass count ≈ 64; after verification: **2 refuted**, the rest confirmed or accepted as below.

**§9 invariants checked (Pass 1): all 18 active entries HOLD in code** (9.1–9.14, 9.16–9.19; slash grep, dedupe grep, is_dynamic grep, linked-child audit all clean). The §9-related findings below are about *test coverage of* the invariants and *doc drift*, not violations.

Severity: H high · M medium · L low · I info. Disposition: **FIX** (Phase 3), **DOCS** (documentation correction), **ACCEPT** (justified, logged), **DEFER** (blocked by §10 maintainer decision), **REFUTED**.

---

## High

| ID | Where | Finding | Disposition |
|---|---|---|---|
| QUA-1 | tests/php (REST/Propagate suites) | The §9.1 `wp_slash` invariant — CLAUDE.md's "most re-introducible bug class" — is regression-tested on only one of six write paths (`CPT::sync_attrs_from_content`). Removing `wp_slash()` from REST create/update, `update_instance_content`, or `write_snapshot` leaves the suite green. | **FIX** — hostile fixtures (`"` `\` `--` `&`) round-tripped through REST create, REST update, and `Propagate::run`. |

## Medium

| ID | Where | Finding | Disposition |
|---|---|---|---|
| SEC-1 | class-rest.php, class-render.php, class-cpt.php (meta) | Variation attrs cross a trust boundary unvalidated: any `publish_posts` user's variation attrs are merged into other users' blocks at render/propagation; no kses or schema pass at write time; third-party blocks may echo attr values unescaped. | **FIX (mitigate)** — write-time sanitization of string attr values (`wp_kses_post` for users without `unfiltered_html`) + payload size cap in REST and meta `sanitize_callback` (also closes SEC-4); residual trust model documented. |
| SEC-3 | class-cpt.php register (show_in_rest) | **Empirically confirmed:** anonymous `GET /wp/v2/block-variation-manager` returns published variations (title, content, attrs/inner_blocks meta) — core allows publish-status reads regardless of `public => false`, while every `bvm/v1` route requires `edit_posts`. | **FIX** — restrict core-route reads to `edit_posts` (the block editor itself is always authenticated). |
| COR-1 | class-propagate.php run() | An interrupted run (timeout/fatal mid-batch) is never retried: the continuation is only scheduled after the loop, and already-rewritten instances then fail the old-snapshot in-sync check forever ("diverged"). `wp_update_post` failures are also counted as processed. | **FIX** — schedule the continuation before processing the batch; treat an instance that already matches the **current** source as in sync (no-op, not diverged). |
| COR-2 | class-propagate.php | Editing the variation between batches of a multi-batch run leaves batch-1 instances (old markup) compared against the final new-source snapshot → false diverged. | **FIX (partial)** — the COR-1 "matches current source" check absorbs the common cases; residual multi-edit window documented in §10. |
| COR-4 | VariationPanel.js performSave | If the `/registry` fetch fails, `ensureRegistryLoaded()` resolves `null` and the save silently proceeds without child capture — creating exactly the childless parent variation the awaiting comment claims to prevent. | **FIX** — abort the save with a visible error when the registry is unavailable for a block that may need children. |
| COR-11 | source/lib/equality.js + track-overrides.js | **Empirically confirmed:** in WP 6.5+ the editor stores rich-text attrs as `RichTextData` objects; `deepEqual(object, string)` is always false, so the sync effect rewrites identical text on every open (dirtying posts) and rich-text overrides can never be un-marked. | **FIX** — normalize values exposing `toHTMLString()` before comparison, with unit tests. |
| COR-5 | track-overrides.js sync effect | The editor sync lacks §9.8's `blockName === block_type` check (render + propagation both enforce it): a type-mismatched link gets foreign preset attrs written into the store. | **FIX** — skip sync/tracking when `props.name !== variation.block_type`. |
| COR-D2 | class-propagate.php:241-259, TECHNICAL.md §4.3/§7 | `usage_where()` excludes `post_type = bvm_variation`, so the nested-variation hook-suppression branch in `update_instance_content` is **dead code**, and a variation embedding a linked child is never rewritten when the child's variation changes. Docs imply otherwise. | **DOCS** + code comment (branch kept as a guard); behavioral change deferred to the §10 children design. |
| QUA-2 | tests/php | Propagate's riskiest paths are untested: batch continuation + cursor dedupe, the kses suspension window (no iframe/script fixture), `handle_dismiss`. | **FIX** — add the three test groups (the nested-variation branch is dead code per COR-D2; not testable). |
| QUA-3 | InserterTest | The cache-flush test cannot fail: the helper itself calls `flush_cache()`, so deleting the `save_post → flush_cache` hook goes undetected. | **FIX** — remove the helper flush; assert the hook does the invalidation. |
| QUA-4 | visual.spec.js | "propagated front-end render" doesn't test propagation — the fixture is pre-baked with final markup; it passes if both channels do nothing. | **FIX** — rename honestly (static render baseline); real propagation coverage via QUA-5. |
| QUA-5 | tests/e2e | The product's core promise has no E2E: edit variation → instance updates; override survives; `bvmVariationId` actually in `post_content`; permission denial. | **FIX** — add a propagation-journey spec (editor-sync channel + override survival + content assertion). |
| QUA-6 | visual.spec.js, blueprint, scripts | Visual baselines depend on unpinned WP "latest", wordpress.org Kadence, and `@wp-playground/cli@latest`; the "clip to the two plugin panels" comment doesn't match the whole-region screenshot. | **FIX** — pin WP + Playground CLI for the E2E server; correct the comment. (2% diff ratio kept deliberately; noted.) |
| QUA-8 | track-overrides.test.js | Only static states tested: no loading→loaded transition, no variation-attrs-change-while-mounted (the actual propagation feature). | **FIX** — notify-driven transition tests via a listener-capturing subscribe mock. |
| QUA-9 | variation-editor(.test).js | The re-entrancy guard (stack-overflow protection) is untested, and subscriber selection by call index couples tests to registration order; autosave exclusion untested. | **FIX** — re-entrant `resetBlocks` test, autosave test, order-robust subscriber selection. |
| QUA-10 | tests.yml js job | CI never verifies the committed `build/` matches `source/` (CLAUDE.md's rebuild-and-commit rule). | **FIX** — `git diff --exit-code build/` after the production build. |
| QUA-11 | conductor/code_styleguides | The declared Google JS style guide contradicts the WordPress-style codebase; no lint config or CI gate exists. | **FIX** — replace the guide with the project's real conventions; evaluate `wp-scripts lint-js` adoption (adopt if the violation count is small). |

## Low

| ID | Where | Finding | Disposition |
|---|---|---|---|
| SEC-2 | class-propagate.php update_instance_content | `kses_init()` not in try/finally — a mid-call fatal/exception leaves kses off for the rest of the cron request; third-party save_post hooks run inside the window. | **FIX** — try/finally. |
| SEC-4 | class-cpt.php register_post_meta | attrs/inner_blocks meta writable via the core route with no sanitize/validate callback or size cap. | **FIX** — folded into SEC-1's sanitize callbacks. |
| SEC-5 | class-rest.php get_usage | `/usage` gated only by `edit_posts`, id not validated as a variation; leaks reference counts across others' drafts/private posts. | **FIX** — route through `item_check( edit_post )`. |
| SEC-6 | class-propagate.php handle_dismiss | Any `edit_posts` user can clear every variation's skipped notice globally. | **FIX** — scoped dismiss requires `edit_post` on the variation; global requires `edit_others_posts`. |
| SEC-7 / QUA-25 / COR-12 | tests.yml, scripts/*.mjs | CI/scripts hardening cluster: no `permissions:` block; third-party action unpinned; `@wp-playground/cli@latest` unpinned (also QUA-6); no `timeout-minutes`; no pipefail on the coverage tee (COR-14/QUA-24); spawn `shell:true` breaks on paths with spaces and orphans the child on SIGINT. | **FIX** — permissions block, pin `shivammathur/setup-php` by SHA, pin CLI version, timeouts, `shell: bash` (pipefail), quote spawn args + kill child on signals. Remaining items (SHA-pin first-party actions, composer cache, php-job artifacts) **ACCEPT** as noted. |
| SEC-8 | class-migration.php | Migrations run on any request (incl. anonymous) with no lock; concurrent first hits repeat the bulk UPDATE + cache flush. | **FIX** — transient lock around both migrations. |
| SEC-9 | class-rest.php create | `block_type` not validated against a block-name shape; forged/malformed names reach post_content comments (no injection — `<` is encoded). | **FIX** — block-name regex validation. |
| SEC-10 | class-assets.php | `$_GET['post']` trusted for localization (count/block-type of an arbitrary ID). | **FIX** — use the screen's post ID. |
| COR-3 | TECHNICAL.md §4.3 vs wrapper compare | Docs claim instance-only attrs (className/anchor) survive the bake; in reality any wrapper-markup difference skips the instance as `content_diverged`. | **DOCS** — correct §4.3 (behavior change too risky without design input). |
| COR-7 | class-propagate.php | A double-run with the same cursor (§9.14's parallel-runner scenario) appends duplicate skipped rows → double-counted notice. | **FIX** — de-dupe rows by post ID in `write_skipped`. |
| COR-8 | class-rest.php delete_variation | Deleting a variation leaves its skipped-notice rows and pending cron event behind. | **FIX** — cleanup on delete (and trash/unpublish for the notice). |
| COR-9 / QUA-26 | variation-store.js | `invalidateList()` doesn't clear `inflightLists`; a stale in-flight list resolution repopulates the cache missing a just-created variation. | **FIX** — drop in-flight entries on invalidate; only cache a resolution that is still current. |
| COR-10 | variation-editor.js seedChain | `createBlock()` on an unregistered root (source plugin deactivated) throws inside a data subscriber and breaks the editor. | **FIX** — bail with a warning when the chain's blocks aren't registered. |
| COR-15 | class-render.php | `array_flip` on an unfiltered `bvmOverriddenAttrs` raises E_WARNING on malformed entries (walk filters `is_string`; render doesn't). | **FIX** — same `is_string` filter + test. |
| COR-D1 / SEC-5b | class-rest.php get_instances, usage-panel.js | `/instances` caps at 200 with the capability filter applied **after** the LIMIT (visible rows can be hidden); the panel's "Used on N pages" caps at 200 while the banner uses the true count. | **FIX** — capability-aware keyset pagination up to the cap; docs note the cap. |
| COR-D3 | TECHNICAL.md §4.3; class-propagate.php early exit | Docs say `write_skipped` is final-batch-only (it runs every batch); the attrs-only early exit never clears stale skipped rows when a variation loses its bake/inner reason. | **FIX** (clear skipped in the early exit) + **DOCS**. |
| QUA-12 | VariationPanel.test.js | `clearAllMocks` keeps implementations → `getCached` stubs leak into later tests. | **FIX** — targeted reset in `beforeEach`. |
| QUA-13 | tests/js/__mocks__/wp-components.js | `PanelBody` ignores `initialOpen`; Button drops `aria-expanded` — `openInitial` semantics untestable. | **FIX** — expose `aria-expanded` state on the mock + one assertion for `openInitial`. |
| QUA-14 | VariationPanel.test.js | `content: serialize()` asserts a constant stub value — cannot detect wrong-block serialization. | **FIX** — assert the mock's call args. |
| QUA-15/16 | probe.spec.js, harness.test.js | Redundant scaffolding tests (global-setup already proves the probe; every suite proves the harness). | **FIX** — remove both. |
| QUA-17 | MigrationTest / BlockNeedsBakeTest | Migration-v2 reset is tested twice nearly identically. | **FIX** — keep the canonical BlockNeedsBakeTest version; reduce MigrationTest to the guard case. |
| QUA-18 | tests/php | Variation fixture helpers copy-pasted across 7 classes. | **FIX** — shared fixtures trait. |
| QUA-19 | tests/e2e | Duplicated helpers across specs; broad `catch(()=>{})` swallows real failures; the visual retry loop can outlive the test timeout. | **FIX** — extract `tests/e2e/helpers.js`, narrow the catches. |
| QUA-20 | source/ | JS duplication: `useVariation` ≡ `useVariationSnapshot`; reset-attrs loops repeated; `kadenceClassPair` inlines `pairBaseKey`. | **FIX** — shared hook + helpers (rebuild `build/`, §9 re-check). |
| QUA-21 | tests (PHP↔JS mirrors) | The excluded-attrs and linked-child mirrors are pinned separately per language — one side can drift without any test noticing. | **FIX** — shared JSON fixture asserted from both Jest and PHPUnit. (`parseInt` vs `(int)` on `"1e3"`: **ACCEPT**, absurd input.) |
| QUA-22 | usage-panel.js | Hardcodes `'bvm_variation'`; the localized `BVM.cpt` is dead. | **FIX** — read `window.BVM.cpt`. |
| QUA-28 | visual.spec.js | Stacked docblocks — the fixtures comment sits above the wrong function. | **FIX**. |
| QUA-27a | VariationPanel.js:403 | `disabled={ ! variationId }` is always false inside a `variationId > 0` block. | **FIX** — remove. |

## Info / Accepted (justification logged)

| ID | Finding | Justification |
|---|---|---|
| SEC-11 | `/registry` exposes block topology to `edit_posts` users | Intentional; same data as core `/wp/v2/block-types`. |
| COR-6 | Template replacement copies the variation's child `uniqueID`s into instances | **DEFER** — inner-block behavior is explicitly frozen pending the maintainer's children design (§10 / CLAUDE memory). Logged, not changed. |
| COR-13 | `count_usage` LIKE scan per list row / edit screen | Admin-only, bounded by list pagination; a grouped-query rewrite isn't justified yet. |
| COR-14b | `--env-cwd` hardcodes the checkout folder name | CI checkout always matches the repo name; documented in TECHNICAL.md §11.1 territory. |
| COR-16 | Migration v2 skips block types registered after init 999 | One-shot migration already shipped; affected sites can delete the option to re-run. |
| COR-D4/D5 | Stale Propagate docblock; §9.1 grep false-positives on multi-line calls | **DOCS** — fixed with the docs batch. |
| QUA-23 | AssetsTest couples to committed build/ + accumulating wp_scripts data | Intrinsic to testing the real enqueue path; noted in the test. |
| QUA-27b-f | One-line wrapper, unused hook param, JS-unused REST branches (tested), defensive unused api-fetch stub, test timer leak | Harmless by inspection; the REST branches are deliberate external API surface. |
| QUA-29 | Multisite tests report as skipped in single-site runs | By design (`ms-required` guard). |
| QUA-30 | Matrix holes: no PHPUnit 7.4 (unbuildable images, documented), E2E on latest WP only, Jest Node 20 only | Documented deviations; cost/benefit doesn't justify more legs now. |
| QUA-31 | Coverage thresholds are global, not per-file | Tightening per-file would block unrelated work; revisit after Phase 3 lands. |

## Refuted

| ID | Claim | Why refuted |
|---|---|---|
| INV-1 | §9.19's second pipeline untested | `tests/php/RenderHeadCssTest.php` covers hook registration, head-pass merge, override respect, and non-array passthrough. |
| QUA-7 | Serial-group retry duplicates `VARIATION_NAME` causing selector ambiguity | Playwright retries run in a fresh worker process; the module re-evaluates and `Date.now()` yields a new name. (Residual spec order-dependence noted under QUA-19.) |

---

## Resolution summary (Phase 3, 2026-10-21)

Every FIX/DOCS item above is resolved; commits carry the finding IDs.

| Commit | Findings resolved |
|---|---|
| `1a48189` | SEC-1 (mitigated: write-time kses + 256KB cap; residual documented in §9.7), SEC-2, SEC-3, SEC-5, SEC-6, SEC-8, SEC-9, SEC-10, COR-1, COR-7, COR-8, COR-15, COR-D1, COR-D3 (code half), QUA-1 — **SEC-4 re-verdict: REFUTED** (no `custom-fields` support ⇒ no core-route meta writes; pinned by test, sanitize kept as defense-in-depth) |
| `be7dba1` | COR-4, COR-5, COR-9/QUA-26, COR-10, COR-11, QUA-20, QUA-22, QUA-27a (build/ rebuilt) |
| `292d0ae` | QUA-2 (remaining), QUA-3, QUA-8, QUA-9, QUA-12, QUA-13, QUA-14, QUA-15, QUA-16, QUA-17, QUA-18 (partial: heading/meta fixtures consolidated; group fixtures + user-authored suites left local), QUA-21 |
| `982378d` | QUA-4, QUA-5, QUA-6, QUA-19, QUA-28 (+ two hardenings found en route: cookie-jar readiness probe, guide-before-header dismissal) |
| `86c3c01` | QUA-10, QUA-25 (partial: permissions/timeouts/SHA-pin third-party/pipefail; composer cache + php-job artifacts accepted), SEC-7, COR-12, COR-14, COR-3 (docs), COR-D2 (docs+comment), COR-D3 (docs half), COR-D4, COR-D5, QUA-11 (guide fixed; lint adoption follow-up — `wp-scripts lint-js` crashes on the current dependency tree) |

## CI confirmation (Phase 4, 2026-10-22)

Pushed to `main` (`81c4072..2292683`, then `b26ae6e`). First run surfaced two CI-only issues, fixed in `b26ae6e`:

| Commit | What |
|---|---|
| `b26ae6e` | QUA-10 gate refined: `*.map` excluded from the build-freshness diff (source maps differ between the Windows-committed build and CI's Linux build; the shipped JS/CSS/asset.php stays gated). Stale `tools-listing-row-linux.png` baseline (predated the row-actions-hiding rewrite) replaced with the CI-rendered actual. `restCall()` e2e helper now throws on REST errors instead of returning `{ __error }` nobody read — a transient Playground 404 had surfaced as an opaque 60s timeout. |

CI green on `main` at `b26ae6e` (run 39727326578, attempt 2; attempt 1's e2e failed on a transient Playground/Kadence activation hiccup — `kadence-blocks` installs unpinned from wordpress.org, noted as a possible future pin). All seven jobs pass: php-lint, Build+Jest+coverage gate, PHPUnit 8.1/8.3 × WP 6.5/latest, Playwright E2E + visual.

§9 check for `b26ae6e`: CI/test-only change, no `includes/` or `source/` code touched — §9.1/§9.4–§9.7 n/a; no new §9 entry warranted (environment-specific source maps and a stale baseline are one-off operational issues, recorded here).

§9 upkeep: §9.5 extended (matches-current corollary), §9.7 extended (trust-boundary sanitize rule), **new §9.20** (RichTextData normalization). §10 updated: (b) resolved maintainer-approved; COR-2 residual and COR-6 deferral recorded.

COR-2: **fixed (mitigated)** — the single-edit case is absorbed by the matches-current check; the mid-run multi-edit window remains documented in §10.
