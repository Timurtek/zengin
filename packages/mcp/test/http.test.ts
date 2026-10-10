import type { Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHost } from "../src/host.js";
import { checkExposure, MCP_PATH, startHttp } from "../src/http.js";

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, "..", "..", "engine", "test", "fixtures", "project-css", "zengin.config.yaml");
const host = createHost(configPath);

const urlOf = (server: Server, path = MCP_PATH): string => {
  const addr = server.address();
  if (!addr || typeof addr !== "object") throw new Error("not listening");
  return `http://127.0.0.1:${addr.port}${path}`;
};

async function connect(server: Server, headers: Record<string, string> = {}): Promise<Client> {
  const client = new Client({ name: "http-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(urlOf(server)), { requestInit: { headers } }));
  return client;
}

const close = (server: Server) => new Promise<void>((r) => server.close(() => r()));
const CARD = 'export const Card = () => <div style={{ color: "#ff0000", padding: 13 }}>hi</div>;';

describe("zengin-mcp --http", () => {
  let open: Server;
  let authed: Server;
  let pub: Server;

  beforeAll(async () => {
    open = await startHttp(host, { port: 0, address: "127.0.0.1" });
    authed = await startHttp(host, { port: 0, address: "127.0.0.1" }, { token: "s3cret-token" });
    pub = await startHttp(host, { port: 0, address: "127.0.0.1" }, { public: true });
  });
  afterAll(async () => {
    await Promise.all([close(open), close(authed), close(pub)]);
  });

  it("serves the four tools over Streamable HTTP and checks code sent to it", async () => {
    const client = await connect(open);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["zengin_check_code", "zengin_describe_system", "zengin_explain_rules", "zengin_get_violations"]);
    const r = await client.callTool({ name: "zengin_check_code", arguments: { path: "src/Card.tsx", content: CARD, format: "json" } });
    const rules = ((r.structuredContent as { violations: { rule: string }[] }).violations ?? []).map((v) => v.rule).sort();
    expect(rules).toEqual(["color-literal", "spacing-literal"]);
    await client.close();
  });

  it("keeps nothing between requests: a second client gets the same answer", async () => {
    const a = await connect(open), b = await connect(open);
    const [ra, rb] = await Promise.all([a, b].map((c) => c.callTool({ name: "zengin_explain_rules", arguments: { rule: "color-literal" } })));
    expect(ra!.content).toEqual(rb!.content);
    await Promise.all([a.close(), b.close()]);
  });

  it("asks for the bearer token when ZENGIN_MCP_TOKEN is set", async () => {
    const res = await fetch(urlOf(authed), { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    await expect(connect(authed, { authorization: "Bearer wrong" })).rejects.toThrow();
    const client = await connect(authed, { authorization: "Bearer s3cret-token" });
    expect((await client.listTools()).tools).toHaveLength(4);
    await client.close();
  });

  it("--public leaves out the tool that reads files on disk", async () => {
    const client = await connect(pub);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("zengin_get_violations");
    expect(names).toHaveLength(3);
    await client.close();
  });

  it("answers health checks, refuses other methods and paths, and a foreign Host header", async () => {
    const health = await (await fetch(urlOf(open, "/"))).json();
    expect(health).toMatchObject({ mcp: MCP_PATH, auth: "none", tools: "all" });
    expect((await fetch(urlOf(open), { method: "GET" })).status).toBe(405);
    expect((await fetch(urlOf(open, "/nope"))).status).toBe(404);
    // DNS rebinding: a page on evil.example resolving to 127.0.0.1 sends its own name as Host
    const { request } = await import("node:http");
    const addr = open.address() as { port: number };
    const status = await new Promise<number>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port: addr.port, path: MCP_PATH, method: "POST", headers: { host: "evil.example", "content-type": "application/json", accept: "application/json, text/event-stream" } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "0" } } }));
    });
    expect(status).toBe(403);
  });

  it("will not serve a project's files off the loopback interface without a token or --public", async () => {
    expect(checkExposure("127.0.0.1", {})).toBeUndefined();
    expect(checkExposure("0.0.0.0", {})).toMatch(/ZENGIN_MCP_TOKEN/);
    expect(checkExposure("0.0.0.0", { token: "t" })).toBeUndefined();
    expect(checkExposure("0.0.0.0", { public: true })).toBeUndefined();
    await expect(startHttp(host, { port: 0, address: "0.0.0.0" })).rejects.toThrow(/Refusing/);
  });
});
