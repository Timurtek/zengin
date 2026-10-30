import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE_PROPERTIES, run, startCapture, telemetryEnv, type Capture } from "../../engine/test/telemetry-capture.js";

// The built hook, fed the payload Claude Code sends after a write, as an agent session would run it.
const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "dist", "index.js");
const cli = join(here, "..", "..", "cli", "dist", "index.js");
const project = join(here, "..", "..", "engine", "test", "fixtures", "project-css");
const payload = JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", cwd: project, tool_input: { file_path: join(project, "src", "features", "review", "approve-bar.css") } });

let capture: Capture;
beforeAll(async () => {
  capture = await startCapture();
});
afterAll(() => capture.close());

describe("zengin-hook, counted", () => {
  it("blocks the same way and sends nothing before consent or under DO_NOT_TRACK", async () => {
    for (const extra of [{}, { DO_NOT_TRACK: "1" }]) {
      const env = telemetryEnv(capture, extra);
      if ("DO_NOT_TRACK" in extra) await run(cli, ["telemetry", "on"], { env });
      const before = capture.bodies.length;
      const r = await run(bin, [], { env, input: payload });
      expect(r.code).toBe(2);
      expect(r.stderr).not.toMatch(/Share anonymous usage counts/);
      expect(capture.bodies.length, JSON.stringify(extra)).toBe(before);
    }
  });

  it("after a yes, sends one hook_violation_blocked with the count only: no path, rule or code", async () => {
    const env = telemetryEnv(capture);
    await run(cli, ["telemetry", "on"], { env });
    const before = capture.bodies.length;
    const r = await run(bin, [], { env, input: payload });
    expect(r.code).toBe(2);
    const sent = capture.bodies.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0]!["event"]).toBe("hook_violation_blocked");
    const props = sent[0]!["properties"] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual([...BASE_PROPERTIES, "violations_count"].sort());
    expect(props).toMatchObject({ app: "ZenginUI", tool: "hook" });
    expect(props["violations_count"]).toBeGreaterThan(0);
    const text = JSON.stringify(sent[0]);
    for (const leak of ["approve-bar", "review", "project-css", "color-literal", "#"]) expect(text).not.toContain(leak);
  });

  it("sends nothing when the edit is clean", async () => {
    const env = telemetryEnv(capture);
    await run(cli, ["telemetry", "on"], { env });
    const before = capture.bodies.length;
    const r = await run(bin, [], { env, input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Read", cwd: project }) });
    expect(r.code).toBe(0);
    expect(capture.bodies.length).toBe(before);
  });
});
