# Tech Stack

## Platform

- **WordPress plugin** — requires the block editor (WP 6.5+ era APIs: `get_block_type_variations` filter, editor-settings plumbing)
- **PHP 7.4+**, namespace `BVM`, all server code in `includes/` (no PHP build step; lint touched files with `php -l`)

## Backend (PHP)

- Custom post type `bvm_variation` (Tools → Block Variations)
- Post meta with JSON payloads (all writes `wp_slash()`-wrapped — TECHNICAL.md §9.1)
- REST: custom `bvm/v1` namespace + standard `/wp/v2/block-variation-manager` controller
- WP-Cron propagation job (`bvm_propagate_variation`)
- Hooks: `render_block_data`, `register_block_type_args`, `save_post`, etc.

## Frontend (JS)

- **ES modules** in `source/`, built with **webpack** via `@wordpress/scripts` ^30 (`webpack.config.cjs`)
- `@wordpress/*` packages (block editor components, data stores, HOCs/filters)
- SCSS for editor styles
- Committed `build/` artifacts (plugin installable straight from GitHub) — JS changes require `npm run build` and committing the regenerated `build/`

## Tooling & Dev Environment

- **npm** scripts: `build`, `start` (watch), `playground`, `playground:local`
- **WordPress Playground** (`@wp-playground/cli`) + `blueprint.json` for disposable test sites; local mount via `scripts/playground-local.mjs`
- **Kadence Blocks** as a first-class companion plugin (auto-installed in Playground)

## Testing (to be added)

No automated test suite exists yet; adding one is part of the project.

- **JS:** Jest via `@wordpress/scripts` (`test:unit`) — pure logic in `source/lib/` (equality, preset, class-pairs) is the natural first target.
- **PHP:** PHPUnit with `wp-env` / `wp-phpunit` for `includes/` (propagation, attribute sync, REST).
- **E2E:** Playground-driven smoke tests building on the TECHNICAL.md §12 recipes.

Until the suite exists, verification is manual via Playground recipes (TECHNICAL.md §12).
