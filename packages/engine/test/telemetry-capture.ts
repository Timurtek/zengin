import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A stand-in for PostHog's capture endpoint, for the telemetry tests of the engine, the CLI, the hook and the
 * MCP server: it records every request body and answers 200, so a test can count what was sent and read it.
 */
export interface Capture {
  url: string;
  bodies: Record<string, unknown>[];
  close(): Promise<void>;
}

export async function startCapture(): Promise<Capture> {
  const bodies: Record<string, unknown>[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      bodies.push({ path: req.url, ...(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>) });
      res.writeHead(200, { "content-type": "application/json" }).end('{"status":1}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, bodies, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

/** Variables that switch telemetry off, removed so a test decides them itself (GitHub's runners set CI). */
const OFF = ["DO_NOT_TRACK", "CI", "CONTINUOUS_INTEGRATION", "BUILD_NUMBER", "RUN_ID", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "TRAVIS", "BUILDKITE", "JENKINS_URL", "TF_BUILD", "CODEBUILD_BUILD_ID", "TEAMCITY_VERSION", "BITBUCKET_BUILD_NUMBER", "ZENGIN_TELEMETRY_DEBUG"];

/** An environment with a fresh config directory, the capture server as the host and a test key. */
export function telemetryEnv(capture: Capture, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !OFF.includes(k)) env[k] = v;
  return {
    ...env,
    ZENGIN_CONFIG_DIR: mkdtempSync(join(tmpdir(), "zengin-telemetry-")),
    ZENGIN_TELEMETRY_HOST: capture.url,
    ZENGIN_TELEMETRY_KEY: "phc_test",
    ...extra,
  };
}

/** Run a built entry point to its end without blocking the event loop, so the capture server can answer it. */
export function run(bin: string, args: string[], opts: { cwd?: string; env: Record<string, string>; input?: string }): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd: opts.cwd, env: opts.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(opts.input ?? "");
  });
}

/** The property names an event may carry beyond its declared counts. */
export const BASE_PROPERTIES = ["app", "tool", "version", "$process_person_profile", "$geoip_disable"];
