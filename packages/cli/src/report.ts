import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zengin/engine";
import { aggregate, buildSnapshot, isRollup, isSnapshot, renderHtml, renderMarkdown, type ReportSnapshot, type RollupResult } from "@zengin/rollup";
import { findConfig } from "./check.js";

export interface ReportOptions {
  config?: string;
  cwd: string;
  /** Repository name for the snapshot. Default: the git remote's repo name, else the directory name. */
  repo?: string;
  includeViolations: boolean;
  /** The snapshot's moment, for backfilling history from older commits. Default: now. */
  at?: string;
  /** Commit and ref to record instead of git's answer, for backfills. */
  commit?: string;
  ref?: string;
}

/** One repository, one point in time: the check plus the inventory, as JSON for the rollup. */
export async function runReport(opts: ReportOptions): Promise<ReportSnapshot> {
  const configPath = findConfig(opts.config, opts.cwd);
  const { config, dir } = loadConfigFile(configPath);
  const resolved = resolveConfig(config, dir);
  const engine = await createEngine(resolved);
  const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
  const repo = repoInfo(dir, opts.repo);
  if (opts.commit) repo.commit = opts.commit;
  if (opts.ref) repo.ref = opts.ref;
  return buildSnapshot({ engine, files, repo, includeViolations: opts.includeViolations, ...(opts.at ? { now: new Date(opts.at) } : {}) });
}

/** `reports/acme-checkout/2026-09-12T06-00-00Z.json`: one file per run, named so a directory listing is a timeline. */
export function historyPath(into: string, snapshot: ReportSnapshot): string {
  const repo = snapshot.repo.name.replace(/[^A-Za-z0-9._-]+/g, "-");
  const stamp = snapshot.generatedAt.replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
  return join(into, repo, `${stamp}.json`);
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
  if (opts.snapshots.length === 0) throw new Error("zengin rollup needs at least one snapshot file written by `zengin report`, or a directory of them.");
  const files = opts.snapshots.flatMap((p) => {
    const abs = resolve(opts.cwd, p);
    return statSync(abs).isDirectory() ? walkJson(abs) : [abs];
  });
  if (files.length === 0) throw new Error(`No snapshot files under ${opts.snapshots.join(", ")}.`);
  const snapshots = files.flatMap((abs) => {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(abs, "utf8")) as unknown;
    } catch {
      json = undefined;
    }
    if (isSnapshot(json)) return [json];
    // A directory may hold the rollup's own outputs beside the snapshots; a file given by name must be one.
    if (opts.snapshots.some((p) => resolve(opts.cwd, p) === abs)) throw new Error(`${abs} is not a zengin report snapshot (expected schema zengin-report/1).`);
    return [];
  });
  if (snapshots.length === 0) throw new Error(`No zengin report snapshots found under ${opts.snapshots.join(", ")}.`);
  let previous: RollupResult | undefined;
  if (opts.previous) {
    const json = JSON.parse(readFileSync(resolve(opts.cwd, opts.previous), "utf8")) as unknown;
    if (!isRollup(json)) throw new Error(`${opts.previous} is not a zengin rollup (expected schema zengin-rollup/1).`);
    previous = json;
  }
  return aggregate(snapshots, { previous });
}

/** Every .json file under a directory, sorted, so a directory of runs reads in order. */
function walkJson(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkJson(p));
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

export function renderRollup(r: RollupResult, format: "markdown" | "json" | "html"): string {
  if (format === "json") return JSON.stringify(r, null, 2);
  if (format === "html") return renderHtml(r);
  return renderMarkdown(r);
}
