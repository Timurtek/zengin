# @zengin/rollup

Drift and adoption across every repository that consumes a design system. The same engine that corrects an agent mid-generation, added up for the team that owns the system.

Two commands, both in the CLI:

```bash
zengin report --out zengin-report.json            # in each consuming repository, in CI
zengin rollup reports/*.json --format html --out rollup.html   # wherever the snapshots are collected
```

## report

One repository, one point in time. Everything `zengin check` finds, plus what the check does not say:

| Field | What it is |
| --- | --- |
| `summary` | Violations by severity, rule and file. |
| `inventory.components` | Which system components the repository uses and how often. Adoption. |
| `inventory.suppressions` | `zengin-allow` comments, with and without a reason. A suppression is drift with a note attached, and one without a reason suppresses nothing. |
| `inventory.ownedFiles`, `owned` | Components the repository has forked, with the version they forked from when the pragma says. |
| `inventory.uncontracted` | System components in use whose manifest declares nothing, so the engine cannot check their props. |
| `system.version` | The version this repository pins, so the rollup can say who is behind. |
| `repo` | Name, ref and commit from git; `--repo` overrides the name. |

Violation ranges are left out by default because the rollup needs counts. `--include-violations` keeps them.

## rollup

Reads any number of snapshots and produces one view: a row per repository ranked by drift, violations per 100 files so repositories of different sizes compare, suppressions, owned files, adoption, the pinned version against the newest in use, and totals by rule and by component. Pass `--previous` with the last rollup's JSON and each row carries its deltas.

The **needs attention** list is deterministic and in priority order: rising drift since the last rollup, suppressions without a reason, new suppressions, repositories behind the latest version, uncontracted components in use, and the repository carrying the most drift.

Formats: `markdown` for a pull request comment, an issue or a chat message; `json` for tooling and for the next `--previous`; `html` for a self-contained page with no scripts and no external resources, in both color schemes.

## Collecting snapshots

The simplest honest pipeline is a scheduled workflow in the design system's repository that clones each consumer, reports, and rolls up:

```yaml
name: rollup
on:
  schedule: [{ cron: "0 6 * * 1" }]   # Monday mornings
  workflow_dispatch:
jobs:
  rollup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile && pnpm build
      - name: report each consumer
        env: { GH_TOKEN: "${{ secrets.CONSUMER_READ_TOKEN }}" }
        run: |
          mkdir -p reports
          for repo in acme/checkout acme/admin acme/marketing; do
            gh repo clone "$repo" "work/$repo" -- --depth 1
            (cd "work/$repo" && pnpm install --frozen-lockfile && node "$GITHUB_WORKSPACE/packages/cli/dist/index.js" report --out "$GITHUB_WORKSPACE/reports/$(echo $repo | tr / -).json")
          done
      - name: roll up
        run: |
          node packages/cli/dist/index.js rollup reports/*.json --previous rollup/latest.json --format json --out rollup/next.json || true
          node packages/cli/dist/index.js rollup reports/*.json --previous rollup/latest.json --format html --out rollup/latest.html
          mv rollup/next.json rollup/latest.json
      - uses: actions/upload-artifact@v4
        with: { name: zengin-rollup, path: rollup/ }
```

Publish `rollup/latest.html` wherever the team reads dashboards, and post the markdown to the channel where the design system lives. Consumers that keep their snapshot as a CI artifact instead can be collected with `gh run download` in place of the clone.

## Programmatic use

```ts
import { buildSnapshot, aggregate, renderMarkdown, renderHtml } from "@zengin/rollup";

const snapshot = buildSnapshot({ engine, files, repo: { name: "acme/checkout" } });
const rollup = aggregate([snapshot, ...others], { previous });
console.log(renderMarkdown(rollup));
```

## Not in this version

- Trend charts over more than two points. Keep the rollup JSONs; the data is there.
- A hosted collector. Files and CI artifacts are enough until they are not.
