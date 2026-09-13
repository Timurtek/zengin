import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zengin/engine";
import { describe, expect, it } from "vitest";
import { aggregate, buildSnapshot, isRollup, isSnapshot, renderHtml, renderMarkdown, type ReportSnapshot } from "../src/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "engine", "test", "fixtures");
const NOW = new Date("2026-09-12T12:00:00Z");

function snapshot(over: Partial<ReportSnapshot> & { name: string; violations?: number; byRule?: Record<string, number> }): ReportSnapshot {
  const total = over.violations ?? 0;
  return {
    schema: "zengin-report/1",
    generatedAt: over.generatedAt ?? NOW.toISOString(),
    repo: { name: over.name, commit: "abc1234def", ref: "main" },
    system: over.system ?? { package: "@zengin/ui", version: "0.1.0" },
    filesChecked: over.filesChecked ?? 100,
    summary: { total, bySeverity: { error: total, warn: 0, info: 0 }, byRule: over.byRule ?? (total ? { "color-literal": total } : {}), byFile: {} },
    violations: [],
    inventory: over.inventory ?? { files: 100, consumerFiles: 90, ownedFiles: 2, suppressions: 1, suppressionsWithoutReason: 0, components: { Button: { uses: 40, files: 20 }, Dialog: { uses: 5, files: 5 } }, uncontracted: [] },
    suppressions: [],
    owned: [],
  };
}

describe("buildSnapshot on the engine's fixture project", () => {
  it("captures violations, suppressions, owned files and component usage", async () => {
    const { config, dir } = loadConfigFile(join(fixtures, "project", "zengin.config.yaml"));
    const resolved = resolveConfig(config, dir);
    const engine = await createEngine(resolved);
    const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
    const s = buildSnapshot({ engine, files, repo: { name: "acme/fixture", commit: "0000000" }, now: NOW });

    expect(isSnapshot(s)).toBe(true);
    expect(s.generatedAt).toBe("2026-09-12T12:00:00.000Z");
    expect(s.system).toEqual({ package: "@zengin/ui", version: "1.2.0" });
    expect(s.summary.total).toBe(21);
    expect(s.violations).toEqual([]); // counts only, by default
    // Hero.tsx carries one suppression with a reason and one without.
    expect(s.inventory.suppressions).toBe(2);
    expect(s.inventory.suppressionsWithoutReason).toBe(1);
    expect(s.suppressions.map((x) => [x.file, x.line, x.reason ?? null])).toEqual([
      ["src/marketing/Hero.tsx", 6, "hero gradient, approved in brand review 2026-09"],
      ["src/marketing/Hero.tsx", 8, null],
    ]);
    // badge.tsx is owned by path and carries a pragma with the fork version.
    expect(s.inventory.ownedFiles).toBe(1);
    expect(s.owned).toEqual([{ file: "src/components/ui/badge.tsx", component: "Badge", forkedFrom: "@zengin/ui@1.2.0" }]);
    // Button is used in RejectButton.tsx and twice in Hero.tsx.
    expect(s.inventory.components["Button"]).toEqual({ uses: 3, files: 2 });
    expect(s.inventory.uncontracted).toEqual([]);
  });

  it("keeps the violation list when asked", async () => {
    const { config, dir } = loadConfigFile(join(fixtures, "project-css", "zengin.config.yaml"));
    const resolved = resolveConfig(config, dir);
    const engine = await createEngine(resolved);
    const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
    const s = buildSnapshot({ engine, files, repo: { name: "acme/css" }, includeViolations: true });
    expect(s.violations.length).toBe(s.summary.total);
  });
});

describe("aggregate", () => {
  const snaps = [
    snapshot({ name: "acme/checkout", violations: 30, byRule: { "color-literal": 20, "component-substitution": 10 }, filesChecked: 200 }),
    snapshot({ name: "acme/admin", violations: 4, filesChecked: 50, system: { package: "@zengin/ui", version: "0.0.9" } }),
    snapshot({
      name: "acme/marketing",
      violations: 0,
      filesChecked: 40,
      inventory: { files: 40, consumerFiles: 40, ownedFiles: 0, suppressions: 3, suppressionsWithoutReason: 2, components: { Card: { uses: 7, files: 3 } }, uncontracted: ["Card"] },
    }),
  ];

  it("ranks repositories by drift, computes density, and finds the latest version", () => {
    const r = aggregate(snaps, { now: NOW });
    expect(isRollup(r)).toBe(true);
    expect(r.repos.map((x) => x.name)).toEqual(["acme/checkout", "acme/admin", "acme/marketing"]);
    expect(r.repos[0]!.density).toBe(15);
    expect(r.system.latestVersion).toBe("0.1.0");
    expect(r.system.versionsInUse).toEqual(["0.0.9", "0.1.0"]);
    expect(r.repos.find((x) => x.name === "acme/admin")!.behindLatest).toBe(true);
    expect(r.totals).toMatchObject({ repos: 3, filesChecked: 290, violations: 34, suppressions: 5, suppressionsWithoutReason: 2, ownedFiles: 4, adoptionUses: 97 });
    expect(r.totals.byRule).toEqual({ "color-literal": 24, "component-substitution": 10 });
    expect(r.totals.components).toEqual([
      ["Button", 80],
      ["Dialog", 10],
      ["Card", 7],
    ]);
  });

  it("puts what needs attention in priority order", () => {
    const r = aggregate(snaps, { now: NOW });
    expect(r.attention).toEqual([
      "acme/marketing: 2 zengin-allow comments without a reason. They suppress nothing and should be fixed or removed.",
      "acme/admin: pins 0.0.9, behind 0.1.0.",
      "acme/marketing: uses Card with no contract; the engine cannot check their props.",
      "acme/checkout carries the most drift: 30 violations across 200 files, mostly color-literal (20).",
    ]);
  });

  it("computes deltas against a previous rollup and flags rising drift first", () => {
    const previous = aggregate([snapshot({ name: "acme/checkout", violations: 20, filesChecked: 200 }), snapshot({ name: "acme/admin", violations: 9 })], { now: new Date("2026-09-05T12:00:00Z") });
    const r = aggregate(snaps, { previous, now: NOW });
    const checkout = r.repos.find((x) => x.name === "acme/checkout")!;
    expect(checkout.delta).toEqual({ violations: 10, suppressions: 0, adoptionUses: 0 });
    expect(r.repos.find((x) => x.name === "acme/admin")!.delta!.violations).toBe(-5);
    expect(r.repos.find((x) => x.name === "acme/marketing")!.delta).toBeUndefined();
    expect(r.attention[0]).toBe("acme/checkout: violations up by 10 since the previous run (30 now).");
    expect(r.previousGeneratedAt).toBe("2026-09-05T12:00:00.000Z");
  });

  it("refuses to mix systems", () => {
    expect(() => aggregate([snaps[0]!, snapshot({ name: "x", system: { package: "@other/ui", version: "1.0.0" } })])).toThrow(/same system/);
  });
});

