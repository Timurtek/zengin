// Field test 3: `zengin init --from claude-design` on a Claude Design export, then `zengin check`.
// The export is copied to a temporary directory first; the original is never written to.
//   pnpm -r build && node scripts/field-test-claude-design.mjs "<path to the export>" [--json]
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/field-test-claude-design.mjs <export directory> [--json]");
  process.exit(2);
}
const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "cli", "dist", "index.js");
const dir = mkdtempSync(join(tmpdir(), "zengin-field-test-"));
cpSync(resolve(source), dir, { recursive: true });

/** Counts by rule, by fix confidence, and by distinct (rule, found, fix) so a person can classify each kind once. */
function summarize(json) {
  const report = JSON.parse(json);
  const violations = report.violations ?? [];
  const tally = (key) => {
    const out = {};
    for (const v of violations) out[key(v)] = (out[key(v)] ?? 0) + 1;
    return JSON.stringify(out);
  };
  const kinds = new Map();
  for (const v of violations) {
    const k = `${v.rule} | ${v.found} | ${v.fix.replace ?? "(no fix)"} [${v.fix.confidence}]`;
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
  const rows = [...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${String(n).padStart(3)}  ${k}`);
  return [
    `${report.filesChecked} files checked, ${violations.length} violations`,
    `by rule: ${tally((v) => v.rule)}`,
    `by fix confidence: ${tally((v) => v.fix.confidence)}`,
    `by area: ${tally((v) => v.file.split("/").slice(0, 2).join("/").replace(/\/[^/]*\.\w+$/, ""))}`,
    "",
    ...rows,
    "",
  ].join("\n");
}

const run = (...args) => spawnSync(process.execPath, [cli, ...args, "--dir", dir], { cwd: dir, encoding: "utf8" });
try {
  const init = run("init", "--from", "claude-design");
  process.stdout.write(init.stdout + init.stderr);
  if (init.status !== 0) process.exit(init.status ?? 1);
  const check = spawnSync(process.execPath, [cli, "check", "--format", "json"], { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write("\n--- zengin check ---\n");
  if (process.argv.includes("--json")) process.stdout.write(check.stdout + check.stderr);
  else process.stdout.write(summarize(check.stdout) + check.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
