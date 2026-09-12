#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHost, findConfig } from "./host.js";
import { createServer } from "./server.js";

function parseArgs(argv: string[]): { config?: string; help: boolean } {
  const out: { config?: string; help: boolean } = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--config" || a === "-c") out.config = argv[++i];
    else if (a.startsWith("--config=")) out.config = a.slice("--config=".length);
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stderr.write(
      [
        "zengin-mcp: MCP server (stdio) for the Zengin conformance engine.",
        "",
        "Usage: zengin-mcp [--config <path/to/zengin.config.yaml>]",
        "",
        "Config resolution: --config, then ZENGIN_CONFIG, then the nearest zengin.config.yaml walking up from the cwd.",
        "",
      ].join("\n"),
    );
    return;
  }

  const configPath = findConfig(args.config, process.cwd());
  const host = createHost(configPath);
  const server = createServer(host);
  process.stderr.write(`zengin-mcp: ${host.config.system.package}@${host.config.system.version}, config ${configPath}\n`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e: unknown) => {
  process.stderr.write(`zengin-mcp: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
