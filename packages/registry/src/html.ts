import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface HtmlPatch {
  title?: string;
  themeColor?: string;
  /** href for the icon link. */
  icon?: string;
  /** Google Fonts stylesheet href; null removes the one a theme or brand added before. */
  fonts?: string | null;
}

const MARK = "data-zengin";

/**
 * Edits index.html in place: the title, the theme-color meta, the icon, and one fonts link the CLI owns
 * (marked with data-zengin so a later theme replaces it, never duplicates it). Returns false when there
 * is no index.html to patch.
 */
export function patchIndexHtml(projectDir: string, patch: HtmlPatch): boolean {
  const p = join(projectDir, "index.html");
  if (!existsSync(p)) return false;
  let html = readFileSync(p, "utf8");

  if (patch.title !== undefined) {
    const title = `<title>${escapeHtml(patch.title)}</title>`;
    html = /<title>[\s\S]*?<\/title>/.test(html) ? html.replace(/<title>[\s\S]*?<\/title>/, title) : insertInHead(html, title);
  }
  if (patch.themeColor !== undefined) {
    const meta = `<meta name="theme-color" content="${patch.themeColor}" />`;
    html = /<meta\s+name="theme-color"[^>]*>/.test(html) ? html.replace(/<meta\s+name="theme-color"[^>]*>/, meta) : insertInHead(html, meta);
  }
  if (patch.icon !== undefined) {
    const link = `<link rel="icon" href="${patch.icon}" />`;
    html = /<link\s+rel="icon"[^>]*>/.test(html) ? html.replace(/<link\s+rel="icon"[^>]*>/, link) : insertInHead(html, link);
  }
  if (patch.fonts !== undefined) {
    const owned = new RegExp(`\\s*<link[^>]*${MARK}="fonts"[^>]*>`, "g");
    html = html.replace(owned, "");
    if (patch.fonts) {
      const link = `<link rel="stylesheet" href="${patch.fonts}" ${MARK}="fonts" />`;
      html = insertInHead(html, link);
    }
  }
  writeFileSync(p, html);
  return true;
}

/** The Google Fonts css2 href for the families, at the four weights components use. */
export function fontsHref(families: string[]): string {
  const unique = [...new Set(families.map((f) => f.trim()).filter(Boolean))];
  const params = unique.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

function insertInHead(html: string, tag: string): string {
  if (/<\/head>/.test(html)) return html.replace(/(\s*)<\/head>/, `\n    ${tag}$1</head>`);
  return `${tag}\n${html}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
