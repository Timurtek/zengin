# @zenginui/rollup

## 0.1.0

### Minor Changes

- [`9af7637`](https://github.com/Timurtek/zengin/commit/9af7637026f94b3d3ef9af81fdd263acf58b5c21) Thanks [@Timurtek](https://github.com/Timurtek)! - Rollup history and hosted trends. `zengin report --into <dir>` files each snapshot as `<dir>/<repo>/<time>.json`; `zengin rollup <dir>` reads a directory as history: the newest run per repository is the current row, the one before it is the delta (no `--previous` needed), and the whole series is the trend. The result carries `history` with every run per repository and as-of totals; the HTML page draws violations, component uses and suppressions over time and a sparkline per repository, the markdown gets a trend column. `--at`, `--commit` and `--ref` on `zengin report` stamp backfilled snapshots. `--out` creates its directory. Zengin's own examples report on every push to main and the marketing site serves the rollup at /rollup/.

- [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a) Thanks [@Timurtek](https://github.com/Timurtek)! - Cross-repository drift and adoption reporting. `zengin report` writes one repository's snapshot (violations plus an inventory of component usage, suppressions, owned forks, uncontracted components and the pinned version); `zengin rollup` aggregates snapshots into a ranked view with deltas against a previous rollup and a prioritised attention list, rendered as markdown, JSON or a self-contained HTML page. The engine exposes `inventory(files)`.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
