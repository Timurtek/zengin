# Zengin

An open-source conformance layer for design systems in the age of coding agents.

A design system is a set of rules nobody can enforce at the moment the code is written. Zengin exposes those rules as a deterministic engine: code goes in, structured violations with suggested corrections come out. The same engine serves an agent mid-generation, a developer at the keyboard, and CI on every pull request.

Everyone else serves context. Zengin serves constraints.

## Packages

| Package | Status | Purpose |
| --- | --- | --- |
| [`@zengin/engine`](packages/engine) | Phase 1, seven rule kinds | The rule engine. Parses TSX and CSS, resolves class names through the project's own stylesheets (or an optional Tailwind adapter), checks declarations against a system's tokens and component manifest. |
| [`@zengin/mcp`](packages/mcp) | Phase 1, four tools | stdio MCP server: `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system`, `zengin_explain_rules`. |
| [`@zengin/hook`](packages/hook) | Phase 1 | Claude Code PostToolUse hook. Checks every file write; blocks with the violations as the reason. |
| [`@zengin/cli`](packages/cli) | Phase 1 | `zengin check` for pre-commit and CI, with `--changed`, `--staged`, and GitHub annotations. `explain`, `init`. |
| `@zengin/ui` | not started | The reference component system the engine is proven against. Plain CSS and custom properties, no styling framework. |

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Node 22 and pnpm 10.

## Releasing

Releases are automated with [Changesets](https://github.com/changesets/changesets). A change a consumer should know about ships with a changeset file in `.changeset/` naming the packages and bumps. On push to `main`, the release workflow opens a "Version packages" pull request that applies the pending bumps and changelogs; merging it publishes the affected packages to npm with provenance. Internal dependents are bumped automatically, so a change to the engine releases new patch versions of the surfaces that depend on it.

```bash
pnpm changeset          # describe a change (or write the file by hand; see .changeset/README.md)
pnpm version-packages   # what the release PR does, locally, if you ever need to
pnpm release            # what merging the release PR does
```

Publishing needs an `NPM_TOKEN` repository secret with publish rights on the `@zengin` scope.

## Design documents

The product vision and the decision record that shaped the engine live in the Timurtek ORG vault under `Ventures/ZenginUI/Product`. The engine's fixtures are the three violation examples from that record, and its first milestone is returning exactly the violations written there on every run.
