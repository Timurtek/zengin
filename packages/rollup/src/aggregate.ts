import { compareVersions, RULE_IDS, type RuleId } from "@zenginui/engine";
import { buildHistory, groupByRepo, type History } from "./history.js";
import type { ReportSnapshot } from "./snapshot.js";

/** One row per repository in the rollup. */
export interface RepoRow {
  name: string;
  commit?: string;
  ref?: string;
  generatedAt: string;
  systemVersion: string;
  behindLatest: boolean;
  filesChecked: number;
  violations: number;
  /** Violations per 100 files in scope, so repos of different sizes compare. */
  density: number;
  byRule: Partial<Record<RuleId, number>>;
  suppressions: number;
  suppressionsWithoutReason: number;
  ownedFiles: number;
  /** Total uses of system components, and how many distinct components. */
  adoption: { uses: number; components: number };
  uncontracted: string[];
  /** Change since the previous rollup, when one was given and the repo was in it. */
  delta?: { violations: number; suppressions: number; adoptionUses: number };
}

export interface RollupResult {
  schema: "zengin-rollup/1";
  generatedAt: string;
  system: { package: string; latestVersion: string; versionsInUse: string[] };
  repos: RepoRow[];
  totals: {
    repos: number;
    filesChecked: number;
    violations: number;
    suppressions: number;
    suppressionsWithoutReason: number;
    ownedFiles: number;
    adoptionUses: number;
    byRule: Partial<Record<RuleId, number>>;
    /** System component name -> uses across all repos, sorted descending. */
    components: [string, number][];
  };
  /** Things the design system owner should look at, in priority order. */
  attention: string[];
  previousGeneratedAt?: string;
  /** Every run kept, per repository and as-of totals, when the snapshots carry more than the current state. */
  history: History;
}

export interface AggregateOptions {
  previous?: RollupResult;
  now?: Date;
}

