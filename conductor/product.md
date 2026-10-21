# Product Definition

## Block Variation Manager

A WordPress plugin that lets site editors save any block's attributes (optionally with its inner-block template) as a named, reusable variation. Instances across the site link to a variation and stay in sync through three propagation channels — render-time attribute merging for dynamic blocks, live editor sync, and a cron-driven re-bake of stored post content for static blocks — while per-instance manual overrides are always preserved. Built around WordPress core blocks and Kadence Blocks, with a Tools-menu management screen, a block-sidebar Variation panel, and a `bvm/v1` REST layer.

## Target Users

- **Site editors / content teams** who reuse styled blocks across many pages and want one place to edit them site-wide.
- **Agencies and site builders** (especially Kadence-based stacks) maintaining design consistency without locking content into synced patterns.

## Core Value

Edit once, update everywhere — without losing intentional per-instance customizations. Unlike core synced patterns, a variation propagates *attributes* (and optionally a template) while each instance keeps its own content and tracked overrides.

## Key Features

1. **Save as variation** — capture a selected block's attributes (and inner template) from the editor sidebar.
2. **Apply / detach** — link any compatible block instance to a variation, or detach it back to a standalone block.
3. **Three-channel propagation** — render-time merge (dynamic blocks), editor sync (open posts), cron re-bake (static blocks and templates), with snapshot-based safe overwrites.
4. **Override preservation** — per-attribute overrides (`bvmOverriddenAttrs`) are never clobbered by any channel.
5. **Management screen** — Tools → Block Variations lists variations with source type and usage counts.
6. **Inserter integration** — variations appear as insertable block variations.
7. **Playground demo** — one-click WordPress Playground blueprint for trying the plugin with zero install.

## Current Status

Working plugin (v0.1.0) with committed build artifacts, full technical documentation (TECHNICAL.md), and documented invariants distilled from shipped bugs. Children/linked-child UX refinements are deliberately pending product direction.
