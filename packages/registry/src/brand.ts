import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zenginui/engine";
import { contrast, hexToOklch, oklchToHex, pushForContrast, type Oklch } from "./color.js";
import { patchIndexHtml, fontsHref } from "./html.js";
import { LAYOUT } from "./schema.js";

export type BrandRadius = "sharp" | "soft" | "round";

export interface BrandOptions {
  projectDir: string;
  /** The product's name: the title, the wordmark, the favicon initial. */
  name: string;
  /** Path to a logo. An SVG also supplies the primary color when none is given. */
  logo?: string;
  /** Primary color as hex. Wins over the logo. */
  primary?: string;
  /** Google Fonts family names. */
  fontDisplay?: string;
  fontSans?: string;
  fontMono?: string;
  radius?: BrandRadius;
}

export interface Palette {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export interface BrandResult {
  name: string;
  primary: string;
  primarySource: "option" | "logo" | "system";
  palette: Palette;
  /** Project-relative paths written. */
  files: string[];
  /** Contrast pairs the palette guarantees, for the record. */
  contrast: { pair: string; ratio: number }[];
  warnings: string[];
  /** The engine on the result. */
  violations: number;
}

/**
 * The brand from one color: primary with its hover, active, soft, soft-foreground and on-primary; neutrals
 * tinted toward the primary's hue; both schemes. Every pairing a component relies on is pushed until it
 * meets WCAG AA, so a brand can be any hue without producing an unreadable button.
 */
export function derivePalette(primaryHex: string): Palette {
  const p = hexToOklch(primaryHex);
  const hue = p.h;
  const nc = p.c < 0.02 ? 0 : Math.min(0.018, p.c * 0.12); // neutrals lean toward the accent, faintly
  const n = (l: number, c = nc): string => oklchToHex({ l, c, h: hue });
  const at = (l: number, c: number): Oklch => ({ l, c, h: hue });

  // Light scheme.
  const light: Record<string, string> = {};
  const surface = "#FFFFFF";
  light["--color-surface"] = surface;
  light["--color-surface-raised"] = n(0.975, nc * 0.5);
  light["--color-surface-sunken"] = n(0.95, nc * 0.7);
  const text = n(0.22);
  light["--color-surface-overlay"] = `${text}CC`;
  light["--color-text"] = text;
  light["--color-text-muted"] = pushForContrast(at(0.48, nc), surface, 4.5, "darker");
  light["--color-text-subtle"] = pushForContrast(at(0.66, nc), surface, 3, "darker");
  light["--color-border"] = n(0.9, nc * 0.6);
  light["--color-border-strong"] = n(0.8, nc * 0.8);

  const primary = pushForContrast(p, surface, 3, "darker");
  const pl = hexToOklch(primary);
  light["--color-primary"] = primary;
  light["--color-primary-hover"] = oklchToHex({ ...pl, l: pl.l - 0.06 });
  light["--color-primary-active"] = oklchToHex({ ...pl, l: pl.l - 0.12 });
  const soft = oklchToHex(at(0.94, Math.min(0.06, p.c * 0.4)));
  light["--color-primary-soft"] = soft;
  light["--color-primary-soft-hover"] = oklchToHex(at(0.89, Math.min(0.08, p.c * 0.5)));
  light["--color-primary-soft-foreground"] = pushForContrast(at(0.42, Math.min(p.c, 0.15)), soft, 4.5, "darker");
  light["--color-on-primary"] = contrast("#FFFFFF", primary) >= 4.5 ? "#FFFFFF" : pushForContrast(at(0.22, nc), primary, 4.5, "darker");
  light["--color-focus"] = primary;

  light["--color-neutral"] = n(0.3);
  light["--color-neutral-hover"] = n(0.38);
  light["--color-neutral-active"] = n(0.22);
  light["--color-neutral-soft"] = n(0.93, nc * 0.7);
  light["--color-neutral-soft-hover"] = n(0.88, nc * 0.8);
  light["--color-neutral-soft-foreground"] = text;
  light["--color-on-neutral"] = "#FFFFFF";

  // Dark scheme.
  const dark: Record<string, string> = {};
  const dSurface = n(0.18, nc);
  dark["--color-surface"] = dSurface;
  dark["--color-surface-raised"] = n(0.23, nc);
  dark["--color-surface-sunken"] = n(0.13, nc);
  const dText = n(0.95, nc * 0.3);
  dark["--color-surface-overlay"] = `${n(0.13, nc)}CC`;
  dark["--color-text"] = dText;
  dark["--color-text-muted"] = pushForContrast(at(0.72, nc * 0.5), dSurface, 4.5, "lighter");
  dark["--color-text-subtle"] = pushForContrast(at(0.55, nc * 0.5), dSurface, 3, "lighter");
  dark["--color-border"] = n(0.29, nc);
  dark["--color-border-strong"] = n(0.37, nc);

  const dPrimary = pushForContrast(at(Math.max(p.l, 0.72), Math.min(p.c, 0.17)), dSurface, 3, "lighter");
  const dpl = hexToOklch(dPrimary);
  dark["--color-primary"] = dPrimary;
  dark["--color-primary-hover"] = oklchToHex({ ...dpl, l: Math.min(0.97, dpl.l + 0.05) });
  dark["--color-primary-active"] = oklchToHex({ ...dpl, l: Math.min(0.99, dpl.l + 0.1) });
  const dSoft = oklchToHex(at(0.3, Math.min(0.08, p.c * 0.5)));
  dark["--color-primary-soft"] = dSoft;
  dark["--color-primary-soft-hover"] = oklchToHex(at(0.35, Math.min(0.09, p.c * 0.55)));
  dark["--color-primary-soft-foreground"] = pushForContrast(at(0.85, Math.min(0.1, p.c * 0.6)), dSoft, 4.5, "lighter");
  dark["--color-on-primary"] = contrast(dSurface, dPrimary) >= 4.5 ? n(0.13, nc) : "#FFFFFF";
  dark["--color-focus"] = dPrimary;

  dark["--color-neutral"] = n(0.9, nc * 0.5);
  dark["--color-neutral-hover"] = n(0.84, nc * 0.5);
  dark["--color-neutral-active"] = n(0.95, nc * 0.3);
  dark["--color-neutral-soft"] = n(0.28, nc);
  dark["--color-neutral-soft-hover"] = n(0.34, nc);
  dark["--color-neutral-soft-foreground"] = dText;
  dark["--color-on-neutral"] = n(0.13, nc);

  return { light, dark };
}

/** The pairings the components rely on, with the ratios the palette reached. */
export function paletteContrast(p: Palette): { pair: string; ratio: number }[] {
  const pairs: [string, string, string][] = [
    ["text on surface", "--color-text", "--color-surface"],
    ["muted on surface", "--color-text-muted", "--color-surface"],
    ["primary on surface", "--color-primary", "--color-surface"],
    ["on-primary on primary", "--color-on-primary", "--color-primary"],
    ["soft-foreground on soft", "--color-primary-soft-foreground", "--color-primary-soft"],
  ];
  const out: { pair: string; ratio: number }[] = [];
  for (const [scheme, vars] of [["light", p.light], ["dark", p.dark]] as const) {
    for (const [label, a, b] of pairs) out.push({ pair: `${scheme}: ${label}`, ratio: Math.round(contrast(vars[a]!, vars[b]!) * 100) / 100 });
  }
  return out;
}

const RADII: Record<BrandRadius, Record<string, string> | null> = {
  sharp: { "--radius-sm": "0px", "--radius-md": "0px", "--radius-lg": "0px", "--radius-xl": "0px" },
  soft: null,
  round: { "--radius-sm": "8px", "--radius-md": "12px", "--radius-lg": "16px", "--radius-xl": "24px" },
};

const FALLBACK_SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FALLBACK_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export function renderBrandCss(opts: { name: string; palette: Palette; fontDisplay?: string; fontSans?: string; fontMono?: string; radius?: BrandRadius; logo: boolean }): string {
  const head: string[] = [];
  if (opts.fontSans) head.push(`  --font-sans: "${opts.fontSans}", ${FALLBACK_SANS};`);
  if (opts.fontDisplay) head.push(`  --font-display: "${opts.fontDisplay}", ${opts.fontSans ? `"${opts.fontSans}", ` : ""}${FALLBACK_SANS};`);
  else if (opts.fontSans) head.push(`  --font-display: "${opts.fontSans}", ${FALLBACK_SANS};`);
  if (opts.fontMono) head.push(`  --font-mono: "${opts.fontMono}", ${FALLBACK_MONO};`);
  const radii = RADII[opts.radius ?? "soft"];
  if (radii) {
    head.push("");
    for (const [k, v] of Object.entries(radii)) head.push(`  ${k}: ${v};`);
  }
  const block = (vars: Record<string, string>): string => Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n");

  return `/*
 * The ${opts.name} brand, generated by \`zengin brand\` from one color. Edit freely: this is the one file in the
 * project that may hold literals, and every component wears whatever it says. Re-run \`zengin brand\` to
 * regenerate from zengin/brand.json, or hand-tune the values below.
 */

:root,
[data-theme="light"] {
${head.length ? head.join("\n") + "\n\n" : ""}${block(opts.palette.light)}
}

[data-theme="dark"] {
${block(opts.palette.dark)}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${block(opts.palette.dark).replace(/^/gm, "  ")}
  }
}

/* The wordmark, for a header or a footer: the logo and the name, in the display face. */
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
  text-decoration: none;
}

.brand-mark__logo {
  width: 1.5em;
  height: 1.5em;
  object-fit: contain;
}
`;
}

/** The most saturated color an SVG paints with, or undefined for a monochrome or unreadable file. */
export function primaryFromSvg(svg: string): string | undefined {
  const found = new Set<string>();
  for (const m of svg.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) found.add(`#${m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!}`.toUpperCase());
  for (const m of svg.matchAll(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)) {
    found.add(`#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase());
  }
  let best: { hex: string; c: number } | undefined;
  for (const hex of found) {
    const { c, l } = hexToOklch(hex);
    if (c < 0.04 || l < 0.15 || l > 0.95) continue; // greys, near-black, near-white
    if (!best || c > best.c) best = { hex, c };
  }
  return best?.hex;
}

/** The favicon when there is no logo: the name's initial on the primary, in the display face. */
export function faviconSvg(name: string, primary: string, onPrimary: string, radius: BrandRadius): string {
  const initial = (name.trim().charAt(0) || "Z").toUpperCase();
  const rx = radius === "sharp" ? 0 : radius === "round" ? 16 : 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="${primary}"/><text x="32" y="44" text-anchor="middle" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="${onPrimary}">${initial}</text></svg>\n`;
}

/** Applies a brand to a project: brand.css, brand.json, the logo and favicon, the wordmark, and index.html. */
export async function brandProject(opts: BrandOptions): Promise<BrandResult> {
  const dir = resolve(opts.projectDir);
  if (!existsSync(join(dir, "zengin.config.yaml"))) throw new Error(`${dir} has no zengin.config.yaml. Run zengin brand inside a project made by zengin create, or pass --dir.`);
  if (!opts.name.trim()) throw new Error("zengin brand needs --name.");
  const warnings: string[] = [];
  const files: string[] = [];
  const write = (rel: string, content: string): void => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
    files.push(rel);
  };

  // The logo: copied into public/, and read for a color when it is an SVG.
  let logoPublic: string | undefined;
  let logoPrimary: string | undefined;
  if (opts.logo) {
    const src = resolve(dir, opts.logo);
    if (!existsSync(src)) throw new Error(`Logo not found: ${src}`);
    const ext = extname(src).toLowerCase();
    if (![".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) throw new Error(`Logo must be an SVG, PNG, JPEG or WebP (got ${basename(src)}).`);
    logoPublic = `logo${ext}`;
    mkdirSync(join(dir, "public"), { recursive: true });
    copyFileSync(src, join(dir, "public", logoPublic));
    files.push(`public/${logoPublic}`);
    if (ext === ".svg") logoPrimary = primaryFromSvg(readFileSync(src, "utf8"));
    else if (!opts.primary) warnings.push(`A ${ext.slice(1).toUpperCase()} logo does not supply a color; pass --primary <hex> to set one. Using the system default.`);
  }

  let primary: string;
  let primarySource: BrandResult["primarySource"];
  if (opts.primary) {
    primary = normalizeHex(opts.primary);
    primarySource = "option";
  } else if (logoPrimary) {
    primary = logoPrimary;
    primarySource = "logo";
  } else {
    primary = systemPrimary(dir);
    primarySource = "system";
    if (opts.logo && extname(opts.logo).toLowerCase() === ".svg") warnings.push("The logo has no saturated color to take a primary from. Using the system default; pass --primary <hex> to set one.");
  }

  const palette = derivePalette(primary);
  const radius = opts.radius ?? "soft";
  write("src/theme/brand.css", renderBrandCss({ name: opts.name, palette, fontDisplay: opts.fontDisplay, fontSans: opts.fontSans, fontMono: opts.fontMono, radius, logo: Boolean(logoPublic) }));
  write(
    `${LAYOUT.definitionsDir}/brand.json`,
    JSON.stringify({ name: opts.name, primary, primarySource, logo: logoPublic ? `public/${logoPublic}` : null, fontDisplay: opts.fontDisplay ?? null, fontSans: opts.fontSans ?? null, fontMono: opts.fontMono ?? null, radius }, null, 2) + "\n",
  );

  const icon = logoPublic && logoPublic.endsWith(".svg") ? `/${logoPublic}` : "/favicon.svg";
  if (icon === "/favicon.svg") write("public/favicon.svg", faviconSvg(opts.name, palette.light["--color-primary"]!, palette.light["--color-on-primary"]!, radius));

  write(
    "src/brand.ts",
    `/** Generated by \`zengin brand\`. Import it wherever the product names itself. */
export const brand = {
  name: ${JSON.stringify(opts.name)},
  logo: ${logoPublic ? JSON.stringify(`/${logoPublic}`) : "null"},
} as const;
`,
  );
  write(
    "src/components/brand-mark.tsx",
    `import { brand } from "../brand";

/** The logo and the name, for a header or a footer. Styled by .brand-mark in src/theme/brand.css. */
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <a className="brand-mark" href={href} aria-label={brand.name}>
      {brand.logo && <img className="brand-mark__logo" src={brand.logo} alt="" />}
      {brand.name}
    </a>
  );
}
`,
  );

  const families = [opts.fontDisplay, opts.fontSans, opts.fontMono].filter((f): f is string => Boolean(f));
  const html = patchIndexHtml(dir, { title: opts.name, themeColor: palette.light["--color-primary"], icon, fonts: families.length ? fontsHref(families) : null });
  if (html) files.push("index.html");
  if (families.length) warnings.push("Fonts load from Google Fonts at weights 400 to 700; open the page once to confirm each family has them.");

  const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
  const resolved = resolveConfig(config, projectDir);
  const engine = await createEngine(resolved);
  const violations = engine.check(readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude)).length;

  return { name: opts.name, primary, primarySource, palette, files, contrast: paletteContrast(palette), warnings, violations };
}

function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`--primary must be a hex color like #1B3FE4 (got ${hex}).`);
  const s = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  return `#${s.toUpperCase()}`;
}

function systemPrimary(dir: string): string {
  const p = join(dir, LAYOUT.definitionsDir, "tokens.json");
  try {
    const tokens = JSON.parse(readFileSync(p, "utf8")) as { color?: { primary?: { DEFAULT?: { $value?: string } } } };
    const v = tokens.color?.primary?.DEFAULT?.$value;
    if (v && /^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  } catch {
    // fall through
  }
  return "#2563EB";
}
