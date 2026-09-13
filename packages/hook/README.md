# @zenginui/hook

Claude Code PostToolUse hook. Every time the agent writes or edits a file, the engine checks it and the violations go straight back to the agent as the blocking reason. This is the surface that catches the agent that never called MCP.

## What it does

1. Claude Code runs `zengin-hook` after `Write`, `Edit` or `MultiEdit`, with the tool payload on stdin.
2. The hook finds the nearest `zengin.config.yaml` above the written file, reads the file from disk, and runs the engine on it.
3. Clean file: exit 0, no output, nothing in the transcript.
4. Violations at or above `--block-on` (default `error`): exit 2 with the violations on stderr. Claude Code shows them to the agent as the reason the write was flagged, and the agent corrects.
5. Violations below the threshold, or any violations with `--block-on never`: exit 0 with `additionalContext` JSON on stdout, so the agent sees them without being blocked.

On `Edit` and `MultiEdit`, only violations on the lines the edit touched are reported (`--scope changed`, the default). A one-line edit in a file with forty pre-existing problems is not blocked by the forty; the hook says how many it left out. `--scope file` reports everything. `Write` always reports the whole file, because the agent wrote all of it.

The hook never blocks for reasons unrelated to the design system: no config, a file outside scope, a non-code file, or an internal error all exit without blocking.

## Install

```bash
pnpm build
npm link ./packages/hook      # or reference dist/index.js by absolute path
```

Print the settings fragment and merge it into `.claude/settings.json` (project) or `~/.claude/settings.json` (user):

```bash
zengin-hook settings
```

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "zengin-hook", "args": [], "timeout": 30, "statusMessage": "Checking against the design system..." }
        ]
      }
    ]
  }
}
```

Use `"command": "node", "args": ["/abs/path/packages/hook/dist/index.js"]` if the bin is not on PATH. Add options as further `args`.

## Options

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| `--config <path>` | | nearest above the file | Which `zengin.config.yaml` to use. |
| `--block-on` | `error`, `warn`, `info`, `never` | `error` | Lowest severity that blocks. `never` always reports as context. |
| `--scope` | `changed`, `file` | `changed` | On Edit, report only touched lines or the whole file. |
| `--max <n>` | | `50` | Maximum violations rendered. |

## The three surfaces

| Surface | Fires | Bypassable |
| --- | --- | --- |
| MCP | when the agent asks | yes |
| Hook | on every file write | not locally |
| CLI and CI | on commit and pull request | no |

Same engine, same violation shape, same fixes. The hook and the MCP server render violations through the engine's shared formatter, so the agent sees identical text either way.

## Tests

```bash
pnpm test
```

Tests copy the engine's plain-CSS fixture project to a temp directory, perform real writes and edits, and drive the hook in-process. The built binary is also exercised by hand from a foreign working directory before release.
