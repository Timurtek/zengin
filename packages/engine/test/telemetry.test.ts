import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { askConsent, blockedBy, buildEvent, consentPath, EVENTS, readConsent, shouldAsk, track, writeConsent, type TelemetryEvent } from "../src/telemetry.js";
import { BASE_PROPERTIES, startCapture, telemetryEnv, type Capture } from "./telemetry-capture.js";

const here = dirname(fileURLToPath(import.meta.url));
const event: TelemetryEvent = { event: "check_run", tool: "cli", version: "0.10.0", counts: { files_count: 3, violations_count: 2 } };

let capture: Capture;
beforeAll(async () => {
  capture = await startCapture();
});
afterAll(() => capture.close());

describe("telemetry: when nothing may be sent", () => {
  it("is blocked by DO_NOT_TRACK and by CI, whatever the person chose", () => {
    expect(blockedBy({})).toBeUndefined();
    expect(blockedBy({ DO_NOT_TRACK: "1" })).toBe("DO_NOT_TRACK");
    expect(blockedBy({ DO_NOT_TRACK: "true" })).toBe("DO_NOT_TRACK");
    expect(blockedBy({ DO_NOT_TRACK: "0" })).toBeUndefined();
    expect(blockedBy({ CI: "true" })).toBe("CI");
    expect(blockedBy({ CI: "false" })).toBeUndefined();
    expect(blockedBy({ GITHUB_ACTIONS: "true" })).toBe("CI");
    expect(blockedBy({ BUILDKITE: "true" })).toBe("CI");
  });

  it("sends nothing before consent, after a no, under DO_NOT_TRACK or in CI, and once with a yes", async () => {
    const env = telemetryEnv(capture);
    const before = capture.bodies.length;

    expect(await track(event, env)).toBe(false);
    expect(existsSync(consentPath(env))).toBe(false);

    writeConsent(false, env);
    expect(await track(event, env)).toBe(false);

    writeConsent(true, env);
    expect(await track(event, { ...env, DO_NOT_TRACK: "1" })).toBe(false);
    expect(await track(event, { ...env, CI: "true" })).toBe(false);
    expect(await track(event, { ...env, GITHUB_ACTIONS: "true" })).toBe(false);
    expect(await track(event, { ...env, ZENGIN_TELEMETRY_DEBUG: "1" })).toBe(false);
    expect(capture.bodies.length).toBe(before);

    expect(await track(event, env)).toBe(true);
    expect(capture.bodies.length).toBe(before + 1);
    const body = capture.bodies.at(-1)!;
    expect(body["path"]).toBe("/i/v0/e/");
    expect(body["event"]).toBe("check_run");
    expect(body["distinct_id"]).toBe(readConsent(env)!.id);
    expect(body["properties"]).toEqual({ app: "ZenginUI", tool: "cli", version: "0.10.0", files_count: 3, violations_count: 2, $process_person_profile: false, $geoip_disable: true });
  });

  it("sends nothing without a key, and gives up quietly when the host is unreachable", async () => {
    const env = telemetryEnv(capture);
    writeConsent(true, env);
    expect(await track(event, { ...env, ZENGIN_TELEMETRY_KEY: "" })).toBe(false);
    expect(await track(event, { ...env, ZENGIN_TELEMETRY_HOST: "http://127.0.0.1:9" })).toBe(false);
  });
});

describe("telemetry: what an event may carry", () => {
  it("carries the app, the tool, its version, the anonymous id and the event's counts, and nothing else", () => {
    for (const [name, spec] of Object.entries(EVENTS)) {
      const counts = Object.fromEntries(spec.counts.map((c) => [c, 7]));
      const built = buildEvent({ event: name as TelemetryEvent["event"], tool: spec.tool, version: "1.2.3", counts }, "3b241101-e2bb-4255-8caf-4136c566a962");
      if (!("body" in built)) throw new Error(built.error);
      expect(Object.keys(built.body).sort()).toEqual(["distinct_id", "event", "properties"]);
      const props = built.body["properties"] as Record<string, unknown>;
      expect(Object.keys(props).sort()).toEqual([...BASE_PROPERTIES, ...spec.counts].sort());
      for (const c of spec.counts) expect(props[c]).toBe(7);
      expect(props["app"]).toBe("ZenginUI");
    }
  });

  it("refuses a path, code, a name or an email, and anything that is not a whole-number count", () => {
    const refused = (counts: Record<string, unknown>) => buildEvent({ ...event, counts: counts as Record<string, number> }, "id");
    expect(refused({ file: "src/features/review/ApproveBar.tsx" })).toEqual({ error: "check_run carries no file" });
    expect(refused({ code: "color: #ff0000" })).toEqual({ error: "check_run carries no code" });
    expect(refused({ name: "Acme" })).toEqual({ error: "check_run carries no name" });
    expect(refused({ email: "someone@example.com" })).toEqual({ error: "check_run carries no email" });
    expect(refused({ files_count: "src/a.tsx" })).toEqual({ error: "files_count must be a whole number from 0" });
    expect(refused({ files_count: 1.5 })).toEqual({ error: "files_count must be a whole number from 0" });
    expect(refused({ files_count: -1 })).toEqual({ error: "files_count must be a whole number from 0" });
    expect(buildEvent({ ...event, event: "page_viewed" as never }, "id")).toEqual({ error: "unknown event page_viewed" });
    expect(buildEvent({ ...event, tool: "hook" }, "id")).toEqual({ error: "check_run is sent by cli, not hook" });
  });

  it("sends a version only when it is a version, so a path cannot ride in on it", () => {
    const built = buildEvent({ ...event, version: "/home/sam/acme" }, "id");
    expect("body" in built && (built.body["properties"] as Record<string, unknown>)["version"]).toBe("unknown");
  });
});

