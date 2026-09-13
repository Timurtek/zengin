import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { derivePackage, renderReport as renderPackageReport, writePackage } from "@zenginui/adapter-css";
import { deriveShadcn, renderReport, writeShadcn } from "@zenginui/adapter-shadcn";

export const CONFIG_TEMPLATE = `# Zengin policy for this project. The design system ships the definitions; this file says how strictly they apply.
system:
  package: "@zenginui/ui"           # the package that ships tokens.json and components.json
  # version: "1.2.0"              # read from node_modules when omitted
  sources: ["@zenginui/ui"]         # import sources that count as the system (globs allowed)
  # definitions: ./design-system  # override the definitions directory (default: node_modules/<package>/zengin)

scope:
  include: ["src/**/*.{ts,tsx,js,jsx,css}"]
  exclude: ["**/*.stories.{ts,tsx}", "**/*.test.{ts,tsx}"]
  foundations: ["src/theme/**"]   # literals live here; not checked
  ownership: []                   # paths where you have taken ownership of a component; contract and substitution rules are off there

classes:
  tailwind: auto                  # auto | true | false; auto enables the adapter when package.json depends on tailwindcss

rules:
  color-literal: { severity: error, allow: semantic }   # allow: semantic | palette
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: error
  component-substitution: error
  # component-substitution:
  #   severity: error
  #   map: { "@headlessui/react#Dialog": Dialog }       # extra shadowed imports beyond the manifest's
`;

/** Writes zengin.config.yaml into `dir`. Refuses to overwrite. Returns the path written. */
export function init(dir: string): string {
  const path = join(dir, "zengin.config.yaml");
  if (existsSync(path)) throw new Error(`${path} already exists. Delete it first if you want a fresh template.`);
  writeFileSync(path, CONFIG_TEMPLATE);
  return path;
}

/** Derives definitions and a config from a shadcn/ui project and writes them. Returns the report text. */
export function initFromShadcn(dir: string, force: boolean): string {
  const derivation = deriveShadcn(dir);
  const { written } = writeShadcn(dir, derivation, force);
  return `Wrote ${written.join(", ")}

${renderReport(derivation)}`;
}

/** Derives definitions and a config from an installed package's stylesheet and type declarations. Returns the report text. */
export function initFromPackage(dir: string, pkgName: string, force: boolean): string {
  const derivation = derivePackage(dir, pkgName);
  const { written } = writePackage(dir, derivation, force);
  return `Wrote ${written.join(", ")}

${renderPackageReport(derivation)}`;
}
