import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  createEngine,
  loadConfigFile,
  readProjectFiles,
  resolveConfig,
  summarize,
  type FileInput,
  type ResolvedConfig,
  type RuleId,
  type Severity,
  type Summary,
  type Violation,
} from "@zenginui/engine";
import { changedFiles, stagedFiles } from "./git.js";

export type Format = "pretty" | "json" | "github";

export interface CheckOptions {
  /** Explicit config path. Otherwise the nearest zengin.config.yaml walking up from cwd. */
  config?: string;
  cwd: string;
  /** Project-relative or absolute paths. Empty means the whole scope. */
  paths: string[];
  /** Only files changed relative to this git ref. */
  changed?: string;
  /** Only files staged in git. */
  staged: boolean;
  rules?: RuleId[];
  severity?: Severity;
  /** Lowest severity that makes the exit code non-zero. */
  failOn: Severity | "never";
  format: Format;
  /** Maximum violations rendered in pretty output. */
  max: number;
}

export const DEFAULT_CHECK: Omit<CheckOptions, "cwd"> = { paths: [], staged: false, failOn: "error", format: "pretty", max: 200 };

export interface CheckResult {
  projectDir: string;
  configPath: string;
  system: { package: string; version: string };
  filesChecked: number;
  violations: Violation[];
  summary: Summary;
  /** 0 clean or below fail-on, 1 violations at or above fail-on. Usage and config errors throw. */
  exitCode: 0 | 1;
}

const CONFIG_NAMES = ["zengin.config.yaml", "zengin.config.yml"];
const RANK: Record<Severity, number> = { error: 3, warn: 2, info: 1 };

export function findConfig(explicit: string | undefined, startDir: string): string {
  if (explicit) {
    const p = resolve(startDir, explicit);
    if (!existsSync(p)) throw new Error(`Config not found at ${p}.`);
    return p;
  }
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const p = join(dir, name);
      if (existsSync(p)) return p;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`No zengin.config.yaml found in ${startDir} or any parent. Run \`zengin init\` to create one, or pass --config.`);
}

function selectFiles(opts: CheckOptions, projectDir: string, config: ResolvedConfig): FileInput[] {
  const inScope = readProjectFiles(projectDir, config.scope.include, config.scope.exclude);
  const byPath = new Map(inScope.map((f) => [f.path, f]));
  const toRel = (p: string) => relative(projectDir, isAbsolute(p) ? p : resolve(opts.cwd, p)).replace(/\\/g, "/");

  let wanted: string[] | undefined;
  if (opts.staged) wanted = stagedFiles(projectDir);
  else if (opts.changed !== undefined) wanted = changedFiles(projectDir, opts.changed);
  if (wanted) {
    const explicit = opts.paths.map(toRel);
    return wanted
      .filter((p) => byPath.has(p) && (explicit.length === 0 || explicit.some((e) => p === e || p.startsWith(e + "/"))))
      .map((p) => byPath.get(p)!);
  }
  if (opts.paths.length === 0) return inScope;

  const out: FileInput[] = [];
  for (const raw of opts.paths) {
    const rel = toRel(raw);
    const abs = join(projectDir, rel);
    if (!existsSync(abs)) throw new Error(`Path not found: ${raw}`);
    const hit = byPath.get(rel);
    if (hit) {
      out.push(hit);
      continue;
    }
    // A directory: every in-scope file under it. A file outside scope: nothing, by design.
    for (const f of inScope) if (f.path.startsWith(rel + "/")) out.push(f);
  }
  return out;
}

export async function runCheck(opts: CheckOptions): Promise<CheckResult> {
  const configPath = findConfig(opts.config, opts.cwd);
  const { config, dir } = loadConfigFile(configPath);
  const resolved = resolveConfig(config, dir);
  const engine = await createEngine(resolved);

  const files = selectFiles(opts, dir, resolved);
  // Stylesheets outside the selection still resolve class names for the files in it.
  engine.loadStylesheets(readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude).filter((f) => /\.css$/.test(f.path)));

  let violations = engine.check(files);
  if (opts.rules) violations = violations.filter((v) => opts.rules!.includes(v.rule));
  if (opts.severity) violations = violations.filter((v) => v.severity === opts.severity);

  const failing = opts.failOn !== "never" && violations.some((v) => RANK[v.severity] >= RANK[opts.failOn as Severity]);
  return {
    projectDir: dir,
    configPath,
    system: { package: resolved.system.package, version: resolved.system.version },
    filesChecked: files.length,
    violations,
    summary: summarize(violations),
    exitCode: failing ? 1 : 0,
  };
}

/** Reads a file for callers that want to show source context. */
export function readSource(projectDir: string, rel: string): string | undefined {
  const p = join(projectDir, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
}
