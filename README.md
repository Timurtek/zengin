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
| [`@zengin/adapter-shadcn`](packages/adapter-shadcn) | Phase 2 | `zengin init --from shadcn`: derives tokens, the component manifest and a config from a shadcn/ui project. Reproduces the taxonomy field test exactly. |
| [`@zengin/ui`](packages/ui) | Phase 1, seven components | The reference design system: plain CSS, custom-property tokens, light and dark themes, Radix behavior, Storybook with manifest-driven stories. Ships the `zengin/` definitions the engine enforces against, and checks itself with the engine. |

## The demo

[`examples/review-workspace`](examples/review-workspace) is a review queue built on `@zengin/ui` with the MCP server, hook and CLI wired in. Its [DEMO.md](examples/review-workspace/DEMO.md) replays the enforcement loop: an off-system component the way an agent writes it, the engine's 19 violations, the corrected component, zero violations, and both renders. The replay runs in CI with assertions.

## Field tests

`docs/field-tests/` records runs against real external codebases, every violation classified by hand, and the engine changes each run produced. First: [shadcn/taxonomy](docs/field-tests/2026-09-12-shadcn-taxonomy.md), 41 violations of which 10 were false positives, then 35 with none after the fixes; the shadcn adapter reproduces that run from one command. Second: [vercel/ai-chatbot](docs/field-tests/2026-09-12-vercel-ai-chatbot.md) on Tailwind 4, 128 then 109 with none, no hand-authored definitions, and a migration bug found that nobody had noticed.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm --filter @zengin/ui storybook
```

Node 22 and pnpm 10.

## Agent skill

`skills/zengin/SKILL.md` teaches a coding agent the loop: learn the system, write, check, apply fixes by confidence, re-check, and never suppress without a reason. Copy the directory into a project's `.claude/skills/` (or wherever your agent loads skills from) alongside the MCP server or hook.

```bash
cp -r skills/zengin .claude/skills/zengin
```

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
