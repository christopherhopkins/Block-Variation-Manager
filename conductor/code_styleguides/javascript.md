# JavaScript Style Guide — WordPress conventions

This project follows the **WordPress JavaScript coding standards**, not a
generic style guide (QUA-11: the previously bundled Google guide contradicted
every file in the repo).

Reference: https://developer.wordpress.org/coding-standards/wordpress-coding-standards/javascript/

The conventions actually used here:

- **Tabs** for indentation.
- **Spaces inside parentheses** of control structures and function calls:
  `if ( condition )`, `fn( arg )`.
- **Single quotes** for strings; template literals where interpolation helps.
- **Semicolons** always.
- `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for module
  constants, `PascalCase` for React components.
- **JSDoc blocks** on every exported function and on non-obvious internal
  ones; comments explain constraints and *why*, never restate the code.
- ES modules; `export default` is acceptable for React components (one per
  file); named exports for libraries (`source/lib/`).
- `@wordpress/*` packages are consumed as webpack externals — import them by
  package name and never bundle them.
- React: function components + hooks; follow the rules-of-hooks; prefer
  `useSyncExternalStore` for external stores (see `source/lib/use-variation.js`).

Enforcement: there is currently **no lint gate** — `wp-scripts lint-js`
crashes against this dependency tree (typescript-eslint peer chain) and
adopting it needs its own dependency work; tracked as a follow-up in the
code-review track's report. Until then, match the surrounding file.
