#!/usr/bin/env node
/**
 * Builds every template's source app into public/templates/<name>/ with a matching base path, so the
 * catalog can embed and link live previews served beside the page. Reads the template list and each
 * template's source directory from the registry just built into public/r, so the two cannot disagree.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(site, "..", "..");
const indexPath = join(site, "public", "r", "index.json");
if (!existsSync(indexPath)) {
  console.error("public/r/index.json is missing. Run the registry build first: node ../../packages/cli/dist/index.js registry build --out public/r");
  process.exit(2);
}
const index = JSON.parse(readFileSync(indexPath, "utf8"));
const templates = index.items.filter((i) => i.type === "template" && i.source);
const outRoot = join(site, "public", "templates");
rmSync(outRoot, { recursive: true, force: true });

for (const t of templates) {
  const root = join(repo, t.source);
  await build({
    root,
    configFile: join(root, "vite.config.ts"),
    base: `/templates/${t.name}/`,
    publicDir: false, // the site's public/ is the one that is served; a nested copy would recurse
    logLevel: "error",
    build: { outDir: join(outRoot, t.name), emptyOutDir: true },
  });
  console.log(`built public/templates/${t.name}/ from ${t.source}`);
}

// Storybook for Zengin UI, served at /storybook/. Always for a site build (--storybook); for dev only when
// it is not there yet, since it takes a moment and rarely changes underneath a page edit.
const storybookOut = join(site, "public", "storybook");
if (process.argv.includes("--storybook") || !existsSync(join(storybookOut, "index.html"))) {
  const ui = join(repo, "packages", "ui");
  // shell: true is what runs pnpm's .cmd shim on Windows, and it splits on spaces, so the path is quoted.
  execFileSync("pnpm", ["exec", "storybook", "build", "--output-dir", `"${storybookOut}"`, "--quiet"], { cwd: ui, stdio: "inherit", shell: true });
  console.log("built public/storybook/ from packages/ui");
}
