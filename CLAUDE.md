# Block Variation Manager — agent notes

- Before modifying anything under `includes/` or `source/`, read
  [TECHNICAL.md](TECHNICAL.md) — architecture, data model, runtime flows,
  REST surface. **§9 (Invariants & gotchas)** lists rules distilled from real
  shipped bugs; treat every §9 entry as a project convention that code review
  must check the diff against.
- Follow the `invariants` project skill (`.claude/skills/invariants/SKILL.md`)
  for any code review or bug fix: check the diff against §9, state which
  invariants were checked in your summary, and when a fix's root cause is a
  rule that could recur at another call site, add it to §9 as part of the fix.
- The single most re-introducible bug class here: every
  `wp_insert_post` / `wp_update_post` / `update_post_meta` call carrying
  serialized blocks or JSON must be `wp_slash()`ed (§9.1 has the audit grep).
- JS changes require rebuilding the committed bundle: `npm run build`, then
  commit the regenerated `build/` artifacts alongside `source/`. PHP has no
  build step; syntax-check touched files with `php -l`.
- Smoke-test runtime changes with `npm run playground:local` (recipes in
  TECHNICAL.md §12).
