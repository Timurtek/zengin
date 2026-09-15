import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  createEngine,
  loadConfigFile,
  readProjectFiles,
  renderSummary,
  renderViolations,
  resolveConfig,
  summarize,
  type Engine,
  type Severity,
  type Violation,
} from "@zenginui/engine";

/** The subset of the Claude Code PostToolUse payload the hook reads. */
export interface HookInput {
  hook_event_name?: string;
  tool_name?: string;
  cwd?: string;
  tool_input?: {
    file_path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    edits?: { old_string?: string; new_string?: string }[];
  };
}

export interface HookOptions {
  /** Explicit config path. Otherwise the nearest zengin.config.yaml above the written file. */
  config?: string;
  /** Severity at or above which the hook blocks (exit 2). `never` always exits 0 and reports as context. */
  blockOn: Severity | "never";
  /** `changed` reports only violations on lines an Edit touched; `file` reports the whole file. Write always reports the whole file. */
  scope: "changed" | "file";
  /** Maximum violations rendered. */
  max: number;
}

export const DEFAULT_OPTIONS: HookOptions = { blockOn: "error", scope: "changed", max: 50 };

export interface HookResult {
  exitCode: 0 | 2;
  stdout: string;
  stderr: string;
  /** Why the hook did nothing, for tests and debugging. */
  skipped?: string;
  violations: Violation[];
  /** Violations in the file that were outside the changed lines and therefore not reported. */
  preexisting: number;
}

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
/**
 * Tools that change files without saying which, so the payload carries no path to check.
 *
 * The matcher in a project's settings is a *tool* filter, and for a long time this hook only ever saw the
 * three file-writing tools. An agent told to use `sed` for small edits — a common instruction — left the
 * enforcement loop entirely and silently: in one measured session six edits out of sixteen went around it,
 * two of them inside the checked scope. The loop was only ever as wide as a list of tool names.
 */
const SHELL_TOOLS = new Set(["Bash", "BashOutput"]);
const CONFIG_NAMES = ["zengin.config.yaml", "zengin.config.yml"];
const SEVERITY_RANK: Record<Severity, number> = { error: 3, warn: 2, info: 1 };

function skip(reason: string): HookResult {
  return { exitCode: 0, stdout: "", stderr: "", skipped: reason, violations: [], preexisting: 0 };
}

/** Nearest config walking up from `startDir`. */
export function findConfigFrom(startDir: string): string | undefined {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const p = join(dir, name);
      if (existsSync(p)) return p;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** 1-based line spans of every occurrence of `needle` in `content`. */
export function lineSpansOf(content: string, needle: string): { start: number; end: number }[] {
  if (!needle) return [];
  const spans: { start: number; end: number }[] = [];
  let from = 0;
  for (;;) {
    const idx = content.indexOf(needle, from);
    if (idx === -1) break;
    const start = content.slice(0, idx).split("\n").length;
    const end = start + needle.split("\n").length - 1;
    spans.push({ start, end });
    from = idx + needle.length;
  }
  return spans;
}

/** Lines the tool call touched, or undefined when the whole file should count. */
function changedLines(input: HookInput, content: string): { start: number; end: number }[] | undefined {
  const t = input.tool_input ?? {};
  if (input.tool_name === "Edit") return lineSpansOf(content, t.new_string ?? "");
  if (input.tool_name === "MultiEdit") return (t.edits ?? []).flatMap((e) => lineSpansOf(content, e.new_string ?? ""));
  return undefined;
}

function overlaps(v: Violation, spans: { start: number; end: number }[]): boolean {
  return spans.some((s) => v.range.start.line <= s.end && v.range.end.line >= s.start);
}

/** Engines by config path, so a long-lived process (tests) does not rebuild per call. */
const engines = new Map<string, Promise<Engine>>();

async function engineFor(configPath: string): Promise<{ engine: Engine; projectDir: string }> {
  const { config, dir } = loadConfigFile(configPath);
  const resolved = resolveConfig(config, dir);
  let pending = engines.get(configPath);
  if (!pending) {
    pending = createEngine(resolved).then((e) => {
      const css = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude).filter((f) => /\.css$/.test(f.path));
      e.loadStylesheets(css);
      return e;
    });
    engines.set(configPath, pending);
  }
  return { engine: await pending, projectDir: dir };
}

