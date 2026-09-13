import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { codeConnectFiles, fromFigmaVariables, renderImportReport, toFigmaVariables, writePlugin } from "@zengin/figma";
import type { ComponentManifest } from "@zengin/engine";
import { generateMock, PRESETS, schemaFromPresets, type MockSchema } from "@zengin/mock";
import { applyTheme, brandProject, buildRegistry, createProject, installItems, LAYOUT, listThemes, openRegistry, resolveItems, writeRegistry, writeTokensCss, type BrandRadius } from "@zengin/registry";

export interface ScaffoldOptions {
  registry?: string;
  template?: string;
  theme?: string;
  name?: string;
  storybook: boolean;
  local?: string;
  force: boolean;
  out?: string;
  root?: string;
  dir?: string;
  list: boolean;
  logo?: string;
  primary?: string;
  fontDisplay?: string;
  fontSans?: string;
  fontMono?: string;
  radius?: BrandRadius;
  write: boolean;
  map?: string;
  collection?: string;
  schema?: string;
  count?: number;
  seed?: number;
}

/** `zengin theme [name]`: list the registry's themes, or apply one to the current project. */
export async function runTheme(name: string | undefined, opts: ScaffoldOptions, cwd: string): Promise<string> {
  const source = openRegistry(opts.registry);
  if (!name || opts.list) {
    const themes = await listThemes(source);
    const width = Math.max(...themes.map((t) => t.name.length));
    return [`Themes in ${source.location}:`, ...themes.map((t) => `  ${t.name.padEnd(width)}  ${t.description}${t.fonts.length ? ` Fonts: ${t.fonts.join(", ")}.` : ""}`), "", "Apply one: zengin theme <name>"].join("\n");
  }
  const projectDir = opts.dir ? resolve(cwd, opts.dir) : cwd;
  const r = await applyTheme({ projectDir, name, source });
  const lines = [`Applied the ${r.name} theme from ${source.location}.`, ...r.files.map((f) => `  wrote   ${f}`)];
  if (r.fonts.length) lines.push(`  fonts   ${r.fonts.join(", ")}${r.html ? " (linked in index.html)" : " (no index.html to link them in)"}`);
  lines.push("", "Every component wears it now. Run the dev server, or zengin brand to make it yours.");
  return lines.join("\n");
}

/** `zengin brand --name <name> [--logo] [--primary] [--font-*] [--radius]`: a brand from one color. */
export async function runBrand(opts: ScaffoldOptions, cwd: string): Promise<string> {
  if (!opts.name) throw new Error("zengin brand needs --name <product name>. Optional: --logo <file>, --primary <hex>, --font-display, --font-sans, --font-mono, --radius sharp|soft|round.");
  const projectDir = opts.dir ? resolve(cwd, opts.dir) : cwd;
  const r = await brandProject({ projectDir, name: opts.name, logo: opts.logo, primary: opts.primary, fontDisplay: opts.fontDisplay, fontSans: opts.fontSans, fontMono: opts.fontMono, radius: opts.radius });
  const source = { option: "from --primary", logo: "from the logo", system: "the system default" }[r.primarySource];
  const lines = [`Branded ${r.name}: primary ${r.primary} (${source}).`, ...r.files.map((f) => `  wrote   ${f}`), "", "Contrast:"];
  for (const c of r.contrast) lines.push(`  ${c.ratio.toFixed(2).padStart(5)}  ${c.pair}`);
  for (const w of r.warnings) lines.push("", `Note: ${w}`);
  lines.push("", `zengin check: ${r.violations} violations. Use <BrandMark /> from src/components/brand-mark.tsx for the wordmark.`);
  return lines.join("\n");
}

