import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE_PROPERTIES, run, startCapture, telemetryEnv, type Capture } from "../../engine/test/telemetry-capture.js";

// The built server, started over stdio as an agent starts it, then stopped once it has had time to send.
const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "dist", "index.js");
const cli = join(here, "..", "..", "cli", "dist", "index.js");
const project = join(here, "..", "..", "engine", "test", "fixtures", "project-css");

let capture: Capture;
beforeAll(async () => {
  capture = await startCapture();
});
afterAll(() => capture.close());

/** Start the server, wait until it has sent something or 2.5 s have passed, stop it, and return what it sent. */
async function serve(env: Record<string, string>): Promise<Record<string, unknown>[]> {
  const before = capture.bodies.length;
  const child = spawn(process.execPath, [bin], { cwd: project, env, stdio: ["pipe", "pipe", "pipe"] });
  const deadline = Date.now() + 2500;
  while (capture.bodies.length === before && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  return capture.bodies.slice(before);
}

describe("zengin-mcp, counted", () => {
  it("sends nothing before consent", { timeout: 10_000 }, async () => {
    expect(await serve(telemetryEnv(capture))).toHaveLength(0);
  });

  it("sends nothing under DO_NOT_TRACK, even after a yes", { timeout: 10_000 }, async () => {
    const dnt = telemetryEnv(capture, { DO_NOT_TRACK: "1" });
    await run(cli, ["telemetry", "on"], { env: dnt });
    expect(await serve(dnt)).toHaveLength(0);
  });

  it("after a yes, sends one mcp_server_started with the tool and version only", { timeout: 10_000 }, async () => {
    const env = telemetryEnv(capture);
    await run(cli, ["telemetry", "on"], { env });
    const sent = await serve(env);
    expect(sent).toHaveLength(1);
    expect(sent[0]!["event"]).toBe("mcp_server_started");
    const props = sent[0]!["properties"] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual([...BASE_PROPERTIES].sort());
    expect(props).toMatchObject({ app: "ZenginUI", tool: "mcp" });
    expect(JSON.stringify(sent[0])).not.toContain("project-css");
  });
});
