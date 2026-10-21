# Product Guidelines

## Voice & Tone

- **Plain, direct, editor-facing.** UI copy speaks to WordPress site editors, not developers: "Save as variation", "Apply", "Detach" — short verbs, no jargon.
- **Honest about side effects.** When propagation skips hand-edited content, say so in an admin notice rather than failing silently. Never claim sync happened when it was skipped.
- **Documentation is developer-grade.** README stays concise and task-oriented; TECHNICAL.md carries full depth, including invariants distilled from real bugs.

## UX Principles

1. **Never destroy user intent.** Manual per-instance overrides are sacred — no propagation channel may overwrite an attribute the user deliberately changed, and hand-edited markup is skipped, not clobbered.
2. **Work where editors already are.** Features live in native WordPress surfaces: the block sidebar, the inserter, and Tools → Block Variations. No custom top-level admin menus or bespoke UI frameworks.
3. **Feel native to Gutenberg.** Use `@wordpress/*` components and conventions so panels, notices, and controls are indistinguishable from core.
4. **Safe by default.** Snapshot-guarded writes, capability checks, and `publish`-only visibility; destructive or surprising operations surface notices.
5. **Zero-friction evaluation.** The Playground blueprint must keep working one-click from GitHub — demos are part of the product.

## Conventions

- English (US) strings, translatable via the `block-variation-manager` text domain.
- Admin notices: concise sentence case, state what happened and which posts were affected/skipped.
- Naming: "variation" (never "preset" or "pattern") in all user-facing copy.