/** `zengin create <dir>`: a new project on the registry's components, checked by the engine before it prints. */
export async function runCreate(dirArg: string | undefined, opts: ScaffoldOptions, cwd: string): Promise<string> {
  if (!dirArg) throw new Error("zengin create needs a directory: zengin create my-app [--template marketing]");
  const source = openRegistry(opts.registry);
  const r = await createProject({ dir: resolve(cwd, dirArg), name: opts.name, template: opts.template, theme: opts.theme, source, storybook: opts.storybook, local: opts.local });
  const lines = [
    `Created ${r.name} in ${relative(cwd, r.dir) || "."} from the ${r.template} template${opts.theme ? ` with the ${opts.theme} theme` : ""} (Zengin UI ${r.version}, registry ${source.location}).`,
    `  ${r.install.components.length} components in ${LAYOUT.componentsDir}: ${r.install.components.join(", ")}`,
    `  tokens.css: ${r.tokens.light} tokens, ${r.tokens.dark} dark overrides`,
    `  zengin check: ${r.violations} violations`,
    "",
    "Next:",
    `  cd ${relative(cwd, r.dir) || "."}`,
    "  npm install        # or pnpm install",
    "  npm run dev        # the app",
    ...(opts.storybook ? ["  npm run storybook  # every component, both themes"] : []),
    "  npm run add -- select switch   # more components from the registry",
  ];
  if (r.violations > 0) lines.push("", "The fresh project has violations, which means the registry is wrong. Run `zengin check` in it and report the output.");
  return lines.join("\n");
}

/** `zengin add <items...>`: registry items into the current project, with manifest, styles and barrel updated. */
export async function runAdd(names: string[], opts: ScaffoldOptions, cwd: string): Promise<string> {
  if (!names.length) throw new Error("zengin add needs at least one item: zengin add select switch");
  const projectDir = opts.dir ? resolve(cwd, opts.dir) : cwd;
  if (!existsSync(join(projectDir, "zengin.config.yaml"))) {
    throw new Error(`${projectDir} has no zengin.config.yaml. Run zengin add inside a project made by zengin create, or pass --dir.`);
  }
  const source = openRegistry(opts.registry);
  const index = await source.index();
  const items = await resolveItems(source, names);
  const r = installItems({ projectDir, items, version: index.version, force: opts.force });

  const missing = missingDependencies(projectDir, { ...r.dependencies, ...r.devDependencies });
  const lines = [`Added ${names.join(", ")} from ${source.location} (Zengin UI ${index.version}).`];
  for (const p of r.written) lines.push(`  wrote   ${p}`);
  for (const p of r.skipped) lines.push(`  kept    ${p} (exists; --force overwrites)`);
  if (Object.keys(missing).length) {
    lines.push("", "Install the packages these components need:", `  npm install ${Object.entries(missing).map(([k, v]) => `${k}@"${v}"`).join(" ")}`);
  }
  lines.push("", `Manifest: ${r.components.length} components in ${LAYOUT.definitionsDir}/components.json. Run zengin check to confirm the project is still clean.`);
  return lines.join("\n");
}

/** `zengin tokens`: zengin/tokens*.json to src/styles/generated/tokens.css. */
export function runTokens(opts: ScaffoldOptions, cwd: string): string {
  const projectDir = opts.dir ? resolve(cwd, opts.dir) : cwd;
  const defs = join(projectDir, LAYOUT.definitionsDir);
  const out = opts.out ? resolve(cwd, opts.out) : join(projectDir, "src", "styles", "generated", "tokens.css");
  const r = writeTokensCss(defs, out);
  return `Wrote ${relative(cwd, out)}: ${r.light} tokens, ${r.dark} dark overrides.`;
}

/** `zengin registry build`: the registry from a Zengin repository checkout, as static files. */
export function runRegistryBuild(opts: ScaffoldOptions, cwd: string): string {
  const root = opts.root ? resolve(cwd, opts.root) : findRepoRoot(cwd);
  if (!opts.out) throw new Error("zengin registry build needs --out <dir>.");
  const out = resolve(cwd, opts.out);
  const registry = buildRegistry({ root });
  const written = writeRegistry(registry, out);
  const counts = { component: 0, template: 0, theme: 0, lib: 0, definitions: 0 };
  for (const i of registry.items) counts[i.type]++;
  return `Wrote ${written.length} files to ${relative(cwd, out) || "."}: ${counts.component} components, ${counts.template} templates, ${counts.theme} themes, ${counts.lib + counts.definitions} shared items (Zengin UI ${registry.version}).`;
}

