import type { Comment } from "./parse/tsx.js";
import type { RuleId, Violation } from "./types.js";
import { RULE_IDS } from "./types.js";

export interface Suppression {
  rules: Set<string>;
  reason: string | undefined;
  line: number;
  endLine: number;
}

const RE = /zengin-allow\s+([\w*,\s-]+?)(?::\s*(.*))?$/s;

export function parseSuppressions(comments: Comment[]): Suppression[] {
  const out: Suppression[] = [];
  for (const c of comments) {
    const m = RE.exec(c.text);
    if (!m) continue;
    const rules = new Set(
      m[1]!.split(",").map((s) => s.trim()).filter((s) => s === "*" || (RULE_IDS as readonly string[]).includes(s)),
    );
    if (rules.size === 0) continue;
    const reason = m[2]?.trim();
    out.push({ rules, reason: reason ? reason : undefined, line: c.line, endLine: c.endLine });
  }
  return out;
}

/**
 * Applies `zengin-allow <rule>: <reason>` comments. A suppression covers violations on its own line and the
 * line after it. A comment without a reason does not suppress; the violation is kept and annotated.
 */
export function applySuppressions(violations: Violation[], comments: Comment[]): Violation[] {
  const sups = parseSuppressions(comments);
  if (sups.length === 0) return violations;
  const kept: Violation[] = [];
  for (const v of violations) {
    const line = v.range.start.line;
    const match = sups.find(
      (s) => (s.rules.has("*") || s.rules.has(v.rule)) && (line === s.line || line === s.endLine || line === s.endLine + 1),
    );
    if (!match) {
      kept.push(v);
    } else if (match.reason === undefined) {
      kept.push({ ...v, note: "zengin-allow comment ignored: a reason is required after the colon." });
    }
  }
  return kept;
}

export function suppressHint(rule: RuleId): string {
  return `// zengin-allow ${rule}: <reason>`;
}
