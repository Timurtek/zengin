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
| [`@zengin/adapter-css`](packages/adapter-css) | Phase 2 | `zengin init --from package <name>`: derives them from any installed design-system package, tokens from its CSS variables with the names kept, manifest from its `.d.ts`. Verified on umami. |
| [`@zengin/rollup`](packages/rollup) | Phase 2 | `zengin report` in each consuming repo, `zengin rollup` across them: drift, adoption, suppressions, owned forks, pinned versions, deltas. Markdown, JSON, or a self-contained HTML page. |
| [`@zengin/registry`](packages/registry) | Phase 3 | The registry and the generator: `zengin create` scaffolds a project that owns its components shadcn-style, `zengin add` brings in more, `zengin tokens` compiles the token JSON. Items are built from `packages/ui` and `examples/`; the marketing site serves the public registry. |
| [`@zengin/mock`](packages/mock) | Phase 3 | `zengin mock`: typed, seeded mock data generated as plain TypeScript into the project. Presets for the entities apps show, a small schema for the rest, no runtime dependency. |
| [`@zengin/figma`](packages/figma) | Phase 3 | Figma both ways: tokens to Figma variables (Light and Dark modes, code syntax set to the CSS variable) and back with a report, Code Connect files from the component manifest, and a plugin that imports and exports variables in any file. |
| [`@zengin/ui`](packages/ui) | Phase 1, thirty-three components | The reference design system: plain CSS, custom-property tokens, light and dark themes, Radix behavior, Storybook with manifest-driven stories. Ships the `zengin/` definitions the engine enforces against, and checks itself with the engine. |

## Start a project

```bash
npx zengin create acme --template saas        # or: chat, blank, marketing, review
npm run mock                                  # regenerate the SaaS template's rows from mock.json
cd acme && npm install && npm run dev
npm run add -- dialog tooltip
npx zengin theme plex                          # or: default, meadow, spec-sheet, brutal
npx zengin brand --name Acme --logo logo.svg  # your own palette, favicon and wordmark from one color
```

The project owns its components (`src/components/ui`, each file carrying the version it was copied from), its definitions (`zengin/`), a brand file, Storybook, and the MCP server and hook. The generator runs the engine on the result before it returns: a fresh project reports zero violations. Until the first npm release, run the CLI from a checkout with `--local <path>`.

## The two reference experiences

The vision asks for one marketing page and one application workflow from the same foundations with distinct visual treatments. Both are workspace examples built on `@zengin/ui`, and both are checked by the engine in CI.

[`examples/review-workspace`](examples/review-workspace) is a review queue with the MCP server, hook and CLI wired in, in the default theme. Its [DEMO.md](examples/review-workspace/DEMO.md) replays the enforcement loop: an off-system component the way an agent writes it, the engine's 19 violations, the corrected component, zero violations, and both renders. The replay runs in CI with assertions.

[`examples/chat`](examples/chat) is the AI chat template: a conversation with streamed markdown, reasoning, tool calls and sources, a prompt with suggestions and a model picker, on the Vercel AI SDK with a scripted transport so it runs without a key. It is what brought the AI kit into Zengin UI. [`examples/saas`](examples/saas) is the SaaS dashboard template: an overview with stat cards and charts, a customers table with row actions and a detail sheet, billing with quotas, settings that save with a toast; sidebar, top bar, both schemes. It is what brought the charts, the motion presets and the breakpoint tokens into Zengin UI. [`examples/blank`](examples/blank) is the blank template, one card and one button. [`examples/marketing-site`](examples/marketing-site) is Zengin's own marketing page, and it shows the templates as live previews with a theme picker, built from these example apps and served beside the page. Its brand is one file of token overrides (an expanded grotesk for headlines, square corners, black rules, cobalt as the single accent, both color schemes); the components have no idea. The hero panel renders real engine output for a sample file, the four surfaces sit in a `Tabs` component, and the page's own check passes with zero violations and zero suppressions. Building the page is what added `Tabs`, the display typeface token, display text sizes and the larger spacing steps to Zengin UI.

## Field tests

`docs/field-tests/` records runs against real external codebases, every violation classified by hand, and the engine changes each run produced. First: [shadcn/taxonomy](docs/field-tests/2026-09-12-shadcn-taxonomy.md), 41 violations of which 10 were false positives, then 35 with none after the fixes; the shadcn adapter reproduces that run from one command. Second: [vercel/ai-chatbot](docs/field-tests/2026-09-12-vercel-ai-chatbot.md) on Tailwind 4, 128 then 109 with none, no hand-authored definitions, and a migration bug found that nobody had noticed. Third: [umami](docs/field-tests/2026-09-12-umami.md), the first non-shadcn system (`@umami/react-zen`, read from the package by `zengin init --from package`), 255 then 147 with none, an invalid DOM attribute and a `var()` whose fallback is what renders, both real.

## Rollup, hosted

Every example app is a consumer of Zengin UI and reports on every push to main (`.github/workflows/rollup.yml`, `scripts/report-examples.mjs`); the snapshots live in [`reports/`](reports) and the marketing site rolls them up at build time into [zengin-marketing-site.vercel.app/rollup/](https://zengin-marketing-site.vercel.app/rollup/): drift, adoption and suppressions over time, a sparkline per repository. The same two commands, `zengin report --into` and `zengin rollup <dir>`, do it for any set of repositories.

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
