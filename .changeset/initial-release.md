---
"@zengin/engine": minor
"@zengin/mcp": minor
"@zengin/hook": minor
"@zengin/cli": minor
---

First public release of the Zengin conformance layer.

- `@zengin/engine`: the deterministic rule engine. Seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution) checked against a design system's DTCG tokens and component manifest. Class names resolve through the project's own stylesheets, with Tailwind v4 as an optional adapter.
- `@zengin/mcp`: stdio MCP server with `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system` and `zengin_explain_rules`.
- `@zengin/hook`: Claude Code PostToolUse hook that checks every file write and reports violations back to the agent.
- `@zengin/cli`: `zengin check`, `zengin explain`, `zengin init`, with `--changed`, `--staged` and GitHub annotation output for CI.
