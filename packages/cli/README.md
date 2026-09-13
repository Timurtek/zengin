# @zengin/cli

The `zengin` command. The gate that actually protects the codebase: run it pre-commit and on every pull request. Same engine, same violations, same fixes as the MCP server and the hook.

```
zengin check [paths...]     check files (default: everything in scope)
zengin explain [rule]       what each rule checks
zengin init                 write a zengin.config.yaml in the current directory
zengin create <dir>         a new project that owns its components, with the engine, MCP, hook and Storybook wired
zengin add <items...>       components or templates from the registry into this project
zengin theme [name]         list the registry's themes, or swap this project's brand for one
zengin brand --name <name>  a brand from a name, a logo or a color: tokens, favicon, wordmark, index.html
zengin tokens               zengin/tokens*.json to src/styles/generated/tokens.css
zengin figma export|import|connect|plugin   tokens to Figma variables and back, Code Connect, the plugin
zengin mock <presets...>    typed, seeded mock data modules into src/mock
zengin registry build       the registry, from a Zengin repository checkout
zengin report, rollup       drift and adoption, per repository and across them
```

## check

```bash
zengin check                                  # whole scope, pretty output
zengin check src/features/review              # a directory
zengin check --changed origin/main            # only files changed since a ref, plus uncommitted and untracked
zengin check --staged                         # only staged files (pre-commit)
zengin check --format github                  # GitHub Actions annotations on the PR
zengin check --format json > report.json      # the full violation shape, for the rollup
zengin check --rule color-literal --severity error
zengin check --fail-on never                  # report, never fail
```

| Option | Values | Default |
| --- | --- | --- |
| `--config <path>` | | nearest `zengin.config.yaml` above cwd |
| `--changed [ref]` | git ref | `HEAD` when given without a value |
| `--staged` | | off |
| `--rule <id>` | repeatable | all rules |
| `--severity` | `error`, `warn`, `info` | all |
| `--fail-on` | `error`, `warn`, `info`, `never` | `error` |
| `--format` | `pretty`, `json`, `github` | `pretty` |
| `--max <n>` | | `200` |

Exit codes: `0` clean or below `--fail-on`, `1` violations at or above `--fail-on`, `2` usage or configuration error.

Stylesheets outside the selected files still resolve class names for the files inside it, so `zengin check src/one/file.tsx` sees what `className="btn"` does even though the CSS file was not selected.

## Pre-commit

