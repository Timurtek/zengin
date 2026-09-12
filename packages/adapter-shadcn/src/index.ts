import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentManifest } from "@zengin/engine";
import { scanUiDir } from "./components.js";
import { readTailwind } from "./tailwind.js";
import { deriveTokens, findThemeCss, parseTheme } from "./theme.js";

export interface ShadcnDerivation {
  tokens: Record<string, unknown>;
  tokensDark: Record<string, unknown> | undefined;
  components: ComponentManifest[];
  config: string;
  report: {
    themeFile: string;
    tailwind: 3 | 4 | undefined;
    uiDir: string;
    tokenCount: number;
    darkOverrides: number;
    componentCount: number;
    skippedFiles: string[];
    skippedVariables: string[];
    review: string[];
  };
}

/**
 * Reads a shadcn/ui project and derives everything the engine needs. Nothing is executed: the theme CSS,
 * the Tailwind config and the ui components are read as text.
 */
export function deriveShadcn(projectDir: string): ShadcnDerivation {
  const theme = findThemeCss(projectDir);
  if (!theme) throw new Error("No theme stylesheet found: looked for a CSS file defining --background and --foreground (app/globals.css, src/app/globals.css, styles/globals.css, ...).");
  const tw = readTailwind(projectDir);
  if (!tw.uiDir) throw new Error("No ui directory found: looked at components.json aliases, tsconfig paths, and components/ui, src/components/ui.");

  const parsed = parseTheme(theme.content);
  for (const ns of tw.replacedNamespaces) parsed.replacedNamespaces.add(ns);
  // Tailwind 4 declares fonts in @theme; Tailwind 3 in the config.
  const fonts = { ...tw.fontFamilies };
  for (const [k, v] of Object.entries(parsed.themeBlock)) if (k.startsWith("font-") && !k.includes("weight")) fonts[k.slice(5)] = v;
  const { light, dark, skipped } = deriveTokens(parsed, fonts);

  const scan = scanUiDir(projectDir, tw.uiDir, tw.uiAlias);
  const components = scan.components.map((c) => c.manifest);

  const config = renderConfig(tw.uiAlias, tw.uiDir, theme.path, tw.major !== undefined);

  const count = (o: Record<string, unknown>): number =>
    Object.entries(o).reduce((n, [k, v]) => (k.startsWith("$") ? n : v && typeof v === "object" && "$value" in (v as object) ? n + 1 : n + count(v as Record<string, unknown>)), 0);

  return {
    tokens: light,
    tokensDark: dark,
    components,
    config,
    report: {
      themeFile: theme.path,
      tailwind: tw.major,
      uiDir: tw.uiDir,
      tokenCount: count(light),
      darkOverrides: dark ? count(dark) : 0,
      componentCount: components.length,
      skippedFiles: scan.skipped,
      skippedVariables: skipped,
      review: scan.components.flatMap((c) => c.review),
    },
  };
}

function renderConfig(uiAlias: string, uiDir: string, themeFile: string, tailwind: boolean): string {
  const themeDir = themeFile.includes("/") ? themeFile.slice(0, themeFile.lastIndexOf("/")) : ".";
  return `# Derived by @zengin/adapter-shadcn. Definitions live in ./zengin; regenerate with: zengin init --from shadcn --force
system:
  package: "${uiAlias}"
  version: "0.0.0"
  definitions: ./zengin
  sources: ["${uiAlias}/*"]

scope:
  include: ["app/**/*.{ts,tsx,css}", "src/**/*.{ts,tsx,css}", "components/**/*.{ts,tsx,css}", "lib/**/*.{ts,tsx}", "styles/**/*.css"]
  exclude: ["**/node_modules/**", "**/*.test.{ts,tsx}", "**/*.stories.{ts,tsx}"]
  foundations: ["${themeDir}/**/*.css"]
  ownership: ["${uiDir}/**"]

classes:
  tailwind: ${tailwind ? "true" : "auto"}

rules:
  color-literal: { severity: error, allow: semantic }
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: warn      # shadcn projects use className freely; tighten per component in components.json
  component-substitution: error
`;
}

export interface WriteResult {
  written: string[];
}

/** Writes the derivation into the project. Refuses to overwrite existing files unless `force`. */
export function writeShadcn(projectDir: string, d: ShadcnDerivation, force = false): WriteResult {
  const targets: [string, string][] = [
    ["zengin/tokens.json", JSON.stringify(d.tokens, null, 2) + "\n"],
    ["zengin/components.json", JSON.stringify(d.components, null, 2) + "\n"],
    ["zengin.config.yaml", d.config],
  ];
  if (d.tokensDark) targets.push(["zengin/tokens.dark.json", JSON.stringify(d.tokensDark, null, 2) + "\n"]);
  const existing = targets.map(([p]) => p).filter((p) => existsSync(join(projectDir, p)));
  if (existing.length && !force) throw new Error(`Refusing to overwrite ${existing.join(", ")}. Pass --force to regenerate.`);
  mkdirSync(join(projectDir, "zengin"), { recursive: true });
  for (const [p, content] of targets) writeFileSync(join(projectDir, p), content);
  return { written: targets.map(([p]) => p) };
}

export function renderReport(d: ShadcnDerivation): string {
  const r = d.report;
  const lines = [
    `Theme: ${r.themeFile} (Tailwind ${r.tailwind ?? "version unknown"})`,
    `Tokens: ${r.tokenCount} light, ${r.darkOverrides} dark overrides`,
    `Components: ${r.componentCount} from ${r.uiDir}`,
  ];
  if (r.skippedFiles.length) lines.push(`Skipped (no component export): ${r.skippedFiles.join(", ")}`);
  if (r.skippedVariables.length) lines.push(`Not tokens (not colors): ${r.skippedVariables.join("; ")}`);
  lines.push("", "Defaults to review in zengin/components.json:");
  for (const line of r.review) lines.push(`  ${line}`);
  lines.push("", "Next: zengin check");
  return lines.join("\n");
}

export { deriveComponent } from "./components.js";
export { deriveTokens, parseTheme } from "./theme.js";
