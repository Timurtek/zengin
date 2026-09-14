import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readOwnedPragma } from "@zenginui/engine";
import { kebab } from "./build.js";
import { contentHash, mergeManifest, stripPragma, withPragma } from "./install.js";
import type { RegistrySource } from "./load.js";
import { addTokens, tokenDrift, type TokenDrift } from "./definitions.js";
import { LAYOUT, type RegistryItem } from "./schema.js";

/**
 * What changed upstream since a project copied its components, and whether the project changed them too.
 * Every owned file carries the hash of what was copied. Comparing that hash with the file as it is now says
 * whether the project edited it; comparing it with the registry's current file says whether the system
 * moved. Four answers per file, and only one of them needs a person: both sides changed.
 */

export type UpgradeState =
  /** The file is what the registry ships. */
  | "current"
  /** Upstream changed, the project did not: safe to take. */
  | "upstream"
  /** The project changed it, upstream did not: nothing to do. */
  | "local"
  /** Both changed: a person merges, or --force takes upstream. */
  | "conflict"
  /** No hash in the pragma (copied before hashes) and the contents differ: cannot tell which side moved. */
  | "unknown"
  /** The registry no longer ships this file. */
  | "gone";

export interface UpgradeEntry {
  /** Project-relative path. */
  path: string;
  /** Registry item the file belongs to. */
  item: string;
  state: UpgradeState;
  /** The version the file was copied from, when the pragma says. */
  from?: string;
  /** Local against upstream, for a conflict or an unknown. */
  diff?: string;
}

export interface UpgradePlan {
  /** The version the project pins in zengin.config.yaml. */
  projectVersion: string | undefined;
  /** The registry's version. */
  version: string;
  entries: UpgradeEntry[];
  /** Registry items the project has files for. */
  items: string[];
  /**
   * The definitions, compared token by token rather than file by file. `zengin/tokens.json` carries no
   * pragma — JSON has no comments — so it was outside this plan entirely, and a project a release behind on
   * its tokens was told everything was current. A component added later can read a token family added later,
   * which is how a project ends up failing its own gate straight after a clean upgrade.
   */
  tokens: TokenDrift;
}

export interface ApplyResult {
  written: string[];
  skipped: UpgradeEntry[];
  /** True when zengin.config.yaml's system.version was moved to the registry's. */
  versionBumped: boolean;
}

/** Owned files under src/components/ui and the libs under src/lib, mapped to the registry items that ship them. */
export async function planUpgrade(opts: { projectDir: string; source: RegistrySource; only?: string[] }): Promise<UpgradePlan> {
  const dir = resolve(opts.projectDir);
  const configPath = join(dir, "zengin.config.yaml");
  if (!existsSync(configPath)) throw new Error(`${dir} has no zengin.config.yaml. Run zengin upgrade inside a project made by zengin create, or pass --dir.`);
  const projectVersion = /^\s*version:\s*"?([^"\s#]+)"?/m.exec(readFileSync(configPath, "utf8"))?.[1];
  const index = await opts.source.index();
  const only = opts.only?.map((n) => n.replace(/^lib-/, ""));

  // Which items to look at: every component item with a directory in the project, every lib item with a file.
  const wanted = index.items.filter((i) => {
    if (i.type === "component") return existsSync(join(dir, LAYOUT.componentsDir, i.name)) && (!only || only.includes(i.name));
    if (i.type === "lib") return existsSync(join(dir, LAYOUT.libDir)) && (!only || only.includes(i.name.replace(/^lib-/, "")));
    return false;
  });

  const entries: UpgradeEntry[] = [];
  const items: string[] = [];
  for (const summary of wanted) {
    const item: RegistryItem = await opts.source.item(summary.name);
    let touched = false;
    for (const f of item.files) {
      if (f.kind === "story") continue; // the project's from the start
      const abs = join(dir, f.path);
      if (!existsSync(abs)) continue;
      touched = true;
      entries.push(compare(f.path, readFileSync(abs, "utf8"), f.content, item));
    }
    if (touched) items.push(item.name);
  }
  // Files with a pragma whose item the registry no longer has.
  for (const p of walk(join(dir, LAYOUT.componentsDir))) {
    const rel = relative(dir, p).replace(/\\/g, "/");
    if (entries.some((e) => e.path === rel)) continue;
    const pragma = readOwnedPragma(readFileSync(p, "utf8"));
    if (!pragma?.component) continue;
    const name = kebab(pragma.component);
    if (only && !only.includes(name)) continue;
    if (!index.items.some((i) => i.name === name)) entries.push({ path: rel, item: name, state: "gone", ...(pragma.forkedFrom ? { from: pragma.forkedFrom } : {}) });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));

  // Token drift is read from the registry's foundation, which is where a project's definitions came from.
  let tokens: TokenDrift = { missing: [], yours: [] };
  if (index.items.some((i) => i.name === "foundation")) {
    const foundation = await opts.source.item("foundation");
    const upstream = foundation.files.find((f) => f.path === `${LAYOUT.definitionsDir}/tokens.json`);
    if (upstream) tokens = tokenDrift(join(dir, LAYOUT.definitionsDir), JSON.parse(upstream.content));
  }
  return { projectVersion, version: index.version, entries, items, tokens };
}

