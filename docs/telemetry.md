# Telemetry: anonymous usage counts from the CLI, the hook and the MCP server

**Off unless you say yes.** The first time you run `zengin` at a terminal it asks once, and pressing Enter is no. Either answer is saved, so it never asks again. Nothing is ever sent in CI, when `DO_NOT_TRACK` is set, or before you answer.

What is sent is a count: "a project was created", "the hook blocked an edit, with 3 violations". **Never a file path, code, a file or project name, a package name, a rule, or an email.** Not even the name of the template or component you used.

## Why

Zengin is used in a terminal, so its maker cannot see whether anyone uses it beyond the website. These counts answer the questions the website cannot: does a copied install command become a project, and does the hook ever stop an agent for anyone? Every count is tied to a user story in the venture's notes, and is read in aggregate.

## Changing your answer

```sh
zengin telemetry          # show the choice, where it is stored, and whether this environment sends at all
zengin telemetry on       # yes
zengin telemetry off      # no: the anonymous id is deleted, so a later yes starts a new one
```

`npx @zenginui/cli telemetry off` works too, without a project.

The choice is stored outside any project, for your user account:

| Platform | File |
|---|---|
| Windows | `%APPDATA%\zengin\telemetry.json` |
| macOS, Linux | `$XDG_CONFIG_HOME/zengin/telemetry.json`, else `~/.config/zengin/telemetry.json` |

It holds `enabled`, the date you chose, and, only after a yes, the anonymous id.

## When nothing is sent, whatever you chose

- **`DO_NOT_TRACK`** is set to anything but `0` or `false` ([the convention](https://consoledonottrack.com/)).
- **CI**: `CI` is set, or any of `CONTINUOUS_INTEGRATION`, `BUILD_NUMBER`, `RUN_ID`, `GITHUB_ACTIONS`, `GITLAB_CI`, `CIRCLECI`, `TRAVIS`, `BUILDKITE`, `JENKINS_URL`, `TF_BUILD`, `CODEBUILD_BUILD_ID`, `TEAMCITY_VERSION`, `BITBUCKET_BUILD_NUMBER`.
- **No answer yet.** The question is only asked when the CLI runs at a terminal (stdin, stdout and stderr all interactive). The hook and the MCP server are started by your agent and never ask: they send only if you already said yes with the CLI.
- **`ZENGIN_TELEMETRY_DEBUG=1`** prints the event that would be sent to stderr, and sends nothing. Use it to see exactly what leaves your machine.

## Every event

Every event carries the same four things and its own counts, nothing more:

- `app`: always `"ZenginUI"` (one PostHog project serves several products).
- `tool`: `cli`, `hook` or `mcp`.
- `version`: the version of that package, e.g. `0.10.0`.
- the anonymous id: a random UUID made on your machine when you said yes. It is not derived from anything about you or your machine.

Two PostHog switches ride along, and are not data: `$process_person_profile: false` (no person profile is built from the id) and `$geoip_disable: true` (no location is looked up from your IP address).

| Event | tool | Sent when | Counts | The story it measures |
|---|---|---|---|---|
| `project_created` | cli | `zengin create` (and `npm create zengin`) finished | none | US-02: one command gives a project that checks clean |
| `component_added` | cli | `zengin add` finished | `items_count`: how many items were asked for | US-05: adding a component keeps the build passing |
| `brand_generated` | cli | `zengin brand` finished | none | US-04: a whole brand in one step |
| `init_completed` | cli | `zengin init`, with or without `--from`, finished | none | US-08: Zengin over a design system you already have |
| `doctor_run` | cli | `zengin doctor` finished | `findings_count`: problems found (not the ones that passed); `fixed_count`: files `--fix` repaired | US-07: keep an old project's plumbing current |
| `check_run` | cli | `zengin check` finished, outside CI | `files_count`: files checked; `violations_count`: violations found | US-09: the check is run before code reaches review |
| `rollup_generated` | cli | `zengin rollup` finished | `repo_count`: repositories in the rollup | US-10: every repository's drift in one place |
| `hook_violation_blocked` | hook | the hook blocked an agent's edit (exit 2) | `violations_count`: violations in the blocked edit | US-03: an agent is stopped when it goes off-system |
| `mcp_server_started` | mcp | the MCP server started (stdio or HTTP) | none | US-03: the agent has the design system in its context |

A command that fails before it finishes sends nothing. `zengin explain`, `report`, `tokens`, `theme`, `fonts`, `icons`, `upgrade`, `mock`, `figma`, `registry`, `define` and `telemetry` send nothing.

**Not sent, though the stories proposed them:** the template, framework, theme, component, rule or `--from` source names. Each is a name, and this page promises counts only. `ci_check_run` (US-09 in CI) cannot exist, because nothing is sent in CI.

## How it is enforced

- `packages/engine/src/telemetry.ts` holds the list of events above (`EVENTS`). `buildEvent` refuses any event not on it, any property the event does not declare, and any value that is not a whole number from 0. A path, code, a name or an email has nowhere to go.
- A version that is not a version (`1.2.3`) is sent as `unknown`.
- A request waits at most one second and any failure is ignored: offline, behind a firewall or with PostHog down, the tool behaves exactly as with telemetry off.
- Tests (`pnpm test`): `packages/engine/test/telemetry.test.ts` for the rules; `packages/cli/test/telemetry.test.ts`, `packages/hook/test/telemetry.test.ts` and `packages/mcp/test/telemetry.test.ts` run each built tool against a stand-in for PostHog and assert nothing is sent before consent, in CI or under `DO_NOT_TRACK`, and that what is sent after a yes carries only the properties above and none of the paths, rules or code in the tool's own output. The docs test fails if this table is missing an event or a count.

## Where it goes and how it is read

- PostHog Cloud (US), project 652049, the same project as the site ([analytics.md](analytics.md)). Filter on `app = ZenginUI` and on `tool`.
- The chain the venture reads, as weekly counts: `install_command_copied` (site) → `project_created` → `hook_violation_blocked`. The site keeps no id, so the first step is compared by week, not by person. From `project_created` on, the anonymous id joins the steps: an id that sends `project_created` and never `hook_violation_blocked` is a loop that never engaged.
- Read in PostHog: Product analytics → New insight → Trends, event `project_created` (or any above), Total count, interval Week, filter `app = ZenginUI`; or a Funnel of `project_created` → `hook_violation_blocked` with the same filter.
- PostHog records the request's IP on its own server unless *Discard client IP data* is on in the project's settings. That is a project setting, not code.

## Setup (maintainers)

The project key (`phc_…`) is public by design, since it can only send events, but the repository never holds it. The release workflow passes the repository secret **`ZENGIN_POSTHOG_KEY`** to `pnpm build`, and `packages/engine/scripts/telemetry-key.mjs` writes it into `dist/telemetry.js`. Without the secret the published packages send nothing, whatever anyone chose. `ZENGIN_TELEMETRY_KEY` and `ZENGIN_TELEMETRY_HOST` override the key and the host at run time, for a self-hosted PostHog or the tests.