export async function runHook(input: HookInput, opts: HookOptions = DEFAULT_OPTIONS): Promise<HookResult> {
  if (input.hook_event_name && input.hook_event_name !== "PostToolUse") return skip(`event ${input.hook_event_name}`);
  if (input.tool_name && SHELL_TOOLS.has(input.tool_name)) return runShellHook(input, opts);
  if (!input.tool_name || !WRITE_TOOLS.has(input.tool_name)) return skip(`tool ${input.tool_name ?? "unknown"}`);

  const rawPath = input.tool_input?.file_path;
  if (!rawPath) return skip("no file_path");
  const filePath = isAbsolute(rawPath) ? rawPath : resolve(input.cwd ?? process.cwd(), rawPath);
  if (!/\.(tsx|jsx|ts|js|css)$/.test(filePath)) return skip("not a checked file type");

  const configPath = opts.config ? resolve(opts.config) : findConfigFrom(dirname(filePath));
  if (!configPath) return skip("no zengin.config.yaml above the file");
  if (!existsSync(filePath)) return skip("file does not exist after the write");

  const { engine, projectDir } = await engineFor(configPath);
  const rel = relative(projectDir, filePath).replace(/\\/g, "/");
  if (rel.startsWith("..")) return skip("file is outside the project");

  const content = readFileSync(filePath, "utf8");
  const file = { path: rel, content };
  if (engine.kindOf(file) === "excluded") return skip("excluded by scope");

  const all = engine.checkFile(file);
  const spans = opts.scope === "changed" ? changedLines(input, content) : undefined;
  const violations = spans ? all.filter((v) => overlaps(v, spans)) : all;
  const preexisting = all.length - violations.length;
  if (violations.length === 0) return { exitCode: 0, stdout: "", stderr: "", violations, preexisting };

  const shown = violations.slice(0, opts.max);
  const summary = summarize(violations);
  const heading = `zengin: ${rel} ${renderSummary(summary)}${shown.length < violations.length ? ` (showing first ${shown.length})` : ""}`;
  const body =
    renderViolations(shown, heading) +
    (preexisting > 0 ? `\n\n${preexisting} pre-existing violation${preexisting === 1 ? "" : "s"} elsewhere in this file were not reported; only the lines you changed are shown.` : "") +
    "\n\nApply `exact` fixes as given. For `nearest` fixes, read the note and choose. Do not suppress a violation without a reason the design system owner would accept.";

  const worst = Math.max(...violations.map((v) => SEVERITY_RANK[v.severity]));
  const block = opts.blockOn !== "never" && worst >= SEVERITY_RANK[opts.blockOn];
  if (block) return { exitCode: 2, stdout: "", stderr: body, violations, preexisting };

  const json = { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: body } };
  return { exitCode: 0, stdout: JSON.stringify(json), stderr: "", violations, preexisting };
}

/**
 * A shell command says nothing about what it touched, so the working tree is asked instead: what changed,
 * and changed since the last time this hook looked.
 *
 * Git answers the first question exactly and cheaply. The timestamp answers the second, and is what keeps a
 * project with pre-existing uncommitted work from being reported on every shell command — only files touched
 * since the last run are checked. In a project that is not a repository there is nothing to ask, and the hook
 * says so rather than pretending to have looked.
 */
async function runShellHook(input: HookInput, opts: HookOptions): Promise<HookResult> {
  const cwd = input.cwd ?? process.cwd();
  const configPath = opts.config ? resolve(opts.config) : findConfigFrom(cwd);
  if (!configPath) return skip("no zengin.config.yaml above the working directory");

  const { engine, projectDir } = await engineFor(configPath);
  const seen = readSeen(projectDir);
  const changed = changedFiles(projectDir);
  if (changed === undefined) return skip("not a git repository, so a shell edit cannot be detected");

  const files: { path: string; content: string }[] = [];
  const now: Record<string, string> = {};
  for (const rel of changed) {
    if (!CHECKED_FILE.test(rel)) continue;
    const abs = join(projectDir, rel);
    if (!existsSync(abs)) continue; // deleted, or renamed away
    const content = readFileSync(abs, "utf8");
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    now[rel] = hash;
    if (seen[rel] === hash) continue; // this exact content has already been reported on
    const file = { path: rel, content };
    if (engine.kindOf(file) === "excluded") continue;
    files.push(file);
    if (files.length >= MAX_SHELL_FILES) break;
  }
  writeSeen(projectDir, now);
  if (!files.length) return skip("no checked file changed in the working tree since the last run");

  const violations = files.flatMap((f) => engine.checkFile(f));
  if (!violations.length) return { exitCode: 0, stdout: "", stderr: "", violations, preexisting: 0 };

  const shown = violations.slice(0, opts.max);
  const heading = `zengin: ${files.length} file${files.length === 1 ? "" : "s"} changed by the shell, ${renderSummary(summarize(violations))}`;
  const body =
    renderViolations(shown, heading) +
    "\n\nThese were edited outside the editing tools, so they are checked as whole files rather than by the lines you changed." +
    "\n\nApply `exact` fixes as given. For `nearest` fixes, read the note and choose. Do not suppress a violation without a reason the design system owner would accept.";

  const worst = Math.max(...violations.map((v) => SEVERITY_RANK[v.severity]));
  if (opts.blockOn !== "never" && worst >= SEVERITY_RANK[opts.blockOn]) return { exitCode: 2, stdout: "", stderr: body, violations, preexisting: 0 };
  return { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: body } }), stderr: "", violations, preexisting: 0 };
}

