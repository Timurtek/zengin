---
"@zengin/rollup": minor
"@zengin/cli": minor
---

Rollup history and hosted trends. `zengin report --into <dir>` files each snapshot as `<dir>/<repo>/<time>.json`; `zengin rollup <dir>` reads a directory as history: the newest run per repository is the current row, the one before it is the delta (no `--previous` needed), and the whole series is the trend. The result carries `history` with every run per repository and as-of totals; the HTML page draws violations, component uses and suppressions over time and a sparkline per repository, the markdown gets a trend column. `--at`, `--commit` and `--ref` on `zengin report` stamp backfilled snapshots. `--out` creates its directory. Zengin's own examples report on every push to main and the marketing site serves the rollup at /rollup/.
