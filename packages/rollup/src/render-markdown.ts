import type { RollupResult } from "./aggregate.js";

/** Markdown for a pull request comment, an issue, or a chat message. Tables first, attention list second. */
export function renderMarkdown(r: RollupResult): string {
  const t = r.totals;
  const lines: string[] = [];
  lines.push(`# ${r.system.package} across ${t.repos} repositor${t.repos === 1 ? "y" : "ies"}`);
  lines.push("");
  lines.push(`${t.violations} violations in ${t.filesChecked} files. ${t.suppressions} suppressions (${t.suppressionsWithoutReason} without a reason). ${t.ownedFiles} owned component files. ${t.adoptionUses} uses of system components. Latest version ${r.system.latestVersion}${r.system.versionsInUse.length > 1 ? `, versions in use: ${r.system.versionsInUse.join(", ")}` : ""}.`);
  lines.push("");

  lines.push("| Repository | Version | Files | Violations | Per 100 files | Suppressions | Owned | Adoption |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const repo of r.repos) {
    const delta = repo.delta ? ` (${signed(repo.delta.violations)})` : "";
    const version = repo.behindLatest ? `${repo.systemVersion} behind` : repo.systemVersion;
    const supp = repo.suppressionsWithoutReason ? `${repo.suppressions} (${repo.suppressionsWithoutReason} no reason)` : String(repo.suppressions);
    lines.push(`| ${repo.name} | ${version} | ${repo.filesChecked} | ${repo.violations}${delta} | ${repo.density} | ${supp} | ${repo.ownedFiles} | ${repo.adoption.uses} uses, ${repo.adoption.components} components |`);
  }
  lines.push("");

  const rules = Object.entries(t.byRule).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (rules.length) {
    lines.push("| Rule | Violations |");
    lines.push("| --- | ---: |");
    for (const [id, n] of rules) lines.push(`| ${id} | ${n} |`);
    lines.push("");
  }

  if (t.components.length) {
    lines.push("| Component | Uses |");
    lines.push("| --- | ---: |");
    for (const [name, n] of t.components.slice(0, 15)) lines.push(`| ${name} | ${n} |`);
    lines.push("");
  }

  if (r.attention.length) {
    lines.push("## Needs attention");
    lines.push("");
    for (const a of r.attention) lines.push(`- ${a}`);
    lines.push("");
  }

  lines.push(`Generated ${r.generatedAt}${r.previousGeneratedAt ? `, compared with ${r.previousGeneratedAt}` : ""}.`);
  return lines.join("\n");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
