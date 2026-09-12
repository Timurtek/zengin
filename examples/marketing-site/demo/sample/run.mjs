#!/usr/bin/env node
/**
 * Runs the engine on demo/sample/Actions.tsx against @zengin/ui and writes src/data/sample.json: the source before
 * and after, and the violations the hero panel renders. Asserts that Actions.fixed.tsx is clean. Re-run after
 * changing the sample or the engine.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, readProjectFiles, resolveConfig } from "@zengin/engine";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..", "..");
const config = resolveConfig({ system: { package: "@zengin/ui" }, scope: { include: ["demo/sample/*.tsx"] } }, project);
const engine = await createEngine(config);
const files = readProjectFiles(project, config.scope.include, config.scope.exclude);

const before = files.filter((f) => f.path.endsWith("/Actions.tsx"));
const after = files.filter((f) => f.path.endsWith("/Actions.fixed.tsx"));
const violations = engine.check(before).map(({ rule, severity, range, found, message, fix }) => ({ rule, severity, line: range.start.line, found, message, fix }));
const remaining = engine.check(after);
if (remaining.length) {
  console.error("Actions.fixed.tsx must be clean:", remaining.map((v) => `${v.range.start.line} ${v.rule} ${v.found}`));
  process.exit(1);
}

const read = (name) => readFileSync(join(here, name), "utf8").replace(/\r\n/g, "\n").trimEnd();
mkdirSync(join(project, "src", "data"), { recursive: true });
writeFileSync(
  join(project, "src", "data", "sample.json"),
  JSON.stringify({ file: "src/Actions.tsx", before: read("Actions.tsx"), after: read("Actions.fixed.tsx"), violations }, null, 2) + "\n",
);
console.log(`${violations.length} violations written to src/data/sample.json; the fixed version is clean`);
for (const v of violations) console.log(`${v.line} ${v.rule} ${v.found} -> ${v.fix.replace ?? "(no fix)"} [${v.fix.confidence}]`);
