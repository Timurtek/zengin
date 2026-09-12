import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fontsHref, patchIndexHtml } from "./html.js";
import type { RegistrySource } from "./load.js";
import type { RegistryItem } from "./schema.js";

export interface ThemeSummary {
  name: string;
  title: string;
  description: string;
  fonts: string[];
}

export interface ApplyThemeResult {
  name: string;
  /** Project-relative paths written. */
  files: string[];
  fonts: string[];
  html: boolean;
}

/** Every theme the registry offers. */
export async function listThemes(source: RegistrySource): Promise<ThemeSummary[]> {
  const index = await source.index();
  return index.items.filter((i) => i.type === "theme").map((i) => ({ name: i.name, title: i.title, description: i.description, fonts: i.fonts ?? [] }));
}

/**
 * Swaps the project's brand for a theme from the registry: the theme's files replace what is there
 * (a theme is the whole brand, not an addition), and index.html gets the theme's fonts link, replacing
 * the previous theme's. Everything else in the project is untouched, which is the point.
 */
export async function applyTheme(opts: { projectDir: string; name: string; source: RegistrySource }): Promise<ApplyThemeResult> {
  const dir = resolve(opts.projectDir);
  if (!existsSync(join(dir, "zengin.config.yaml"))) throw new Error(`${dir} has no zengin.config.yaml. Run zengin theme inside a project made by zengin create, or pass --dir.`);
  const index = await opts.source.index();
  const summary = index.items.find((i) => i.name === opts.name && i.type === "theme");
  if (!summary) {
    const names = index.items.filter((i) => i.type === "theme").map((i) => i.name);
    throw new Error(`No theme "${opts.name}". Themes: ${names.join(", ")}.`);
  }
  const item: RegistryItem = await opts.source.item(opts.name);

  const files: string[] = [];
  for (const f of item.files) {
    const abs = join(dir, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content);
    files.push(f.path);
  }
  const fonts = item.fonts ?? [];
  const html = patchIndexHtml(dir, { fonts: fonts.length ? fontsHref(fonts) : null });
  return { name: item.name, files, fonts, html };
}
