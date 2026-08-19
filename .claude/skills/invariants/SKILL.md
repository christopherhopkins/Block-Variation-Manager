---
name: invariants
description: >-
  Check every code change against TECHNICAL.md §9 (Invariants & gotchas) and
  keep §9 current. Use whenever reviewing code, fixing a bug, or changing
  anything under includes/ or source/ in this plugin — database writes, block
  serialization, propagation, REST handlers, save_post hooks, or editor
  state — even if the task never mentions documentation. Any fix whose root
  cause could recur at another call site must end with §9 updated.
---

# Maintain TECHNICAL.md §9 — Invariants & gotchas

[TECHNICAL.md](../../../TECHNICAL.md) §9 is this repo's institutional memory:
every entry is a rule distilled from a real shipped bug (silent database
corruption from unslashed writes, variations destroyed by hook re-entrancy,
propagation clobbering user edits). The section only prevents regressions if
two things reliably happen:

1. Changes are **checked** against it before they land.
2. New lessons are **written** into it when a fix reveals a rule.

Both halves are easy to skip while focused on the fix itself — that is why
this skill exists.

## When changing or reviewing code

1. Read TECHNICAL.md §9 before finalizing the change, and skim the §4 flow
   and §5 file entry for the code being touched.
2. Check the diff against each applicable invariant. The highest-traffic ones:
   - **§9.1** — every `wp_insert_post` / `wp_update_post` / `update_post_meta`
     carrying serialized blocks or JSON must be `wp_slash()`ed (the audit grep
     is in the entry).
   - **§9.4** — any programmatic write of a `bvm_variation` post fires
     `save_post_bvm_variation` mid-call; decide explicitly which of the two
     hooks (sync @10, schedule @20) should run and suppress the rest.
   - **§9.5** — the propagation snapshot is written only at create or after a
     *completed* run, never on ordinary saves.
   - **§9.6** — wrapper structure comes only from
     `BlockRegistry::wrapper_chain()`; a second opinion anywhere destroys
     child-only variations.
   - **§9.7** — excluded attrs are stripped at every meta write path (sole
     exception: a linked child's `bvmVariationId` in templates — §9.16).
3. In the review report or fix summary, name which invariants were checked
   and their outcome. "Checked §9.1/§9.4/§9.7 — all hold" costs one line;
   without it, nobody can tell whether the check happened at all.

## After fixing a bug

Ask: **is the root cause a rule that could be broken again at a different
call site by someone who never saw this bug?**

- Yes → add or extend a §9 entry (format below). This is part of the fix,
  not optional follow-up: a fix without its invariant leaves the next
  occurrence unprevented.
- No (a genuinely one-off typo or logic slip local to one line) → no entry,
  but say so explicitly in the summary.

Qualifies as an invariant: rules spanning multiple call sites; violations
that are silent, destructive, or only visible with specific data; contracts
between distant code (PHP↔JS mirrors, hook ordering, cache/store semantics,
WordPress API expectations like slashing).

Does not qualify: style preferences, anything a linter or type check already
catches, and descriptions of what the code does — behavior documentation
belongs in §3–§7, not §9.

## Entry format

Append as `### 9.N Short imperative title`. Never renumber or delete-and-shift
existing entries — they are referenced by number from commit messages, review
summaries, and past conversations. If a mechanism is removed and its invariant
becomes moot, rewrite the entry in place to say what replaced it.

Each entry contains, in the style of the existing ones:

- The rule stated imperatively, with the *why* in one or two sentences.
- The concrete failure it prevents (what breaks and how it manifests).
- A grep/audit command when the rule is mechanically checkable.

Keep entries as tight as the existing ones — §9 works because it is scannable
top to bottom in a minute.

## Keep the rest of TECHNICAL.md honest

If a change alters the data model (§3), a runtime flow (§4), a file's
responsibilities (§5), the REST surface (§6), or hooks/capabilities (§7–§8),
update that section in the same change. Agents trust these docs; a stale
architecture doc is worse than none.

## Definition of done

A change touching `includes/` or `source/` is complete only when its summary
answers both:

1. Which §9 invariants were checked, and their outcome.
2. Whether a §9 entry was added or updated — or explicitly why the fix
   doesn't warrant one.
