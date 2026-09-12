#!/usr/bin/env node
import { resolve } from "node:path";
import { FAMILY_NOTES, RULE_DOCS, RULE_IDS, type RuleId, type Severity } from "@zengin/engine";
import { DEFAULT_CHECK, runCheck, type CheckOptions, type Format } from "./check.js";
import { renderGithub, renderJson, renderPretty } from "./format-cli.js";
import { init, initFromShadcn } from "./init.js";

const HELP = `zengin: design-system conformance, enforceable.

Usage:
  zengin check [paths...] [options]   check files (default: everything in scope)
  zengin explain [rule]               what each rule checks
  zengin init                         write a zengin.config.yaml in the current directory
  zengin init --from shadcn           derive tokens, manifest and config from a shadcn/ui project

Init options:
  --from shadcn         read the theme CSS, Tailwind config and components/ui; write zengin/ and zengin.config.yaml
  --dir <path>          project directory (default: cwd)
  --force               overwrite existing zengin/ definitions and config

Check options:
  --config <path>       zengin.config.yaml (default: nearest one above cwd)
  --changed [ref]       only files changed since <ref> (default HEAD), plus uncommitted and untracked
  --staged              only files staged in git (pre-commit)
  --rule <id>           only this rule; repeatable. One of: ${RULE_IDS.join(", ")}
  --severity <level>    only this severity: error | warn | info
  --fail-on <level>     lowest severity that fails the run: error | warn | info | never (default: error)
  --format <fmt>        pretty | json | github (default: pretty; github emits PR annotations)
  --max <n>             violations shown in pretty output (default: 200)

Exit codes: 0 clean or below --fail-on, 1 violations at or above --fail-on, 2 usage or configuration error.
`;

interface Parsed {
  command: "check" | "explain" | "init" | "help";
  positional: string[];
  check: CheckOptions;
  init: { from?: string; dir?: string; force: boolean };
}

export function parseArgs(argv: string[], cwd: string): Parsed {
  const check: CheckOptions = { ...DEFAULT_CHECK, cwd, paths: [] };
  const positional: string[] = [];
  let command: Parsed["command"] | undefined;
  const rules: RuleId[] = [];
  const initOpts: Parsed["init"] = { force: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (!a.startsWith("-") && !command) {
      if (a === "check" || a === "explain" || a === "init" || a === "help") command = a;
      else {
        command = "check";
        positional.push(a);
      }
    } else if (!a.startsWith("-")) positional.push(a);
    else if (a === "-h" || a === "--help") command = "help";
    else if (a === "--config" || a === "-c") check.config = value();
    else if (a.startsWith("--config=")) check.config = a.slice(9);
    else if (a === "--changed") check.changed = argv[i + 1] && !argv[i + 1]!.startsWith("-") ? argv[++i]! : "HEAD";
    else if (a.startsWith("--changed=")) check.changed = a.slice(10);
    else if (a === "--staged") check.staged = true;
    else if (a === "--rule") rules.push(asRule(value()));
    else if (a.startsWith("--rule=")) rules.push(asRule(a.slice(7)));
    else if (a === "--severity") check.severity = asSeverity(value());
    else if (a.startsWith("--severity=")) check.severity = asSeverity(a.slice(11));
    else if (a === "--fail-on") check.failOn = asFailOn(value());
    else if (a.startsWith("--fail-on=")) check.failOn = asFailOn(a.slice(10));
    else if (a === "--format") check.format = asFormat(value());
    else if (a.startsWith("--format=")) check.format = asFormat(a.slice(9));
    else if (a === "--max") check.max = asInt(value());
    else if (a.startsWith("--max=")) check.max = asInt(a.slice(6));
    else if (a === "--from") initOpts.from = value();
    else if (a.startsWith("--from=")) initOpts.from = a.slice(7);
    else if (a === "--dir") initOpts.dir = value();
    else if (a.startsWith("--dir=")) initOpts.dir = a.slice(6);
    else if (a === "--force") initOpts.force = true;
    else throw new Error(`Unknown option ${a}. Try zengin --help.`);
  }
  if (rules.length) check.rules = rules;
  check.paths = command === "check" || command === undefined ? positional : [];
  if (initOpts.from && initOpts.from !== "shadcn") throw new Error(`--from supports "shadcn" (got ${initOpts.from}).`);
  return { command: command ?? "check", positional, check, init: initOpts };
}

function asRule(s: string): RuleId {
  if (!(RULE_IDS as readonly string[]).includes(s)) throw new Error(`Unknown rule "${s}". Rules: ${RULE_IDS.join(", ")}.`);
  return s as RuleId;
}
function asSeverity(s: string): Severity {
  if (!["error", "warn", "info"].includes(s)) throw new Error(`--severity must be error, warn or info (got ${s}).`);
  return s as Severity;
}
function asFailOn(s: string): Severity | "never" {
  if (!["error", "warn", "info", "never"].includes(s)) throw new Error(`--fail-on must be error, warn, info or never (got ${s}).`);
  return s as Severity | "never";
}
function asFormat(s: string): Format {
  if (!["pretty", "json", "github"].includes(s)) throw new Error(`--format must be pretty, json or github (got ${s}).`);
  return s as Format;
}
function asInt(s: string): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--max must be a positive integer (got ${s}).`);
  return n;
}

export function explain(rule: string | undefined): string {
  const ids = rule ? [asRule(rule)] : RULE_IDS;
  const lines: string[] = [];
  for (const id of ids) {
    const d = RULE_DOCS[id];
    lines.push(`${id} (${d.family})`, `  ${d.description}`, "");
  }
  if (!rule) lines.push(FAMILY_NOTES);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2), process.cwd());
  switch (parsed.command) {
    case "help":
      process.stdout.write(HELP);
      return;
    case "explain":
      process.stdout.write(explain(parsed.positional[0]) + "\n");
      return;
    case "init": {
      const dir = parsed.init.dir ? resolve(process.cwd(), parsed.init.dir) : process.cwd();
      if (parsed.init.from === "shadcn") {
        process.stdout.write(initFromShadcn(dir, parsed.init.force) + "\n");
        return;
      }
      const path = init(dir);
      process.stdout.write(`Wrote ${path}. Edit system.package to point at your design system, then run: zengin check\n`);
      return;
    }
    case "check": {
      const result = await runCheck(parsed.check);
      const out =
        parsed.check.format === "json" ? renderJson(result) : parsed.check.format === "github" ? renderGithub(result) : renderPretty(result, parsed.check.max);
      process.stdout.write(out + "\n");
      process.exitCode = result.exitCode;
    }
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`zengin: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
});
