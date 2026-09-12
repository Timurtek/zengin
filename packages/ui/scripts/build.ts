/**
 * Builds the stylesheet.
 *
 * 1. tokens.json and tokens.dark.json -> src/styles/generated/tokens.css, using the engine's own
 *    token loader so the CSS variable names are exactly the ones the rules check for.
 * 2. src/styles/index.css lists every stylesheet in order; they are concatenated into dist/zengin.css.
 *
 * `--tokens-only` runs step 1 alone (tests need the generated file, not the bundle).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, type Token } from "@zengin/engine";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function block(selector: string, tokens: Token[]): string {
  const lines = tokens.map((t) => `  ${t.cssVar}: ${t.value};`);
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

function buildTokens(): void {
  const light = loadTokens(JSON.parse(read("zengin/tokens.json")));
  const dark = loadTokens(JSON.parse(read("zengin/tokens.dark.json")));

  const lightVars = new Set(light.map((t) => t.cssVar));
  const unknown = dark.filter((t) => !lightVars.has(t.cssVar)).map((t) => t.cssVar);
  if (unknown.length) throw new Error(`tokens.dark.json defines tokens missing from tokens.json: ${unknown.join(", ")}`);

  // Themes attach to any element, so a subtree can be dark inside a light page. An explicit
  // data-theme always wins; without one, the system preference decides.
  const css = [
    "/* Generated from zengin/tokens.json and zengin/tokens.dark.json by scripts/build.ts. Do not edit. */",
    "",
    block(':root, [data-theme="light"]', light),
    "",
    block('[data-theme="dark"]', dark),
    "",
    "@media (prefers-color-scheme: dark) {",
    block('  :root:not([data-theme="light"])', dark).replace(/\n {2}/g, "\n    ").replace(/^ {2}/, "  "),
    "}",
    "",
  ].join("\n");

  mkdirSync(join(root, "src/styles/generated"), { recursive: true });
  writeFileSync(join(root, "src/styles/generated/tokens.css"), css);
  console.log(`tokens.css: ${light.length} tokens, ${dark.length} dark overrides`);
}

function buildBundle(): void {
  const index = read("src/styles/index.css");
  const imports = [...index.matchAll(/@import\s+"([^"]+)";/g)].map((m) => m[1]!);
  const parts = imports.map((rel) => `/* ${rel} */\n${read(join("src/styles", rel))}`);
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist/zengin.css"), `/* @zengin/ui */\n\n${parts.join("\n\n")}`);
  console.log(`zengin.css: ${imports.length} stylesheets`);
}

buildTokens();
if (!process.argv.includes("--tokens-only")) buildBundle();
