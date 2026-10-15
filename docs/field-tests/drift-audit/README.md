# Drift Audit runs on the public field-test codebases

Recorded runs of `zengin audit` against the public repositories the field tests used, so the runner is proven on code nobody wrote for it and no client data is involved. Each folder holds exactly what the command wrote: `findings.json`, `run.json`, `report.md` and `report.pdf`. The reports are drafts by design; the classes in them are proposed by rule and have not been confirmed by hand.

| Codebase | Commit | Definitions (prework) | Findings | Groups | Hand review | Summarised | Run time | Recorded |
|---|---|---|---|---|---|---|---|---|
| [umami](umami/report.md) | `ca661c7` | `zengin init --from package @umami/react-zen` | 155 | 92 | 150 | 5 | 1.6 s | 2026-10-14 |
| shadcn/taxonomy | | `zengin init --from shadcn` | not run | | | | | no local clone |
| vercel/ai-chatbot | | `zengin init --from shadcn` | not run | | | | | no local clone |

These counts are this runner's output on the current engine. They are a current-engine re-run in the field tests' terms, not first-run or validated findings, and are not comparable with the figures in the field-test write-ups.

## Reproduce

```bash
git clone https://github.com/umami-software/umami && cd umami && git checkout ca661c7
pnpm install
zengin init --from package @umami/react-zen          # prework: definitions derived, none written by hand
zengin audit . --out ../umami-audit/deliverables
```

The same steps with `zengin init --from shadcn` apply to [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) and [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot).
