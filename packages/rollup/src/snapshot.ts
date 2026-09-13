import type { Engine, FileInput, InventoryTotals, OwnedFile, SuppressionUse, Summary, Violation } from "@zenginui/engine";
import { summarize } from "@zenginui/engine";

/** One repository, one point in time. What `zengin report` writes and `zengin rollup` reads. */
export interface ReportSnapshot {
  schema: "zengin-report/1";
  generatedAt: string;
  repo: { name: string; ref?: string; commit?: string };
  system: { package: string; version: string };
  filesChecked: number;
  summary: Summary;
  violations: Violation[];
  inventory: InventoryTotals;
  suppressions: SuppressionUse[];
  owned: OwnedFile[];
}

export interface SnapshotOptions {
  engine: Engine;
  files: FileInput[];
  repo: { name: string; ref?: string; commit?: string };
  /** Injectable for deterministic tests. */
  now?: Date;
  /** Keep the full violation list in the snapshot. Off by default: the rollup needs counts, not ranges. */
  includeViolations?: boolean;
}

export function buildSnapshot(opts: SnapshotOptions): ReportSnapshot {
  const violations = opts.engine.check(opts.files);
  const inventory = opts.engine.inventory(opts.files);
  return {
    schema: "zengin-report/1",
    generatedAt: (opts.now ?? new Date()).toISOString(),
    repo: opts.repo,
    system: { package: opts.engine.config.system.package, version: opts.engine.config.system.version },
    filesChecked: opts.files.length,
    summary: summarize(violations),
    violations: opts.includeViolations ? violations : [],
    inventory: inventory.totals,
    suppressions: inventory.files.flatMap((f) => f.suppressions),
    owned: inventory.files.flatMap((f) => (f.owned ? [f.owned] : [])),
  };
}

export function isSnapshot(x: unknown): x is ReportSnapshot {
  return typeof x === "object" && x !== null && (x as { schema?: unknown }).schema === "zengin-report/1";
}
