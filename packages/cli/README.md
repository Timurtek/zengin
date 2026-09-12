# @zengin/cli

The `zengin` command. The gate that actually protects the codebase: run it pre-commit and on every pull request. Same engine, same violations, same fixes as the MCP server and the hook.

```
zengin check [paths...]     check files (default: everything in scope)
zengin explain [rule]       what each rule checks
zengin init                 write a zengin.config.yaml in the current directory
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

## explain

```bash
zengin explain                     # all rules, plus how scope and suppressions work
zengin explain classname-policy
```

## init

```bash
zengin init                     # a commented zengin.config.yaml template
zengin init --from shadcn       # derive zengin/tokens.json, zengin/components.json and a config from a shadcn/ui project
zengin init --from shadcn --dir ../app --force
```

The template refuses to overwrite an existing config. The shadcn path reads the theme CSS, the Tailwind config and `components/ui`, writes the definitions, and prints the defaults worth reviewing. See [`@zengin/adapter-shadcn`](../adapter-shadcn).

## Not included, on purpose

`zengin fix` would apply `exact` fixes automatically. It is a small addition, and it is left out for now because the first milestone's non-goals exclude tools that edit code. It is a candidate for later once the false-positive rate of the rules is measured on a real codebase.