/** Packages an item needs that the project's package.json does not list. */
function missingDependencies(projectDir: string, wanted: Record<string, string>): Record<string, string> {
  const p = join(projectDir, "package.json");
  if (!existsSync(p)) return wanted;
  const pkg = JSON.parse(readFileSync(p, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const have = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const missing: Record<string, string> = {};
  for (const [k, v] of Object.entries(wanted)) if (!(k in have)) missing[k] = v;
  if (Object.keys(missing).length) {
    // Record them so a plain `npm install` later picks them up, and so the next add does not repeat them.
    pkg.dependencies = Object.fromEntries(Object.entries({ ...(pkg.dependencies ?? {}), ...missing }).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
  }
  return missing;
}

/** The nearest directory above `from` that looks like the Zengin repository. */
function findRepoRoot(from: string): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "packages", "ui", "zengin", "components.json"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) throw new Error("Not inside a Zengin repository checkout. Pass --root <path>.");
    dir = parent;
  }
}

/** `zengin figma export|import|connect|plugin`: tokens to variables and back, Code Connect files, the plugin. */
export function runFigma(sub: string | undefined, args: string[], opts: ScaffoldOptions, cwd: string): string {
  const projectDir = opts.dir ? resolve(cwd, opts.dir) : cwd;
  const defs = join(projectDir, LAYOUT.definitionsDir);
  const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
  const writeText = (rel: string, text: string): string => {
    const abs = resolve(projectDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    return rel;
  };
  const tokensPath = join(defs, "tokens.json");
  const darkPath = join(defs, "tokens.dark.json");

  switch (sub) {
    case "export": {
      if (!existsSync(tokensPath)) throw new Error(`No ${LAYOUT.definitionsDir}/tokens.json in ${projectDir}.`);
      const payload = toFigmaVariables(readJson(tokensPath), existsSync(darkPath) ? readJson(darkPath) : undefined, { collection: opts.collection });
      const out = opts.out ?? "figma/variables.json";
      writeText(out, JSON.stringify(payload, null, 2) + "\n");
      return `Wrote ${out}: ${payload.variables.length} variables in "${payload.variableCollections[0]!.name}" with ${payload.variableModes.map((m) => m.name).join(" and ")} modes.\nImport it with the plugin (zengin figma plugin), or POST it to /v1/files/:key/variables on an Enterprise plan.`;
    }
    case "import": {
      const file = args[0];
      if (!file) throw new Error("zengin figma import needs the exported variables JSON: zengin figma import figma/local.json [--write]");
      if (!existsSync(tokensPath)) throw new Error(`No ${LAYOUT.definitionsDir}/tokens.json in ${projectDir}.`);
      const local = readJson(resolve(cwd, file)) as Parameters<typeof fromFigmaVariables>[0];
      if (!local || typeof local !== "object" || !("meta" in local)) throw new Error(`${file} is not a Figma variables export (expected { meta: { variableCollections, variables } }).`);
      const light = readJson(tokensPath);
      const dark = existsSync(darkPath) ? readJson(darkPath) : undefined;
      const report = fromFigmaVariables(local, light, dark, { collection: opts.collection });
      const lines = [renderImportReport(report)];
      if (opts.write) {
        writeText(`${LAYOUT.definitionsDir}/tokens.json`, JSON.stringify(report.light, null, 2) + "\n");
        if (dark !== undefined || report.changed.some((c) => c.mode === "dark") || report.added.some((c) => c.mode === "dark")) {
          writeText(`${LAYOUT.definitionsDir}/tokens.dark.json`, JSON.stringify(report.dark, null, 2) + "\n");
        }
        lines.push("", `Wrote ${LAYOUT.definitionsDir}/tokens.json${dark !== undefined ? ` and tokens.dark.json` : ""}. Run zengin tokens to rebuild the stylesheet.`);
      } else if (report.changed.length || report.added.length) {
        lines.push("", "Nothing written. Pass --write to update the token files.");
      }
      return lines.join("\n");
    }
    case "connect": {
      const manifestPath = join(defs, "components.json");
      if (!existsSync(manifestPath)) throw new Error(`No ${LAYOUT.definitionsDir}/components.json in ${projectDir}.`);
      const manifests = readJson(manifestPath) as ComponentManifest[];
      const urls = opts.map ? (readJson(resolve(cwd, opts.map)) as Record<string, string>) : {};
      const files = codeConnectFiles(manifests, { urls, dir: opts.out ?? "src/figma" });
      const written = Object.entries(files).map(([rel, text]) => writeText(rel, text));
      const todo = manifests.filter((m) => !urls[m.name]).map((m) => m.name);
      const lines = [`Wrote ${written.length} files: figma.config.json and one *.figma.tsx per component in ${opts.out ?? "src/figma"}.`];
      if (todo.length) lines.push(`${todo.length} without a Figma URL, marked TODO: ${todo.join(", ")}. Pass --map <json> with { "Button": "https://www.figma.com/design/...?node-id=..." }.`);
      lines.push("Then: npx figma connect publish");
      return lines.join("\n");
    }
    case "plugin": {
      const dir = resolve(projectDir, opts.out ?? "figma/plugin");
      const written = writePlugin(dir);
      return `Wrote ${written.length} files to ${relative(cwd, dir) || "."}.\nIn Figma: Plugins, Development, Import plugin from manifest, choose manifest.json. Import pastes the payload from zengin figma export; Export produces what zengin figma import reads.`;
    }
    default:
      throw new Error("zengin figma supports: export [--out file] [--collection name], import <local.json> [--write], connect [--map urls.json] [--out dir], plugin [--out dir]");
  }
}

/** `zengin mock <presets...> | --schema file`: typed, seeded fixture modules into src/mock. */
export function runMock(names: string[], opts: ScaffoldOptions, cwd: string): string {
  const projectDir = opts.dir ? resolve(cwd, opts.dir) : cwd;
  let schema: MockSchema;
  if (opts.schema) {
    const parsed = JSON.parse(readFileSync(resolve(cwd, opts.schema), "utf8")) as MockSchema;
    if (!parsed || !Array.isArray(parsed.entities)) throw new Error(`${opts.schema} is not a mock schema (expected { entities: [...] }).`);
    schema = { seed: opts.seed ?? parsed.seed, entities: parsed.entities.map((e) => ({ ...e, count: opts.count ?? e.count })) };
  } else {
    if (!names.length) throw new Error(`zengin mock needs preset names or --schema <file>. Presets: ${Object.keys(PRESETS).join(", ")}.`);
    schema = schemaFromPresets(names, { seed: opts.seed, count: opts.count });
  }
  const files = generateMock(schema, { dir: opts.out ?? "src/mock" });
  const written: string[] = [];
  for (const [rel, text] of Object.entries(files)) {
    const abs = resolve(projectDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    written.push(rel);
  }
  const entities = schema.entities.map((e) => `${e.name} (${e.count ?? 20})`).join(", ");
  return [`Wrote ${written.length} files: ${entities}, seed ${schema.seed ?? 7}.`, ...written.map((w) => `  wrote   ${w}`), "", `import { ${schema.entities[0] ? pluralName(schema.entities[0].name) : "rows"} } from "@/mock/${schema.entities[0] ? pluralName(schema.entities[0].name) : "rows"}"; the same data every run.`].join("\n");
}

function pluralName(name: string): string {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${lower}es`;
  return `${lower}s`;
}
