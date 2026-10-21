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

## Testing

Added by track `test-suite_20261021` (2026-10-21):

- **JS:** Jest via `@wordpress/scripts` (`npm run test:unit`), tests in `tests/js/`, webpack-external `@wordpress/*` packages stubbed in `tests/js/__mocks__/`; ≥80% coverage gates in `jest.config.cjs`.
- **PHP:** PHPUnit inside `@wordpress/env` (`npm run test:php`, multisite via `test:php:ms`), tests in `tests/php/`, WP test library supplied by wp-env; ≥80% line coverage on `includes/` gated in CI.
- **E2E + visual:** Playwright (`npm run test:e2e`) against a `@wp-playground/cli` server mounting the working tree (`scripts/playground-e2e.mjs`); platform-suffixed screenshot baselines in `tests/e2e/visual.spec.js-snapshots/`. *Deviation (2026-10-21):* plain `@playwright/test` instead of `@wordpress/e2e-test-utils-playwright` — the WP utils need application-password auth that Playground doesn't provide.
- **CI:** `.github/workflows/tests.yml` — php-lint (PHP 7.4), build+Jest, PHPUnit matrix **PHP 8.1/8.3 × WP 6.5/latest**, E2E+visual in the pinned `mcr.microsoft.com/playwright` container. *Deviation (2026-10-21):* the planned PHP 7.4 matrix leg is unbuildable — wp-env's PHP 7.4 image bases on Debian bullseye, whose apt archives are gone — so runtime 7.4 compatibility rests on the `php -l` job and the composer `platform: 7.4` pin.
