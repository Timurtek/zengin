import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import type { RuleId, Severity, Violation } from "@zenginui/engine";
import { DEFAULT_CHECK, runCheck } from "./check.js";
import { markdownToPdf } from "./pdf.js";
import { repoInfo } from "./report.js";

/**
 * The Design System Drift Audit, run end to end: the check, every finding given a proposed class with its
 * evidence, findings grouped by cause and ranked, the hand-review set capped, and the report drafted.
 * Classes here are proposals made by rule from the field tests; the audit's promise is that a person
 * confirms each one, so the report says DRAFT and never claims otherwise.
 */

export const AUDIT_CAP = 150;
export const AUDIT_FILES = ["findings.json", "run.json", "report.md", "report.pdf"] as const;

export type AuditClass = "true-drift" | "needs-decision" | "intentional-exception" | "false-positive";

export const CLASS_LABEL: Record<AuditClass, string> = {
  "true-drift": "True drift",
  "needs-decision": "Needs a decision",
  "intentional-exception": "Intentional exception",
  "false-positive": "False positive",
};

const CLASS_ORDER: AuditClass[] = ["true-drift", "needs-decision", "intentional-exception", "false-positive"];

export interface AuditFinding {
  /** F001, in ranked order: the id every claim in the report points at. */
  id: string;
  group: string;
  rule: RuleId;
  severity: Severity;
  /** `file:line`, project-relative. */
  evidence: string;
  file: string;
  line: number;
  col: number;
  found: string;
  /** The token or component the finding is about. */
  involves: string;
  message: string;
  fix: Violation["fix"];
  note?: string;
  class: AuditClass;
  /** Why that class was proposed: the rule from the field tests that matched. */
  basis: string;
  review: "hand" | "summarised";
}

export interface AuditGroup {
  /** G01, by rank. One group is one decision: a rule, a found value and the class proposed for it. */
  id: string;
  rule: RuleId;
  severity: Severity;
  found: string;
  involves: string;
  class: AuditClass;
  basis: string;
  findings: string[];
  files: number;
  /** Impact (severity weight) times spread (files). */
  score: number;
  review: "hand" | "partial" | "summarised";
}

export interface AuditRun {
  schema: "zengin-audit/1";
  repo: { name: string; ref?: string; commit?: string };
  system: { package: string; version: string };
  tool: { name: "@zenginui/cli"; version: string };
  generatedAt: string;
  durationMs: number;
  filesChecked: number;
  cap: number;
  totals: {
    findings: number;
    groups: number;
    hand: number;
    summarised: number;
    /** Over the hand-review set only. */
    byClass: Record<AuditClass, { findings: number; groups: number }>;
  };
}

export interface AuditResult {
  run: AuditRun;
  groups: AuditGroup[];
  findings: AuditFinding[];
  markdown: string;
}

export interface AuditOptions {
  /** The client repository. Read only. */
  repo: string;
  /** The engagement workspace's deliverables folder: the only place anything is written. */
  out: string;
  /** zengin.config.yaml; default: the one at the repository root, written during prework. */
  config?: string;
  cap?: number;
  /** Repository name in the report; default from the git remote, else the directory. */
  name?: string;
  now?: Date;
}

const SEVERITY_WEIGHT: Record<Severity, number> = { error: 3, warn: 2, info: 1 };

/** Props a component forwards from a library type the manifest cannot list: the umami field test's adapter defects. */
const FORWARDED_PROP = /^(as|asChild|render|slot|on[A-Z]\w*)$/;
/** Stylesheets that define a system's own values. Their literals are the definitions, unless config says otherwise. */
const FOUNDATION_LIKE = /(^|\/)(globals?|theme|tokens?|variables)\.css$/;
const NOT_A_COLOR = /^(transparent|currentcolor|inherit|initial|unset|#0000|#00000000)$/i;

export function classify(v: Violation): { class: AuditClass; basis: string } {
  if (v.note?.startsWith("zengin-allow comment ignored"))
    return { class: "intentional-exception", basis: "A zengin-allow comment marks this as deliberate but gives no reason, so the engine did not honour it." };
  if (v.rule === "color-literal" && NOT_A_COLOR.test(v.found.trim()))
    return { class: "false-positive", basis: "The value carries no colour choice (a keyword or a fully transparent value)." };
  if (v.rule === "unknown-prop") {
    const prop = /has no prop "([^"]+)"/.exec(v.message)?.[1] ?? "";
    if (FORWARDED_PROP.test(prop))
      return { class: "false-positive", basis: `"${prop}" is the kind of prop a component forwards from a library type the manifest does not list; record it as passthrough in the definitions.` };
  }
  if ((v.rule === "color-literal" || v.rule === "spacing-literal") && FOUNDATION_LIKE.test(v.file))
    return { class: "needs-decision", basis: "This stylesheet looks like it defines the system's own values. If it does, scope.foundations should name it and the finding goes away." };
  if (v.rule === "classname-policy" && v.severity !== "error")
    return { class: "needs-decision", basis: "True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call." };
  if ((v.rule === "spacing-literal" || v.rule === "color-literal") && v.fix.confidence === "none")
    return { class: "needs-decision", basis: "No token is near this value: either the system is missing a token or this is a deliberate one-off." };
  const fix = v.fix.confidence === "none" ? "a fix to be written by hand" : v.fix.confidence === "exact" ? "an exact fix" : "a nearest fix";
  return { class: "true-drift", basis: `${v.rule} at ${v.severity}, with ${fix}.` };
}

