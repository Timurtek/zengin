# @zengin/mcp

MCP server (stdio) that exposes the Zengin conformance engine to coding agents. An agent submits code, the engine returns structured violations with suggested corrections, the agent self-corrects before the code lands. No LLM in the check, no token spend on it, the same answer every time.

## Tools

| Tool | Purpose |
| --- | --- |
| `zengin_check_code` | Check a piece of code that is not on disk yet. Takes the path it will live at (decides parser and scope) and the full content. The mid-generation loop. |
| `zengin_get_violations` | Check files on disk, or the whole project scope. Filters by path, rule and severity. Returns a summary by severity, rule and file. |
| `zengin_describe_system` | The tokens and component contracts the rules check against, so generated code references what exists. |
| `zengin_explain_rules` | What each rule checks, whether it is on in this project, and how to suppress or scope it. |

All four are read-only. Nothing installs, edits, migrates or executes code. The violation shape is the engine's: see [`@zengin/engine`](../engine/README.md#violations).

## Running

```bash
pnpm build
node packages/mcp/dist/index.js --config ./zengin.config.yaml
```

Config resolution: `--config`, then `ZENGIN_CONFIG`, then the nearest `zengin.config.yaml` walking up from the working directory. On first use the server indexes the project's stylesheets so `zengin_check_code` can resolve `className` against them; restart the server after adding CSS files.

### Claude Code

```bash
claude mcp add zengin -- node /absolute/path/to/packages/mcp/dist/index.js --config /absolute/path/to/zengin.config.yaml
```

Or in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "zengin": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": { "ZENGIN_CONFIG": "zengin.config.yaml" }
    }
  }
}
```

### Inspecting

```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js --config packages/engine/test/fixtures/project/zengin.config.yaml
```

## The loop this is built for

1. Agent calls `zengin_describe_system` (optional) to learn the tokens and variants that exist.
2. Agent writes a component.
3. Agent calls `zengin_check_code` with the path and content.
4. Engine returns violations. `exact` fixes are applied verbatim; `nearest` fixes are read with their note and decided; `none` fixes mean the agent goes back to the system definition.
5. Agent re-checks until clean, then writes the file.

MCP is opt-in: the agent has to decide to call it. The PostToolUse hook catches the agent that did not ask, and CI catches everyone. All three run the same engine.

## Tests

```bash
pnpm test
```

Tests connect a real MCP client to the server over an in-memory transport and exercise every tool against the engine's fixture project.
