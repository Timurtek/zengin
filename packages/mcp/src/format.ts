import type { RuleId, Severity, Violation } from "@zengin/engine";

export interface Summary {
  total: number;
  bySeverity: Record<Severity, number>;
  byRule: Partial<Record<RuleId, number>>;
  byFile: Record<string, number>;
}

export function summarize(violations: Violation[]): Summary {
  const s: Summary = { total: violations.length, bySeverity: { error: 0, warn: 0, info: 0 }, byRule: {}, byFile: {} };
  for (const v of violations) {
    s.bySeverity[v.severity]++;
    s.byRule[v.rule] = (s.byRule[v.rule] ?? 0) + 1;
    s.byFile[v.file] = (s.byFile[v.file] ?? 0) + 1;
  }
  return s;
}

/** Compact, line-oriented rendering an agent can act on without parsing JSON. */
export function renderViolations(violations: Violation[], heading: string): string {
  if (violations.length === 0) return `${heading}\n\nNo violations.`;
  const lines = [heading, ""];
  let currentFile = "";
  for (const v of violations) {
    if (v.file !== currentFile) {
      currentFile = v.file;
      lines.push(`## ${v.file}`, "");
    }
    lines.push(`- ${v.range.start.line}:${v.range.start.col} [${v.rule}] ${v.message}`);
    lines.push(`  found: ${oneLine(v.found)}`);
    if (v.fix.replace !== null) {
      lines.push(`  fix (${v.fix.confidence}): ${oneLine(v.fix.replace)}`);
    } else {
      lines.push(`  fix: none`);
    }
    if (v.fix.candidates) lines.push(`  candidates: ${v.fix.candidates.join(", ")}`);
    if (v.fix.note) lines.push(`  note: ${v.fix.note}`);
    if (v.note) lines.push(`  ${v.note}`);
  }
  return lines.join("\n");
}

export function renderSummary(s: Summary): string {
  const rules = Object.entries(s.byRule)
    .sort((a, b) => b[1]! - a[1]!)
    .map(([r, n]) => `${r} ${n}`)
    .join(", ");
  return `${s.total} violation${s.total === 1 ? "" : "s"} (${s.bySeverity.error} error, ${s.bySeverity.warn} warn, ${s.bySeverity.info} info)${rules ? `: ${rules}` : ""}`;
}

function oneLine(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? flat.slice(0, 157) + "..." : flat;
}
