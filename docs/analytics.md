# Analytics

What Zengin measures, where, and how to read it. The site at zengin.timurtek.com (`examples/marketing-site`, the home page and `/why/`) sends events to the org's PostHog Cloud project (US, project 652049). Nothing else in this repository sends anything: the CLI, the MCP server, the hook and every project `zengin create` writes are untouched.

## The one number

**`install_command_copied` per week**, the count of times someone copies a `npm create zengin@latest` command from the site.

Zengin is used in a terminal, so the site cannot see someone use it. Copying the create command is the last thing a visitor does on the site before they try it, and it is the action the whole page leads to.

**Target: 25 a week, measured over the four weeks after the key goes live.** This is a starting figure, not one taken from data: the site has never been measured, so there is no baseline. It should be reset once two weeks of real numbers exist. The target is the engineer's proposal, and Tek confirms or replaces it at the release gate.

Check it against npm downloads of `create-zengin` for the same weeks (outside PostHog: `https://api.npmjs.org/downloads/point/last-week/create-zengin`). Copies with no matching rise in downloads mean people copy and do not run.

### Reading it in PostHog

1. Product analytics → New insight → **Trends**.
2. Event `install_command_copied`, measured as **Total count**, interval **Week**.
3. Filter: `app` equals `ZenginUI`. Every Zengin event carries it; other products share the project.
4. Break down by `template` to see which template people start from, or by `section` to see which part of the page got the copy.

Conversion: a **Funnel** of `$pageview` → `install_command_copied`, both filtered on `app = ZenginUI`, broken down by `$pathname` to compare the home page with `/why/`. The site keeps no identity between page loads (see Privacy), so the funnel holds within a single page load. That is the question it needs to answer: did this page get someone to copy the command?

## Events

| Event | Sent when | Properties (beyond PostHog's own) | What it proves |
|---|---|---|---|
| `$pageview` | each page loads (home, `/why/`) | `app` | People reach the site, and which page they land on (`$pathname`, `$referring_domain`). It is the denominator for every rate below. |
| `install_command_copied` | the Copy button on a code block holding `npm create zengin@latest` is pressed | `app`, `template` (`default` when none is named), `theme` (when the command names one), `section` (the id of the page section, e.g. `get-started`, `templates`, `start`) | **The main action.** A visitor took the command to their terminal. It is the venture's one number. |
| `code_copied` | the Copy button on any other code block is pressed (CLI, MCP, hook, config snippets) | `app`, `section` | People are reading closely enough to take a snippet. It shows which surfaces (MCP, hook, CLI, rollup) draw interest. |

There is **no signup**. Zengin has no accounts, so there is nothing to sign up for.

No event carries the copied text. `template` and `theme` are names from the public registry.

## Privacy

- **No personal data.** No autocapture, no session recording, no heatmaps, no `identify`, no person profiles (`person_profiles: "never"`), and no properties beyond the ones listed above.
- **No cookies and no storage.** `persistence: "memory"`, so nothing survives a page load. The site has no consent screen to ask with, so it stores nothing that would need one.
- **Do Not Track and Global Privacy Control are honoured** before PostHog is loaded. A visitor who sends either one never downloads the library.
- **Nothing extra is fetched from PostHog.** No feature flags, no remote config, no surveys, no scripts from its CDN.
- **IP addresses:** PostHog records the request's IP on its own server. Turning on *Discard client IP data* in project 652049's settings stops that. This is a project setting, not code, and it is Tek's to change.

## Setup

- The key comes from an env variable, **`VITE_POSTHOG_KEY`** (the project API key, `phc_…`), set in the Vercel project for the site. Vite includes only `VITE_` variables in the client build, and a project key is public by design. It is never committed.
- `VITE_POSTHOG_HOST` is optional and defaults to `https://us.i.posthog.com`.
- **No key means no analytics**: in dev, in CI and in any preview build without the variable, PostHog is never loaded.
- The code is `examples/marketing-site/src/measure.ts`, started once by each page's entry point (`src/main.tsx`, `src/why.tsx`). It is not called `analytics.ts`, because the bundler names the chunk both pages share after it, and blockers drop scripts called `analytics-*.js`.
- `src/` is also the `marketing` template. `packages/registry/src/build.ts` keeps `measure.ts` and its call out of the template (`SITE_ONLY`), and `packages/registry/test/registry.test.ts` holds it there.

## How it is checked

- `pnpm --filter marketing-site test` runs `zengin check`, the unit tests (`test/measure.test.ts`), and `scripts/check-measure.mjs`. The script builds the site with a test key, opens both pages in headless Chrome with PostHog's endpoint intercepted, copies the create command, and asserts:
  - each pageview and copy is sent, with `app: "ZenginUI"`;
  - no personal properties are sent;
  - a Do Not Track visitor sends nothing;
  - a build without the key sends nothing.
- Run it with `--verbose` to see every request and the full list of property names PostHog receives.

## Not measured yet

- `/docs/`, `/storybook/`, `/rollup/` and the template previews are separate builds and send nothing.
- The CLI sends nothing. Telemetry in a tool people run on their own code is a product decision, not a wiring task.
