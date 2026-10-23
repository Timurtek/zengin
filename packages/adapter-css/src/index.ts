import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { ComponentManifest } from "@zenginui/engine";
import { deriveTokensFromCss } from "./tokens.js";
import { moduleGraph } from "./modules.js";
import { deriveScope, type DerivedScope } from "./scope.js";
import { deriveManifestFromSource } from "./source.js";
import { deriveManifestFromTypes, HTML_TAGS, type TypesDerivation } from "./types.js";

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
    /** Distinct Tailwind palette classes the package's own code styles with; ten or more make the palette on-system. */
    paletteClasses: number;
    /** The package's source in the same workspace, when node_modules holds a separate copy of it: the two may differ. */
    workspaceSource?: string;
    /** What scope.include was derived from: tsconfig, Tailwind content, @source. Empty: the default folders. */
    scopeFrom: string[];
    scopeInclude: string[];
  };
}

/**
 * Reads an installed design-system package and derives what the engine needs: tokens from the stylesheet
 * that defines the most custom properties, a component manifest from the package's type declarations, and
 * a config that points the class resolver at the package's precompiled utilities, when it ships any.
 * Nothing is executed; the package is read as text.
 */
export interface PackageOptions {
  /**
   * Stylesheets that hold the tokens, project-relative, when the package's own do not: a sibling preset
   * (`@dub/tailwind-config/themes.css`) or the app's globals. Read together, in order.
   */
  tokens?: string[];
}

export function derivePackage(projectDir: string, pkgName: string, opts: PackageOptions = {}): PackageDerivation {
  const pkgDir = join(projectDir, "node_modules", ...pkgName.split("/"));
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) throw new Error(`${pkgName} is not installed: no ${rel(projectDir, pkgJsonPath)}. Install it first.`);
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { version?: string; types?: string; typings?: string; main?: string; exports?: unknown; files?: string[]; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };

  const cssFiles = findCss(pkgDir, pkg);
  // The theme sheet is the one that is mostly custom properties: variables per class rule. A precompiled
  // utility sheet defines more variables (Tailwind's whole palette) but thousands of rules; it is the largest of the rest.
  const scored = cssFiles.map((f) => {
    const content = readFileSync(f, "utf8");
    const rules = (content.match(/\.[A-Za-z_-][\w-]*\s*[{,:]/g) ?? []).length;
    const derivation = deriveTokensFromCss(content);
    return { file: f, derivation, size: statSync(f).size, score: derivation.report.light / (1 + rules) };
  });
  scored.sort((a, b) => b.score - a.score);
  const foundations = findFoundations(projectDir);
  const theme = tokenSheet(projectDir, pkgDir, pkg, scored, foundations, opts.tokens);
  if (!theme) {
    const where = cssFiles.length ? `${pkgName}'s stylesheets define no custom properties on :root` : `${pkgName} ships no stylesheet`;
    throw new Error(`${where}, and neither do the project's stylesheets or the package's dependencies, so there are no tokens to derive. Name the stylesheet that holds them: --tokens <path/to/theme.css>.`);
  }
  const fromPackage = scored.find((s) => s.file === theme.file);
  const utility = scored
    .filter((s) => s !== fromPackage)
    .sort((a, b) => b.size - a.size)
    .find((s) => s.size > (fromPackage?.size ?? 0));

  const typesFile = findTypes(pkgDir, pkg);
  const types: TypesDerivation = typesFile ? manifestFromEntry(pkgDir, typesFile, pkgName, pkg.version) : { components: [], report: { components: 0, withVariants: 0, skipped: [] } };

  // Stylesheets whose @theme blocks Tailwind compiles against: the design system's own and the project's.
  const themeSheets = [...new Set([...cssFiles.map((f) => rel(projectDir, f)), ...foundations, ...(fromPackage ? [] : [rel(projectDir, theme.file)])])].filter((p) => hasTheme(join(projectDir, p)));
  const classesCss = [...(utility ? [rel(projectDir, utility.file)] : []), ...themeSheets.filter((p) => !utility || p !== rel(projectDir, utility.file))];
  // A design system whose own components style with Tailwind's palette has made the palette part of the system:
  // `bg-neutral-100` in the app is the same vocabulary, not a literal that escaped the tokens.
  const ownCode = [utility ? readFileSync(utility.file, "utf8") : "", ...(typesFile ? sourceTexts(typesFile) : [])].join("\n");
  const paletteClasses = paletteUse(ownCode);
  const scope = deriveScope(projectDir);
  const config = renderConfig(pkgName, pkg.version ?? "0.0.0", classesCss, utility ? rel(projectDir, utility.file) : undefined, foundations, paletteClasses >= PALETTE_THRESHOLD, scope);
  return {
    tokens: theme.derivation.tokens,
    tokensDark: theme.derivation.tokensDark,
    components: types.components,
    config,
    report: {
      package: pkgName,
      version: pkg.version ?? "unknown",
      foundations,
      themeFile: theme.label,
      utilityFile: utility ? rel(projectDir, utility.file) : undefined,
      typesFile: typesFile ? rel(projectDir, typesFile) : undefined,
      tokenCount: theme.derivation.report.light,
      darkOverrides: theme.derivation.report.dark,
      byGroup: theme.derivation.report.byGroup,
      componentCount: types.report.components,
      withVariants: types.report.withVariants,
      paletteClasses,
      scopeFrom: scope.from,
      scopeInclude: scope.include,
      ...(() => {
        const ws = workspaceSource(projectDir, pkgDir, pkgName);
        return ws ? { workspaceSource: ws } : {};
      })(),
      skippedVariables: theme.derivation.report.skipped,
      skippedComponents: types.report.skipped,
    },
  };
}