/** The token or component a finding is about, for the report's evidence column. */
export function involves(v: Violation): string {
  if (v.fix.token) return v.fix.token;
  const component =
    /^(\w+) has no /.exec(v.message)?.[1] ??
    /^(?:className|style) on (\w+) /.exec(v.message)?.[1] ??
    /\. Use ([\w, ]+) from /.exec(v.message)?.[1];
  return component ?? v.found;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function buildAudit(violations: Violation[], cap: number): { groups: AuditGroup[]; findings: AuditFinding[] } {
  type Draft = Omit<AuditGroup, "id" | "findings" | "files" | "score" | "review"> & { members: Violation[] };
  const drafts = new Map<string, Draft>();
  for (const v of violations) {
    const c = classify(v);
    const key = `${v.rule}\u0000${v.found.trim().toLowerCase()}\u0000${c.class}`;
    const d = drafts.get(key);
    if (d) {
      d.members.push(v);
      if (SEVERITY_WEIGHT[v.severity] > SEVERITY_WEIGHT[d.severity]) d.severity = v.severity;
    } else drafts.set(key, { rule: v.rule, severity: v.severity, found: v.found.trim(), involves: involves(v), class: c.class, basis: c.basis, members: [v] });
  }

  const ranked = [...drafts.values()]
    .map((d) => {
      const files = new Set(d.members.map((m) => m.file)).size;
      return { d, files, score: SEVERITY_WEIGHT[d.severity] * files };
    })
    .sort((a, b) => b.score - a.score || b.d.members.length - a.d.members.length || a.d.rule.localeCompare(b.d.rule) || a.d.found.localeCompare(b.d.found));

  const groups: AuditGroup[] = [];
  const findings: AuditFinding[] = [];
  const width = Math.max(3, String(violations.length).length);
  let hand = 0;
  ranked.forEach(({ d, files, score }, gi) => {
    const id = `G${pad(gi + 1, Math.max(2, String(ranked.length).length))}`;
    const members = [...d.members].sort((a, b) => a.file.localeCompare(b.file) || a.range.start.line - b.range.start.line || a.range.start.col - b.range.start.col);
    const ids: string[] = [];
    let inHand = 0;
    for (const v of members) {
      const review = hand < cap ? "hand" : "summarised";
      if (review === "hand") {
        hand++;
        inHand++;
      }
      const c = classify(v);
      const fid = `F${pad(findings.length + 1, width)}`;
      ids.push(fid);
      findings.push({
        id: fid,
        group: id,
        rule: v.rule,
        severity: v.severity,
        evidence: `${v.file}:${v.range.start.line}`,
        file: v.file,
        line: v.range.start.line,
        col: v.range.start.col,
        found: v.found,
        involves: involves(v),
        message: v.message,
        fix: v.fix,
        ...(v.note ? { note: v.note } : {}),
        class: c.class,
        basis: c.basis,
        review,
      });
    }
    const review = inHand === members.length ? "hand" : inHand === 0 ? "summarised" : "partial";
    groups.push({ id, rule: d.rule, severity: d.severity, found: d.found, involves: d.involves, class: d.class, basis: d.basis, findings: ids, files, score, review });
  });
  return { groups, findings };
}

function totals(groups: AuditGroup[], findings: AuditFinding[]): AuditRun["totals"] {
  const byClass = Object.fromEntries(CLASS_ORDER.map((c) => [c, { findings: 0, groups: 0 }])) as AuditRun["totals"]["byClass"];
  const handGroups = new Set<string>();
  for (const f of findings) {
    if (f.review !== "hand") continue;
    byClass[f.class].findings++;
    if (!handGroups.has(f.group)) {
      handGroups.add(f.group);
      byClass[f.class].groups++;
    }
  }
  const hand = findings.filter((f) => f.review === "hand").length;
  const t = { findings: findings.length, groups: groups.length, hand, summarised: findings.length - hand, byClass };
  // The report prints these numbers; they must add up, or it must not be written.
  const classSum = CLASS_ORDER.reduce((n, c) => n + byClass[c].findings, 0);
  const grouped = groups.reduce((n, g) => n + g.findings.length, 0);
  if (t.hand + t.summarised !== t.findings || classSum !== t.hand || grouped !== t.findings)
    throw new Error(`Audit counts do not reconcile: ${t.hand} hand + ${t.summarised} summarised vs ${t.findings}; classes ${classSum}; groups ${grouped}.`);
  return t;
}

const code = (s: string) => "`" + s.replace(/`/g, "'").replace(/\s+/g, " ").slice(0, 80) + "`";
const cell = (s: string) => s.replace(/\|/g, "\\|");
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function idRange(ids: string[]): string {
  if (ids.length <= 4) return ids.join(", ");
  return `${ids[0]} to ${ids.at(-1)} (${ids.length})`;
}

function fixLine(f: AuditFinding): string {
  if (f.fix.replace) return `${code(f.fix.replace)} (${f.fix.confidence})${f.fix.note ? `. ${f.fix.note}` : ""}`;
  return f.fix.note ?? "No fix the engine can write; decided by hand.";
}

const FIX_PATH: Record<AuditClass, string> = {
  "true-drift": "Fix in code, in group order. Apply exact fixes first; check each nearest fix by eye, since a neighbouring step can be a different design.",
  "needs-decision": "A decision for the team before any code changes: add the missing token, name the file as a foundation, or widen the component's className.allow. Each decision closes a whole group.",
  "intentional-exception": "Keep it and write the reason after the zengin-allow comment's colon, so the engine honours it and the next reader knows why; or remove the exception.",
  "false-positive": "Not a code change. Tune the definitions (a passthrough type, a foundation file) so the engine stops reporting it, and count it in the report's false-positive rate.",
};

export function renderAuditMarkdown(run: AuditRun, groups: AuditGroup[], findings: AuditFinding[]): string {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const t = run.totals;
  const handGroups = groups.filter((g) => g.review !== "summarised");
  const L: string[] = [];
  L.push(`# Design System Drift Audit: ${run.repo.name} (DRAFT)`, "");
  L.push("> DRAFT for review. Not for the client until it has been reviewed and edited. Every class below is proposed by rule and confirmed by hand before the report leaves.", "");
  L.push(
    `Run: ${run.repo.name}${run.repo.commit ? ` at ${run.repo.commit.slice(0, 7)}` : ""}, against ${run.system.package}@${run.system.version}. ${run.filesChecked} files checked in ${(run.durationMs / 1000).toFixed(1)} seconds by ${run.tool.name}@${run.tool.version}, ${run.generatedAt.slice(0, 10)}.`,
    "",
  );

  L.push("## Summary", "");
  L.push(`- This run reported ${t.findings} findings in ${t.groups} groups. A group is one rule and one found value with one proposed class: one decision.`);
  L.push(`- Hand review covers ${t.hand} findings in ${handGroups.length} groups, up to the cap of ${run.cap}, taken in rank order (severity times the number of files). ${t.summarised} findings are summarised, not classified by hand. ${t.hand} + ${t.summarised} = ${t.findings}.`);
  L.push(`- False positives proposed in the hand-review set: ${t.byClass["false-positive"].findings} of ${t.hand}. The rate is stated once each one has been confirmed by hand.`);
  L.push("- Every number here comes from this run and is reconciled above. No figure from another run is quoted.", "");
  L.push("| Proposed class | Findings | Groups |", "|---|---|---|");
  for (const c of CLASS_ORDER) L.push(`| ${CLASS_LABEL[c]} | ${t.byClass[c].findings} | ${t.byClass[c].groups} |`);
  L.push(`| Hand-review set | ${t.hand} | ${handGroups.length} |`, "");

  L.push("## Top issues", "");
  const top = handGroups.slice(0, 10);
  if (top.length === 0) L.push("The scan reported nothing within the engine's rule kinds. See what the scan cannot see, below.", "");
  for (const g of top) {
    const members = g.findings.map((id) => byId.get(id)!);
    const first = members[0]!;
    L.push(`### ${g.id}: ${g.rule} ${code(g.found)} (${CLASS_LABEL[g.class]})`, "");
    L.push(`- What: ${first.message}`);
    L.push(`- Spread: ${count(members.length, "finding")} in ${count(g.files, "file")}, at ${g.severity}. Involves ${code(g.involves)}.`);
    L.push(`- Why this class: ${g.basis}`);
    L.push(`- Fix: ${fixLine(first)}`);
    L.push(`- Examples: ${members.slice(0, 3).map((f) => `${f.id} ${code(f.evidence)}`).join(", ")}.`);
    L.push(`- Findings: ${idRange(g.findings)}.`, "");
  }

  L.push("## Fix path by class", "");
  for (const c of CLASS_ORDER) {
    const gs = handGroups.filter((g) => g.class === c);
    L.push(`### ${CLASS_LABEL[c]}`, "", FIX_PATH[c], "");
    if (gs.length === 0) L.push("No group in the hand-review set.", "");
    else {
      L.push("| Group | Rule | Found | Findings | Files |", "|---|---|---|---|---|");
      for (const g of gs) L.push(`| ${g.id} | ${g.rule} | ${cell(code(g.found))} | ${idRange(g.findings)} | ${g.files} |`);
      L.push("");
    }
  }

  const rest = groups.filter((g) => g.review !== "hand");
  L.push("## Beyond the hand-review cap", "");
  if (rest.length === 0) L.push(`Every finding is in the hand-review set; the cap of ${run.cap} was not reached.`, "");
  else {
    L.push(`${t.summarised} findings past the cap ship as engine output with a proposed class and no hand review. A second pass is a separate piece of work.`, "");
    L.push("| Group | Rule | Found | Proposed class | Findings past the cap |", "|---|---|---|---|---|");
    for (const g of rest) {
      const past = g.findings.filter((id) => byId.get(id)!.review === "summarised");
      L.push(`| ${g.id} | ${g.rule} | ${cell(code(g.found))} | ${CLASS_LABEL[g.class]} | ${idRange(past)} |`);
    }
    L.push("");
  }

  L.push("## What the scan cannot see", "");
  L.push("- Drift outside the engine's seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution): behavioural, architectural and most accessibility drift.");
  L.push("- What renders at runtime: class names built from runtime values, styles set from JavaScript, and the visual result of an override.");
  L.push("- Files outside the configured scope, and any system the definitions do not describe.");
  L.push("- Whether a finding matters to a user. That judgement is the hand review.", "");

  L.push("## Evidence", "");
  L.push("Every finding id above resolves in findings.json, with its `file:line`, rule, found value, the token or component involved, its proposed class and the reason for it. run.json records the run.");
  return L.join("\n") + "\n";
}

function toolVersion(): string {
  return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
}

export async function runAudit(opts: AuditOptions): Promise<AuditResult> {
  const repo = resolve(opts.repo);
  if (!existsSync(repo) || !statSync(repo).isDirectory()) throw new Error(`Repository not found: ${opts.repo}`);
  const config = opts.config ? resolve(opts.config) : join(repo, "zengin.config.yaml");
  if (!existsSync(config))
    throw new Error(`No zengin.config.yaml at ${repo}. Derive the definitions in prework (zengin init --from shadcn, or --from package <name>) or pass --config.`);
  const cap = opts.cap ?? AUDIT_CAP;

  const started = performance.now();
  const check = await runCheck({ ...DEFAULT_CHECK, cwd: repo, config, failOn: "never" });
  const { groups, findings } = buildAudit(check.violations, cap);
  const durationMs = Math.round(performance.now() - started);

  const run: AuditRun = {
    schema: "zengin-audit/1",
    repo: repoInfo(repo, opts.name),
    system: check.system,
    tool: { name: "@zenginui/cli", version: toolVersion() },
    generatedAt: (opts.now ?? new Date()).toISOString(),
    durationMs,
    filesChecked: check.filesChecked,
    cap,
    totals: totals(groups, findings),
  };
  const markdown = renderAuditMarkdown(run, groups, findings);

  const out = resolve(opts.out);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "findings.json"), JSON.stringify({ schema: "zengin-audit-findings/1", groups, findings }, null, 2) + "\n");
  writeFileSync(join(out, "run.json"), JSON.stringify(run, null, 2) + "\n");
  writeFileSync(join(out, "report.md"), markdown);
  writeFileSync(join(out, "report.pdf"), markdownToPdf(markdown, `Design System Drift Audit: ${run.repo.name} (DRAFT)`, `DRAFT - ${run.repo.name}`));
  return { run, groups, findings, markdown };
}