With [husky](https://typicode.github.io/husky/) or any pre-commit runner:

```bash
zengin check --staged
```

## GitHub Actions

Until the packages are published, build them from source in the workflow. With published packages this collapses to one `npx zengin check` step.

```yaml
name: design-system
on: [pull_request]
jobs:
  zengin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }            # --changed needs the base ref
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm exec zengin check --changed origin/${{ github.base_ref }} --format github
```

`--format github` emits workflow commands, so each violation appears as an inline annotation on the changed line with the fix in the message. The job fails on `error` severity unless `--fail-on` says otherwise.

## create and add

```bash
zengin create acme --template marketing       # blank | marketing | review | saas | chat | auth | docs | storefront
zengin create acme --template saas --framework next   # the App Router under src/app; the template mounted client-side from page.tsx
zengin create acme --no-storybook
zengin create acme --registry ./r --local ../zengin   # a local registry, packages linked from a checkout
cd acme && zengin add dialog tooltip          # more items; --force overwrites files that exist
zengin tokens                                 # after editing zengin/tokens*.json (dev and build run it)
```

`create` writes the project, copies the template's components in with the owned pragma, merges their manifest entries into `zengin/components.json`, builds `tokens.css`, and runs the engine on the result before it prints. `add` does the same for further items and records any npm packages they need in `package.json`. See [@zengin/registry](../registry) for the layout and the registry format.

## upgrade

```bash
zengin upgrade                 # a report: what the registry changed since each owned file was copied, and what you changed
zengin upgrade --write         # take every upstream change the project did not touch; move the pinned version
zengin upgrade button card     # only these items
zengin upgrade --write --force # take upstream over a conflict too
```

Every owned file carries the hash of what was copied in its pragma (`/* zengin-owned Button, forked from @zengin/ui@0.1.0, sha 3f9a1c0b2d4e */`). Comparing that hash with the file now says whether you edited it; comparing it with the registry says whether the system moved. Four answers per file: `current`, `upstream` (taken with `--write`), `local` (yours, left alone), `conflict` (both moved: the report shows the diff, `--force` takes upstream). Files copied before hashes existed show as `unknown` when they differ. When nothing is left behind, `zengin.config.yaml` is moved to the registry's version.

## theme and brand

```bash
zengin theme                                  # list: brutal, default, meadow, plex, spec-sheet, zengin
zengin theme plex                             # swap the brand file and the fonts link; nothing else changes
zengin fonts                                  # list: archivo, brutal, dm, fraunces, geist, inter, manrope, playfair, plex, space
zengin fonts fraunces                         # the three font tokens and the fonts link; palette untouched
zengin fonts geist --self-host                # woff2 files into public/fonts, @font-face in src/theme/fonts.css
zengin brand --name Acme --fonts plex         # a pairing instead of --font-display/--font-sans/--font-mono
zengin icons                                  # list: lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap
zengin icons tabler                           # every <Icon.Name /> draws from Tabler; direct icon-package imports become violations
zengin create acme --theme spec-sheet         # or at creation

zengin brand --name "Acme Reviews" --logo logo.svg --font-display Archivo --font-sans Inter --radius round
zengin brand --name Nova --primary "#7C3AED"  # from a color alone
```

`theme` replaces `src/theme/brand.css` with the theme's file and puts its Google Fonts link in `index.html` (one link, marked `data-zengin="fonts"`, replaced by the next theme). `brand` derives a whole palette from one color, in OKLCH so steps look even, and pushes every pairing the components rely on (text on surface, on-primary on primary, soft-foreground on soft, and so on) until it meets WCAG AA in both schemes. It writes the brand file, `zengin/brand.json` (the inputs, for re-running), the logo into `public/`, a favicon when there is no SVG logo, `src/brand.ts` and a `BrandMark` component, and patches the title, theme-color, icon and fonts in `index.html`. An SVG logo also supplies the primary; a PNG needs `--primary`. Both commands run the engine afterwards; the project stays clean because the brand file is a foundation.

## mock

```bash
zengin mock customers invoices            # presets: users, customers, companies, products, orders, invoices, events, messages, metrics
zengin mock users --count 50 --seed 3
zengin mock --schema mock.json            # your own entities; see @zengin/mock for the field kinds
```

Writes `src/mock/rng.ts` (a seeded generator and the pools, no dependency) and one typed module per entity exporting the type, a factory and the array. The same seed gives the same data on every run, so screenshots and previews do not drift. See [@zengin/mock](../mock).

## figma

```bash
zengin figma export                          # zengin/tokens*.json -> figma/variables.json (the Variables payload)
zengin figma plugin                          # a plugin into figma/plugin/ that imports that payload into any file
zengin figma import figma/local.json         # what the plugin exported -> a report of what changed in Figma
zengin figma import figma/local.json --write # and update the token files; then zengin tokens
zengin figma connect --map figma/map.json    # Code Connect files from zengin/components.json
```

One naming rule carries both directions: `color.primary.soft` is `color/primary/soft` in Figma with `var(--color-primary-soft)` as its code syntax. See [@zengin/figma](../figma).

## report and rollup

```bash
zengin report --out zengin-report.json                      # in each consuming repository, in CI
zengin rollup reports/*.json --previous last.json           # across repositories; markdown by default
zengin rollup reports/*.json --format html --out rollup.html
```

`report` is the check plus an inventory: component usage (adoption), suppressions with and without reasons, owned forks with their versions, uncontracted components, and the pinned system version. `rollup` ranks repositories by drift, shows violations per 100 files so sizes compare, flags who is behind the latest version, computes deltas against a previous rollup, and lists what needs attention in priority order. See [`@zengin/rollup`](../rollup) for the workflow recipe.

## explain

```bash
zengin explain                     # all rules, plus how scope and suppressions work
zengin explain classname-policy
```

## init

```bash
zengin init                     # a commented zengin.config.yaml template
zengin init --from shadcn       # derive zengin/tokens.json, zengin/components.json and a config from a shadcn/ui project
zengin init --from package @umami/react-zen   # the same from an installed design-system package: its CSS variables (names kept) and .d.ts
zengin init --from shadcn --dir ../app --force
```

The template refuses to overwrite an existing config. The shadcn path reads the theme CSS, the Tailwind config and `components/ui`, writes the definitions, and prints the defaults worth reviewing. See [`@zengin/adapter-shadcn`](../adapter-shadcn). The package path reads `node_modules/<name>`: its theme stylesheet, its precompiled utilities and its `.d.ts`; see [`@zengin/adapter-css`](../adapter-css).

## Not included, on purpose

`zengin fix` would apply `exact` fixes automatically. It is a small addition, and it is left out for now because the first milestone's non-goals exclude tools that edit code. It is a candidate for later once the false-positive rate of the rules is measured on a real codebase.

## History

```bash
zengin report --into reports          # files reports/<repo>/<time>.json instead of one --out file
zengin rollup reports --format html --out public/rollup/index.html
zengin report --into reports --at 2026-09-01T06:00:00Z --commit abc1234 --ref main   # backfill from an older checkout
```

`zengin rollup` accepts directories and reads every snapshot under them as history: the newest run per repository is the row, the one before is the delta, the series is the trend. See [`@zengin/rollup`](../rollup#history-and-trends).
