# @zenginui/mcp

MCP server (stdio) that exposes the Zengin conformance engine to coding agents. An agent submits code, the engine returns structured violations with suggested corrections, the agent self-corrects before the code lands. No LLM in the check, no token spend on it, the same answer every time.

## Tools

| Tool | Purpose |
| --- | --- |
| `zengin_check_code` | Check a piece of code that is not on disk yet. Takes the path it will live at (decides parser and scope) and the full content. The mid-generation loop. |
| `zengin_get_violations` | Check files on disk, or the whole project scope. Filters by path, rule and severity. Returns a summary by severity, rule and file. |
| `zengin_describe_system` | The tokens and component contracts the rules check against, so generated code references what exists. |
| `zengin_explain_rules` | What each rule checks, whether it is on in this project, and how to suppress or scope it. |

All four are read-only. Nothing installs, edits, migrates or executes code. The violation shape is the engine's: see [`@zenginui/engine`](../engine/README.md#violations).

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

### Codex CLI

```bash
codex mcp add zengin -- npx -y @zenginui/mcp
```

With no `--config`, the server finds the nearest `zengin.config.yaml` above the folder Codex was started in.

### Cursor

The same `mcpServers` block in `.cursor/mcp.json` at the project root. Approve the server the first time Cursor asks; for the headless `cursor-agent -p`, allow its tools in `.cursor/cli.json` with `{ "permissions": { "allow": ["Mcp(zengin:*)"] } }`.

### Over HTTP

For a client that takes a URL instead of launching a process, the same four tools speak Streamable HTTP:

```bash
npx -y @zenginui/mcp --http                     # http://127.0.0.1:3333/mcp
npx -y @zenginui/mcp --http --port 4000         # or $PORT, which hosting platforms set
```

It is stateless: every request gets its own MCP server over one shared engine, so instances can sit behind a load balancer and a restart loses nothing. `GET /` answers health checks with the system and version. On the loopback interface only loopback `Host` headers are accepted, so a web page cannot reach it by DNS rebinding; behind a reverse proxy that forwards its public name, add `--allowed-host zengin.example.com`.

Off the loopback interface (`--host 0.0.0.0` in a container) the server needs one of two things, and refuses to start without either:

- `ZENGIN_MCP_TOKEN=<secret>` in the environment: clients send `Authorization: Bearer <secret>`. It is read from the environment, never a flag, so it stays out of the process list.
- `--public`: no auth, and `zengin_get_violations` is left out, because it returns the contents of files on disk. What remains checks code the client sends and describes the system.

A server hosted on a checkout of your repository checks against that checkout: its tokens, components, brand and stylesheets as of the deploy.

### ChatGPT

ChatGPT reaches MCP servers over a public HTTPS URL or through OpenAI's Secure MCP Tunnel, never a localhost URL. Either path can run this server: `--http` behind HTTPS with `ZENGIN_MCP_TOKEN` (or `--public`), or the tunnel client pointed at the stdio server. Neither has been run against ChatGPT itself yet.

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
