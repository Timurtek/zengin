import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE_PROPERTIES, run, startCapture, telemetryEnv, type Capture } from "../../engine/test/telemetry-capture.js";

// These run the built command line, dist/index.js, as a person or a CI job would: the wiring in main() is what
// is under test, not the engine's telemetry module (packages/engine/test/telemetry.test.ts covers that).
const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "dist", "index.js");
const project = join(here, "..", "..", "engine", "test", "fixtures", "project-css");
const consentFile = (env: Record<string, string>) => join(env["ZENGIN_CONFIG_DIR"]!, "telemetry.json");

let capture: Capture;
beforeAll(async () => {
  capture = await startCapture();
});
afterAll(() => capture.close());

describe("zengin telemetry", () => {
  it("shows the choice, turns it on and off, and refuses anything else", async () => {
    const env = telemetryEnv(capture);
    const status = await run(bin, ["telemetry"], { env });
    expect(status.code).toBe(0);
    expect(status.stdout).toMatch(/Anonymous usage counts: not chosen yet, so off\./);
    expect(status.stdout).toContain("docs/telemetry.md");
    expect(existsSync(consentFile(env))).toBe(false);

    const on = await run(bin, ["telemetry", "on"], { env });
    expect(on.stdout).toMatch(/Anonymous usage counts: on\./);
    const stored = JSON.parse(readFileSync(consentFile(env), "utf8"));
    expect(stored.enabled).toBe(true);
    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/);

    const off = await run(bin, ["telemetry", "off"], { env });
    expect(off.stdout).toMatch(/Anonymous usage counts: off\./);
    expect(JSON.parse(readFileSync(consentFile(env), "utf8"))).toEqual({ enabled: false, decided: expect.any(String) });

    const wrong = await run(bin, ["telemetry", "maybe"], { env });
    expect(wrong.code).toBe(2);
    expect(wrong.stderr).toMatch(/takes on, off or status/);
  });

  it("says when the environment forbids sending whatever the choice", async () => {
    const env = telemetryEnv(capture, { DO_NOT_TRACK: "1" });
    await run(bin, ["telemetry", "on"], { env });
    expect((await run(bin, ["telemetry"], { env })).stdout).toMatch(/Nothing is sent here whatever the choice: DO_NOT_TRACK is set\./);
  });
});

describe("zengin check, counted", () => {
  const check = (env: Record<string, string>) => run(bin, ["check", "--fail-on", "never"], { cwd: project, env });

  it("never asks without a terminal and sends nothing before consent", async () => {
    const env = telemetryEnv(capture);
    const before = capture.bodies.length;
    const r = await check(env);
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/Share anonymous usage counts/);
    expect(existsSync(consentFile(env))).toBe(false);
    expect(capture.bodies.length).toBe(before);
  });

  it("sends nothing under DO_NOT_TRACK or in CI, even after a yes", async () => {
    for (const extra of [{ DO_NOT_TRACK: "1" }, { CI: "true" }, { GITHUB_ACTIONS: "true" }]) {
      const env = telemetryEnv(capture, extra);
      await run(bin, ["telemetry", "on"], { env });
      const before = capture.bodies.length;
      expect((await check(env)).code).toBe(0);
      expect(capture.bodies.length, JSON.stringify(extra)).toBe(before);
    }
  });

  it("after a yes, sends one check_run with counts only: no path, no code, no name", async () => {
    const env = telemetryEnv(capture);
    await run(bin, ["telemetry", "on"], { env });
    const before = capture.bodies.length;
    const r = await check(env);
    expect(r.code).toBe(0);
    const sent = capture.bodies.slice(before);
    expect(sent).toHaveLength(1);
    const body = sent[0]!;
    expect(body["event"]).toBe("check_run");
    expect(body["distinct_id"]).toBe(JSON.parse(readFileSync(consentFile(env), "utf8")).id);
    const props = body["properties"] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual([...BASE_PROPERTIES, "files_count", "violations_count"].sort());
    expect(props).toMatchObject({ app: "ZenginUI", tool: "cli", version: JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")).version });
    expect(props["violations_count"]).toBeGreaterThan(0);

    // The output names files, rules and code; none of it may be in what was sent.
    const text = JSON.stringify(body);
    for (const leak of ["project-css", "src/", "features", "approve-bar", "color-literal", "#", project, process.cwd(), env["ZENGIN_CONFIG_DIR"]!]) expect(text).not.toContain(leak);
  });
});
