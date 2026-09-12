import { renderSummary, type Violation } from "@zengin/engine";
import type { CheckResult } from "./check.js";

const useColor = (): boolean => process.stdout.isTTY === true && !process.env["NO_COLOR"] && process.env["TERM"] !== "dumb";

function paint(code: string): (s: string) => string {
  return useColor() ? (s) => `[${code}m${s}[0m` : (s) => s;
}

const bold = paint("1");
const dim = paint("2");
const red = paint("31");
const yellow = paint("33");
const blue = paint("34");
const green = paint("32");
const cyan = paint("36");

const SEVERITY_PAINT = { error: red, warn: yellow, info: blue };

/** Terminal rendering: grouped by file, one line per violation, fix underneath. */
export function renderPretty(result: CheckResult, max: number): string {
  const { violations, filesChecked, system } = result;
  const lines: string[] = [];
  const shown = violations.slice(0, max);

  let current = "";
  for (const v of shown) {
    if (v.file !== current) {
      current = v.file;
      if (lines.length) lines.push("");
      lines.push(bold(v.file));
    }
    const loc = dim(`${v.range.start.line}:${v.range.start.col}`);
    lines.push(`  ${loc}  ${SEVERITY_PAINT[v.severity](v.severity.padEnd(5))}  ${cyan(v.rule)}  ${v.message}`);
    lines.push(`         ${dim("found")}  ${oneLine(v.found)}`);
    if (v.fix.replace !== null) lines.push(`         ${dim(`fix (${v.fix.confidence})`)}  ${green(oneLine(v.fix.replace))}`);
    if (v.fix.note) lines.push(`         ${dim("note")}  ${v.fix.note}`);
    if (v.note) lines.push(`         ${dim("note")}  ${v.note}`);
  }

  if (lines.length) lines.push("");
  const summary = renderSummary(result.summary);
  const tail = `${filesChecked} file${filesChecked === 1 ? "" : "s"} checked against ${system.package}@${system.version}: ${summary}`;
  lines.push(violations.length ? (result.exitCode ? red(tail) : yellow(tail)) : green(tail));
  if (shown.length < violations.length) lines.push(dim(`Showing the first ${shown.length}. Raise --max or use --format json for all.`));
  return lines.join("\n");
}

/** GitHub Actions workflow commands, so violations become inline annotations on the pull request. */
export function renderGithub(result: CheckResult): string {
  const level = (s: Violation["severity"]) => (s === "error" ? "error" : s === "warn" ? "warning" : "notice");
  const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const prop = (s: string) => esc(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
  const lines = result.violations.map((v) => {
    const fix = v.fix.replace !== null ? ` Fix (${v.fix.confidence}): ${v.fix.replace}` : "";
    return `::${level(v.severity)} file=${prop(v.file)},line=${v.range.start.line},endLine=${v.range.end.line},col=${v.range.start.col},endColumn=${v.range.end.col},title=${prop(`zengin ${v.rule}`)}::${esc(v.message + fix)}`;
  });
  lines.push(`${result.filesChecked} files checked against ${result.system.package}@${result.system.version}: ${renderSummary(result.summary)}`);
  return lines.join("\n");
}

export function renderJson(result: CheckResult): string {
  const { projectDir, configPath, system, filesChecked, summary, violations, exitCode } = result;
  return JSON.stringify({ projectDir, configPath, system, filesChecked, exitCode, summary, violations }, null, 2);
}

function oneLine(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? flat.slice(0, 117) + "..." : flat;
}