describe("telemetry: the choice", () => {
  it("is stored in the user's config; a yes makes an anonymous id, a no deletes it", () => {
    const env = { ZENGIN_CONFIG_DIR: mkdtempSync(join(tmpdir(), "zengin-telemetry-")) };
    expect(readConsent(env)).toBeUndefined();
    const on = writeConsent(true, env);
    expect(on.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(writeConsent(true, env).id).toBe(on.id);
    const off = writeConsent(false, env);
    expect(off.id).toBeUndefined();
    expect(JSON.parse(readFileSync(consentPath(env), "utf8"))).not.toHaveProperty("id");
    expect(writeConsent(true, env).id).not.toBe(on.id);
  });

  it("lives outside any project: APPDATA on Windows, XDG_CONFIG_HOME or ~/.config elsewhere", () => {
    const expected = process.platform === "win32" ? join("C:\\Users\\sam\\AppData\\Roaming", "zengin", "telemetry.json") : join("/x", "zengin", "telemetry.json");
    expect(consentPath({ APPDATA: "C:\\Users\\sam\\AppData\\Roaming", XDG_CONFIG_HOME: "/x" })).toBe(expected);
  });

  it("is asked for only at a terminal, outside CI and DO_NOT_TRACK, and only until it is made", () => {
    const env = { ZENGIN_CONFIG_DIR: mkdtempSync(join(tmpdir(), "zengin-telemetry-")) };
    expect(shouldAsk(false, env)).toBe(false);
    expect(shouldAsk(true, { ...env, CI: "true" })).toBe(false);
    expect(shouldAsk(true, { ...env, DO_NOT_TRACK: "1" })).toBe(false);
    expect(shouldAsk(true, env)).toBe(true);
    writeConsent(false, env);
    expect(shouldAsk(true, env)).toBe(false);
  });

  it("defaults to no: only y or yes says yes", async () => {
    const answer = async (typed: string | null) => {
      const input = new PassThrough();
      const output = new PassThrough();
      const pending = askConsent(input, output);
      if (typed === null) input.end();
      else input.write(typed);
      const result = await pending;
      expect(output.read().toString()).toMatch(/Share anonymous usage counts\? \[y\/N\] $/);
      return result;
    };
    expect(await answer("\n")).toBe(false);
    expect(await answer("no\n")).toBe(false);
    expect(await answer("sure\n")).toBe(false);
    expect(await answer(null)).toBe(false);
    expect(await answer("y\n")).toBe(true);
    expect(await answer("YES\n")).toBe(true);
  });
});

describe("telemetry: the docs page", () => {
  it("lists every event, the tool that sends it and every count it carries", () => {
    const docs = readFileSync(join(here, "..", "..", "..", "docs", "telemetry.md"), "utf8");
    for (const [name, spec] of Object.entries(EVENTS)) {
      const row = docs.split("\n").find((line) => line.startsWith(`| \`${name}\``));
      expect(row, name).toBeDefined();
      expect(row).toContain(`| ${spec.tool} |`);
      for (const c of spec.counts) expect(row).toContain(`\`${c}\``);
    }
  });
});

describe("telemetry: the release key", () => {
  const script = join(here, "..", "scripts", "telemetry-key.mjs");
  const built = () => {
    const file = join(mkdtempSync(join(tmpdir(), "zengin-key-")), "telemetry.js");
    writeFileSync(file, 'const BUILT_IN_KEY = "";\n');
    return file;
  };
  const env = (key?: string) => {
    const e = { ...process.env };
    delete e["ZENGIN_POSTHOG_KEY"];
    return key === undefined ? e : { ...e, ZENGIN_POSTHOG_KEY: key };
  };

  it("writes ZENGIN_POSTHOG_KEY into the built module, and leaves it empty without one", () => {
    const file = built();
    expect(spawnSync(process.execPath, [script, file], { env: env() }).status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe('const BUILT_IN_KEY = "";\n');
    expect(spawnSync(process.execPath, [script, file], { env: env("phc_abc123") }).status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe('const BUILT_IN_KEY = "phc_abc123";\n');
  });

  it("finds the line it replaces in the module's source", () => {
    expect(readFileSync(join(here, "..", "src", "telemetry.ts"), "utf8")).toContain('const BUILT_IN_KEY = "";');
  });

  it("refuses anything that is not a project key", () => {
    const file = built();
    const r = spawnSync(process.execPath, [script, file], { env: env('phc_x"; process.exit(1); "'), encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not a PostHog project key/);
    expect(readFileSync(file, "utf8")).toBe('const BUILT_IN_KEY = "";\n');
  });
});
