# Block Variation Manager

Save any block's attributes as a named variation. Edits to the variation propagate to every instance, while preserving manual per-instance overrides. Built around WordPress core blocks and [Kadence Blocks](https://wordpress.org/plugins/kadence-blocks/).

## Try it in WordPress Playground

One-click demo (runs entirely in the browser, nothing to install):

> https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/christopherhopkins/Block-Variation-Manager/main/blueprint.json

The Playground site auto-installs Kadence Blocks alongside this plugin, logs you in as admin, and seeds a "Block Variation Manager — Demo" post under **Posts** with a mix of core and Kadence blocks (advanced heading, row layout with two columns, accordion, and an image with a Blob 2 mask) so you can immediately try saving a block as a variation.

## How it works

- **Tools → Block Variations** lists every saved variation, with the source block type and the number of pages each is used on.
- In the post editor, the block sidebar gains a **Variation** panel where you can save the selected block's current attributes as a named variation, apply an existing variation to the selected block, or detach an instance.
- When you edit a variation, every published post that references it is rebaked (for `core/*` blocks whose markup is serialized into `post_content`) so the front-end stays in sync. Manual per-attribute overrides on individual instances are preserved.
- **Guided tours** walk you through each surface the first time you see it — the Tools screen, the editor's Variation panel, and the variation editor. Revisit them anytime via the **Start tour** button (Tools screen) or the **Take the tour** links in the panels; seen/dismissed state is stored per user, so it follows you across browsers.

## Development

Full architecture, data-model, and maintenance documentation — including the
invariants to check before changing anything that writes to the database —
lives in [TECHNICAL.md](TECHNICAL.md).

```bash
npm install
npm run start              # dev build with watch
npm run build              # production build
npm run playground         # boot the blueprint locally (installs the plugin from GitHub)
npm run playground:local   # boot the blueprint locally, mounted against this working tree
npm run test:unit          # Jest unit tests (source/)
npm run test:php           # PHPUnit in wp-env (requires Docker; npm run env:start first)
npm run test:php:ms        # the same suite as multisite
npm run test:e2e           # Playwright E2E + visual regression against Playground
```

CI (GitHub Actions) runs all suites on every push/PR to `main`, including a
PHP 8.1/8.3 × WordPress 6.5/latest matrix and committed visual-regression
baselines — see `.github/workflows/tests.yml` and TECHNICAL.md §11.1.

`playground` mirrors what the public Playground link does: it pulls the plugin from GitHub. Use `playground:local` while developing — it mounts the current directory at `/wp-content/plugins/block-variation-manager` so your unbuilt changes show up immediately (run `npm run start` in another terminal to keep `build/` fresh).

The compiled assets in `build/` are committed so the plugin is installable directly from a GitHub checkout (which is how the Playground blueprint pulls it).
