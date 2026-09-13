import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ComponentManifest } from "@zengin/engine";
import { LAYOUT, type RegistryItem } from "./schema.js";

export interface InstallResult {
  /** Project-relative paths written, in order. */
  written: string[];
  /** Project-relative paths that existed and were left alone (pass `force` to overwrite). */
  skipped: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Component names now in the manifest. */
  components: string[];
}

/**
 * Writes resolved items into a project: component files with the owned pragma, the manifest entry merged
 * into zengin/components.json with `export.from` pointing at the alias, the stylesheet import, the barrel
 * export, and the story. Templates write their files as-is. Existing files are kept unless `force`.
 */
export function installItems(opts: { projectDir: string; items: RegistryItem[]; version: string; force?: boolean }): InstallResult {
  const { projectDir, items, version } = opts;
  const result: InstallResult = { written: [], skipped: [], dependencies: {}, devDependencies: {}, components: [] };

  const write = (rel: string, content: string, always = false): void => {
    const abs = join(projectDir, rel);
    if (existsSync(abs) && !opts.force && !always) {
      result.skipped.push(rel);
      return;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    result.written.push(rel);
  };

  for (const item of items) {
    Object.assign(result.dependencies, item.dependencies);
    Object.assign(result.devDependencies, item.devDependencies);

    for (const f of item.files) {
      const content = f.kind === "component" && item.manifest ? withPragma(f.content, item.manifest.name, version) : f.content;
      write(f.path, content);
    }

    if (item.manifest) {
      mergeManifest(projectDir, { ...item.manifest, export: item.type === "component" ? { ...item.manifest.export, from: LAYOUT.alias } : item.manifest.export });
      const css = item.files.find((f) => f.kind === "style" && f.path.startsWith(LAYOUT.componentsDir));
      if (css) addStyleImport(projectDir, css.path);
      addBarrelExport(projectDir, item.name);
    }
  }

  const manifestPath = join(projectDir, LAYOUT.definitionsDir, "components.json");
  if (existsSync(manifestPath)) {
    result.components = (JSON.parse(readFileSync(manifestPath, "utf8")) as ComponentManifest[]).map((m) => m.name);
  }
  return result;
}

/** The pragma the engine reads: the file is owned by the project, forked from this system version. */
function withPragma(content: string, component: string, version: string): string {
  if (/zengin-owned/.test(content.slice(0, 500))) return content;
  return `/* zengin-owned ${component}, forked from @zengin/ui@${version} */\n${content}`;
}

function mergeManifest(projectDir: string, entry: ComponentManifest): void {
  const p = join(projectDir, LAYOUT.definitionsDir, "components.json");
  const current: ComponentManifest[] = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as ComponentManifest[]) : [];
  const i = current.findIndex((m) => m.name === entry.name);
  if (i === -1) current.push(entry);
  else current[i] = entry;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(current, null, 2) + "\n");
}

/** Appends `@import "../components/ui/<x>/<x>.css";` to src/styles/index.css once. */
function addStyleImport(projectDir: string, cssPath: string): void {
  const p = join(projectDir, LAYOUT.stylesIndex);
  const rel = "../" + cssPath.replace(/^src\//, "");
  const line = `@import "${rel}";`;
  const current = existsSync(p) ? readFileSync(p, "utf8") : STYLES_INDEX_HEAD;
  if (current.includes(line)) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, current.trimEnd() + "\n" + line + "\n");
}

/** Appends `export * from "./<x>/<x>";` to src/components/ui/index.ts once. */
function addBarrelExport(projectDir: string, name: string): void {
  const p = join(projectDir, LAYOUT.componentsDir, "index.ts");
  const line = `export * from "./${name}/${name}";`;
  const current = existsSync(p) ? readFileSync(p, "utf8") : BARREL_HEAD;
  if (current.includes(line)) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, current.trimEnd() + "\n" + line + "\n");
}

export const STYLES_INDEX_HEAD = `/* Order matters: tokens, then foundation, then components. \`zengin add\` appends component stylesheets here. */
@import "generated/tokens.css";
@import "base.css";
@import "chart.css";
@import "motion.css";
`;

export const BARREL_HEAD = `/* Every component the project owns. \`zengin add\` appends to this file; the engine treats "${LAYOUT.alias}" as the system. */
`;