const CHECKED_FILE = /\.(tsx|jsx|ts|js|css)$/;
const MAX_SHELL_FILES = 25;
const STATE = join("node_modules", ".cache", "zengin", "hook.json");

/**
 * Tracked files that differ from HEAD plus untracked ones, as paths relative to the project.
 *
 * `git status --porcelain` reports relative to the repository root, not to where it was run, and a project
 * is often a directory inside a larger repository — which is the case this hook exists to serve. Resolving
 * against the root and re-basing on the project is what makes the monorepo case work at all; without it
 * every path points somewhere that does not exist and the hook silently checks nothing.
 */
function changedFiles(projectDir: string): string[] | undefined {
  const git = (args: string[]): string =>
    execFileSync("git", args, { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    const root = git(["rev-parse", "--show-toplevel"]).trim();
    // -z: NUL-separated, so a path with a space or a quote needs no unescaping.
    const entries = git(["status", "--porcelain", "--untracked-files=all", "-z"]).split("\0").filter(Boolean);
    const out: string[] = [];
    for (const entry of entries) {
      const fromRoot = entry.slice(3);
      if (!fromRoot) continue;
      const rel = relative(projectDir, resolve(root, fromRoot)).replace(/\\/g, "/");
      if (rel && !rel.startsWith("..")) out.push(rel); // a change elsewhere in the repository is not this project's
    }
    return out;
  } catch {
    return undefined;
  }
}

/**
 * What each changed file looked like when this hook last saw it, by content rather than by timestamp.
 *
 * A timestamp is the obvious choice and it is wrong: two writes inside the same millisecond are
 * indistinguishable from one, and the second edit goes unchecked. Content is exact, and it is also what
 * stops a project with pre-existing uncommitted work from being reported on at every shell command.
 */
function readSeen(projectDir: string): Record<string, string> {
  try {
    return (JSON.parse(readFileSync(join(projectDir, STATE), "utf8")) as { seen?: Record<string, string> }).seen ?? {};
  } catch {
    return {};
  }
}

function writeSeen(projectDir: string, seen: Record<string, string>): void {
  try {
    const p = join(projectDir, STATE);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ seen }));
  } catch {
    // A cache that cannot be written costs a repeat report, not a wrong one.
  }
}

export function parseHookArgs(argv: string[]): HookOptions & { help: boolean; settings: boolean } {
  const out = { ...DEFAULT_OPTIONS, help: false, settings: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i];
    if (a === "--config" || a === "-c") out.config = next();
    else if (a.startsWith("--config=")) out.config = a.slice(9);
    else if (a === "--block-on") out.blockOn = next() as HookOptions["blockOn"];
    else if (a.startsWith("--block-on=")) out.blockOn = a.slice(11) as HookOptions["blockOn"];
    else if (a === "--scope") out.scope = next() as HookOptions["scope"];
    else if (a.startsWith("--scope=")) out.scope = a.slice(8) as HookOptions["scope"];
    else if (a === "--max") out.max = Number(next());
    else if (a.startsWith("--max=")) out.max = Number(a.slice(6));
    else if (a === "settings") out.settings = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  if (!["error", "warn", "info", "never"].includes(out.blockOn)) throw new Error(`--block-on must be error, warn, info or never (got ${out.blockOn})`);
  if (!["changed", "file"].includes(out.scope)) throw new Error(`--scope must be changed or file (got ${out.scope})`);
  if (!Number.isInteger(out.max) || out.max < 1) throw new Error(`--max must be a positive integer`);
  return out;
}

/** The settings.json fragment that installs the hook. */
export function settingsSnippet(): string {
  return JSON.stringify(
    {
      hooks: {
        PostToolUse: [
          {
            matcher: "Write|Edit|MultiEdit",
            hooks: [{ type: "command", command: "zengin-hook", args: [], timeout: 30, statusMessage: "Checking against the design system..." }],
          },
        ],
      },
    },
    null,
    2,
  );
}
