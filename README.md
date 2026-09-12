# Zengin

An open-source conformance layer for design systems in the age of coding agents.

A design system is a set of rules nobody can enforce at the moment the code is written. Zengin exposes those rules as a deterministic engine: code goes in, structured violations with suggested corrections come out. The same engine serves an agent mid-generation, a developer at the keyboard, and CI on every pull request.

Everyone else serves context. Zengin serves constraints.

## Packages

| Package | Status | Purpose |
| --- | --- | --- |
| [`@zengin/engine`](packages/engine) | Phase 1, seven rule kinds | The rule engine. Parses TSX and CSS, resolves class names through the project's own stylesheets (or an optional Tailwind adapter), checks declarations against a system's tokens and component manifest. |
| [`@zengin/mcp`](packages/mcp) | Phase 1, four tools | stdio MCP server: `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system`, `zengin_explain_rules`. |
| `@zengin/hook` | not started | Claude Code PostToolUse hook. |
| `@zengin/cli` | not started | CLI and CI action. |
| `@zengin/ui` | not started | The reference component system the engine is proven against. Plain CSS and custom properties, no styling framework. |

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Node 22 and pnpm 10.

## Design documents

The product vision and the decision record that shaped the engine live in the Timurtek ORG vault under `Ventures/ZenginUI/Product`. The engine's fixtures are the three violation examples from that record, and its first milestone is returning exactly the violations written there on every run.
