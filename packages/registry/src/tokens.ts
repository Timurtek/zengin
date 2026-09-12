import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadTokens, type Token } from "@zengin/engine";

/**
 * tokens.json (and tokens.dark.json when present) to a stylesheet of custom properties, using the engine's
 * own token loader so the variable names are exactly the ones the rules check for. Themes attach to any
 * element: an explicit data-theme wins; without one, the system preference decides.
 */
export function buildTokensCss(definitionsDir: string): { css: string; light: number; dark: number } {
  const lightPath = join(definitionsDir, "tokens.json");
  if (!existsSync(lightPath)) throw new Error(`No tokens.json in ${definitionsDir}.`);
  const light = loadTokens(JSON.parse(readFileSync(lightPath, "utf8")));
  const darkPath = join(definitionsDir, "tokens.dark.json");
  const dark = existsSync(darkPath) ? loadTokens(JSON.parse(readFileSync(darkPath, "utf8"))) : [];

  const lightVars = new Set(light.map((t) => t.cssVar));
  const unknown = dark.filter((t) => !lightVars.has(t.cssVar)).map((t) => t.cssVar);
  if (unknown.length) throw new Error(`tokens.dark.json defines tokens missing from tokens.json: ${unknown.join(", ")}`);

  const parts = [
    "/* Generated from zengin/tokens.json and zengin/tokens.dark.json by `zengin tokens`. Do not edit. */",
    "",
    block(':root, [data-theme="light"]', light),
  ];
  if (dark.length) {
    parts.push("", block('[data-theme="dark"]', dark), "", "@media (prefers-color-scheme: dark) {", indent(block(':root:not([data-theme="light"])', dark)), "}");
  }
  return { css: parts.join("\n") + "\n", light: light.length, dark: dark.length };
}

export function writeTokensCss(definitionsDir: string, outFile: string): { light: number; dark: number } {
  const { css, light, dark } = buildTokensCss(definitionsDir);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, css);
  return { light, dark };
}

function block(selector: string, tokens: Token[]): string {
  return `${selector} {\n${tokens.map((t) => `  ${t.cssVar}: ${t.value};`).join("\n")}\n}`;
}

function indent(s: string): string {
  return s
    .split("\n")
    .map((l) => (l ? `  ${l}` : l))
    .join("\n");
}
