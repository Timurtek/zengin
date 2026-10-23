---
"@zenginui/adapter-css": minor
"@zenginui/cli": minor
---

The last of the preflight fixes:

- **Scope from the project.** `init --from package` derives `scope.include` from what the project already tells its tools: `tsconfig.json`'s `include` (comments, trailing commas and `"./*"` path globs are fine), Tailwind 3's `content` and Tailwind 4's `@source`, inside the project. Anything that covers the whole project scopes the whole project, minus build output, tests and stories; otherwise the folders they name plus the usual ones. Dub's `ui/` and Sim's `ee/` and `hooks/` no longer need adding by hand. The report says where the scope came from.
- **Help per command, and a version.** `zengin init --help` (or `zengin help init`) prints init's usage and options instead of the whole help; `zengin --version` prints the version.
- **Docs.** "An existing project" says to run `npx -p @zenginui/cli zengin` before the CLI is a dependency (the npm name `zengin` is not this tool), and what `init --from package` now reads. "Suppressions" covers the expected answer to a fair `component-substitution` on documented presentational reuse. The config reference covers `classes.config` and which Tailwind the engine loads.
