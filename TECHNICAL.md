# Block Variation Manager — Technical Documentation

Reference for developers, support engineers, and AI agents maintaining this
plugin. Covers the architecture, data model, runtime flows, REST surface,
extension points, and — most importantly — the **invariants** that must hold
when modifying the code. Read [§9 Invariants & gotchas](#9-invariants--gotchas)
before changing anything that writes to the database.

- Plugin slug / text domain: `block-variation-manager`
- PHP namespace: `BVM` (all server code in `includes/`)
- Editor bundle: `source/` → webpack → `build/entry.js` (committed)
- Minimum assumptions: WordPress with block editor (uses `enter_title_here`
  editor-settings plumbing, `get_block_type_variations` filter → WP 6.5+ era),
  PHP 7.4+.

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Glossary](#2-glossary)
3. [Data model](#3-data-model)
4. [Runtime flows](#4-runtime-flows)
5. [File-by-file reference](#5-file-by-file-reference)
6. [REST API reference](#6-rest-api-reference)
7. [Hooks and filters](#7-hooks-and-filters)
8. [Capability model](#8-capability-model)
9. [Invariants & gotchas](#9-invariants--gotchas)
10. [Known limitations](#10-known-limitations)
11. [Build & development workflow](#11-build--development-workflow)
12. [Verification recipes](#12-verification-recipes)

---

## 1. Mental model

A **variation** is a saved preset of block attributes (optionally plus an
inner-block template), stored as a post of the `bvm_variation` custom post
type. Any block **instance** in any post can *link* to a variation by carrying
the block attribute `bvmVariationId`. Once linked, edits to the variation
reach every instance through **three independent channels**:

| Channel | Where | What it updates | For which blocks |
|---|---|---|---|
| Render-time merge | `render_block_data` filter (every frontend render) | Attributes only, in memory | Dynamic blocks (has `render_callback`) — attrs drive output |
| Editor sync | `editor.BlockEdit` HOC effect (open posts) | Attributes in the editor store | All linked blocks while a post is open |
| Cron re-bake | `bvm_propagate_variation` WP-Cron job | `post_content` on disk (baked HTML + attrs + inner templates) | Static-save blocks (no `render_callback`) and any variation with an inner-block template |

Per-instance customization is preserved by **`bvmOverriddenAttrs`** (a list of
attribute names the user changed on that instance — those keys are never
overwritten by any channel) and by the **propagation snapshot** (the cron job
only rewrites markup/children that still match what the *previous* propagation
left there; anything hand-edited is skipped and surfaced in an admin notice).

Why three channels: WordPress block types split into *dynamic* (render from
attrs on every request — attribute merging is sufficient) and *static* (their
`save()` bakes attribute-derived markup into `post_content` at save time —
attribute merging at render is a no-op, so the stored HTML itself must be
rewritten). Kadence blocks are dynamic (request-time CSS from attrs); most
`core/*` display blocks are static.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Variation** | A `bvm_variation` post: title + `post_content` snapshot + meta (preset attrs, block type, inner template). |
| **Instance** | A block in any post whose attrs contain `bvmVariationId > 0`. |
| **Source block** | The one block inside the variation's `post_content` whose `blockName` equals the variation's `block_type` meta. May be nested inside synthetic wrappers. |
| **Preset attrs** | The variation's effective attribute set (`_bvm_variation_attrs`), the values that propagate. Excludes the "excluded attrs" (below). |
| **Excluded attrs** | Bookkeeping + per-instance identity keys that must never enter a preset: `bvmVariationId`, `bvmOverriddenAttrs`, `className`, `anchor`, `lock`, `metadata`, `uniqueID`, `uniqueId`. Mirrored in PHP (`Attributes::excluded_attrs()`, filterable) and JS (`PRESET_EXCLUDED_ATTRS` in `source/constants.js`). |
| **Overrides** | `bvmOverriddenAttrs` on an instance: attr names the user intentionally diverged. All propagation channels skip these keys. |
| **Linked child** | A node inside a template or instance subtree that itself carries `bvmVariationId > 0`. Opaque to the enclosing variation (§9.16): templates store only its link, propagation comparisons don't inspect it, and template replacement preserves the instance's node. |
| **Wrapper chain** | For child-only block types (block.json `parent`), the list of synthetic ancestors needed to make the block valid at the editor root, e.g. `[core/list, core/list-item]`. Single source of truth: `BlockRegistry::wrapper_chain()`. |
| **Bake / bake-splice** | The cron job rewriting a static block instance's wrapper HTML (`innerHTML` / `innerContent` string segments) from the variation's serialized source. |
| **Snapshot** | `_bvm_propagated_source` meta: the serialized source block as it was **last propagated**. The in-sync test for safe overwrites. |
| **Tuple shape** | Inner-block template storage format: recursive `[ name, attrs, innerBlocks ]` arrays (Gutenberg's block-variation `innerBlocks` shape). Distinct from the editor object shape `{ name, attributes, innerBlocks }` and from the `parse_blocks()` shape `{ blockName, attrs, innerBlocks, innerHTML, innerContent }`. |

---

## 3. Data model

### 3.1 Custom post type `bvm_variation`

Registered in `CPT::register()` (constant `BVM_CPT`):

- Not public; `show_ui` under **Tools → Block Variations** (`show_in_menu: tools.php`).
- `show_in_rest: true`, `rest_base: block-variation-manager` — the block editor
  saves variation posts through the standard `/wp/v2/block-variation-manager`
  controller; the plugin's own `bvm/v1` API is a convenience layer on top.
- Supports `title` + `editor` only. No revisions, no custom-fields metabox.
- `post_content` holds the **canonical serialized source block** (possibly
  inside synthetic wrappers) — it is the "golden snapshot" whose baked HTML
  the cron job splices into instances.
- Only `publish` variations are live: the render merge, the `bvm/v1` list/get
  routes, and the inserter all ignore other statuses.

### 3.2 Post meta (on `bvm_variation` posts)

All JSON meta is written with `wp_slash( wp_json_encode( … ) )` — see
[§9.1](#91-slashing-every-database-write).

| Key (constant) | Type | Written by | Read by |
|---|---|---|---|
| `_bvm_variation_attrs` (`BVM_META_ATTRS`) | JSON object string — the preset | `CPT::sync_attrs_from_content` (parse + defaults + baseline), `Rest::create/update_variation` (authoritative client set) | `CPT::get_attrs()` → render merge, inserter, propagation, REST serialize |
| `_bvm_variation_block_type` (`BVM_META_BLOCK_TYPE`) | string block name | REST create/update; sync fallback auto-populate (only when previously empty) | Everything that must find the source block or match instances |
| `_bvm_variation_inner_blocks` (`BVM_META_INNER_BLOCKS`) | JSON tuple tree | Sync (derived from content, excluded attrs stripped), REST (client-shaped, sanitized) | Inserter template, apply flow, REST serialize |
| `_bvm_propagated_source` (`BVM_META_PROPAGATED_SOURCE`) | Serialized block markup | `Propagate::write_snapshot()` — at REST create and at the **end of a completed propagation run only** | `Propagate::run()` in-sync guards |
| *(registered for REST)* first three keys are registered via `register_post_meta` with `edit_posts` auth callbacks | | | |

Historical note: a `_bvm_attrs_source` one-shot tag protocol existed and was
removed; do not reintroduce it — baseline layering plus the editor's post-save
attrs sync replaced it (see [§4.2](#42-editing-a-variation)).

### 3.3 Block attributes (injected into every block type)

`Attributes::extend()` (PHP `register_block_type_args`) and
`source/filters/extend-attributes.js` (JS `blocks.registerBlockType`) both
register, on **every** block type:

```
bvmVariationId      number, default 0     // link to a variation post ID
bvmOverriddenAttrs  string[], default []  // attr names the instance overrides
```

Both sides are required: the PHP filter covers server-registered blocks, the
JS filter covers client-only registrations. These serialize into the block
comment in `post_content`, which is also how usage discovery works (§3.5).

### 3.4 Options

| Option | Autoload | Shape | Purpose |
|---|---|---|---|
| `bvm_migration_version` | **yes** (read every request) | string `'1'` | One-shot `ncss_*` → `bvm_*` rename migration guard (`Migration`). |
| `bvm_propagate_skipped` | no (admin-only reads) | `{ [variationId]: SkippedRow[] }` | Instances the last propagation refused to overwrite. `SkippedRow = { id, title, edit_link, permalink, overrides: string[], inner_diverged: bool, content_diverged: bool }`. Rendered by `Propagate::render_admin_notice` (capability-filtered per viewer), cleared via the notice's Dismiss link (`handle_dismiss`, nonce `bvm_dismiss_propagate`). |

### 3.5 Usage discovery

There is no lookup table. Instances are found by SQL `LIKE` over
`wp_posts.post_content` for the **delimiter-terminated** needle
`"bvmVariationId":<id>,` OR `"bvmVariationId":<id>}` (both variants, because
serialized JSON follows the number with `,` or `}`; a bare prefix would make
variation 12 match 123). Shared builder: `CPT::usage_where()`. Consumers:

- `CPT::count_usage()` — admin list column, localized editor usage count.
- `CPT::list_usage( $id, $offset, $limit )` — REST instances panel (rows
  filtered by capability at the REST layer).
- `CPT::usage_post_ids( $id, $after_id, $limit )` — **keyset-paged** ID cursor
  used by propagation (stable under concurrent edits; `ORDER BY ID ASC`,
  `WHERE ID > $after_id`).

These are full-table scans by design (unindexable leading-wildcard LIKE);
they are confined to admin/REST/cron paths — never call them during frontend
rendering.

---

## 4. Runtime flows

### 4.1 Creating a variation (sidebar Save panel)

`SavePanel` (`source/components/VariationPanel.js`) →
`createVariation()` (`source/lib/variation-store.js`) →
`POST /bvm/v1/variations` (`Rest::create_variation`).

1. Client computes `preset = extractPresetAttrs(attributes)` (excluded attrs
   stripped) and — after **awaiting** `ensureRegistryLoaded()` — captures the
   live child tree when the block has required children (block.json-derived
   or seeded via `DEFAULT_REQUIRED_CHILDREN`, e.g. kadence/rowlayout →
   kadence/column), sending both a client-serialized `content` string
   (authoritative for static-save markup) and an `inner_blocks` object tree.
   Children that are themselves variation instances are captured as
   link-only stubs — `{ name, attributes: { bvmVariationId } }` plus their
   subtree — never their baked settings (§9.16). (Free-form containers
   without required children are NOT captured — see the pending design
   decision in §10.)
2. Server wraps `content` in the wrapper chain (`wrap_for_editing`),
   **suppresses `CPT::sync_attrs_from_content` around `wp_insert_post`**
   (otherwise the pre-meta sync would mistake the wrapper for the source and
   store the child as a self-referential inner template), then writes
   authoritative meta directly and seeds the propagation snapshot.
3. `Propagate::schedule` (still hooked at priority 20) queues the cron job;
   harmless on a brand-new variation.
4. Client links the block (`bvmVariationId = created.id`, overrides `[]`) and
   optionally saves the post (with a confirm dialog if the post had other
   dirty state). The store's version tick refreshes every mounted panel list.

### 4.2 Editing a variation

The variation edit screen is the normal block editor plus
`source/admin/*` behavior (active only when `window.BVM.isVariationEditor`):

- **Root enforcement** (`variation-editor.js initVariationEditor`): keeps
  exactly one root block of the **expected root type = wrapper chain[0]**
  (NOT the raw block type — for child-only variations the legitimate root is
  the synthetic parent). Re-seeds the full nested chain when empty or
  wrong-typed. Waits for `__unstableIsEditorReady` to avoid boot races.
- **Save path**: the editor saves `post_content` via `/wp/v2/…` →
  `save_post_bvm_variation` fires:
  - priority 10 `CPT::sync_attrs_from_content` — parses content, finds the
    source block (by name through wrappers; root fallback for root-capable
    types), rebuilds attrs as `parse + block.json defaults`, then **layers the
    existing meta as a baseline** (parsed values win on overlap; keys that only
    exist in meta survive). This compensates for `parse_blocks()` losing
    html-sourced attrs (heading text) and client-registered defaults (Kadence
    presets). Also derives the inner tuple template (excluded attrs stripped).
  - priority 20 `Propagate::schedule` — queues the cron run (+60 s, deduped
    via `wp_next_scheduled` on args `[id, 0]`).
- **Post-save attrs sync** (`variation-editor.js initAttrsSaveSync`): after
  each *successful* editor save, the client PUTs the source block's
  **fully-resolved** attrs + inner tree to `/bvm/v1/variations/:id`
  (meta-only on the server). This is the authority that keeps html-sourced
  values and client-only defaults in the preset (which is what makes instance
  text edits overridable) and purges stale keys the baseline would carry.
- The Usage sidebar panel lists instances; the orientation banner explains
  propagation (dismissal persisted in `localStorage['bvm-orientation-seen']`).

### 4.3 Propagation (cron)

`Propagate::run( $variation_id, $after_id = 0 )` on hook
`bvm_propagate_variation`, batches of `BATCH_SIZE = 50` via keyset paging,
continuation events scheduled +30 s with the last processed ID as cursor
(deduped via `wp_next_scheduled`, same as the initial `schedule()`).

Per matched instance block (`blockName === block_type` AND
`bvmVariationId === id` — both checks required), inside `walk()`:

1. Collect the instance's `bvmOverriddenAttrs` into the skipped report.
2. **Inner-block replace** (when the variation has a template): replace the
   instance's children with the variation's tree **only if** the current
   children still `trees_match()` the *snapshot's* children (deep compare:
   names, default-normalized attrs, and — for static-save children only —
   trimmed innerHTML, §9.17). Mismatch ⇒
   `inner_diverged`, skip. Child-count changes rebuild the parent's
   `innerContent` null slots (`rebuild_inner_content`). Linked children
   (same `bvmVariationId` on both sides) compare as opaque-equal — their own
   variation owns attrs/markup/subtree — and the replacement goes through
   `merge_template_children`, which keeps the instance's node at linked
   template positions instead of the template's stale copy (§9.16).
3. **Bake-splice** (when `CPT::block_needs_bake()` — i.e. static-save — and
   the instance has no overrides): if the instance's wrapper prefix/suffix
   (`wrapper_html()`: leading/trailing string segments of `innerContent`)
   still match the *snapshot's*, write `attrs = array_merge(instance,
   preset)` + new wrapper HTML. Mismatch ⇒ `content_diverged`, skip. The
   merge (not replace) is what preserves instance-only attrs.
4. Changed instances are persisted via `update_instance_content()`: slashed
   `wp_update_post`, kses suspended/restored, and both save hooks removed
   around updates when the instance is itself a `bvm_variation`.
5. After the **final** batch: `write_skipped()` and `write_snapshot()` — the
   just-propagated source becomes the next run's baseline.

With **no snapshot** (legacy data), comparisons fall back to the *current*
source: matching instances are already up to date (no-op), differing ones are
flagged instead of overwritten — a deliberately conservative first run.

### 4.4 Render-time merge

`Render::apply_variation` on `render_block_data` (every block, every frontend
request): if `bvmVariationId > 0`, and the block's name matches the
variation's `block_type` (type check — transformed/hand-retyped blocks are
skipped), merge preset attrs over instance attrs, skipping overridden and
excluded keys. `CPT::get_attrs()` is publish-gated; meta reads hit the object
cache.

### 4.5 Editor-side behavior on linked instances

`source/filters/track-overrides.js` wraps every block's `setAttributes`:

- **Store states** (from `variation-store.js getCached`): `undefined` =
  loading, `null` = confirmed missing (404 negative-cached only), object =
  loaded. Transient fetch errors are NOT cached (retry on next mount);
  `fetchVariation` dedupes in-flight requests per ID.
- While **loading**, user edits are marked overridden *conservatively*; the
  sync effect's **reconcile pass** later drops marks that turn out to equal
  the variation value (or that the variation doesn't define — stale marks
  would wrongly block server propagation).
- The new override list is based on `overriddenRef.current` and the ref is
  updated **synchronously**, so two `setAttributes` calls in the same tick
  can't erase each other's marks.
- Kadence `foo`/`fooClass` pairs (`source/lib/class-pairs.js`) are marked and
  un-marked together.
- The sync effect writes changed preset values into the block-editor store
  (dirties the post by design — see the file's docblock for why prop-merging
  was rejected).

`source/filters/inject-panel.js` mounts `VariationPanel` (InspectorControls)
on every selected, non-blocklisted block outside the variation editor. Apply
flow: attr-only for template-less variations; silent child restore into empty
targets; a Replace/Keep confirm dialog when both sides have children.

### 4.6 Child-only block types

Blocks whose block.json declares `parent` (e.g. `kadence/singlebtn`,
`core/list-item`) cannot sit at the editor root. `BlockRegistry::
wrapper_chain()` computes the ancestor chain (first declared parent, depth-
capped, cycle-guarded) and is the **single source of truth** consumed by:

1. `Rest::wrap_for_editing` — wraps variation `post_content`.
2. `Assets` — localizes `variationRootChain` and seeds the editor template.
3. `variation-editor.js` — enforces chain[0] as the root and seeds the nested
   chain.

Server-side readers (`CPT::find_block`, `Propagate::extract_source_block`)
see *through* wrappers by searching for the block **by name**; the
root-fallback path is only taken for root-capable types.

---

## 5. File-by-file reference

### PHP (`includes/`, loaded in order by `block-variation-manager.php`; `Plugin::init()` wires them)

| File | Class | Responsibility |
|---|---|---|
| `class-migration.php` | `Migration` | One-shot rename `ncss_*` → `bvm_*` (post type, meta keys, attr keys in content via SQL REPLACE). Flushes the object cache when rows changed. Guarded by autoloaded `bvm_migration_version`. |
| `class-cpt.php` | `CPT` | CPT + meta registration, admin list columns, `enter_title_here` placeholder, the save-time meta sync (`sync_attrs_from_content`), source-block search (`find_block`), default merging (`merge_with_defaults`), tuple derivation (`blocks_to_tuples`), usage queries (`usage_where` / `list_usage` / `count_usage` / `usage_post_ids`), `block_needs_bake` (keyed on `!is_dynamic()`), meta accessors (`get_attrs`, `get_block_type`, `get_inner_blocks`). |
| `class-attributes.php` | `Attributes` | Injects `bvmVariationId`/`bvmOverriddenAttrs` into every block type; owns `excluded_attrs()` (filter `bvm_excluded_attrs`) and `strip_excluded()`. |
| `class-render.php` | `Render` | The `render_block_data` merge (precedence: overrides > preset > instance; type-checked; excluded-key safe). |
| `class-rest.php` | `Rest` | `bvm/v1` routes, per-object permission callbacks, create/update/delete handlers, `wrap_for_editing`, attrs-splice content updates, `serialize_single_block` (core `get_comment_delimited_block_content`), inner-tree sanitizer, response serializer. |
| `class-inserter.php` | `Inserter` | Registers each published variation as a block-inserter variation via `get_block_type_variations`. **One query per request** (static map grouped by block type, 500 cap), flushed on variation saves. |
| `class-assets.php` | `Assets` | Enqueues `build/entry.js`/`.css`, localizes `window.BVM` (see below), seeds the variation editor's root template from the wrapper chain. |
| `class-block-registry.php` | `BlockRegistry` | Parent/child policy derived from the WP block registry: `parent_of`, `wrapper_chain`, `required_children` map (block.json `parent` pass + the `DEFAULT_REQUIRED_CHILDREN` vendor seed, e.g. kadence/rowlayout → kadence/column), `/registry` REST route (filter `bvm/block_policy`, only non-empty entries returned). |
| `class-propagate.php` | `Propagate` | The cron engine (§4.3), snapshot read/write, safe instance writes, skipped-option storage, admin notice + dismiss handling. |
| `class-plugin.php` | `Plugin` | `::init()` fans out to every class's `init()`. |

### `window.BVM` (localized by Assets on every block-editor screen)

```
restNamespace        'bvm/v1'
cpt                  'bvm_variation'
adminUrl             admin post.php URL (Edit source button)
variationListUrl     Tools → Block Variations URL (back link)
isVariationEditor    bool — current screen edits a bvm_variation
variationBlockType   the variation's block type ('' elsewhere)
variationRootChain   wrapper chain, outermost first ([] elsewhere)
variationUsageCount  instance count for the orientation banner
```

### JavaScript (`source/`, bundled from `entry.js`)

| Module | Responsibility |
|---|---|
| `constants.js` | Attr-name constants, `INTERNAL_ATTRS` (override-tracking skip set), `PRESET_EXCLUDED_ATTRS` (preset strip set — superset incl. `uniqueID`). |
| `lib/rest-path.js` | `restPath(suffix)` — the only place the namespace fallback lives. |
| `lib/variation-store.js` | Module-level store: per-ID cache (undefined/null/object semantics), per-type list cache, in-flight dedupe, **version-counter snapshot** for `useSyncExternalStore`, CRUD helpers (`createVariation`, `updateVariation`, `listInstances`). |
| `lib/block-registry.js` | Lazy `/registry` mirror; `ensureRegistryLoaded()` (retries after failure), `hasRequiredChildren()`. |
| `lib/preset.js` | `extractPresetAttrs`, `shapeInnerBlocks` — shared preset shaping. |
| `lib/class-pairs.js` | `kadenceClassPair`, `pairBaseKey`. |
| `lib/equality.js` | `deepEqual` for attribute values. |
| `filters/extend-attributes.js` | Client-side attribute injection (mirror of `Attributes`). |
| `filters/track-overrides.js` | The override-tracking HOC + variation→store sync effect (§4.5). |
| `filters/inject-panel.js` | Mounts `VariationPanel` on selected blocks; blocklist: `core/freeform`, `core/missing`, `core/block`. |
| `components/VariationPanel.js` | SourcePanel (apply/rebind/unlink/override chips/reset) + SavePanel (create). |
| `admin/variation-editor.js` | Variation-screen orchestration: chrome, root enforcement, post-save attrs sync, orientation banner. |
| `admin/strip-post-chrome.js` | Removes irrelevant document panels; retargets the back link (self-disconnecting, 10 s-capped MutationObserver). Title placeholder is PHP-side (`enter_title_here`). |
| `admin/usage-panel.js` | Document sidebar Usage panel (instances list via REST). |
| `admin/orientation.js` | Dismissible orientation notice (localStorage-persisted). |

---

## 6. REST API reference

Namespace `bvm/v1`. All responses for a variation use `Rest::serialize()`:

```json
{ "id": 16, "title": "…", "block_type": "core/heading",
  "attrs": { … }, "inner_blocks": [ [name, attrs, innerBlocks], … ],
  "edit_link": "…/post.php?post=16&action=edit" }
```

| Route | Method | Permission | Notes |
|---|---|---|---|
| `/variations` | GET | `edit_posts` | Optional `?block_type=`; publish-only; 200 cap. |
| `/variations` | POST | `edit_posts` **+** `publish_posts` | Body: `title`, `block_type` (required), `attrs`, `content` (client-serialized block, preferred), `inner_blocks`. Creates as `publish`. |
| `/variations/{id}` | GET | `edit_posts` | 404 for non-publish (deliberate — clients treat 404 as "missing"). |
| `/variations/{id}` | PUT/PATCH | `edit_post` on {id} | See semantics below. |
| `/variations/{id}` | DELETE | `delete_post` on {id} | Force-deletes (no trash). |
| `/variations/{id}/usage` | GET | `edit_posts` | `{ id, count }` (count only — no titles). |
| `/variations/{id}/instances` | GET | `edit_posts` | Rows filtered to posts the caller can `edit_post`. |
| `/registry` | GET | `edit_posts` | `{ blockName: { required_children: [...] } }`, non-empty entries only, filtered per-entry through `bvm/block_policy`. |

**Update semantics** (`update_variation`) — content precedence:

1. `content` provided → becomes `post_content` (wrapped). Full fidelity.
2. else `attrs` + `sync_content: true` → attrs **spliced into the existing
   parsed content** (children and baked HTML preserved) and content rewritten.
3. else `attrs` alone → **meta-only** (no `wp_update_post`). This is the mode
   the editor's post-save sync uses; note the editor view of comment attrs is
   not refreshed in this mode. External API clients that want the edit screen
   to reflect attr changes should pass `sync_content: true` or `content`.

Ordering inside update: `wp_update_post` first (fires the sync), authoritative
meta writes after, then `Propagate::schedule` explicitly (meta-only updates
never fire `save_post`).

---

## 7. Hooks and filters

**Provided:**

| Hook | Type | Signature | Purpose |
|---|---|---|---|
| `bvm_excluded_attrs` | filter | `(string[] $defaults)` | Add vendor per-instance identity attrs to the preset-exclusion list. Note: the JS `PRESET_EXCLUDED_ATTRS` set is compile-time — a PHP-only addition still protects meta/render/propagation, but the client Save panel would briefly include the key until the sync strips it. Mirror additions in `source/constants.js` for full coverage. |
| `bvm_block_needs_bake` | filter | `(bool $default, string $block_name)` | Override the static-vs-dynamic classification per block. |
| `bvm/block_policy` | filter | `(array $entry, string $block_name)` | Adjust a block's `required_children` entry as served by `/registry`. |
| `bvm_propagate_variation` | action (cron) | `($variation_id, $after_id)` | The propagation job. Args are `[id, 0]` for a fresh run; continuation events carry the ID cursor. |

**Consumed (ordering matters):** `save_post_bvm_variation` — priority 10
`CPT::sync_attrs_from_content`, priority 20 `Propagate::schedule`. Both are
temporarily removed-and-restored in two places: `Rest::create_variation`
(sync only, around insert) and `Propagate::update_instance_content` (both,
when rewriting a nested-variation instance). Also: `render_block_data`,
`register_block_type_args`, `get_block_type_variations`,
`block_editor_settings_all`, `enter_title_here`, `enqueue_block_editor_assets`,
`manage_*_posts_columns` / `_custom_column`, `admin_notices`, `admin_init`.

---

## 8. Capability model

- Read surfaces (`can_read`): `edit_posts`.
- Create: `edit_posts` **and** `publish_posts` (variations are published
  immediately and affect live pages sitewide).
- Update/Delete: per-object `edit_post` / `delete_post` via `map_meta_cap`
  (Contributors cannot touch others' variations or published ones).
- Usage/instances responses and the skipped-posts admin notice are filtered
  per-viewer with `current_user_can( 'edit_post', $row_id )` — the underlying
  queries intentionally span drafts/private posts because cron (userless)
  needs the full set; **the capability filter lives at the presentation
  layer**. Keep it there if you add new surfaces over `list_usage`.

---

## 9. Invariants & gotchas

These are the rules that past bugs came from. Verify against this list before
merging any change.

### 9.1 Slashing: EVERY database write

`wp_insert_post`, `wp_update_post`, **and `update_post_meta`** all
`wp_unslash()` their input. Serialized block markup and `wp_json_encode`
output are full of backslash escape sequences (`"`, `\"`, `\/` — core's
`serialize_block_attributes()` escapes `"`, `--`, `<`, `>`, `&` precisely so
values can't break the HTML comment). Writing any of it unslashed strips the
backslashes and silently corrupts stored data. **Rule: wrap the payload in
`wp_slash()` at every one of these call sites.** Grep audit:

```bash
grep -rn "wp_insert_post\|wp_update_post\|update_post_meta" includes/ | grep -v wp_slash
```

(The only intentional non-slashed writes are plain sanitized strings like
`BVM_META_BLOCK_TYPE` block names, which never contain backslashes.)

### 9.2 Never hand-roll block comments

Use `get_comment_delimited_block_content()` / `serialize_block()` — plain
`wp_json_encode` into `'<!-- wp:… -->'` strings lets attr values containing
`-->`/`--`/quotes break parsing or get mangled by kses. (Attribute-less
wrapper comments in `wrap_for_editing` are the one safe exception.)

### 9.3 Cron writes run with no user

Anything the propagation job writes passes kses as an anonymous user unless
suspended (`kses_remove_filters()` … `kses_init()`), and `get_edit_post_link`
returns null (build admin URLs manually; capability-filter at render time).

### 9.4 Hook re-entrancy

Any `wp_insert_post`/`wp_update_post` of a `bvm_variation` post from plugin
code fires `save_post_bvm_variation` **synchronously mid-call**. Decide
explicitly for each new write whether the sync (prio 10) and the scheduler
(prio 20) should run, and remove/re-add exactly the ones that shouldn't.
Getting this wrong caused the self-referential-template bug (sync ran before
meta existed during REST create).

### 9.5 Snapshot lifecycle

`_bvm_propagated_source` must describe the **last completed propagation**,
never the current content. Write it only: (a) at REST create (no instances
exist yet), (b) at the end of a *completed* run (final batch / no instances /
nothing-to-do). Writing it on ordinary variation saves would make every
in-sync instance look diverged on the next run.

### 9.6 Wrapper chain has one source of truth

`BlockRegistry::wrapper_chain()`. If content wrapping, the localized
`variationRootChain`, and the JS root enforcement ever disagree, the editor
destroys child-only variations on open. Any new consumer of "what is the
variation's root block" must call this method.

### 9.7 The preset must stay authoritative and clean

- `parse_blocks()` never returns html-sourced attrs or client-only-default
  values; the baseline layering in the sync plus the editor's post-save attrs
  PUT are what keep them in meta. If you change either half, text edits on
  instances stop being overridable and the bake-splice becomes destructive
  (the snapshot guard is the last line of defense, not the first).
- Excluded attrs must be stripped at **every** meta write path (sync, REST
  create/update, tuple derivation, inner-tree sanitizer) and skipped at merge
  time. A preset containing `className`/`anchor`/`uniqueID` forces one
  instance's identity onto all instances. Sole deliberate exception (§9.16):
  a linked child inside a template keeps exactly its `bvmVariationId` —
  nothing else.

### 9.8 Matching instances

An instance matches a variation only when **both** `blockName === block_type`
and `bvmVariationId === id`. The render merge and `Propagate::walk` both
enforce this; keep them in agreement.

### 9.9 Usage LIKE needles are delimiter-terminated

Always `"bvmVariationId":<id>,` OR `…<id>}` — never the bare prefix. Use
`CPT::usage_where()`.

### 9.10 Propagation paging is keyset, not OFFSET

`ORDER BY ID ASC` + ID cursor in the cron args. OFFSET over `post_modified`
reshuffles between batches (our own writes bump `post_modified`) and skips
rows.

### 9.11 `useSyncExternalStore` snapshots must change identity

The store exposes a monotonically increasing `getVersion()` for list-shaped
subscriptions. A constant snapshot (the old `STORE_TICK_KEY` sentinel) never
re-renders regardless of `notify()` calls.

### 9.12 Store cache semantics

`getCached(id)`: `undefined` = loading, `null` = confirmed missing (only
404s are negative-cached), object = loaded. Consumers branch on all three;
collapsing `undefined` and `null` reintroduces the edits-reverted-while-
loading and permanent-orphan bugs.

### 9.13 `innerContent` null slots must equal child count

Whenever `innerBlocks` is replaced with a different-length array, rebuild the
parent's `innerContent` (see `rebuild_inner_content`) or `serialize_blocks()`
drops/duplicates children.

### 9.14 Cron scheduling must dedupe with `wp_next_scheduled`

Every `wp_schedule_single_event` for `bvm_propagate_variation` — the initial
queue in `schedule()` AND the continuation in `run()` — must be guarded by
`false === wp_next_scheduled( self::HOOK, $args )` with the exact same args.
WP-Cron does not dedupe identical events (within 10 minutes it only dedupes
*duplicate timestamps*), and `run()` can fire twice with the same cursor
(parallel cron runners, wp-cli `cron event run` alongside web cron): an
unguarded schedule then stacks duplicate continuation events, each of which
schedules more, re-processing every batch N times. Grep audit:

```bash
grep -rn "wp_schedule_single_event" includes/
# every hit must sit inside a wp_next_scheduled( … same args … ) === false guard
```

### 9.15 (retired)

Held "in-sync checks compare against the CURRENT source before the snapshot"
for a fix that was reverted the same day pending the maintainer's inner-block
design decision (§10). The number is not reused so older references stay
unambiguous.

### 9.16 Linked children are opaque to the enclosing variation

A child node carrying `bvmVariationId > 0` is owned by ITS variation (and its
own instance-local content), never by the template that contains it. Five
call sites must agree: template capture keeps only the link — JS
`shapeInnerBlocks`, PHP `CPT::blocks_to_tuples`, `Rest::sanitize_inner_tree`
(the one deliberate exception to §9.7's strip rule) — `Propagate::trees_match`
compares linked nodes by link id alone (no attrs/innerHTML/subtree), and
`Propagate::merge_template_children` preserves the instance's node at linked
template positions during replacement. Breaking any one site either bakes a
stale fork of the nested variation's settings into templates (overwriting
live values on propagation) or flags every instance containing a nested link
as permanently diverged. Grep audit:

```bash
grep -rn "bvmVariationId" includes/class-cpt.php includes/class-rest.php includes/class-propagate.php source/lib/preset.js
# every template capture / compare / replace site must special-case linked nodes
```

### 9.17 Never byte-compare a dynamic block's markup

Dynamic blocks bake per-instance identity into their saved markup — Kadence
embeds each block's `uniqueID` in its class names — and template-inserted
instances legitimately carry different uniqueIDs than the variation's
snapshot. Any in-sync check that byte-compares a dynamic block's
innerHTML/innerContent therefore flags every such instance as diverged
forever, and child propagation silently stops (the exact bug: a rowlayout
variation's column alignment change never reached instances). Their
authoritative state, text included, lives in attrs — which the comparisons
already cover with identity attrs stripped. Markup comparison is valid only
for static-save blocks (`CPT::block_needs_bake()` true), where innerHTML IS
the content; `trees_match()` gates on it, and the bake-splice path only runs
for static blocks in the first place. Keep any new comparison site behind the
same gate.

- **Parts of inner-block behavior remain pending a maintainer design
  decision** (updated 2026-08-19 — do NOT change these without the
  maintainer's direction on how children should function): (a) free-form
  containers WITHOUT required children (core/group, core/columns, …) still
  save childless variations with no option offered — kadence/rowlayout is now
  handled via the `DEFAULT_REQUIRED_CHILDREN` seed and linked-child opacity
  (§9.16); (b) `Propagate::walk()`'s in-sync checks compare against the
  last-propagated snapshot only, so an instance whose children/markup already
  match the *current* template is flagged diverged and can never converge
  (the snapshot advances after every run); (c) the skipped-posts notice
  suggests re-saving the post, which does not adopt a new template. A
  reverted fix for (a)-generalized (capture checkbox), (b) (current-first
  ordering, the retired §9.15), and (c) exists in the 2026-08-19 session
  history.

- **Programmatic edits bypass override tracking.** Attribute changes made via
  `dispatch('core/block-editor').updateBlockAttributes` (other plugins, core
  tools like Paste Styles, code-editor edits) don't pass through the wrapped
  `setAttributes`, so they aren't marked overridden. The propagation snapshot
  guards prevent destructive clobbering of baked content, but attr-level
  changes from such tools can still be re-synced to the variation value.
- **Usage discovery only sees `wp_posts`.** Blocks stored in widgets
  (`widget_block` option), template parts stored elsewhere, or postmeta-based
  builders are invisible to counts and propagation (render-time merge still
  applies wherever `render_block` runs).
- **First propagation after upgrading to snapshot-aware code is
  conservative**: differing instances are flagged, not rewritten; a manual
  resave of each flagged post (or of the variation after reconciling)
  converges them, after which snapshots make runs precise.
- Multi-parent child blocks use their **first** declared parent for wrapping.
- Caps: inserter map 500 variations, list route 200, usage list 500/page.
- The skipped-notice option uses read-modify-write without locking; parallel
  cron runners (non-default setups) could drop rows from the advisory notice
  (post content is never at risk).
- `deepEqual` treats `NaN !== NaN`; attribute values are JSON so this is
  theoretical.

---

## 11. Build & development workflow

```bash
npm install                # @wordpress/scripts (webpack, babel, sass)
npm run start              # dev build, watch mode
npm run build              # production build → build/ (COMMITTED — rebuild before committing JS changes)
npm run playground         # disposable WP via wp-playground CLI, plugin pulled from GitHub (blueprint.json)
npm run playground:local   # same, but the working tree is mounted (use with `npm run start`)
```

- `build/` is committed deliberately so the plugin installs straight from a
  GitHub checkout (the public Playground blueprint depends on this). **Any
  change under `source/` requires a rebuild and committing the new `build/`
  artifacts** (`entry.js`, `entry.css`, `entry-rtl.css`, `entry.asset.php`).
- `webpack.config.cjs` extends `@wordpress/scripts`' config with a custom
  entry; the `.asset.php` dependency list is generated — never hand-edit it.
- PHP has no build step; syntax-check with `php -l includes/*.php`.
- `scripts/playground-local.mjs` strips the blueprint's GitHub install step
  and relies on `--auto-mount`; it writes/cleans `.blueprint.local.json`.

---

## 12. Verification recipes

**Boot smoke test** — `npm run playground:local`, then (the Playground
auto-login 302s the first cookieless request; keep a cookie jar):

```bash
curl -sL -c jar.txt -b jar.txt http://127.0.0.1:9400/ -o /dev/null -w "%{http_code}\n"   # 200
curl -s  -b jar.txt http://127.0.0.1:9400/wp-json/bvm/v1/variations -w "\n%{http_code}\n" # 401 rest_forbidden (route registered, gate works)
```

**Authenticated REST round-trip** — grab the REST nonce from any admin page
(`createNonceMiddleware( "…" )` in the HTML), then the critical regression
check is that hostile attr values survive byte-exact:

```bash
# create
curl -s -b jar.txt -H "X-WP-Nonce: $NONCE" -H "Content-Type: application/json" \
  -X POST http://127.0.0.1:9400/wp-json/bvm/v1/variations \
  -d '{"title":"T \"q\"","block_type":"core/heading","attrs":{"level":2,"content":"Say \"hi\" -- dashes & <angles>","className":"must-be-stripped"}}'
# re-fetch: attrs.content must equal the input exactly; className must be absent
```

**Manual editor checks** (the ones automated tests don't cover):

1. Save a styled block as a variation → the Apply dropdown shows it
   immediately (no remount needed) and the block reads as linked.
2. Insert the variation on two posts; edit one instance's text; edit the
   variation's color and save → after cron (~60 s; trigger via
   `wp cron event run bvm_propagate_variation` or wait), the untouched
   instance updates, the text-edited one appears in the skipped notice.
   **Playground cannot spawn WP-Cron's loopback request**, so the blueprint
   defines `ALTERNATE_WP_CRON` (due events run inline on normal page visits).
   On an instance booted without it, run due jobs by visiting
   `/wp-cron.php?doing_wp_cron` while logged in — a cookieless hit gets
   captured by Playground's auto-login redirect and never reaches WordPress.
3. Save a `core/list-item` (child-only) selection as a variation, then open
   it from Tools → Block Variations → content must display wrapped in a list
   and survive a no-op save.
4. As a Contributor, verify POST/PUT/DELETE on `bvm/v1` are refused and
   `/instances` omits other users' drafts.
