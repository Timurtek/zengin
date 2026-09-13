#!/usr/bin/env node
/**
 * Builds every template's source app into public/templates/<name>/ with a matching base path, so the
 * catalog can embed and link live previews served beside the page. Reads the template list and each
 * template's source directory from the registry just built into public/r, so the two cannot disagree.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
/** Templates whose forms look like an account or checkout page get a visible note on the preview. */
const DEMO_NOTE = new Set(["auth", "storefront"]);

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
  markAsDemo(t);
  console.log(`built public/templates/${t.name}/ from ${t.source}`);
}

/**
 * A hosted preview is a demo, and the page says so where a crawler reads it: noindex on every preview, a
 * title that names the template rather than the screen ("Sign in" on a free subdomain reads as phishing
 * to Safe Browsing), and on the templates with account or order forms a banner saying nothing is sent.
 * Only the built copy changes; the template a project starts from keeps its own title and no banner.
 */
function markAsDemo(t) {
  const file = join(outRoot, t.name, "index.html");
  let html = readFileSync(file, "utf8");
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t.title} template, a Zengin demo</title>`);
  html = html.replace("</head>", '    <meta name="robots" content="noindex, nofollow" />\n  </head>');
  if (DEMO_NOTE.has(t.name)) {
    const note =
      `<p style="margin:0;padding:8px 16px;font:500 12px/1.4 system-ui,sans-serif;text-align:center;background:#1c1b1a;color:#f5f2ec;">` +
      `Demo of the ${t.title} template on Zengin UI. The data is sample data and nothing you type is sent anywhere.</p>`;
    html = html.replace("<body>", `<body>\n    ${note}`);
  }
  writeFileSync(file, html);
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
