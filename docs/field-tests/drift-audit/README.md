# Drift Audit runs on the public field-test codebases

Recorded runs of `zengin audit` against the public repositories the field tests used, so the runner is proven on code nobody wrote for it and no client data is involved. Each folder holds exactly what the command wrote: `findings.json`, `run.json`, `report.md` and `report.pdf`. The reports are drafts by design; the classes in them are proposed by rule and have not been confirmed by hand.

| Codebase | Commit | Definitions (prework) | Findings | Groups | Hand review | Summarised | Run time | Recorded |
|---|---|---|---|---|---|---|---|---|
| [umami](umami/report.md) | `ca661c7` | `zengin init --from package @umami/react-zen` | 155 | 92 | 150 | 5 | 4.3 s | 2026-10-15 |
| [shadcn-ui/taxonomy](taxonomy/report.md) | `298a885` | `zengin init --from shadcn` | 35 | 31 | 35 | 0 | 0.4 s | 2026-10-15 |
| [vercel/ai-chatbot](ai-chatbot/report.md) | `c2f8235` | `zengin init --from shadcn` | 109 | 82 | 109 | 0 | 0.5 s | 2026-10-15 |

The three runs were made one after another on the same machine, each with `--out` set to its folder here, outside the cloned repository. Run time is the check and classification only (`durationMs` in each `run.json`), and varies with the machine's load: the first umami run on 2026-10-14 took 1.6 s and wrote the same findings.

These counts are this runner's output on the current engine. They are a current-engine re-run in the field tests' terms, not first-run or validated findings, and are not comparable with the figures in the field-test write-ups.

## Reproduce

```bash
git clone https://github.com/umami-software/umami && cd umami && git checkout ca661c7
pnpm install
zengin init --from package @umami/react-zen          # prework: definitions derived, none written by hand
zengin audit . --out ../umami-audit/deliverables
```

The same steps apply to [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) at `298a885` and [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot) at `c2f8235`, with `git clone --depth 1`, `pnpm install --ignore-scripts` and `zengin init --from shadcn` as the prework.