interface Scored {
  file: string;
  derivation: ReturnType<typeof deriveTokensFromCss>;
  size: number;
  score: number;
}

/**
 * Where the tokens are. Named stylesheets win outright; otherwise the package's own theme sheet, then the
 * project's `:root` sheets (an app that themes the package in its globals), then the stylesheets of the
 * package's own dependencies (a design system whose variables live in a sibling preset).
 */
function tokenSheet(
  projectDir: string,
  pkgDir: string,
  pkg: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> },
  scored: Scored[],
  foundations: string[],
  named: string[] | undefined,
): { file: string; label: string; derivation: Scored["derivation"] } | undefined {
  if (named?.length) {
    const files = named.map((p) => resolve(projectDir, p));
    for (const f of files) if (!existsSync(f)) throw new Error(`--tokens: no stylesheet at ${rel(projectDir, f)}.`);
    const derivation = deriveTokensFromCss(files.map((f) => readFileSync(f, "utf8")).join("\n"));
    if (derivation.report.light === 0) throw new Error(`--tokens: ${named.join(", ")} define${named.length === 1 ? "s" : ""} no custom properties on :root.`);
    return { file: files[0]!, label: files.map((f) => rel(projectDir, f)).join(" + "), derivation };
  }
  const best = scored[0];
  if (best && best.derivation.report.light > 0) return { file: best.file, label: rel(projectDir, best.file), derivation: best.derivation };
  // The project's :root sheets, and what its stylesheets import by relative path: a monorepo app reaches its
  // tokens as `@import "../../../packages/tailwind-config/themes.css"`.
  const candidates: string[] = [...foundations.map((f) => join(projectDir, f)), ...importedSheets(projectDir)];
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    // installed beside the package (pnpm, nested) or at the project root (hoisted)
    for (const base of [join(pkgDir, "node_modules"), join(projectDir, "node_modules")]) {
      const depDir = join(base, ...dep.split("/"));
      if (!existsSync(join(depDir, "package.json"))) continue;
      const depPkg = JSON.parse(readFileSync(join(depDir, "package.json"), "utf8")) as { exports?: unknown; files?: string[] };
      candidates.push(...findCss(depDir, depPkg));
      break;
    }
  }
  const ranked = candidates
    .map((file) => {
      const derivation = deriveTokensFromCss(readFileSync(file, "utf8"));
      return { file, derivation, light: derivation.report.light };
    })
    .filter((c) => c.light > 0)
    .sort((a, b) => b.light - a.light);
  const pick = ranked[0];
  return pick ? { file: pick.file, label: rel(projectDir, pick.file), derivation: pick.derivation } : undefined;
}

/**
 * The manifest from a package's types entry. A declaration file is read with every declaration file it
 * re-exports or imports, so a barrel (`export * from "./components"`) yields its components. An entry that is
 * TypeScript source, as an internal package consumed through `transpilePackages` ships, is read as source:
 * components from the files the entry re-exports, props types from wherever they import them.
 */
