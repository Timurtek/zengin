import type { ReportSnapshot } from "./snapshot.js";

/**
 * Trends come from keeping every snapshot. A repository that reports on each push to main leaves one
 * file per run; the rollup reads them all, takes the newest per repository as the current state, the one
 * before it as the previous, and the whole series as the trend. No collector, no database: a directory.
 */

/** One repository at one moment, reduced to what a chart draws. */
export interface HistoryPoint {
  at: string;
  commit?: string;
  version: string;
  filesChecked: number;
  violations: number;
  /** Violations per 100 files. */
  density: number;
  suppressions: number;
  adoptionUses: number;
}

export interface History {
  /** Repository name -> its runs, oldest first. */
  repos: Record<string, HistoryPoint[]>;
  /** The system as a whole at each moment any repository reported: every repository's newest run as of that moment, summed. */
  totals: HistoryPoint[];
}

export function pointOf(s: ReportSnapshot): HistoryPoint {
  return {
    at: s.generatedAt,
    ...(s.repo.commit ? { commit: s.repo.commit } : {}),
    version: s.system.version,
    filesChecked: s.filesChecked,
    violations: s.summary.total,
    density: s.filesChecked ? Math.round((s.summary.total / s.filesChecked) * 1000) / 10 : 0,
    suppressions: s.inventory.suppressions,
    adoptionUses: Object.values(s.inventory.components).reduce((n, c) => n + c.uses, 0),
  };
}

/** Snapshots by repository name, each list oldest first. Two snapshots at the same instant keep their input order. */
export function groupByRepo(snapshots: ReportSnapshot[]): Map<string, ReportSnapshot[]> {
  const groups = new Map<string, ReportSnapshot[]>();
  for (const s of snapshots) {
    const list = groups.get(s.repo.name) ?? [];
    list.push(s);
    groups.set(s.repo.name, list);
  }
  for (const list of groups.values()) list.sort((a, b) => (a.generatedAt < b.generatedAt ? -1 : a.generatedAt > b.generatedAt ? 1 : 0));
  return groups;
}

export function buildHistory(groups: Map<string, ReportSnapshot[]>): History {
  const repos: Record<string, HistoryPoint[]> = {};
  for (const [name, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) repos[name] = list.map(pointOf);

  // As-of totals: at every moment something was reported, sum each repository's newest point at or before it.
  const moments = [...new Set(Object.values(repos).flat().map((p) => p.at))].sort();
  const totals: HistoryPoint[] = moments.map((at) => {
    const current = Object.values(repos)
      .map((points) => points.filter((p) => p.at <= at).at(-1))
      .filter((p): p is HistoryPoint => p !== undefined);
    const filesChecked = current.reduce((n, p) => n + p.filesChecked, 0);
    const violations = current.reduce((n, p) => n + p.violations, 0);
    const versions = [...new Set(current.map((p) => p.version))].sort();
    return {
      at,
      version: versions.at(-1) ?? "",
      filesChecked,
      violations,
      density: filesChecked ? Math.round((violations / filesChecked) * 1000) / 10 : 0,
      suppressions: current.reduce((n, p) => n + p.suppressions, 0),
      adoptionUses: current.reduce((n, p) => n + p.adoptionUses, 0),
    };
  });
  return { repos, totals };
}

/** `30 → 28 → 19`, the last few values of a series, for a table cell or a sentence. */
export function trendText(values: number[], last = 5): string {
  return values.slice(-last).join(" → ");
}
