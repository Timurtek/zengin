import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zengin/engine";
import { aggregate, buildSnapshot, isRollup, isSnapshot, renderHtml, renderMarkdown, type ReportSnapshot, type RollupResult } from "@zengin/rollup";
import { findConfig } from "./check.js";

export interface ReportOptions {
  config?: string;
  cwd: string;
  /** Repository name for the snapshot. Default: the git remote's repo name, else the directory name. */
  repo?: string;
  includeViolations: boolean;
}

/** One repository, one point in time: the check plus the inventory, as JSON for the rollup. */
export async function runReport(opts: ReportOptions): Promise<ReportSnapshot> {
  const configPath = findConfig(opts.config, opts.cwd);
  const { config, dir } = loadConfigFile(configPath);
  const resolved = resolveConfig(config, dir);
  const engine = await createEngine(resolved);
  const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
  return buildSnapshot({ engine, files, repo: repoInfo(dir, opts.repo), includeViolations: opts.includeViolations });
}

/** Name, ref and commit from git when available. Never fails: a snapshot without git metadata is still a snapshot. */
export function repoInfo(dir: string, nameOverride?: string): ReportSnapshot["repo"] {
  const git = (args: string[]): string | undefined => {
    try {
      return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
    } catch {
      return undefined;
    }
  };
  const remote = git(["remote", "get-url", "origin"]);
  const fromRemote = remote ? /([^/:]+\/[^/]+?)(?:\.git)?$/.exec(remote)?.[1] : undefined;
  const name = nameOverride ?? fromRemote ?? basename(dir);
  const commit = git(["rev-parse", "HEAD"]);
  const ref = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  return { name, ...(ref && ref !== "HEAD" ? { ref } : {}), ...(commit ? { commit } : {}) };
}

export interface RollupOptions {
  cwd: string;
  /** Snapshot files written by `zengin report`. */
  snapshots: string[];
  /** A previous rollup JSON to compute deltas against. */
  previous?: string;
}

export function runRollup(opts: RollupOptions): RollupResult {
  if (opts.snapshots.length === 0) throw new Error("zengin rollup needs at least one snapshot file written by `zengin report`.");
  const snapshots = opts.snapshots.map((p) => {
    const abs = resolve(opts.cwd, p);
    const json = JSON.parse(readFileSync(abs, "utf8")) as unknown;
    if (!isSnapshot(json)) throw new Error(`${p} is not a zengin report snapshot (expected schema zengin-report/1).`);
    return json;
  });
  let previous: RollupResult | undefined;
  if (opts.previous) {
    const json = JSON.parse(readFileSync(resolve(opts.cwd, opts.previous), "utf8")) as unknown;
    if (!isRollup(json)) throw new Error(`${opts.previous} is not a zengin rollup (expected schema zengin-rollup/1).`);
    previous = json;
  }
  return aggregate(snapshots, { previous });
}

export function renderRollup(r: RollupResult, format: "markdown" | "json" | "html"): string {
  if (format === "json") return JSON.stringify(r, null, 2);
  if (format === "html") return renderHtml(r);
  return renderMarkdown(r);
}