function manifestFromEntry(pkgDir: string, entry: string, pkgName: string, version: string | undefined): TypesDerivation {
  const graph = moduleGraph(entry);
  if (/\.d\.m?ts$/.test(entry)) {
    const dts = graph.all.filter((f) => /\.d\.m?ts$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
    return deriveManifestFromTypes(dts, { importFrom: pkgName, version });
  }
  const files = graph.all.map((f) => ({ path: rel(pkgDir, f), content: readFileSync(f, "utf8") }));
  const exported = new Set(graph.exported.map((f) => rel(pkgDir, f)));
  const s = deriveManifestFromSource(files, { importFrom: pkgName, version, owned: (p) => exported.has(p) });
  // A Tailwind component has no stylesheet to say what it owns; its variant props say it, as the declaration
  // path reads them: `variant` paints the box, `size` pads it and sets its type.
  for (const c of s.components) {
    // and, as the declaration path does for a stranger's package, a Button is a button
    const tag = c.name.toLowerCase();
    c.replaces = HTML_TAGS.has(tag) ? [tag] : [];
    if (HTML_TAGS.has(tag)) c.extends ??= tag;
    if (c.owns && Object.keys(c.owns).length) continue;
    const owns: Record<string, string> = {};
    if (c.props?.["variant"]?.type === "enum") Object.assign(owns, { "background-color": "variant", color: "variant", "border-color": "variant" });
    if (c.props?.["size"]?.type === "enum") Object.assign(owns, { padding: "size", font: "size" });
    if (Object.keys(owns).length) c.owns = owns;
  }
  const withVariants = s.components.filter((c) => Object.values(c.props ?? {}).some((p) => p.type === "enum")).length;
  return { components: s.components, report: { components: s.components.length, withVariants, skipped: s.report.skipped } };
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

/**
 * The package's own source, when the project sits in a workspace that has it and node_modules holds a different
 * copy (a published build installed instead of the workspace link). Searched in the workspace root's packages,
 * apps and libs folders, two levels deep.
 */
function workspaceSource(projectDir: string, pkgDir: string, pkgName: string): string | undefined {
  let root: string | undefined;
  for (let dir = resolve(projectDir); ; ) {
    if (existsSync(join(dir, "pnpm-workspace.yaml")) || existsSync(join(dir, "turbo.json")) || hasWorkspaces(join(dir, "package.json"))) root = dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!root) return undefined;
  const installed = realpath(pkgDir);
  for (const group of ["packages", "apps", "libs"]) {
    for (const name of safeReaddir(join(root, group))) {
      for (const dir of [join(root, group, name), ...safeReaddir(join(root, group, name)).map((n) => join(root!, group, name, n))]) {
        const pj = join(dir, "package.json");
        if (!existsSync(pj)) continue;
        try {
          if ((JSON.parse(readFileSync(pj, "utf8")) as { name?: string }).name !== pkgName) continue;
        } catch {
          continue;
        }
        return realpath(dir) === installed ? undefined : relative(projectDir, dir).replace(/\\/g, "/");
      }
    }
  }
  return undefined;
}

function hasWorkspaces(pj: string): boolean {
  try {
    return existsSync(pj) && "workspaces" in (JSON.parse(readFileSync(pj, "utf8")) as object);
  } catch {
    return false;
  }
}

function realpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/** Stylesheets the project's own stylesheets import by relative path, wherever they live. */
function importedSheets(projectDir: string): string[] {
  const out = new Set<string>();
  for (const file of projectStylesheets(projectDir)) {
    const content = readFileSync(file, "utf8");
    for (const m of content.matchAll(/@import\s+(?:url\()?\s*["']([^"']+\.css)["']/g)) {
      if (!m[1]!.startsWith(".")) continue;
      const target = resolve(dirname(file), m[1]!);
      if (existsSync(target)) out.add(target);
    }
  }
  return [...out];
}

/** Every stylesheet in the project, outside node_modules and build output. */
function projectStylesheets(projectDir: string): string[] {
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
      else if (/\.css$/.test(name)) out.push(abs);
    }
  };
  walk(projectDir, 0);
  return out;
}

/** Stylesheets in the project (not node_modules) that define custom properties on :root: its theme layer. */
function findFoundations(projectDir: string): string[] {
  return projectStylesheets(projectDir)
    .filter((abs) => /:root\s*\{[^}]*--[\w-]+\s*:/.test(readFileSync(abs, "utf8")))
    .map((abs) => rel(projectDir, abs))
    .sort();
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
  // inside the project, a project path; outside it (a monorepo sibling), a relative one: ../../packages/x.css
  const r = abs.startsWith(from) ? abs.slice(from.length).replace(/^[\\/]/, "") : relative(from, abs);
  return r.replace(/\\/g, "/");
}

/** Whether a stylesheet declares a Tailwind `@theme` block. */
function hasTheme(abs: string): boolean {
  try {
    return /@theme\b/.test(readFileSync(abs, "utf8"));
  } catch {
    return false;
  }
}

const PALETTE_THRESHOLD = 10;
const PALETTE = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g;

/** Distinct Tailwind palette classes in a body of CSS or source. */
export function paletteUse(text: string): number {
  return new Set(text.match(PALETTE) ?? []).size;
}

/** The source files a types entry reaches, when it is source rather than declarations. */
function sourceTexts(entry: string): string[] {
  if (/\.d\.m?ts$/.test(entry)) return [];
  return moduleGraph(entry).exported.map((f) => readFileSync(f, "utf8"));
}

function renderConfig(pkgName: string, version: string, classesCss: string[], utilityFile: string | undefined, foundations: string[], palette: boolean, scope: DerivedScope): string {
  const why = utilityFile ? "precompiled utilities, and the @theme blocks Tailwind compiles against" : "the @theme blocks Tailwind compiles against";
  const css = classesCss.length ? `[${classesCss.map((p) => `"${p}"`).join(", ")}]   # ${why}` : "[]";
  const found = foundations.length ? `[${foundations.map((f) => `"${f}"`).join(", ")}]   # define :root variables; literals live here` : "[]";
  return `# Derived by @zenginui/adapter-css from ${pkgName}@${version}. Definitions live in ./zengin; regenerate with: zengin init --from package ${pkgName} --force
system:
  package: "${pkgName}"
  version: "${version}"
  definitions: ./zengin
  sources: ["${pkgName}", "${pkgName}/*"]

scope:
  include: [${scope.include.map((g) => `"${g}"`).join(", ")}]${scope.from.length ? `   # from ${scope.from.join(", ")}` : ""}
  exclude: [${scope.exclude.map((g) => `"${g}"`).join(", ")}]
  foundations: ${found}
  ownership: []

classes:
  tailwind: auto
  css: ${css}

rules:
  color-literal: { severity: error, allow: ${palette ? "palette }   # the package's own components style with Tailwind's palette" : "semantic }"}
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
    r.paletteClasses >= PALETTE_THRESHOLD
      ? `Colors: the package's own code styles with ${r.paletteClasses} Tailwind palette classes, so the palette is on-system (color-literal allow: palette)`
      : `Colors: semantic tokens only (color-literal allow: semantic); the package's own code uses ${r.paletteClasses} palette classes`,
  ];
  lines.push(`Scope: ${r.scopeInclude.join(", ")}${r.scopeFrom.length ? ` (from ${r.scopeFrom.join(", ")})` : " (the default folders that exist)"}`);
  if (r.workspaceSource) {
    lines.push(
      `Warning: ${r.package} in node_modules is a separate copy; this workspace has its source at ${r.workspaceSource}. If the copy is a published build behind the source, props added since read as unknown. Build the workspace package and link it, or point --tokens and the types at the source.`,
    );
  }
  if (r.skippedVariables.length) lines.push(`Not tokens (unclassified values): ${r.skippedVariables.join(", ")}`);
  if (r.skippedComponents.length) lines.push(`Skipped components: ${r.skippedComponents.join("; ")}`);
  const passthrough = d.components.filter((c) => c.passthrough?.length);
  if (passthrough.length) lines.push(`Passthrough (props of imported types, unknown-prop not judged): ${passthrough.map((c) => `${c.name} (${c.passthrough!.join(", ")})`).join("; ")}`);
  lines.push("", "Variable names are kept: the engine suggests var(--surface-base), not a renamed token.", "Next: zengin check");
  return lines.join("\n");
}

export { deriveTokensFromCss, classify, type CssDerivation, type CssOptions, type CssToken, type Group } from "./tokens.js";
export {
  crossCheck,
  deriveClaudeDesign,
  readAdherence,
  renderClaudeDesignReport,
  writeClaudeDesign,
  type ClaudeDesignDerivation,
  type ContractFinding,
} from "./claude-design.js";
export { deriveManifestFromTypes, type TypesDerivation } from "./types.js";
export {
  deriveManifestFromSource,
  mergeIntoManifest,
  renderDefineReport,
  type SourceDerivation,
  type SourceFile,
  type SourceOptions,
  type MergePlan,
} from "./source.js";
