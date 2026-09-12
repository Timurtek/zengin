---
"@zengin/rollup": minor
"@zengin/cli": minor
"@zengin/engine": minor
---

Cross-repository drift and adoption reporting. `zengin report` writes one repository's snapshot (violations plus an inventory of component usage, suppressions, owned forks, uncontracted components and the pinned version); `zengin rollup` aggregates snapshots into a ranked view with deltas against a previous rollup and a prioritised attention list, rendered as markdown, JSON or a self-contained HTML page. The engine exposes `inventory(files)`.
