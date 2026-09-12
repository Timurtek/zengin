import { existsSync, readFileSync } from "node:fs";
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
} from "@zengin/engine";

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