describe("renderers", () => {
  const r = aggregate(
    [snapshot({ name: "acme/checkout", violations: 30, filesChecked: 200 }), snapshot({ name: "acme/admin", violations: 4, filesChecked: 50, system: { package: "@zengin/ui", version: "0.0.9" } })],
    { now: NOW },
  );

  it("markdown has the repository table, the rule table, and the attention list", () => {
    const md = renderMarkdown(r);
    expect(md).toContain("# @zengin/ui across 2 repositories");
    expect(md).toContain("| acme/checkout | 0.1.0 | 200 | 30 | 15 | 1 | 2 | 45 uses, 2 components |");
    expect(md).toContain("| acme/admin | 0.0.9 behind | 50 | 4 | 8 | 1 | 2 | 45 uses, 2 components |");
    expect(md).toContain("| color-literal | 34 |");
    expect(md).toContain("## Needs attention");
    expect(md).toContain("- acme/admin: pins 0.0.9, behind 0.1.0.");
  });

  it("html is self-contained and escapes content", () => {
    const html = renderHtml(aggregate([snapshot({ name: "acme/<script>", violations: 1 })], { now: NOW }));
    expect(html).toContain("<!doctype html>");
    expect(html).not.toContain("<script");
    expect(html).toContain("acme/&lt;script&gt;");
    expect(html).not.toMatch(/src=|href=/);
    expect(html).toContain("prefers-color-scheme: dark");
  });
});

describe("history", () => {
  const runs = [
    snapshot({ name: "acme/checkout", violations: 30, generatedAt: "2026-09-01T00:00:00.000Z" }),
    snapshot({ name: "acme/admin", violations: 4, generatedAt: "2026-09-01T06:00:00.000Z" }),
    snapshot({ name: "acme/checkout", violations: 28, generatedAt: "2026-09-08T00:00:00.000Z" }),
    snapshot({ name: "acme/checkout", violations: 19, generatedAt: "2026-09-12T00:00:00.000Z" }),
  ];

  it("takes the newest snapshot per repository as the row and the one before as the delta", () => {
    const r = aggregate(runs, { now: NOW });
    expect(r.repos.map((x) => [x.name, x.violations, x.delta?.violations])).toEqual([
      ["acme/checkout", 19, -9],
      ["acme/admin", 4, undefined],
    ]);
    expect(r.previousGeneratedAt).toBe("2026-09-08T00:00:00.000Z");
    expect(r.history.repos["acme/checkout"]!.map((p) => p.violations)).toEqual([30, 28, 19]);
  });

  it("sums totals as of each moment, carrying each repository's newest run forward", () => {
    const r = aggregate(runs, { now: NOW });
    expect(r.history.totals.map((p) => [p.at.slice(0, 10), p.violations])).toEqual([
      ["2026-09-01", 30],
      ["2026-09-01", 34],
      ["2026-09-08", 32],
      ["2026-09-12", 23],
    ]);
    expect(r.history.totals.at(-1)!.adoptionUses).toBe(90);
  });

  it("a previous rollup still wins over the prior snapshot for deltas", () => {
    const previous = aggregate([snapshot({ name: "acme/checkout", violations: 10 })], { now: NOW });
    const r = aggregate(runs, { previous, now: NOW });
    expect(r.repos[0]!.delta?.violations).toBe(9);
    expect(r.attention[0]).toMatch(/up by 9 since the previous run/);
  });

  it("renders trends in html and markdown only when a repository has more than one run", () => {
    const r = aggregate(runs, { now: NOW });
    const html = renderHtml(r);
    expect(html).toContain("Over time");
    expect(html).toContain('class="spark"');
    expect(html).toContain("3 runs");
    expect(html).toContain('aria-label="Violations over time, 4 moments, from 30 to 23"');
    const md = renderMarkdown(r);
    expect(md).toContain("| Trend |");
    expect(md).toContain("| 30 → 28 → 19 |");
    expect(md).toContain("violations 30 to 23");

    const single = aggregate([runs[0]!, runs[1]!], { now: NOW });
    expect(renderHtml(single)).not.toContain("Over time");
    expect(renderMarkdown(single)).not.toContain("| Trend |");
  });
});
