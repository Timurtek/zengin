import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

/**
 * Anonymous, opt-in usage counts from the CLI, the hook and the MCP server (ZEN-CLIEVENTS-001).
 *
 * Off until the person running the CLI says yes to one prompt, and off in CI and under DO_NOT_TRACK whatever
 * they said. An event is a name from EVENTS, the tool and its version, a random id made when they said yes,
 * and integer counts. Nothing else can be put in one: buildEvent refuses any other property, so a path, a
 * piece of code, a name or an email has nowhere to go. docs/telemetry.md lists every event.
 */

export type TelemetryTool = "cli" | "hook" | "mcp";

/** Every event any tool may send, the tool that sends it, and the only properties it may carry, all counts. */
export const EVENTS = {
  project_created: { tool: "cli", counts: [] },
  component_added: { tool: "cli", counts: ["items_count"] },
  brand_generated: { tool: "cli", counts: [] },
  init_completed: { tool: "cli", counts: [] },
  doctor_run: { tool: "cli", counts: ["findings_count", "fixed_count"] },
  check_run: { tool: "cli", counts: ["files_count", "violations_count"] },
  rollup_generated: { tool: "cli", counts: ["repo_count"] },
  hook_violation_blocked: { tool: "hook", counts: ["violations_count"] },
  mcp_server_started: { tool: "mcp", counts: [] },
} as const satisfies Record<string, { tool: TelemetryTool; counts: readonly string[] }>;

export type TelemetryEventName = keyof typeof EVENTS;

/** Where the docs page is, for the prompt and `zengin telemetry`. */
export const TELEMETRY_DOCS = "https://github.com/Timurtek/zengin/blob/main/docs/telemetry.md";

/**
 * The PostHog project key, written into the built file by scripts/telemetry-key.mjs from ZENGIN_POSTHOG_KEY at
 * release. Empty in the source and in any build without it, and an empty key sends nothing.
 */
const BUILT_IN_KEY = "";
const DEFAULT_HOST = "https://us.i.posthog.com";
const TIMEOUT_MS = 1000;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** The variables CI services set. `CI` covers most; the rest are the ones that do not set it. */
const CI_VARIABLES = ["CI", "CONTINUOUS_INTEGRATION", "BUILD_NUMBER", "RUN_ID", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "TRAVIS", "BUILDKITE", "JENKINS_URL", "TF_BUILD", "CODEBUILD_BUILD_ID", "TEAMCITY_VERSION", "BITBUCKET_BUILD_NUMBER"];

type Env = Record<string, string | undefined>;

export interface Consent {
  enabled: boolean;
  /** The anonymous install id: random, made on yes, deleted on no. */
  id?: string;
  /** When the choice was made, as an ISO date. */
  decided: string;
}

export interface TelemetryEvent {
  event: TelemetryEventName;
  tool: TelemetryTool;
  version: string;
  counts?: Record<string, number>;
}

