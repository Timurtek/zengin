#!/usr/bin/env node
import { dirname, relative, resolve } from "node:path";
import { FAMILY_NOTES, RULE_DOCS, RULE_IDS, type RuleId, type Severity } from "@zenginui/engine";
import { DEFAULT_CHECK, runCheck, type CheckOptions, type Format } from "./check.js";
import { renderGithub, renderJson, renderPretty } from "./format-cli.js";
import { runDefine } from "./define.js";
import { runDoctor } from "./doctor.js";
import { init, initFromPackage, initFromShadcn } from "./init.js";
import { historyPath, renderRollup, runReport, runRollup } from "./report.js";
import { runAdd, runBrand, runCreate, runFigma, runFonts, runIcons, runMock, runUpgrade, runRegistryBuild, runTheme, runTokens, type ScaffoldOptions } from "./scaffold.js";
import { mkdirSync, writeFileSync } from "node:fs";

const HELP = `zengin: design-system conformance, enforceable.

Usage:
  zengin check [paths...] [options]   check files (default: everything in scope)
  zengin explain [rule]               what each rule checks
  zengin init                         write a zengin.config.yaml in the current directory
  zengin init --from shadcn           derive tokens, manifest and config from a shadcn/ui project
  zengin init --from package <name>   derive them from an installed package: its CSS variables and type declarations
  zengin define [names...]            teach the manifest the components this project owns, from their own types and CSS
  zengin doctor [--fix]               is this project's plumbing what this version expects: agent wiring, pins, generated files
  zengin report [--out file]          one repository's snapshot: violations plus inventory, as JSON, for the rollup
  zengin report --into <dir>          the same, filed as <dir>/<repo>/<time>.json so the directory is the history
  zengin rollup <snapshots|dirs...>   drift, adoption and trends across repositories, from report snapshots
  zengin create <dir>                 a new project on Zengin UI: components copied in, engine, MCP, hook, Storybook wired
  zengin add <items...>               components or templates from the registry into this project
  zengin upgrade [items...]           what changed upstream since the components were copied; --write takes it
  zengin theme [name]                 list the registry's themes, or swap this project's brand for one
  zengin fonts [name]                 list the registry's font pairings, or set this project's three font tokens to one
  zengin icons [set]                  list the registry's icon sets, or draw this project's icon vocabulary from one (react-icons)
  zengin brand --name <name>          a brand from a name, a logo or a color: tokens, favicon, wordmark, index.html
  zengin tokens                       zengin/tokens*.json to src/styles/generated/tokens.css
  zengin mock <presets...>            typed, seeded mock data modules into src/mock (users, customers, invoices, ...)
  zengin figma export                 tokens to a Figma Variables payload (figma/variables.json)
  zengin figma import <local.json>    variables exported from Figma back into the token files, with a report
  zengin figma connect                Code Connect files from zengin/components.json
  zengin figma plugin                 the plugin that imports and exports variables in any Figma file
  zengin registry build --out <dir>   build the registry from a Zengin repository checkout

Init options:
  --from shadcn         read the theme CSS, Tailwind config and components/ui; write zengin/ and zengin.config.yaml
  --from package <name> read node_modules/<name>: tokens from its stylesheet (names kept), manifest from its .d.ts
  --dir <path>          project directory (default: cwd)
  --force               overwrite existing zengin/ definitions and config

Doctor options:
  --fix                 repair what can be repaired: the files Zengin itself writes
  --dir <path>          project directory (default: cwd)

Define options:
  --write               apply the plan (a report only, otherwise)
  --force               on an owns disagreement, take the stylesheet's answer over the manifest's
  --dir <path>          project directory (default: cwd)

Create and add options:
  --template <name>     blank | marketing | review | saas | chat | auth | docs | storefront (create; default: blank)
  --theme <name>        apply a registry theme after the template (create)
  --name <name>         package name (create; default: the directory name)
  --registry <dir|url>  where items come from (default: $ZENGIN_REGISTRY or the public registry)
  --no-storybook        skip the Storybook config and stories (create)
  --framework <name>    vite (default) | next: the App Router under src/app, the template mounted client-side (create)
  --local <repo>        link the Zengin packages from a repository checkout instead of npm (create)
  --dir <path>          project directory (add, tokens; default: cwd)
  --force               overwrite files that already exist (add); take upstream over a conflict (upgrade)
  --install             add: run the project's package manager for the packages the items need
  --write               upgrade: apply the plan (a report only, otherwise)

Brand options:
  --name <name>         the product's name (required)
  --logo <file>         SVG, PNG, JPEG or WebP; an SVG also supplies the primary color
  --primary <hex>       the primary color; wins over the logo
  --font-display <f>    Google Fonts family for headlines
  --font-sans <f>       Google Fonts family for text
  --font-mono <f>       Google Fonts family for code
  --radius <r>          sharp | soft | round (default: soft, the system's own radii)
  --fonts <pairing>     a registry pairing instead of the three --font-* families

Fonts options:
  --self-host           download the woff2 files into public/fonts and write src/theme/fonts.css; no Google Fonts at runtime

Mock options:
  --schema <json>       your own entities instead of presets
  --count <n>           rows per entity
  --seed <n>            a different draw of the same data
  --out <dir>           where the modules go (default: src/mock)

Figma options:
  --collection <name>   the variable collection (default: Zengin)
  --write               import: update zengin/tokens*.json (a report only, otherwise)
  --map <json>          connect: Figma component URLs by component name
  --out <path>          export: the payload file; connect and plugin: the directory

Registry options:
  --root <path>         the Zengin repository (default: found above cwd)
  --out <dir>           where to write index.json and items/

Report options:
  --repo <name>         repository name in the snapshot (default: from the git remote, else the directory)
  --include-violations  keep the full violation list in the snapshot (counts only by default)
  --out <file>          write the snapshot here instead of stdout

Rollup options:
  --into <dir>          report: file the snapshot under <dir>/<repo>/<time>.json; rollup reads the directory
  --at <iso>            report: the snapshot's moment, with --commit and --ref, when backfilling from an older commit
  --previous <file>     a previous rollup JSON, for deltas; with a history directory the prior run is the default
  --format <fmt>        markdown | json | html (default: markdown)
  --out <file>          write the rollup here instead of stdout

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
  command: "check" | "explain" | "init" | "define" | "doctor" | "report" | "rollup" | "create" | "add" | "tokens" | "registry" | "theme" | "fonts" | "icons" | "upgrade" | "brand" | "figma" | "mock" | "help";
  positional: string[];
  check: CheckOptions;
  init: { from?: string; dir?: string; force: boolean };
  report: { repo?: string; includeViolations: boolean; out?: string; into?: string; at?: string; commit?: string; ref?: string };
  rollup: { previous?: string; format: "markdown" | "json" | "html"; out?: string };
  scaffold: ScaffoldOptions;
  doctor: { fix: boolean };
}

export function parseArgs(argv: string[], cwd: string): Parsed {
  const check: CheckOptions = { ...DEFAULT_CHECK, cwd, paths: [] };
  const positional: string[] = [];
  let command: Parsed["command"] | undefined;
  const rules: RuleId[] = [];
  const initOpts: Parsed["init"] = { force: false };
  const reportOpts: Parsed["report"] = { includeViolations: false };
  const rollupOpts: Parsed["rollup"] = { format: "markdown" };
  const scaffold: ScaffoldOptions = { storybook: true, force: false, list: false, write: false };
  const doctor: Parsed["doctor"] = { fix: false };
  let rawFormat: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (!a.startsWith("-") && !command) {
      if (a === "check" || a === "explain" || a === "init" || a === "define" || a === "doctor" || a === "report" || a === "rollup" || a === "create" || a === "add" || a === "tokens" || a === "registry" || a === "theme" || a === "fonts" || a === "icons" || a === "upgrade" || a === "brand" || a === "figma" || a === "mock" || a === "help") command = a;
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
    else if (a === "--format") rawFormat = value();
    else if (a.startsWith("--format=")) rawFormat = a.slice(9);
    else if (a === "--max") check.max = asInt(value());
    else if (a.startsWith("--max=")) check.max = asInt(a.slice(6));
    else if (a === "--from") initOpts.from = value();
    else if (a.startsWith("--from=")) initOpts.from = a.slice(7);
    else if (a === "--dir") initOpts.dir = scaffold.dir = value();
    else if (a.startsWith("--dir=")) initOpts.dir = scaffold.dir = a.slice(6);
    else if (a === "--force") initOpts.force = scaffold.force = true;
    else if (a === "--write") scaffold.write = true;
    else if (a === "--fix") doctor.fix = true;
    else if (a === "--install") scaffold.install = true;
    else if (a === "--schema") scaffold.schema = value();
    else if (a.startsWith("--schema=")) scaffold.schema = a.slice(9);
    else if (a === "--count") scaffold.count = asInt(value());
    else if (a.startsWith("--count=")) scaffold.count = asInt(a.slice(8));
    else if (a === "--seed") scaffold.seed = asInt(value());
    else if (a.startsWith("--seed=")) scaffold.seed = asInt(a.slice(7));
    else if (a === "--map") scaffold.map = value();
    else if (a.startsWith("--map=")) scaffold.map = a.slice(6);
    else if (a === "--collection") scaffold.collection = value();
    else if (a.startsWith("--collection=")) scaffold.collection = a.slice(13);
    else if (a === "--theme") scaffold.theme = value();
    else if (a.startsWith("--theme=")) scaffold.theme = a.slice(8);
    else if (a === "--list") scaffold.list = true;
    else if (a === "--logo") scaffold.logo = value();
    else if (a.startsWith("--logo=")) scaffold.logo = a.slice(7);
    else if (a === "--primary") scaffold.primary = value();
    else if (a.startsWith("--primary=")) scaffold.primary = a.slice(10);
    else if (a === "--fonts") scaffold.fonts = value();
    else if (a.startsWith("--fonts=")) scaffold.fonts = a.slice(8);
    else if (a === "--self-host") scaffold.selfHost = true;
    else if (a === "--font-display") scaffold.fontDisplay = value();
    else if (a.startsWith("--font-display=")) scaffold.fontDisplay = a.slice(15);
    else if (a === "--font-sans") scaffold.fontSans = value();
    else if (a.startsWith("--font-sans=")) scaffold.fontSans = a.slice(12);
    else if (a === "--font-mono") scaffold.fontMono = value();
    else if (a.startsWith("--font-mono=")) scaffold.fontMono = a.slice(12);
    else if (a === "--radius") scaffold.radius = asRadius(value());
    else if (a.startsWith("--radius=")) scaffold.radius = asRadius(a.slice(9));
    else if (a === "--template") scaffold.template = value();
    else if (a.startsWith("--template=")) scaffold.template = a.slice(11);
    else if (a === "--name") scaffold.name = value();
    else if (a.startsWith("--name=")) scaffold.name = a.slice(7);
    else if (a === "--registry") scaffold.registry = value();
    else if (a.startsWith("--registry=")) scaffold.registry = a.slice(11);
    else if (a === "--no-storybook") scaffold.storybook = false;
    else if (a === "--framework") scaffold.framework = asFramework(value());
    else if (a.startsWith("--framework=")) scaffold.framework = asFramework(a.slice(12));
    else if (a === "--local") scaffold.local = value();
    else if (a.startsWith("--local=")) scaffold.local = a.slice(8);
    else if (a === "--root") scaffold.root = value();
    else if (a.startsWith("--root=")) scaffold.root = a.slice(7);
    else if (a === "--repo") reportOpts.repo = value();
    else if (a.startsWith("--repo=")) reportOpts.repo = a.slice(7);
    else if (a === "--include-violations") reportOpts.includeViolations = true;
    else if (a === "--into") reportOpts.into = value();
    else if (a.startsWith("--into=")) reportOpts.into = a.slice(7);
    else if (a === "--at") reportOpts.at = value();
    else if (a.startsWith("--at=")) reportOpts.at = a.slice(5);
    else if (a === "--commit") reportOpts.commit = value();
    else if (a.startsWith("--commit=")) reportOpts.commit = a.slice(9);
    else if (a === "--ref") reportOpts.ref = value();
    else if (a.startsWith("--ref=")) reportOpts.ref = a.slice(6);
    else if (a === "--out") reportOpts.out = rollupOpts.out = scaffold.out = value();
    else if (a.startsWith("--out=")) reportOpts.out = rollupOpts.out = scaffold.out = a.slice(6);
    else if (a === "--previous") rollupOpts.previous = value();
    else if (a.startsWith("--previous=")) rollupOpts.previous = a.slice(11);
    else throw new Error(`Unknown option ${a}. Try zengin --help.`);
  }
  if (rules.length) check.rules = rules;
  check.paths = command === "check" || command === undefined ? positional : [];
  if (rawFormat !== undefined) {
    if (command === "rollup") {
      if (!["markdown", "json", "html"].includes(rawFormat)) throw new Error(`--format must be markdown, json or html for rollup (got ${rawFormat}).`);
      rollupOpts.format = rawFormat as Parsed["rollup"]["format"];
    } else {
      check.format = asFormat(rawFormat);
    }
  }
  if (initOpts.from && initOpts.from !== "shadcn" && initOpts.from !== "package") throw new Error(`--from supports "shadcn" and "package <name>" (got ${initOpts.from}).`);
  return { command: command ?? "check", positional, check, init: initOpts, report: reportOpts, rollup: rollupOpts, scaffold, doctor };
}

function asRadius(s: string): "sharp" | "soft" | "round" {
  if (!["sharp", "soft", "round"].includes(s)) throw new Error(`--radius must be sharp, soft or round (got ${s}).`);
  return s as "sharp" | "soft" | "round";
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
      if (parsed.init.from === "package") {
        const pkgName = parsed.positional[0];
        if (!pkgName) throw new Error("zengin init --from package needs the package name, e.g. zengin init --from package @umami/react-zen");
        process.stdout.write(initFromPackage(dir, pkgName, parsed.init.force) + "\n");
        return;
      }
      const path = init(dir);
      process.stdout.write(`Wrote ${path}. Edit system.package to point at your design system, then run: zengin check\n`);
      return;
    }
    case "doctor": {
      const result = runDoctor({
        cwd: parsed.init.dir ? resolve(process.cwd(), parsed.init.dir) : process.cwd(),
        ...(parsed.check.config ? { config: parsed.check.config } : {}),
        fix: parsed.doctor.fix,
      });
      process.stdout.write(result.report + "\n");
      process.exitCode = result.exitCode;
      return;
    }
    case "define": {
      const result = runDefine({
        cwd: parsed.init.dir ? resolve(process.cwd(), parsed.init.dir) : process.cwd(),
        write: parsed.scaffold.write,
        force: parsed.scaffold.force,
        ...(parsed.positional.length ? { only: parsed.positional } : {}),
      });
      process.stdout.write(result.report + "\n");
      if (result.notFound.length) process.exitCode = 1;
      return;
    }
    case "create":
      process.stdout.write((await runCreate(parsed.positional[0], parsed.scaffold, process.cwd())) + "\n");
      return;
    case "add":
      process.stdout.write((await runAdd(parsed.positional, parsed.scaffold, process.cwd())) + "\n");
      return;
    case "mock":
      process.stdout.write(runMock(parsed.positional, parsed.scaffold, process.cwd()) + "\n");
      return;
    case "figma":
      process.stdout.write(runFigma(parsed.positional[0], parsed.positional.slice(1), parsed.scaffold, process.cwd()) + "\n");
      return;
    case "upgrade":
      process.stdout.write((await runUpgrade(parsed.positional, parsed.scaffold, process.cwd())) + "\n");
      return;
    case "icons":
      process.stdout.write((await runIcons(parsed.positional[0], parsed.scaffold, process.cwd())) + "\n");
      return;
    case "fonts":
      process.stdout.write((await runFonts(parsed.positional[0], parsed.scaffold, process.cwd())) + "\n");
      return;
    case "theme":
      process.stdout.write((await runTheme(parsed.positional[0], parsed.scaffold, process.cwd())) + "\n");
      return;
    case "brand":
      process.stdout.write((await runBrand(parsed.scaffold, process.cwd())) + "\n");
      return;
    case "tokens":
      process.stdout.write(runTokens(parsed.scaffold, process.cwd()) + "\n");
      return;
    case "registry": {
      if (parsed.positional[0] !== "build") throw new Error("zengin registry supports: build --out <dir>");
      process.stdout.write(runRegistryBuild(parsed.scaffold, process.cwd()) + "\n");
      return;
    }
    case "report": {
      const snapshot = await runReport({ config: parsed.check.config, cwd: process.cwd(), repo: parsed.report.repo, includeViolations: parsed.report.includeViolations, at: parsed.report.at, commit: parsed.report.commit, ref: parsed.report.ref });
      if (parsed.report.into) {
        const target = historyPath(resolve(process.cwd(), parsed.report.into), snapshot);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, JSON.stringify(snapshot, null, 2) + "\n");
        process.stdout.write(`Wrote ${relative(process.cwd(), target).replace(/\\/g, "/")}: ${snapshot.summary.total} violations, ${snapshot.inventory.suppressions} suppressions, ${Object.keys(snapshot.inventory.components).length} components in use.\n`);
        return;
      }
      const text = JSON.stringify(snapshot, null, 2);
      if (parsed.report.out) {
        writeFileSync(resolve(process.cwd(), parsed.report.out), text + "\n");
        process.stdout.write(`Wrote ${parsed.report.out}: ${snapshot.summary.total} violations, ${snapshot.inventory.suppressions} suppressions, ${snapshot.inventory.ownedFiles} owned files, ${Object.keys(snapshot.inventory.components).length} components in use.\n`);
      } else {
        process.stdout.write(text + "\n");
      }
      return;
    }
    case "rollup": {
      const result = runRollup({ cwd: process.cwd(), snapshots: parsed.positional, previous: parsed.rollup.previous });
      const text = renderRollup(result, parsed.rollup.format);
      if (parsed.rollup.out) {
        mkdirSync(dirname(resolve(process.cwd(), parsed.rollup.out)), { recursive: true });
        writeFileSync(resolve(process.cwd(), parsed.rollup.out), text + (text.endsWith("\n") ? "" : "\n"));
        process.stdout.write(`Wrote ${parsed.rollup.out}: ${result.totals.repos} repositories, ${result.totals.violations} violations.\n`);
      } else {
        process.stdout.write(text + "\n");
      }
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

function asFramework(v: string): "vite" | "next" {
  if (v !== "vite" && v !== "next") throw new Error(`--framework must be vite or next (got ${v}).`);
  return v;
}