function compare(path: string, local: string, upstreamRaw: string, item: RegistryItem): UpgradeEntry {
  const pragma = readOwnedPragma(local);
  const localBody = stripPragma(local);
  const upstream = stripPragma(upstreamRaw);
  const from = pragma?.forkedFrom;
  const base: UpgradeEntry = { path, item: item.name, state: "current", ...(from ? { from } : {}) };
  if (localBody === upstream) return base;
  if (!pragma?.sha) return { ...base, state: "unknown", diff: diffLines(localBody, upstream) };
  const localChanged = contentHash(localBody) !== pragma.sha;
  const upstreamChanged = contentHash(upstream) !== pragma.sha;
  if (upstreamChanged && !localChanged) return { ...base, state: "upstream" };
  if (localChanged && !upstreamChanged) return { ...base, state: "local" };
  return { ...base, state: "conflict", diff: diffLines(localBody, upstream) };
}

/** Takes upstream for every `upstream` entry, and for `conflict`/`unknown` entries only with `force`. Bumps the pinned version when nothing is left behind. */
export async function applyUpgrade(plan: UpgradePlan, opts: { projectDir: string; source: RegistrySource; force?: boolean }): Promise<ApplyResult> {
  const dir = resolve(opts.projectDir);
  const written: string[] = [];
  const skipped: UpgradeEntry[] = [];
  const byItem = new Map<string, RegistryItem>();
  const load = async (name: string) => byItem.get(name) ?? (byItem.set(name, await opts.source.item(name)), byItem.get(name)!);

  for (const e of plan.entries) {
    const take = e.state === "upstream" || ((e.state === "conflict" || e.state === "unknown") && opts.force);
    if (!take) {
      if (e.state === "conflict" || e.state === "unknown") skipped.push(e);
      continue;
    }
    const item = await load(e.item);
    const f = item.files.find((x) => x.path === e.path)!;
    const owned = item.manifest && (f.kind === "component" || (f.kind === "style" && f.path.startsWith(LAYOUT.componentsDir)));
    writeFileSync(join(dir, e.path), owned ? withPragma(f.content, item.manifest!.name, plan.version) : f.content);
    written.push(e.path);
    if (item.manifest && f.kind === "component") mergeManifest(dir, { ...item.manifest, export: item.type === "component" ? { ...item.manifest.export, from: LAYOUT.alias } : item.manifest.export });
  }

  // The tokens the registry has and this project does not. Additive only: a value the project changed is its
  // brand, and `yours` is reported rather than taken.
  if (plan.tokens.missing.length) {
    const foundation = await load("foundation");
    const upstream = foundation.files.find((f) => f.path === `${LAYOUT.definitionsDir}/tokens.json`);
    if (upstream) {
      const added = addTokens(join(dir, LAYOUT.definitionsDir), JSON.parse(upstream.content), plan.tokens.missing.map((t) => t.path));
      if (added) written.push(`${LAYOUT.definitionsDir}/tokens.json`);
    }
  }

  // Files the project edited but upstream did not keep their old pragma; they are current by choice. Only a
  // conflict or an unknown left behind means the project is not on the registry's version yet.
  let versionBumped = false;
  if (skipped.length === 0 && plan.projectVersion !== plan.version) {
    const p = join(dir, "zengin.config.yaml");
    const before = readFileSync(p, "utf8");
    const after = before.replace(/^(\s*version:\s*)"?[^"\s#]+"?/m, `$1"${plan.version}"`);
    if (after !== before) {
      writeFileSync(p, after);
      versionBumped = true;
    }
  }
  return { written, skipped, versionBumped };
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** A unified-style diff, local against upstream, three lines of context. Enough to decide; a merge tool does the rest. */
export function diffLines(local: string, upstream: string, context = 3): string {
  const a = local.split("\n");
  const b = upstream.split("\n");
  // Longest common subsequence by dynamic programming; component files are a few hundred lines.
  const n = a.length;
  const m = b.length;
  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  type Op = { t: " " | "-" | "+"; s: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push({ t: " ", s: a[i]! }), i++, j++;
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) ops.push({ t: "-", s: a[i]! }), i++;
    else ops.push({ t: "+", s: b[j]! }), j++;
  }
  while (i < n) ops.push({ t: "-", s: a[i++]! });
  while (j < m) ops.push({ t: "+", s: b[j++]! });

  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((op, k) => {
    if (op.t === " ") return;
    for (let c = Math.max(0, k - context); c <= Math.min(ops.length - 1, k + context); c++) keep[c] = true;
  });
  const lines = ["--- local", "+++ upstream"];
  let gap = false;
  ops.forEach((op, k) => {
    if (!keep[k]) {
      gap = true;
      return;
    }
    if (gap) lines.push("@@");
    gap = false;
    lines.push(`${op.t}${op.s}`);
  });
  return lines.join("\n");
}