export function aggregate(all: ReportSnapshot[], opts: AggregateOptions = {}): RollupResult {
  if (all.length === 0) throw new Error("No snapshots to roll up.");
  const pkg = all[0]!.system.package;
  const mixed = all.filter((s) => s.system.package !== pkg).map((s) => `${s.repo.name} (${s.system.package})`);
  if (mixed.length) throw new Error(`All snapshots must report on the same system. ${pkg} expected; found ${mixed.join(", ")}.`);

  // Several snapshots of one repository are its history: the newest is the current state, the one before
  // it is what deltas compare against when no previous rollup is given.
  const groups = groupByRepo(all);
  const snapshots = [...groups.values()].map((list) => list.at(-1)!);
  const priorByName = new Map([...groups.entries()].filter(([, list]) => list.length > 1).map(([name, list]) => [name, list.at(-2)!]));
  const history = buildHistory(groups);

  const versions = [...new Set(snapshots.map((s) => s.system.version))].sort(compareVersions);
  const latest = versions[versions.length - 1]!;
  const prevByName = new Map((opts.previous?.repos ?? []).map((r) => [r.name, r]));

  const repos: RepoRow[] = snapshots
    .map((s) => {
      const adoptionUses = Object.values(s.inventory.components).reduce((n, c) => n + c.uses, 0);
      const prior = priorByName.get(s.repo.name);
      const prev: Pick<RepoRow, "violations" | "suppressions" | "adoption"> | undefined =
        prevByName.get(s.repo.name) ??
        (prior
          ? { violations: prior.summary.total, suppressions: prior.inventory.suppressions, adoption: { uses: Object.values(prior.inventory.components).reduce((n, c) => n + c.uses, 0), components: 0 } }
          : undefined);
      const row: RepoRow = {
        name: s.repo.name,
        ...(s.repo.commit ? { commit: s.repo.commit } : {}),
        ...(s.repo.ref ? { ref: s.repo.ref } : {}),
        generatedAt: s.generatedAt,
        systemVersion: s.system.version,
        behindLatest: compareVersions(s.system.version, latest) < 0,
        filesChecked: s.filesChecked,
        violations: s.summary.total,
        density: s.filesChecked ? Math.round((s.summary.total / s.filesChecked) * 1000) / 10 : 0,
        byRule: s.summary.byRule,
        suppressions: s.inventory.suppressions,
        suppressionsWithoutReason: s.inventory.suppressionsWithoutReason,
        ownedFiles: s.inventory.ownedFiles,
        adoption: { uses: adoptionUses, components: Object.keys(s.inventory.components).length },
        uncontracted: s.inventory.uncontracted,
      };
      if (prev) {
        row.delta = { violations: row.violations - prev.violations, suppressions: row.suppressions - prev.suppressions, adoptionUses: row.adoption.uses - prev.adoption.uses };
      }
      return row;
    })
    .sort((a, b) => b.violations - a.violations || a.name.localeCompare(b.name));

  const byRule: Partial<Record<RuleId, number>> = {};
  const components = new Map<string, number>();
  for (const s of snapshots) {
    for (const id of RULE_IDS) if (s.summary.byRule[id]) byRule[id] = (byRule[id] ?? 0) + s.summary.byRule[id]!;
    for (const [name, c] of Object.entries(s.inventory.components)) components.set(name, (components.get(name) ?? 0) + c.uses);
  }

  const totals: RollupResult["totals"] = {
    repos: repos.length,
    filesChecked: repos.reduce((n, r) => n + r.filesChecked, 0),
    violations: repos.reduce((n, r) => n + r.violations, 0),
    suppressions: repos.reduce((n, r) => n + r.suppressions, 0),
    suppressionsWithoutReason: repos.reduce((n, r) => n + r.suppressionsWithoutReason, 0),
    ownedFiles: repos.reduce((n, r) => n + r.ownedFiles, 0),
    adoptionUses: repos.reduce((n, r) => n + r.adoption.uses, 0),
    byRule,
    components: [...components.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };

  return {
    schema: "zengin-rollup/1",
    generatedAt: (opts.now ?? new Date()).toISOString(),
    system: { package: pkg, latestVersion: latest, versionsInUse: versions },
    repos,
    totals,
    attention: attentionFor(repos, latest),
    ...(opts.previous ? { previousGeneratedAt: opts.previous.generatedAt } : priorByName.size ? { previousGeneratedAt: [...priorByName.values()].map((s) => s.generatedAt).sort().at(-1)! } : {}),
    history,
  };
}

/** Deterministic, in priority order: rising drift, bypassed rules, stale versions, uncontracted use, then the worst repo. */
function attentionFor(repos: RepoRow[], latest: string): string[] {
  const out: string[] = [];
  for (const r of repos.filter((r) => r.delta && r.delta.violations > 0)) out.push(`${r.name}: violations up by ${r.delta!.violations} since the previous run (${r.violations} now).`);
  for (const r of repos.filter((r) => r.suppressionsWithoutReason > 0)) out.push(`${r.name}: ${r.suppressionsWithoutReason} zengin-allow comment${r.suppressionsWithoutReason === 1 ? "" : "s"} without a reason. They suppress nothing and should be fixed or removed.`);
  for (const r of repos.filter((r) => r.delta && r.delta.suppressions > 0)) out.push(`${r.name}: ${r.delta!.suppressions} new suppression${r.delta!.suppressions === 1 ? "" : "s"} since the previous run. Suppressions are drift with a note attached.`);
  for (const r of repos.filter((r) => r.behindLatest)) out.push(`${r.name}: pins ${r.systemVersion}, behind ${latest}.`);
  for (const r of repos.filter((r) => r.uncontracted.length)) out.push(`${r.name}: uses ${r.uncontracted.join(", ")} with no contract; the engine cannot check their props.`);
  const worst = repos.find((r) => r.violations > 0);
  if (worst) {
    const top = Object.entries(worst.byRule).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    out.push(`${worst.name} carries the most drift: ${worst.violations} violations across ${worst.filesChecked} files${top ? `, mostly ${top[0]} (${top[1]})` : ""}.`);
  }
  return out;
}

export function isRollup(x: unknown): x is RollupResult {
  return typeof x === "object" && x !== null && (x as { schema?: unknown }).schema === "zengin-rollup/1";
}