function set(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

/** Why nothing may be sent whatever the person chose, or undefined when nothing forbids it. */
export function blockedBy(env: Env = process.env): "DO_NOT_TRACK" | "CI" | undefined {
  if (set(env["DO_NOT_TRACK"])) return "DO_NOT_TRACK";
  if (CI_VARIABLES.some((name) => set(env[name]))) return "CI";
  return undefined;
}

/** The user's own config file, outside any project: %APPDATA%\zengin on Windows, $XDG_CONFIG_HOME/zengin elsewhere. */
export function consentPath(env: Env = process.env): string {
  const base =
    env["ZENGIN_CONFIG_DIR"] ||
    (process.platform === "win32" && env["APPDATA"] ? join(env["APPDATA"], "zengin") : join(env["XDG_CONFIG_HOME"] || join(homedir(), ".config"), "zengin"));
  return join(base, "telemetry.json");
}

/** The stored choice, or undefined when none was made (or the file cannot be read, which counts as no). */
export function readConsent(env: Env = process.env): Consent | undefined {
  const path = consentPath(env);
  if (!existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Consent>;
    if (typeof raw.enabled !== "boolean") return undefined;
    return { enabled: raw.enabled, decided: String(raw.decided ?? ""), ...(raw.enabled && typeof raw.id === "string" ? { id: raw.id } : {}) };
  } catch {
    return undefined;
  }
}

/** Store a choice. Yes keeps the existing id or makes one; no deletes it, so a later yes is a new install. */
export function writeConsent(enabled: boolean, env: Env = process.env): Consent {
  const previous = readConsent(env);
  const consent: Consent = enabled
    ? { enabled, id: previous?.id ?? randomUUID(), decided: new Date().toISOString() }
    : { enabled, decided: new Date().toISOString() };
  const path = consentPath(env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(consent, null, 2) + "\n");
  return consent;
}

/** Whether the CLI should ask: no choice stored, nothing forbidding it, and a person at a terminal to answer. */
export function shouldAsk(interactive: boolean, env: Env = process.env): boolean {
  return interactive && !blockedBy(env) && readConsent(env) === undefined;
}

export const CONSENT_PROMPT = `
Zengin can send anonymous usage counts, such as "a project was created" or "the hook blocked an edit",
so its maker can see which parts are used. Never file paths, code, names or emails. Never in CI or
when DO_NOT_TRACK is set. Every event is listed at ${TELEMETRY_DOCS}
Change it any time with: zengin telemetry on | off

Share anonymous usage counts? [y/N] `;

/** Ask once. Only "y" or "yes" is a yes: Enter, anything else, or the input closing is a no. */
export function askConsent(input: Readable, output: Writable): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input, terminal: false });
    let answered = false;
    output.write(CONSENT_PROMPT);
    rl.once("line", (line) => {
      answered = true;
      rl.close();
      resolve(/^y(es)?$/i.test(line.trim()));
    });
    rl.once("close", () => {
      if (!answered) resolve(false);
    });
  });
}

/**
 * The capture request's body, or an error naming what was refused. The event must be in EVENTS and sent by its
 * own tool, every count must be one that event declares, and every value a whole number from zero up.
 */
export function buildEvent(e: TelemetryEvent, id: string): { body: Record<string, unknown> } | { error: string } {
  const spec = EVENTS[e.event] as { tool: TelemetryTool; counts: readonly string[] } | undefined;
  if (!spec) return { error: `unknown event ${String(e.event)}` };
  if (spec.tool !== e.tool) return { error: `${e.event} is sent by ${spec.tool}, not ${e.tool}` };
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(e.counts ?? {})) {
    if (!spec.counts.includes(key)) return { error: `${e.event} carries no ${key}` };
    if (!Number.isSafeInteger(value) || value < 0) return { error: `${key} must be a whole number from 0` };
    counts[key] = value;
  }
  return {
    body: {
      event: e.event,
      distinct_id: id,
      properties: {
        app: "ZenginUI",
        tool: e.tool,
        version: VERSION.test(e.version) ? e.version : "unknown",
        ...counts,
        // PostHog's own switches, not data: no person profile for the id, no location looked up from the IP.
        $process_person_profile: false,
        $geoip_disable: true,
      },
    },
  };
}

/**
 * Send one event when the person said yes and nothing forbids it; true when it was sent. Never throws and never
 * waits more than a second: a usage count is not worth slowing or failing the tool for. ZENGIN_TELEMETRY_DEBUG
 * prints what would be sent to stderr instead of sending it.
 */
export async function track(e: TelemetryEvent, env: Env = process.env): Promise<boolean> {
  try {
    if (blockedBy(env)) return false;
    const consent = readConsent(env);
    if (!consent?.enabled || !consent.id) return false;
    const built = buildEvent(e, consent.id);
    const debug = set(env["ZENGIN_TELEMETRY_DEBUG"]);
    if ("error" in built) {
      if (debug) process.stderr.write(`zengin telemetry: not sent, ${built.error}\n`);
      return false;
    }
    if (debug) {
      process.stderr.write(`zengin telemetry: would send ${JSON.stringify(built.body)}\n`);
      return false;
    }
    const key = env["ZENGIN_TELEMETRY_KEY"] || BUILT_IN_KEY;
    if (!key) return false;
    const host = (env["ZENGIN_TELEMETRY_HOST"] || DEFAULT_HOST).replace(/\/+$/, "");
    const res = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, ...built.body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    // Offline, blocked by a firewall, or slow: the tool carries on exactly as if telemetry were off.
    return false;
  }
}

/** The version in the package.json one directory above a module: dist/index.js and src/index.ts alike. */
export function versionOf(moduleUrl: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(moduleUrl)), "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
