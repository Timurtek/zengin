import type { RepoRow, RollupResult } from "./aggregate.js";

/**
 * A self-contained page for the design system owner. No scripts, no external resources, both color
 * schemes. Bars are proportional to the largest value in their column so the eye lands on the worst first.
 */
export function renderHtml(r: RollupResult): string {
  const t = r.totals;
  const maxViolations = Math.max(1, ...r.repos.map((x) => x.violations));
  const maxDensity = Math.max(1, ...r.repos.map((x) => x.density));
  const maxRule = Math.max(1, ...Object.values(t.byRule).map((n) => n ?? 0));
  const maxComponent = Math.max(1, ...t.components.map(([, n]) => n));

  const row = (repo: RepoRow): string => {
    const delta = repo.delta ? `<span class="delta ${repo.delta.violations > 0 ? "up" : repo.delta.violations < 0 ? "down" : ""}">${signed(repo.delta.violations)}</span>` : "";
    const version = repo.behindLatest ? `<span class="chip warn">${esc(repo.systemVersion)} behind</span>` : `<span class="chip">${esc(repo.systemVersion)}</span>`;
    const supp = repo.suppressionsWithoutReason ? `${repo.suppressions} <span class="chip danger">${repo.suppressionsWithoutReason} no reason</span>` : String(repo.suppressions);
    return `<tr>
  <td><strong>${esc(repo.name)}</strong>${repo.commit ? `<div class="sub">${esc(repo.commit.slice(0, 7))}${repo.ref ? ` on ${esc(repo.ref)}` : ""}</div>` : ""}</td>
  <td>${version}</td>
  <td class="num">${repo.filesChecked}</td>
  <td class="num">${bar(repo.violations, maxViolations, "danger")} ${repo.violations} ${delta}</td>
  <td class="num">${bar(repo.density, maxDensity, "danger")} ${repo.density}</td>
  <td class="num">${supp}</td>
  <td class="num">${repo.ownedFiles}</td>
  <td class="num">${bar(repo.adoption.uses, Math.max(1, ...r.repos.map((x) => x.adoption.uses)), "ok")} ${repo.adoption.uses} <span class="sub">${repo.adoption.components} components</span></td>
</tr>`;
  };

  const ruleRows = Object.entries(t.byRule)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([id, n]) => `<tr><td><code>${esc(id)}</code></td><td class="num">${bar(n ?? 0, maxRule, "danger")} ${n}</td></tr>`)
    .join("\n");
  const componentRows = t.components
    .slice(0, 20)
    .map(([name, n]) => `<tr><td><code>${esc(name)}</code></td><td class="num">${bar(n, maxComponent, "ok")} ${n}</td></tr>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.system.package)} rollup</title>
<style>
  :root { --bg: #F6F7FA; --surface: #FFFFFF; --text: #10182B; --muted: #5B6472; --border: #E1E5EC; --danger: #DC2626; --danger-soft: #FEE2E2; --ok: #15803D; --ok-soft: #DCFCE7; --warn: #B45309; --warn-soft: #FEF3C7; --track: #EDF0F5; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0B1120; --surface: #111A2E; --text: #EEF2F7; --muted: #9AA6B8; --border: #1E2A40; --danger: #F87171; --danger-soft: #7F1D1D; --ok: #4ADE80; --ok-soft: #14532D; --warn: #FBBF24; --warn-soft: #78350F; --track: #1A2438; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
  .page { max-width: 1100px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font-size: 1.6rem; margin: 0 0 8px; letter-spacing: -0.01em; }
  h2 { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 36px 0 12px; }
  .lede { color: var(--muted); margin: 0 0 24px; max-width: 70ch; }
  .facts { display: flex; flex-wrap: wrap; gap: 12px 32px; margin: 0 0 8px; font-variant-numeric: tabular-nums; }
  .fact b { display: block; font-size: 1.6rem; line-height: 1.1; }
  .fact span { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; font-variant-numeric: tabular-nums; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  tr:last-child td { border-bottom: 0; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .sub { color: var(--muted); font-size: 0.8rem; }
  .chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.75rem; background: var(--track); }
  .chip.warn { background: var(--warn-soft); color: var(--warn); }
  .chip.danger { background: var(--danger-soft); color: var(--danger); }
  .bar { display: inline-block; height: 8px; width: 80px; background: var(--track); border-radius: 4px; vertical-align: middle; margin-right: 8px; position: relative; overflow: hidden; }
  .bar i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; }
  .bar.danger i { background: var(--danger); } .bar.ok i { background: var(--ok); }
  .delta { font-size: 0.8rem; color: var(--muted); } .delta.up { color: var(--danger); } .delta.down { color: var(--ok); }
  .attention { display: grid; gap: 8px; padding: 0; margin: 0; list-style: none; }
  .attention li { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--warn); border-radius: 8px; padding: 10px 14px; }
  .wrap { overflow-x: auto; }
  footer { margin-top: 40px; color: var(--muted); font-size: 0.85rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
</style>
</head>
<body>
<div class="page">
  <h1>${esc(r.system.package)} across ${t.repos} repositor${t.repos === 1 ? "y" : "ies"}</h1>
  <p class="lede">Drift is every value that does not follow the system. Adoption is every place the system is used. Both come from the same engine that corrects agents mid-generation; this page is what it adds up to.</p>
  <div class="facts">
    <div class="fact"><b>${t.violations}</b><span>violations</span></div>
    <div class="fact"><b>${t.filesChecked}</b><span>files</span></div>
    <div class="fact"><b>${t.suppressions}</b><span>suppressions</span></div>
    <div class="fact"><b>${t.ownedFiles}</b><span>owned files</span></div>
    <div class="fact"><b>${t.adoptionUses}</b><span>component uses</span></div>
    <div class="fact"><b>${esc(r.system.latestVersion)}</b><span>latest version</span></div>
  </div>

  ${r.attention.length ? `<h2>Needs attention</h2>\n  <ul class="attention">\n${r.attention.map((a) => `    <li>${esc(a)}</li>`).join("\n")}\n  </ul>` : ""}

  <h2>Repositories</h2>
  <div class="wrap">
  <table>
    <thead><tr><th>Repository</th><th>Version</th><th class="num">Files</th><th class="num">Violations</th><th class="num">Per 100 files</th><th class="num">Suppressions</th><th class="num">Owned</th><th class="num">Adoption</th></tr></thead>
    <tbody>
${r.repos.map(row).join("\n")}
    </tbody>
  </table>
  </div>

  <h2>By rule</h2>
  <div class="wrap"><table><thead><tr><th>Rule</th><th class="num">Violations</th></tr></thead><tbody>
${ruleRows}
  </tbody></table></div>

  <h2>Components in use</h2>
  <div class="wrap"><table><thead><tr><th>Component</th><th class="num">Uses across repositories</th></tr></thead><tbody>
${componentRows || `<tr><td colspan="2" class="sub">No system components used yet.</td></tr>`}
  </tbody></table></div>

  <footer>Generated ${esc(r.generatedAt)}${r.previousGeneratedAt ? `, compared with ${esc(r.previousGeneratedAt)}` : ""}. Produced by zengin rollup.</footer>
</div>
</body>
</html>
`;
}

function bar(value: number, max: number, tone: "danger" | "ok"): string {
  const pct = Math.round((Math.min(value, max) / max) * 100);
  return `<span class="bar ${tone}"><i style="width:${pct}%"></i></span>`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
