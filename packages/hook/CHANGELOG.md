# @zenginui/hook

## 0.1.0

### Minor Changes

- [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc) Thanks [@Timurtek](https://github.com/Timurtek)! - First public release of the Zengin conformance layer.
  
  - `@zenginui/engine`: the deterministic rule engine. Seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution) checked against a design system's DTCG tokens and component manifest. Class names resolve through the project's own stylesheets, with Tailwind v4 as an optional adapter.
  - `@zenginui/mcp`: stdio MCP server with `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system` and `zengin_explain_rules`.
  - `@zenginui/hook`: Claude Code PostToolUse hook that checks every file write and reports violations back to the agent.
  - `@zenginui/cli`: `zengin check`, `zengin explain`, `zengin init`, with `--changed`, `--staged` and GitHub annotation output for CI.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
