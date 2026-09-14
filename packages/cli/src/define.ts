import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { deriveManifestFromSource, mergeIntoManifest, renderDefineReport } from "@zenginui/adapter-css";
import { addBarrelLine } from "@zenginui/registry";
import { loadConfigFile, readProjectFiles, resolveConfig, type ComponentManifest } from "@zenginui/engine";
import picomatch from "picomatch";
import { findConfig } from "./check.js";

export interface DefineOptions {
  cwd: string;
  config?: string;
  /** Apply the plan. Without it the command reports and writes nothing. */
  write?: boolean;
  /** Limit to these component names. */
  only?: string[];
  /** Resolve an `owns` disagreement in the stylesheet's favour instead of keeping the manifest's answer. */
  force?: boolean;
}

export interface DefineResult {
  report: string;
  /** Components added or updated. Zero means the manifest already describes the source. */
  changes: number;
  manifestPath: string;
}

/**
 * `zengin define`: teaches the manifest about the components this project owns.
 *
 * A component a project writes itself sits in an ownership path, where the contract and substitution rules are
 * off so the file may style itself freely. That is correct for the file and wrong for everyone else: nothing
 * tells the rest of the project what the component accepts, so a misspelled prop or an invented variant passes.
 * This reads the components' own TypeScript types and stylesheets and writes them into `components.json`, which
 * is what turns a component the project invented into one the project is held to.
 *
 * It never removes. A prop the manifest carries and the source cannot see (a passthrough type, a compound's
 * parts) survives, and a hand-written `replaces`, `migrations` or `className` policy is left exactly as it is.
 */
export function runDefine(opts: DefineOptions): DefineResult {
  const configPath = findConfig(opts.config, opts.cwd);
  const { config, dir } = loadConfigFile(configPath);
  const resolved = resolveConfig(config, dir);

  const ownership = resolved.scope.ownership;
  if (!ownership.length) {
    throw new Error(
      "No ownership paths in zengin.config.yaml, so there are no components of your own to define.\n" +
        'Add the directory your components live in, e.g.  scope: { ownership: ["src/components/ui/**"] }',
    );
  }
  const isOwned = picomatch(ownership, { dot: true });

  // Types are read from everything in scope, because a prop's enum often lives in a shared module; only the
  // ownership paths contribute components.
  const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
  if (!files.some((f) => isOwned(f.path))) {
    throw new Error(`No files matched the ownership paths (${ownership.join(", ")}). Nothing to define.`);
  }

  const manifestPath = join(resolved.system.definitionsDir, "components.json");
  const existing: ComponentManifest[] = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as ComponentManifest[]) : [];

  const derivation = deriveManifestFromSource(files, {
    importFrom: resolved.system.package,
    version: resolved.system.version,
    owned: isOwned,
    ...(opts.only?.length ? { only: opts.only } : {}),
  });
  const plan = mergeIntoManifest(existing, derivation.components, Boolean(opts.force));
  const changes = plan.added.length + plan.changed.length;

  // A definition nobody can import does nothing: the contract rules only reach a component the rest of the
  // project imports from a system source. So a new component is exported from the barrel at the same time,
  // and when there is no barrel to write the report says so rather than leaving a definition with no effect.
  const barrelDir = dirname(barrelPath(dir, resolved));
  const exports: string[] = [];
  const unreachable: string[] = [];
  for (const name of plan.added) {
    const origin = derivation.report.origin[name];
    if (!origin) continue;
    const from = relative(barrelDir, join(dir, origin)).replace(/\\/g, "/").replace(/\.(tsx|ts|jsx|js)$/, "");
    if (from.startsWith("..") || !existsSync(barrelPath(dir, resolved))) unreachable.push(`${name} (${origin})`);
    else exports.push(`export * from "./${from}";`);
  }

  if (opts.write && changes > 0) {
    if (!existsSync(resolved.system.definitionsDir)) {
      throw new Error(`${resolved.system.definitionsDir} does not exist. Run zengin init first, or point system.definitions at the directory that holds components.json.`);
    }
    writeFileSync(manifestPath, JSON.stringify(plan.merged, null, 2) + "\n");
    for (const line of exports) addBarrelLine(dir, line);
  }

  let report = renderDefineReport(derivation, plan, Boolean(opts.write) && changes > 0, Boolean(opts.force));
  if (exports.length) report += `\n${opts.write ? "Exported from" : "To export from"} ${relative(dir, barrelPath(dir, resolved)).replace(/\\/g, "/")}: ${exports.length} ${exports.length === 1 ? "line" : "lines"}.`;
  if (unreachable.length) {
    report += `\n\nNot exported by the system's entry point, so the contract rules will not reach ${unreachable.length === 1 ? "it" : "them"}:`;
    for (const u of unreachable) report += `\n  ${u}`;
    report += `\n  Export ${unreachable.length === 1 ? "it" : "them"} from a source in system.sources (${resolved.system.sources.join(", ")}).`;
  }

  return { report, changes, manifestPath };
}

/** The project's component barrel: the file whose exports the engine reads as the system. */
function barrelPath(dir: string, resolved: { scope: { ownership: string[] } }): string {
  const first = resolved.scope.ownership[0] ?? "src/components/ui/**";
  const base = first.replace(/\/\*\*.*$/, "").replace(/\/\*.*$/, "");
  return join(dir, base, "index.ts");
}
