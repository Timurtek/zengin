import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fontsHref, patchIndexHtml } from "./html.js";
import type { RegistrySource } from "./load.js";
import type { FontPairing, RegistryItem } from "./schema.js";

/**
 * A pairing is three roles, display, text and code, each a Google Fonts family at the weights the
 * components use. Applying one touches exactly what a theme touches for fonts: the three font tokens
 * in src/theme/brand.css and the one fonts link in index.html. The palette, radii and shadows stay.
 */

export interface FontsSummary {
  name: string;
  title: string;
  description: string;
  pairing: FontPairing;
}

export interface ApplyFontsResult {
  name: string;
  pairing: FontPairing;
  /** Project-relative paths written. */
  files: string[];
  html: boolean;
  /** With selfHost: the font files downloaded into public/fonts. */
  downloaded: string[];
}

/** Registry items are `fonts-<name>`, so a pairing and a theme can share a name; people say the bare name. */
const bare = (name: string): string => name.replace(/^fonts-/, "");

export const FALLBACK_SANS = "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif";
export const FALLBACK_SERIF = "ui-serif, Georgia, \"Times New Roman\", serif";
export const FALLBACK_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export async function listFonts(source: RegistrySource): Promise<FontsSummary[]> {
  const index = await source.index();
  return index.items.filter((i) => i.type === "fonts" && i.pairing).map((i) => ({ name: bare(i.name), title: i.title, description: i.description, pairing: i.pairing! }));
}

/** `Family:400;700` for the fonts link: each role at its own weights. */
export function pairingFamilies(p: FontPairing): string[] {
  const roles = [p.display, p.sans, p.mono];
  const out: string[] = [];
  for (const r of roles) {
    const spec = `${r.family}:${r.weights.join(";")}`;
    if (!out.includes(spec)) out.push(spec);
  }
  return out;
}

/** The three token declarations a pairing sets, with the fallback stack each role deserves. */
export function pairingCss(p: FontPairing): Record<"--font-sans" | "--font-display" | "--font-mono", string> {
  const stack = (family: string, serif: boolean | undefined, then?: string) => `"${family}", ${then ? `"${then}", ` : ""}${serif ? FALLBACK_SERIF : FALLBACK_SANS}`;
  return {
    "--font-sans": stack(p.sans.family, p.sans.serif),
    "--font-display": p.display.family === p.sans.family ? stack(p.display.family, p.display.serif) : stack(p.display.family, p.display.serif, p.sans.family),
    "--font-mono": `"${p.mono.family}", ${FALLBACK_MONO}`,
  };
}

/**
 * Rewrites the font tokens in a brand file. Each declaration is replaced where it is (every block that
 * sets it, so light and dark agree) or added to the first block when the file never set it.
 */
export function applyPairingToCss(css: string, p: FontPairing): string {
  let out = css;
  const missing: string[] = [];
  for (const [prop, value] of Object.entries(pairingCss(p))) {
    const re = new RegExp(`(^[ \\t]*)${prop}\\s*:[^;]*;`, "gm");
    if (re.test(out)) out = out.replace(re, `$1${prop}: ${value};`);
    else missing.push(`  ${prop}: ${value};`);
  }
  if (missing.length) {
    const open = /(:root[^{]*\{[ \t]*\r?\n)/.exec(out);
    out = open ? out.replace(open[0], `${open[0]}${missing.join("\n")}\n`) : `:root {\n${missing.join("\n")}\n}\n\n${out}`;
  }
  return out;
}

export async function applyFonts(opts: { projectDir: string; name: string; source: RegistrySource; selfHost?: boolean; fetcher?: typeof fetch }): Promise<ApplyFontsResult> {
  const dir = resolve(opts.projectDir);
  if (!existsSync(join(dir, "zengin.config.yaml"))) throw new Error(`${dir} has no zengin.config.yaml. Run zengin fonts inside a project made by zengin create, or pass --dir.`);
  const index = await opts.source.index();
  const summary = index.items.find((i) => i.name === `fonts-${bare(opts.name)}` && i.type === "fonts");
  if (!summary) {
    const names = index.items.filter((i) => i.type === "fonts").map((i) => bare(i.name));
    throw new Error(`No pairing "${opts.name}". Pairings: ${names.join(", ")}.`);
  }
  const item: RegistryItem = await opts.source.item(summary.name);
  const pairing = item.pairing;
  if (!pairing) throw new Error(`The registry item "${opts.name}" carries no pairing.`);

  const files: string[] = [];
  const brand = join(dir, "src", "theme", "brand.css");
  const before = existsSync(brand) ? readFileSync(brand, "utf8") : `/* Fonts, set by zengin fonts. */\n\n:root {\n}\n`;
  mkdirSync(dirname(brand), { recursive: true });
  writeFileSync(brand, applyPairingToCss(before, pairing));
  files.push("src/theme/brand.css");

  const families = pairingFamilies(pairing);
  let downloaded: string[] = [];
  let html: boolean;
  if (opts.selfHost) {
    const hosted = await selfHost(dir, families, opts.fetcher ?? fetch);
    downloaded = hosted.downloaded;
    files.push(hosted.cssFile);
    if (hosted.mainPatched) files.push(hosted.mainPatched);
    html = patchIndexHtml(dir, { fonts: null });
  } else {
    html = patchIndexHtml(dir, { fonts: fontsHref(families) });
  }
  if (html) files.push("index.html");
  return { name: bare(item.name), pairing, files, html, downloaded };
}

/**
 * Downloads the woff2 files Google serves for the families into public/fonts and writes the @font-face
 * rules to src/theme/fonts.css, imported from main.tsx, so nothing loads from fonts.googleapis.com at
 * runtime. Google's CSS is fetched with a modern browser's user agent, which is what makes it answer
 * with woff2 and unicode ranges.
 */
async function selfHost(dir: string, families: string[], fetcher: typeof fetch): Promise<{ cssFile: string; downloaded: string[]; mainPatched: string | null }> {
  const href = fontsHref(families);
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
  const res = await fetcher(href, { headers: { "user-agent": ua } });
  if (!res.ok) throw new Error(`Google Fonts answered ${res.status} for ${href}`);
  let css = await res.text();
  const fontsDir = join(dir, "public", "fonts");
  mkdirSync(fontsDir, { recursive: true });
  const downloaded: string[] = [];
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]!))];
  for (const url of urls) {
    const name = url.split("/").slice(-2).join("-").replace(/[^A-Za-z0-9._-]/g, "");
    const file = join(fontsDir, name);
    const r = await fetcher(url);
    if (!r.ok) throw new Error(`Google Fonts answered ${r.status} for ${url}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    downloaded.push(`public/fonts/${name}`);
    css = css.split(url).join(`/fonts/${name}`);
  }
  const cssFile = "src/theme/fonts.css";
  writeFileSync(join(dir, cssFile), `/* Self-hosted by zengin fonts --self-host: ${families.join(", ")}. Files in public/fonts. */\n\n${css.trim()}\n`);

  let mainPatched: string | null = null;
  const main = join(dir, "src", "main.tsx");
  if (existsSync(main)) {
    const src = readFileSync(main, "utf8");
    if (!src.includes('"./theme/fonts.css"')) {
      const anchor = 'import "./theme/brand.css";';
      const next = src.includes(anchor) ? src.replace(anchor, `${anchor}\nimport "./theme/fonts.css";`) : `import "./theme/fonts.css";\n${src}`;
      writeFileSync(main, next);
      mainPatched = "src/main.tsx";
    }
  }
  return { cssFile, downloaded, mainPatched };
}
