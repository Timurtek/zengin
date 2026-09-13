import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ComponentManifest } from "@zengin/engine";
import { deriveTokensFromCss } from "./tokens.js";
import { deriveManifestFromTypes, type TypesDerivation } from "./types.js";

export interface PackageDerivation {
  tokens: Record<string, unknown>;
  tokensDark: Record<string, unknown> | undefined;
  components: ComponentManifest[];
  config: string;
  report: {
    package: string;
    version: string;
    themeFile: string;
    /** Project stylesheets that define custom properties on :root: the project's own theme layer, not checked. */
    foundations: string[];
    utilityFile: string | undefined;
    typesFile: string | undefined;
    tokenCount: number;
    darkOverrides: number;
    byGroup: Record<string, number>;
    componentCount: number;
    withVariants: number;
    skippedVariables: string[];
    skippedComponents: string[];
  };
}

/**
 * Reads an installed design-system package and derives what the engine needs: tokens from the stylesheet
 * that defines the most custom properties, a component manifest from the package's type declarations, and
 * a config that points the class resolver at the package's precompiled utilities, when it ships any.
 * Nothing is executed; the package is read as text.
 */
export function derivePackage(projectDir: string, pkgName: string): PackageDerivation {
  const pkgDir = join(projectDir, "node_modules", ...pkgName.split("/"));
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) throw new Error(`${pkgName} is not installed: no ${rel(projectDir, pkgJsonPath)}. Install it first.`);
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { version?: string; types?: string; typings?: string; main?: string; exports?: unknown; files?: string[] };

  const cssFiles = findCss(pkgDir, pkg);
  if (!cssFiles.length) throw new Error(`${pkgName} ships no stylesheet: looked at its exports, its files list and its root for *.css.`);
  // The theme sheet is the one that is mostly custom properties: variables per class rule. A precompiled
  // utility sheet defines more variables (Tailwind's whole palette) but thousands of rules; it is the largest of the rest.
  const scored = cssFiles.map((f) => {
    const content = readFileSync(f, "utf8");
    const rules = (content.match(/\.[A-Za-z_-][\w-]*\s*[{,:]/g) ?? []).length;
    const derivation = deriveTokensFromCss(content);
    return { file: f, derivation, size: statSync(f).size, score: derivation.report.light / (1 + rules) };
  });
  scored.sort((a, b) => b.score - a.score);
  const theme = scored[0]!;
  if (theme.derivation.report.light === 0) throw new Error(`${pkgName}'s stylesheets define no custom properties on :root, so there are no tokens to derive.`);
  const utility = scored
    .slice(1)
    .sort((a, b) => b.size - a.size)
    .find((s) => s.size > theme.size);

  const typesFile = findTypes(pkgDir, pkg);
  const types: TypesDerivation = typesFile
    ? deriveManifestFromTypes(readFileSync(typesFile, "utf8"), { importFrom: pkgName, version: pkg.version })
    : { components: [], report: { components: 0, withVariants: 0, skipped: [] } };

  const foundations = findFoundations(projectDir);
  const config = renderConfig(pkgName, pkg.version ?? "0.0.0", utility ? rel(projectDir, utility.file) : undefined, foundations);
  return {
    tokens: theme.derivation.tokens,
    tokensDark: theme.derivation.tokensDark,
    components: types.components,
    config,
    report: {
      package: pkgName,
      version: pkg.version ?? "unknown",
      foundations,
      themeFile: rel(projectDir, theme.file),
      utilityFile: utility ? rel(projectDir, utility.file) : undefined,
      typesFile: typesFile ? rel(projectDir, typesFile) : undefined,
      tokenCount: theme.derivation.report.light,
      darkOverrides: theme.derivation.report.dark,
      byGroup: theme.derivation.report.byGroup,
      componentCount: types.report.components,
      withVariants: types.report.withVariants,
      skippedVariables: theme.derivation.report.skipped,
      skippedComponents: types.report.skipped,
    },
  };
}

function findCss(pkgDir: string, pkg: { exports?: unknown; files?: string[] }): string[] {
  const out = new Set<string>();
  const add = (p: string) => {
    const abs = resolve(pkgDir, p);
    if (/\.css$/.test(abs) && existsSync(abs) && statSync(abs).isFile()) out.add(abs);
  };
  const walkExports = (v: unknown) => {
    if (typeof v === "string") add(v);
    else if (v && typeof v === "object") for (const x of Object.values(v as Record<string, unknown>)) walkExports(x);
  };
  walkExports(pkg.exports);
  for (const f of pkg.files ?? []) add(f);
  for (const name of safeReaddir(pkgDir)) add(name);
  for (const sub of ["dist", "styles", "css"]) for (const name of safeReaddir(join(pkgDir, sub))) add(join(sub, name));
  return [...out];
}

/** Stylesheets in the project (not node_modules) that define custom properties on :root: its theme layer. */
function findFoundations(projectDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    for (const name of safeReaddir(dir)) {
      if (name === "node_modules" || name.startsWith(".") || name === "dist" || name === "build" || name === "zengin") continue;
      const abs = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        continue;
      }
      if (isDir) walk(abs, depth + 1);
      else if (/\.css$/.test(name) && /:root\s*\{[^}]*--[\w-]+\s*:/.test(readFileSync(abs, "utf8"))) out.push(rel(projectDir, abs));
    }
  };
  walk(projectDir, 0);
  return out.sort();
}

