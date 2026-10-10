#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHost, findConfig } from "./host.js";
import { MCP_PATH, startHttp } from "./http.js";
import { createServer } from "./server.js";

interface Args {
  config?: string;
  help: boolean;
  http: boolean;
  port?: number;
  host?: string;
  public: boolean;
  allowedHosts: string[];
}

function parseArgs(argv: string[]): Args {
  const out: Args = { help: false, http: false, public: false, allowedHosts: [] };
  const value = (i: number, flag: string): string => {
    const v = argv[i];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value.`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--config" || a === "-c") out.config = value(++i, a);
    else if (a.startsWith("--config=")) out.config = a.slice("--config=".length);
    else if (a === "--http") out.http = true;
    else if (a === "--port") out.port = Number(value(++i, a));
    else if (a.startsWith("--port=")) out.port = Number(a.slice("--port=".length));
    else if (a === "--host") out.host = value(++i, a);
    else if (a.startsWith("--host=")) out.host = a.slice("--host=".length);
    else if (a === "--allowed-host") out.allowedHosts.push(value(++i, a));
    else if (a.startsWith("--allowed-host=")) out.allowedHosts.push(a.slice("--allowed-host=".length));
    else if (a === "--public") out.public = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  if (out.port !== undefined && !(Number.isInteger(out.port) && out.port >= 0 && out.port < 65536)) throw new Error("--port must be a port number.");
  return out;
}

const HELP = [
  "zengin-mcp: MCP server for the Zengin conformance engine.",
  "",
  "Usage:",
  "  zengin-mcp [--config <path>]                       stdio, for agents that launch it (Claude Code, Codex, Cursor)",
  "  zengin-mcp --http [--port 3333] [--host 127.0.0.1]  Streamable HTTP at /mcp, for clients that take a URL",
  "",
  "HTTP options:",
  "  --port <n>            default: $PORT, else 3333",
  "  --host <address>      default 127.0.0.1. Any other address needs ZENGIN_MCP_TOKEN or --public.",
  "  --public              serve without auth; zengin_get_violations (which returns file contents) is left out",
  "  --allowed-host <h>    on a loopback bind, also accept this Host header (a reverse proxy's public name)",
  "  ZENGIN_MCP_TOKEN      clients must send Authorization: Bearer <token>",
  "",
  "Config resolution: --config, then ZENGIN_CONFIG, then the nearest zengin.config.yaml walking up from the cwd.",
  "",
].join("\n");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stderr.write(HELP);
    return;
  }

  const configPath = findConfig(args.config, process.cwd());
  const host = createHost(configPath);
  const system = `${host.config.system.package}@${host.config.system.version}`;

  if (!args.http) {
    process.stderr.write(`zengin-mcp: ${system}, config ${configPath}\n`);
    await createServer(host).connect(new StdioServerTransport());
    return;
  }

  const address = args.host ?? "127.0.0.1";
  const port = args.port ?? (process.env["PORT"] ? Number(process.env["PORT"]) : 3333);
  const token = process.env["ZENGIN_MCP_TOKEN"] || undefined;
  const server = await startHttp(host, { port, address }, { token, public: args.public, extraHosts: args.allowedHosts });
  const addr = server.address();
  const bound = typeof addr === "object" && addr ? addr.port : port;
  const shown = address.includes(":") ? `[${address}]` : address;
  process.stderr.write(
    `zengin-mcp: ${system}, config ${configPath}\n` +
      `zengin-mcp: Streamable HTTP on http://${shown}:${bound}${MCP_PATH} (auth: ${token ? "bearer" : "none"}; tools: ${args.public ? "public, no file reads" : "all"})\n`,
  );
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e: unknown) => {
  process.stderr.write(`zengin-mcp: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
