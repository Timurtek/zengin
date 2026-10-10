import { timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Host } from "./host.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

export const MCP_PATH = "/mcp";
/** A tool call carries one file's content; anything past this is not a component. */
const MAX_BODY = 1024 * 1024;

export interface HttpOptions {
  /** Bearer token clients must send (from ZENGIN_MCP_TOKEN). Undefined: no auth. */
  token?: string;
  /** Leave out zengin_get_violations, which returns snippets of files on disk. */
  public?: boolean;
  /**
   * Host headers accepted, for DNS-rebinding protection on a loopback bind: a web page cannot reach
   * 127.0.0.1 under its own name. Undefined: any host (a server behind a proxy or a public name).
   */
  allowedHosts?: string[];
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);
export const isLoopback = (address: string): boolean => LOOPBACK.has(address);

/**
 * Who may reach a server on this address, and whether that is allowed. Off the loopback interface a server
 * either asks for a token or says it is public; serving a project's files to whoever finds the port is never
 * the default.
 */
export function checkExposure(address: string, opts: Pick<HttpOptions, "token" | "public">): string | undefined {
  if (isLoopback(address) || opts.token || opts.public) return undefined;
  return `Refusing to serve on ${address} without auth. Set ZENGIN_MCP_TOKEN for bearer auth, or pass --public to serve without it (zengin_get_violations is then left out, so no file on disk is returned).`;
}

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

/**
 * The request handler for the Streamable HTTP transport, stateless: each POST to /mcp gets its own MCP server
 * and transport over the one shared engine, so nothing is kept between calls and any number of instances can
 * sit behind a load balancer. GET / answers health checks.
 */
export function createHttpHandler(host: Host, opts: HttpOptions = {}): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      json(res, 200, { name: SERVER_NAME, version: SERVER_VERSION, system: `${host.config.system.package}@${host.config.system.version}`, mcp: MCP_PATH, auth: opts.token ? "bearer" : "none", tools: opts.public ? "public" : "all" });
      return;
    }
    if (path !== MCP_PATH) {
      json(res, 404, { error: `Not found. The MCP endpoint is ${MCP_PATH}.` });
      return;
    }
    if (opts.token) {
      const header = req.headers.authorization ?? "";
      const given = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
      if (!given || !sameToken(given, opts.token)) {
        json(res, 401, { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized: send Authorization: Bearer <token>." }, id: null }, { "www-authenticate": 'Bearer realm="zengin-mcp"' });
        return;
      }
    }
    if (req.method !== "POST") {
      // stateless: no session to open a server-sent stream on, and none to delete
      json(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. POST JSON-RPC to this endpoint." }, id: null }, { allow: "POST" });
      return;
    }
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) {
      json(res, 413, { jsonrpc: "2.0", error: { code: -32000, message: `Request body over ${MAX_BODY} bytes.` }, id: null });
      return;
    }

    const server = createServer(host, { files: !opts.public });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      ...(opts.allowedHosts ? { enableDnsRebindingProtection: true, allowedHosts: opts.allowedHosts } : {}),
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (e) {
      if (!res.headersSent) json(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: e instanceof Error ? e.message : String(e) }, id: null });
    }
  };
}

/** Starts the HTTP server and resolves once it is listening. Port 0 picks a free one; read it from server.address(). */
export async function startHttp(
  host: Host,
  listen: { port: number; address: string },
  opts: Omit<HttpOptions, "allowedHosts"> & { /** More Host headers a loopback bind accepts: a reverse proxy that forwards its public name. */ extraHosts?: string[] } = {},
): Promise<Server> {
  const refusal = checkExposure(listen.address, opts);
  if (refusal) throw new Error(refusal);
  // On loopback, accept only loopback Host headers. The port is filled in once it is known (port 0 picks one).
  const allowedHosts: string[] = [...(opts.extraHosts ?? [])];
  const handler = createHttpHandler(host, { ...opts, ...(isLoopback(listen.address) ? { allowedHosts } : {}) });
  const server = createHttpServer((req, res) => void handler(req, res));
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(listen.port, listen.address, () => resolveListen());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : listen.port;
  allowedHosts.push(...["127.0.0.1", "localhost", "[::1]"].map((h) => `${h}:${port}`));
  return server;
}
