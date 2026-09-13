# review-workspace

A review-and-approval queue built on `@zenginui/ui`, with every Zengin surface wired in. It is the application workflow from the product vision and the host of the [replayable enforcement demo](DEMO.md).

```bash
pnpm build                                  # from the repository root, once
pnpm --filter review-workspace dev          # http://localhost:5173
pnpm --filter review-workspace check        # zengin check
pnpm --filter review-workspace demo         # replay the enforcement loop
```

## What is wired in

| File | Surface |
| --- | --- |
| `zengin.config.yaml` | One line of configuration: `system.package`. Definitions and version come from the installed package. |
| `.mcp.json` | The MCP server for agents working in this directory. |
| `.claude/settings.json` | The PostToolUse hook, on every `Write` and `Edit`. |
| `package.json` `test` | The replay with assertions, so CI proves the loop on every push. |

## Layout

- `src/App.tsx`: the queue, filter, resolved toggle, theme toggle, and the reject confirmation dialog.
- `src/ReviewCard.tsx`: one item, built from `Card`, `Badge` and `Button`. This is the corrected component from the demo.
- `src/app.css`: layout only. Every value is a token.
- `demo/`: the off-system version, the corrected version, the replay script, the screenshot script, and the captured output.
