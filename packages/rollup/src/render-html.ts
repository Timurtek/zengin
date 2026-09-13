import type { RepoRow, RollupResult } from "./aggregate.js";
import type { HistoryPoint } from "./history.js";

/**
 * A self-contained page for the design system owner. No scripts, no external resources, both color
 * schemes. Bars are proportional to the largest value in their column so the eye lands on the worst first.
 * With more than one run per repository the page carries trends: a sparkline per row and the system's
 * totals over time, drawn as inline SVG.
 */
export function renderHtml(r: RollupResult): string {
  const t = r.totals;
  const runs = Math.max(...Object.values(r.history.repos).map((p) => p.length));
  const trended = runs > 1;
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
${trended ? `  <td class="num">${sparkline((r.history.repos[repo.name] ?? []).map((p) => p.violations), "danger")} <span class="sub">${(r.history.repos[repo.name] ?? []).length} runs</span></td>\n` : ""}</tr>`;
  };

  const trends = trended
    ? `<h2>Over time</h2>
  <p class="lede">Every run kept, ${r.history.totals.length} moments across ${t.repos} repositor${t.repos === 1 ? "y" : "ies"}. Totals are as of each moment: each repository's newest run at that point, summed.</p>
  <div class="charts">
    ${chart("Violations", r.history.totals, (p) => p.violations, "danger")}
    ${chart("Component uses", r.history.totals, (p) => p.adoptionUses, "ok")}
    ${chart("Suppressions", r.history.totals, (p) => p.suppressions, "warn")}
  </div>`
    : "";

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
  .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .chart { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px 10px; }
  .chart h3 { margin: 0 0 2px; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  .chart b { display: block; font-size: 1.4rem; line-height: 1.2; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
  .chart svg { display: block; width: 100%; height: auto; overflow: visible; }
  .chart .axis { fill: var(--muted); font-size: 11px; }
  .chart .grid { stroke: var(--border); stroke-width: 1; }
  .line.danger { stroke: var(--danger); } .line.ok { stroke: var(--ok); } .line.warn { stroke: var(--warn); }
  .area.danger { fill: var(--danger); } .area.ok { fill: var(--ok); } .area.warn { fill: var(--warn); }
  .dot.danger { fill: var(--danger); } .dot.ok { fill: var(--ok); } .dot.warn { fill: var(--warn); }
  .spark { width: 96px; height: 24px; vertical-align: middle; margin-right: 6px; overflow: visible; }
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

  ${trends}

  <h2>Repositories</h2>
  <div class="wrap">
  <table>
    <thead><tr><th>Repository</th><th>Version</th><th class="num">Files</th><th class="num">Violations</th><th class="num">Per 100 files</th><th class="num">Suppressions</th><th class="num">Owned</th><th class="num">Adoption</th>${trended ? '<th class="num">Trend</th>' : ""}</tr></thead>
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

type Tone = "danger" | "ok" | "warn";

/** A stroke through the values with a dot on the last one; flat lines stay visible in the middle. */
function sparkline(values: number[], tone: Tone): string {
  if (values.length === 0) return "";
  const w = 96;
  const h = 24;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length === 1 ? w : (i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 4)] as const);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1]!;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path}" fill="none" class="line ${tone}" stroke-width="1.5"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2" class="dot ${tone}"/></svg>`;
}

/** One series over the as-of moments: an area, a line, the range on the y axis, first and last dates on the x axis. */
function chart(title: string, points: HistoryPoint[], pick: (p: HistoryPoint) => number, tone: Tone): string {
  const values = points.map(pick);
  const w = 320;
  const h = 120;
  const padL = 34;
  const padB = 18;
  const padT = 6;
  const max = Math.max(1, ...values);
  const x = (i: number) => padL + (values.length === 1 ? w - padL : (i / (values.length - 1)) * (w - padL));
  const y = (v: number) => padT + (1 - v / max) * (h - padB - padT);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${(h - padB).toFixed(1)} L${x(0).toFixed(1)} ${(h - padB).toFixed(1)} Z`;
  const first = points[0]!.at.slice(0, 10);
  const last = points[points.length - 1]!.at.slice(0, 10);
  const current = values[values.length - 1]!;
  const start = values[0]!;
  const change = current - start;
  return `<div class="chart">
      <h3>${esc(title)}</h3>
      <b>${current} <span class="delta ${change > 0 ? (tone === "ok" ? "down" : "up") : change < 0 ? (tone === "ok" ? "up" : "down") : ""}">${signed(change)} since ${esc(first)}</span></b>
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)} over time, ${values.length} moments, from ${start} to ${current}">
        <line class="grid" x1="${padL}" y1="${padT}" x2="${w}" y2="${padT}"/>
        <line class="grid" x1="${padL}" y1="${h - padB}" x2="${w}" y2="${h - padB}"/>
        <text class="axis" x="${padL - 6}" y="${padT + 4}" text-anchor="end">${max}</text>
        <text class="axis" x="${padL - 6}" y="${h - padB + 4}" text-anchor="end">0</text>
        <text class="axis" x="${padL}" y="${h - 4}">${esc(first)}</text>
        <text class="axis" x="${w}" y="${h - 4}" text-anchor="end">${esc(last)}</text>
        <path d="${area}" class="area ${tone}" opacity="0.12"/>
        <path d="${line}" fill="none" class="line ${tone}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(current).toFixed(1)}" r="3" class="dot ${tone}"/>
      </svg>
    </div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
