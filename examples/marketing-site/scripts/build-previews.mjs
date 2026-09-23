#!/usr/bin/env node
/**
 * Builds every template's source app into public/templates/<name>/ with a matching base path, so the
 * catalog can embed and link live previews served beside the page. Reads the template list and each
 * template's source directory from the registry just built into public/r, so the two cannot disagree.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Zengin's own documentation, served at /docs/. It is an ordinary project on the docs template, built the
// same way a template preview is, which is the point: the documentation for the product is a consumer of it.
{
  const docsRoot = join(repo, "examples", "zengin-docs");
  const out = join(site, "public", "docs");
  rmSync(out, { recursive: true, force: true });
  await build({
    root: docsRoot,
    configFile: join(docsRoot, "vite.config.ts"),
    base: "/docs/",
    publicDir: false,
    logLevel: "error",
    build: { outDir: out, emptyOutDir: true },
  });
  writeDocPages(out);
  console.log("built public/docs/ from examples/zengin-docs");
}

/**
 * A file per documentation page, each with its own title, description and canonical.
 *
 * The docs used to route on the fragment, so twenty-one pages shared one URL and one title: to a search
 * engine they were a single page, and the only substantial prose this project has could not be found. The
 * app now routes on the path; this writes the pages that path asks for. Every copy is the same built
 * document with three tags rewritten, and the assets are absolute, so depth costs nothing.
 */
function writeDocPages(out) {
  const source = join(out, "index.html");
  const shell = readFileSync(source, "utf8");
  const content = readFileSync(join(repo, "examples", "zengin-docs", "src", "content.ts"), "utf8");

  // Read the pages out of the content module the app itself renders, rather than keeping a second list.
  const docs = [...content.matchAll(/slug:\s*"([a-z0-9-]+)",\s*\n\s*section:\s*"[^"]*",\s*\n\s*title:\s*"([^"]+)",\s*\n\s*summary:\s*"([^"]+)"/g)].map((m) => ({
    slug: m[1],
    title: m[2],
    summary: m[3],
  }));
  if (docs.length < 10) throw new Error(`Only ${docs.length} documentation pages were found in content.ts; the shape it is read with must have changed.`);

  for (const doc of docs) {
    const html = shell
      .replace("<title>Zengin docs</title>", `<title>${escapeHtml(doc.title)} — Zengin docs</title>`)
      .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(doc.summary)}"`)
      .replace('<link rel="icon"', `<link rel="canonical" href="https://zengin.timurtek.com/docs/${doc.slug}/" />\n    <link rel="icon"`);
    const dir = join(out, doc.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
  }
  writeFileSync(join(out, "index.html"), shell.replace('<link rel="icon"', '<link rel="canonical" href="https://zengin.timurtek.com/docs/" />\n    <link rel="icon"'));
  writeSitemap(docs.map((d) => `/docs/${d.slug}/`));
  console.log(`wrote ${docs.length} documentation pages, each with its own title and canonical`);
}

/** The sitemap is generated because the pages are: a hand-kept list would be wrong the day a page is added. */
function writeSitemap(docPaths) {
  const paths = ["/", "/why/", "/docs/", ...docPaths, "/storybook/", "/rollup/"];
  const urls = paths.map((p) => `  <url>\n    <loc>https://zengin.timurtek.com${p}</loc>\n  </url>`).join("\n");
  writeFileSync(join(site, "public", "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log(`wrote public/sitemap.xml: ${paths.length} pages`);
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
