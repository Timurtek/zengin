import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Violation } from "@zenginui/engine";
import { AUDIT_FILES, buildAudit, classify, renderAuditMarkdown, totals, type AuditFinding, type AuditRun } from "../src/audit.js";
import { markdownToPdf } from "../src/pdf.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "engine", "test", "fixtures");
// The built entry point, as a consultant runs it: CI builds before it tests.
const cli = join(here, "..", "dist", "index.js");

/** The plain-CSS fixture project, copied so the test can prove nothing in it is touched. */
function clientRepo(extra: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "zengin-audit-repo-"));
  cpSync(join(fixtures, "project-css"), dir, { recursive: true });
  const config = readFileSync(join(dir, "zengin.config.yaml"), "utf8").replace("definitions: ../system", `definitions: "${join(fixtures, "system").replace(/\\/g, "/")}"`);
  writeFileSync(join(dir, "zengin.config.yaml"), config);
  for (const [path, content] of Object.entries(extra)) writeFileSync(join(dir, path), content);
  return dir;
}

/** Every file under a directory with its size and modification time: the repository's state, to compare. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else out[p] = `${s.size}:${s.mtimeMs}`;
    }
  };
  walk(dir);
  return out;
}

function audit(args: string[]) {
  return spawnSync(process.execPath, [cli, "audit", ...args], { encoding: "utf8" });
}

const read = <T>(out: string, name: string) => JSON.parse(readFileSync(join(out, name), "utf8")) as T;

describe("zengin audit, through the built CLI", () => {
  let repo: string;
  let out: string;
  let before: Record<string, string>;
  let result: ReturnType<typeof audit>;

  beforeAll(() => {
    repo = clientRepo();
    out = join(mkdtempSync(join(tmpdir(), "zengin-audit-ws-")), "deliverables");
    before = snapshot(repo);
    result = audit([repo, "--out", out, "--repo", "acme/checkout"]);
  });

  it("writes the four deliverables to the given folder and nothing else anywhere", () => {
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Wrote findings\.json, run\.json, report\.md, report\.pdf .*16 findings in 15 groups, 16 queued for hand review \(cap 150\), 0 summarised, 0 confirmed/);
    expect(result.stdout).not.toMatch(/\bin hand review\b/);
    expect(readdirSync(out).sort()).toEqual([...AUDIT_FILES].sort());
    expect(snapshot(repo)).toEqual(before);
  });

  it("gives every finding file:line evidence that exists, a class and the reason for it", () => {
    const { findings } = read<{ findings: AuditFinding[] }>(out, "findings.json");
    expect(findings).toHaveLength(16);
    for (const f of findings) {
      expect(f.evidence).toBe(`${f.file}:${f.line}`);
      expect(existsSync(join(repo, f.file))).toBe(true);
      expect(readFileSync(join(repo, f.file), "utf8").split("\n").length).toBeGreaterThanOrEqual(f.line);
      expect(["true-drift", "needs-decision", "intentional-exception", "false-positive"]).toContain(f.class);
      expect(f.basis.length).toBeGreaterThan(10);
      expect(f.involves).toBeTruthy();
    }
    expect(findings.map((f) => f.id)).toEqual(findings.map((_, i) => `F${String(i + 1).padStart(3, "0")}`));
  });

  it("drafts the report in the agreed sections, every issue tied to finding ids, and records the run", () => {
    const md = readFileSync(join(out, "report.md"), "utf8");
    expect(md.split("\n")[0]).toBe("# Design System Drift Audit: acme/checkout (DRAFT)");
    const sections = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(sections).toEqual(["Summary", "Top issues", "Fix path by class", "Beyond the hand-review cap", "What the scan cannot see", "Evidence"]);
    const { findings } = read<{ findings: AuditFinding[] }>(out, "findings.json");
    for (const id of md.match(/\bF\d{3}\b/g)!) expect(findings.some((f) => f.id === id)).toBe(true);

    const run = read<AuditRun>(out, "run.json");
    expect(run.schema).toBe("zengin-audit/1");
    expect(run.repo.name).toBe("acme/checkout");
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.totals).toMatchObject({ findings: 16, queued: 16, summarised: 0, confirmed: 0 });
  });

  it("never states that an unconfirmed DRAFT has been hand-reviewed", () => {
    const md = readFileSync(join(out, "report.md"), "utf8");
    const { findings } = read<{ findings: AuditFinding[] }>(out, "findings.json");
    expect(findings.every((f) => f.confirmed === false && f.review !== ("hand" as string))).toBe(true);
    expect(md).not.toMatch(/hand review covers|hand-reviewed|reviewed by hand|validated|classified by hand/i);
    expect(md).toContain("16 findings in 15 groups are queued for hand review");
    expect(md).toContain("Confirmed by hand so far: 0 of 16.");
  });

  it("follows the services copy rules: no delivery claims, no completeness claims, only this run's numbers", () => {
    const md = readFileSync(join(out, "report.md"), "utf8");
    expect(md).not.toMatch(/deliver/i);
    expect(md).not.toMatch(/zero false positives|every place/i);
    // The field tests' totals are not reconciled for public use; a client report never quotes them.
    expect(md).not.toMatch(/\b(424|291|147)\b/);
    expect(md).toMatch(/16 \+ 0 = 16/);
  });

  it("writes a PDF a reader can open: header, objects at their xref offsets, the DRAFT marking", () => {
    const pdf = readFileSync(join(out, "report.pdf"));
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    expect(text).toMatch(/\(Design System Drift Audit: acme\/checkout \\\(DRAFT\\\)\) Tj/);
  });

  it("holds the hand-review cap at 150 and summarises the rest", () => {
    const literals = Array.from({ length: 200 }, (_, i) => `.swatch-${i} { color: #${(0x102030 + i * 7).toString(16)}; }`).join("\n");
    const big = clientRepo({ "src/features/review/swatches.css": literals + "\n" });
    const ws = join(mkdtempSync(join(tmpdir(), "zengin-audit-ws-")), "deliverables");
    const r = audit([big, "--out", ws, "--repo", "acme/swatches"]);
    expect(r.status).toBe(0);
    const run = read<AuditRun>(ws, "run.json");
    expect(run.cap).toBe(150);
    expect(run.totals.queued).toBe(150);
    expect(run.totals.summarised).toBe(run.totals.findings - 150);
    const { findings } = read<{ findings: AuditFinding[] }>(ws, "findings.json");
    expect(findings.filter((f) => f.review === "queued")).toHaveLength(150);
    const md = readFileSync(join(ws, "report.md"), "utf8");
    expect(md).toContain(`150 + ${run.totals.summarised} = ${run.totals.findings}`);
    expect(md).toMatch(/## Beyond the hand-review cap\n\n\d+ findings past the cap/);

    const capped = join(mkdtempSync(join(tmpdir(), "zengin-audit-ws-")), "deliverables");
    expect(audit([big, "--out", capped, "--cap", "20"]).status).toBe(0);
    expect(read<AuditRun>(capped, "run.json").totals.queued).toBe(20);
  });

  it("refuses without a deliverables folder or prework definitions, and writes nothing", () => {
    const noOut = audit([repo]);
    expect(noOut.status).toBe(2);
    expect(noOut.stderr).toMatch(/zengin audit needs the repository and the deliverables folder/);

    const bare = mkdtempSync(join(tmpdir(), "zengin-audit-bare-"));
    const ws = join(mkdtempSync(join(tmpdir(), "zengin-audit-ws-")), "deliverables");
    const noConfig = audit([bare, "--out", ws]);
    expect(noConfig.status).toBe(2);
    expect(noConfig.stderr).toMatch(/Derive the definitions in prework/);
    expect(existsSync(ws)).toBe(false);
  });
});

const violation = (over: Partial<Violation>): Violation => ({
  rule: "color-literal",
  severity: "error",
  file: "src/a.tsx",
  range: { start: { line: 1, col: 1 }, end: { line: 1, col: 2 } },
  found: "#123456",
  message: "Color literal where a token reference is required.",
  fix: { replace: "var(--color-primary)", confidence: "exact" },
  suppress: "",
  ...over,
});

describe("audit classification", () => {
  it("proposes each class by the field tests' rules", () => {
    expect(classify(violation({})).class).toBe("true-drift");
    expect(classify(violation({ note: "zengin-allow comment ignored: a reason is required after the colon." })).class).toBe("intentional-exception");
    expect(classify(violation({ found: "#0000" })).class).toBe("false-positive");
    expect(classify(violation({ rule: "unknown-prop", found: "render={x}", message: 'Button has no prop "render". Props: "variant".' })).class).toBe("false-positive");
    expect(classify(violation({ rule: "unknown-prop", found: 'flex-direction="column"', message: 'Column has no prop "flex-direction".' })).class).toBe("true-drift");
    expect(classify(violation({ file: "src/app/global.css" })).class).toBe("needs-decision");
    expect(classify(violation({ rule: "classname-policy", severity: "warn" })).class).toBe("needs-decision");
    expect(classify(violation({ rule: "classname-policy", severity: "error" })).class).toBe("true-drift");
    expect(classify(violation({ rule: "spacing-literal", found: "100px", fix: { replace: null, confidence: "none" } })).class).toBe("needs-decision");
  });

  it("groups one decision per rule, value and class, and ranks by severity times spread", () => {
    const { groups, findings } = buildAudit(
      [
        violation({ file: "src/b.tsx", rule: "classname-policy", severity: "warn", found: "p-4" }),
        violation({ file: "src/a.tsx" }),
        violation({ file: "src/c.tsx" }),
        violation({ file: "src/c.tsx", range: { start: { line: 9, col: 1 }, end: { line: 9, col: 2 } } }),
      ],
      150,
    );
    expect(groups.map((g) => [g.id, g.found, g.score, g.findings.length])).toEqual([
      ["G01", "#123456", 6, 3],
      ["G02", "p-4", 2, 1],
    ]);
    expect(findings.map((f) => f.evidence)).toEqual(["src/a.tsx:1", "src/c.tsx:1", "src/c.tsx:9", "src/b.tsx:1"]);
  });

  it("splits a group that crosses the cap and marks it partial", () => {
    const many = Array.from({ length: 5 }, (_, i) => violation({ file: `src/f${i}.tsx` }));
    const { groups, findings } = buildAudit(many, 3);
    expect(groups[0]!.review).toBe("partial");
    expect(findings.map((f) => f.review)).toEqual(["queued", "queued", "queued", "summarised", "summarised"]);
  });

  it("keeps a partial group's summarised findings out of the hand-review sections", () => {
    const many = Array.from({ length: 5 }, (_, i) => violation({ file: `src/f${i}.tsx` }));
    const { groups, findings } = buildAudit(many, 3);
    const run: AuditRun = {
      schema: "zengin-audit/1",
      repo: { name: "acme/split" },
      system: { package: "@acme/ds", version: "1.0.0" },
      tool: { name: "@zenginui/cli", version: "0.0.0" },
      generatedAt: "2026-10-15T00:00:00.000Z",
      durationMs: 1,
      filesChecked: 5,
      cap: 3,
      totals: totals(groups, findings),
    };
    const md = renderAuditMarkdown(run, groups, findings);
    const section = (name: string) => md.split(`## ${name}\n`)[1]!.split("\n## ")[0]!;
    for (const name of ["Top issues", "Fix path by class"]) {
      const ids = section(name).match(/\bF\d{3}\b/g)!;
      expect([...new Set(ids)].sort()).toEqual(["F001", "F002", "F003"]);
    }
    expect(section("Top issues")).toContain("- Spread: 3 findings in 3 files");
    expect(section("Fix path by class")).toContain("| G01 | color-literal | `#123456` | F001, F002, F003 | 3 |");
    expect(section("Beyond the hand-review cap").match(/\bF\d{3}\b/g)).toEqual(["F004", "F005"]);
    expect(md).toContain("3 + 2 = 5");
  });
});

describe("markdownToPdf", () => {
  it("is deterministic and escapes what PDF strings cannot hold", () => {
    const md = "# Title (draft)\n\n- a \\ backslash — and a dash\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
    const a = markdownToPdf(md, "T", "DRAFT");
    expect(a.equals(markdownToPdf(md, "T", "DRAFT"))).toBe(true);
    const text = a.toString("latin1");
    expect(text).toContain("(Title \\(draft\\)) Tj");
    expect(text).toContain("a \\\\ backslash - and a dash");
    expect(text).toContain("(1 | 2) Tj");
    expect(text).not.toContain("|---|");
  });
});