function findTypes(pkgDir: string, pkg: { types?: string; typings?: string; main?: string; exports?: unknown }): string | undefined {
  const candidates: string[] = [];
  if (pkg.types) candidates.push(pkg.types);
  if (pkg.typings) candidates.push(pkg.typings);
  const root = (pkg.exports as Record<string, unknown> | undefined)?.["."];
  if (root && typeof root === "object" && typeof (root as Record<string, unknown>)["types"] === "string") candidates.push((root as Record<string, string>)["types"]!);
  if (pkg.main) candidates.push(pkg.main.replace(/\.(m|c)?js$/, ".d.ts"));
  candidates.push("index.d.ts", "dist/index.d.ts");
  for (const c of candidates) {
    const abs = resolve(pkgDir, c);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return undefined;
}

function safeReaddir(dir: string): string[] {
  try {
    return existsSync(dir) ? readdirSync(dir) : [];
  } catch {
    return [];
  }
}

function rel(from: string, abs: string): string {
  const r = abs.startsWith(from) ? abs.slice(from.length).replace(/^[\\/]/, "") : abs;
  return r.replace(/\\/g, "/");
}

function renderConfig(pkgName: string, version: string, utilityFile: string | undefined, foundations: string[]): string {
  const css = utilityFile ? `["${utilityFile}"]   # precompiled utilities: class names resolve against these declarations` : "[]";
  const found = foundations.length ? `[${foundations.map((f) => `"${f}"`).join(", ")}]   # define :root variables; literals live here` : "[]";
  return `# Derived by @zengin/adapter-css from ${pkgName}@${version}. Definitions live in ./zengin; regenerate with: zengin init --from package ${pkgName} --force
system:
  package: "${pkgName}"
  version: "${version}"
  definitions: ./zengin
  sources: ["${pkgName}", "${pkgName}/*"]

scope:
  include: ["src/**/*.{ts,tsx,css}", "app/**/*.{ts,tsx,css}", "components/**/*.{ts,tsx,css}", "styles/**/*.css"]
  exclude: ["**/node_modules/**", "**/*.test.{ts,tsx}", "**/*.stories.{ts,tsx}", "**/*.d.ts"]
  foundations: ${found}
  ownership: []

classes:
  tailwind: auto
  css: ${css}

rules:
  color-literal: { severity: error, allow: semantic }
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: warn      # the manifest's className.allow is a default; tighten per component in components.json
  component-substitution: error
`;
}

export interface WriteResult {
  written: string[];
}

/** Writes the derivation into the project. Refuses to overwrite existing files unless `force`. */
export function writePackage(projectDir: string, d: PackageDerivation, force = false): WriteResult {
  const targets: [string, string][] = [
    ["zengin/tokens.json", JSON.stringify(d.tokens, null, 2) + "\n"],
    ["zengin/components.json", JSON.stringify(d.components, null, 2) + "\n"],
    ["zengin.config.yaml", d.config],
  ];
  if (d.tokensDark) targets.push(["zengin/tokens.dark.json", JSON.stringify(d.tokensDark, null, 2) + "\n"]);
  const existing = targets.map(([p]) => p).filter((p) => existsSync(join(projectDir, p)));
  if (existing.length && !force) throw new Error(`Refusing to overwrite ${existing.join(", ")}. Pass --force to regenerate.`);
  for (const [p, content] of targets) {
    mkdirSync(dirname(join(projectDir, p)), { recursive: true });
    writeFileSync(join(projectDir, p), content);
  }
  return { written: targets.map(([p]) => p) };
}

export function renderReport(d: PackageDerivation): string {
  const r = d.report;
  const groups = Object.entries(r.byGroup)
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${n} ${g}`)
    .join(", ");
  const lines = [
    `Package: ${r.package}@${r.version}`,
    `Tokens: ${r.tokenCount} from ${r.themeFile} (${groups}); ${r.darkOverrides} dark overrides`,
    `Classes: ${r.utilityFile ? `resolved against ${r.utilityFile}` : "no utility stylesheet found; class names resolve against the project's own CSS"}`,
    `Foundations: ${r.foundations.length ? r.foundations.join(", ") : "none (no project stylesheet defines :root variables)"}`,
    `Components: ${r.componentCount} from ${r.typesFile ?? "no type declarations found"}, ${r.withVariants} with variant maps`,
  ];
  if (r.skippedVariables.length) lines.push(`Not tokens (unclassified values): ${r.skippedVariables.join(", ")}`);
  if (r.skippedComponents.length) lines.push(`Skipped components: ${r.skippedComponents.join("; ")}`);
  const passthrough = d.components.filter((c) => c.passthrough?.length);
  if (passthrough.length) lines.push(`Passthrough (props of imported types, unknown-prop not judged): ${passthrough.map((c) => `${c.name} (${c.passthrough!.join(", ")})`).join("; ")}`);
  lines.push("", "Variable names are kept: the engine suggests var(--surface-base), not a renamed token.", "Next: zengin check");
  return lines.join("\n");
}

export { deriveTokensFromCss, classify, type CssDerivation, type CssToken, type Group } from "./tokens.js";
export { deriveManifestFromTypes, type TypesDerivation } from "./types.js";
