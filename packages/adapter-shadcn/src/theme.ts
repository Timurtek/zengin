import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { normalizeColor } from "@zengin/engine";

/**
 * The theme half of a shadcn project: the CSS file where `--background`, `--primary` and friends live,
 * in either the Tailwind 3 shape (HSL triples inside `@layer base`) or the Tailwind 4 shape (oklch values
 * plus an `@theme inline` block that maps them to utilities).
 */

const CANDIDATES = ["app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css", "src/index.css", "src/globals.css", "app/app.css", "src/app/app.css"];
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "storybook-static", "coverage"]);

export interface ThemeSource {
  path: string;
  content: string;
}

export function findThemeCss(projectDir: string): ThemeSource | undefined {
  for (const c of CANDIDATES) {
    const p = join(projectDir, c);
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      if (looksLikeTheme(content)) return { path: c, content };
    }
  }
  // Fall back to any CSS file that defines the two variables every shadcn theme has.
  const found: ThemeSource[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, depth + 1);
      else if (name.endsWith(".css")) {
        const content = readFileSync(p, "utf8");
        if (looksLikeTheme(content)) found.push({ path: relative(projectDir, p).replace(/\\/g, "/"), content });
      }
    }
  };
  walk(projectDir, 0);
  return found[0];
}

function looksLikeTheme(css: string): boolean {
  return /--background\s*:/.test(css) && /--foreground\s*:/.test(css);
}

export interface ParsedTheme {
  /** Variable name (without `--`) -> raw value, from `:root`. */
  light: Record<string, string>;
  /** From `.dark` (or `[data-theme="dark"]`), when present. */
  dark: Record<string, string>;
  /** `--color-*`, `--radius-*`, `--font-*` entries from a Tailwind 4 `@theme` block, when present. */
  themeBlock: Record<string, string>;
  /** Namespaces reset with `--<ns>-*: initial` inside `@theme`, i.e. replaced rather than extended. */
  replacedNamespaces: Set<string>;
  tailwind4: boolean;
}

function block(css: string, selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  const m = selector.exec(css);
  if (!m) return out;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  const start = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = css.slice(start, i);
  for (const d of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim();
  return out;
}

export function parseTheme(css: string): ParsedTheme {
  const tailwind4 = /@import\s+["']tailwindcss["']/.test(css) || /@theme\b/.test(css);
  const light = block(css, /:root\s*\{/);
  const dark = { ...block(css, /\.dark\s*\{/), ...block(css, /\[data-theme=["']dark["']\]\s*\{/) };
  const themeBlock = block(css, /@theme\b[^{]*\{/);
  const replacedNamespaces = new Set<string>();
  for (const [k, v] of Object.entries(themeBlock)) {
    const m = /^([a-z]+(?:-[a-z]+)?)-\*$/.exec(k);
    if (m && v === "initial") replacedNamespaces.add(m[1]!);
  }
  return { light, dark, themeBlock, replacedNamespaces, tailwind4 };
}

/** A theme value as hex, or undefined when it is not a color (`--radius: 0.5rem`, `--font-sans: ...`). */
export function toHex(value: string): string | undefined {
  const v = value.trim();
  if (/^var\(/.test(v)) return undefined;
  return normalizeColor(v);
}

/** `0.5rem` -> 8, `10px` -> 10, `calc(0.5rem - 2px)` -> 6. Undefined when it cannot be evaluated. */
export function toPx(value: string): number | undefined {
  const v = value.trim();
  const single = /^(-?[\d.]+)(px|rem|em)$/.exec(v);
  if (single) return Number(single[1]) * (single[2] === "px" ? 1 : 16);
  const calc = /^calc\(\s*(-?[\d.]+)(px|rem|em)\s*([+-])\s*(-?[\d.]+)(px|rem|em)\s*\)$/.exec(v);
  if (calc) {
    const a = Number(calc[1]) * (calc[2] === "px" ? 1 : 16);
    const b = Number(calc[4]) * (calc[5] === "px" ? 1 : 16);
    return calc[3] === "+" ? a + b : a - b;
  }
  return undefined;
}

export interface DerivedTokens {
  light: Record<string, unknown>;
  dark: Record<string, unknown> | undefined;
  /** Variables that were not colors and not radius, so were left out. */
  skipped: string[];
}

/**
 * shadcn variables become semantic color tokens. `primary` + `primary-foreground` become a group with
 * DEFAULT and foreground; `chart-1`.. and `sidebar-*` follow the same rule. `--radius` becomes the radius
 * scale shadcn derives from it. Spacing is never declared: shadcn projects use Tailwind's scale as their own.
 */
export function deriveTokens(theme: ParsedTheme, fontFamilies: Record<string, string>): DerivedTokens {
  const skipped: string[] = [];

  const colors = (vars: Record<string, string>, includeNonColors: boolean): Record<string, unknown> => {
    const color: Record<string, unknown> = { $type: "color" };
    for (const [name, raw] of Object.entries(vars)) {
      if (name === "radius" || name.startsWith("font-") || name.startsWith("radius-")) continue;
      const hex = toHex(raw);
      if (!hex) {
        if (includeNonColors) skipped.push(`--${name}: ${raw}`);
        continue;
      }
      const m = /^(.*)-(foreground)$/.exec(name);
      if (m) {
        const group = (color[m[1]!] as Record<string, unknown> | undefined) ?? {};
        if (typeof group === "object" && !("$value" in group)) {
          group["foreground"] = { $value: hex };
          if (m[1]! in vars && !("DEFAULT" in group)) group["DEFAULT"] = { $value: toHex(vars[m[1]!]!) ?? hex };
          color[m[1]!] = group;
        }
      } else if (`${name}-foreground` in vars) {
        const group = (color[name] as Record<string, unknown> | undefined) ?? {};
        group["DEFAULT"] = { $value: hex };
        color[name] = group;
      } else {
        color[name] = { $value: hex };
      }
    }
    return color;
  };

  const light: Record<string, unknown> = {
    $description: "Derived from the project's theme CSS by @zengin/adapter-shadcn. Spacing is Tailwind's scale, so no spacing tokens are declared.",
    color: colors(theme.light, true),
  };

  // Radius: Tailwind 4 declares the scale in @theme; Tailwind 3 shadcn config derives sm/md/lg from --radius.
  const radiusBase = theme.light["radius"] ? toPx(theme.light["radius"]) : undefined;
  const radius: Record<string, unknown> = { $type: "dimension", $extensions: { zengin: { extendsDefault: !theme.replacedNamespaces.has("radius") } } };
  const themeRadius = Object.entries(theme.themeBlock).filter(([k]) => k.startsWith("radius-"));
  if (themeRadius.length) {
    for (const [k, v] of themeRadius) {
      const px = evalRadius(v, radiusBase);
      if (px !== undefined) radius[k.slice("radius-".length)] = { $value: `${px}px` };
    }
  } else if (radiusBase !== undefined) {
    radius["lg"] = { $value: `${radiusBase}px` };
    radius["md"] = { $value: `${radiusBase - 2}px` };
    radius["sm"] = { $value: `${radiusBase - 4}px` };
  }
  if (Object.keys(radius).length > 2) light["radius"] = radius;

  const fonts = Object.entries(fontFamilies);
  if (fonts.length) {
    const font: Record<string, unknown> = { $type: "fontFamily", $extensions: { zengin: { extendsDefault: !theme.replacedNamespaces.has("font") } } };
    for (const [k, v] of fonts) font[k] = { $value: v };
    light["font"] = font;
  }

  const dark = Object.keys(theme.dark).length ? { $description: "Derived from the project's .dark theme block.", color: colors(theme.dark, false) } : undefined;
  return { light, dark, skipped };
}

function evalRadius(v: string, base: number | undefined): number | undefined {
  const direct = toPx(v);
  if (direct !== undefined) return direct;
  if (base === undefined) return undefined;
  if (/^var\(--radius\)$/.test(v.trim())) return base;
  const m = /^calc\(\s*var\(--radius\)\s*([+-])\s*(-?[\d.]+)(px|rem)\s*\)$/.exec(v.trim());
  if (m) {
    const d = Number(m[2]) * (m[3] === "px" ? 1 : 16);
    return m[1] === "+" ? base + d : base - d;
  }
  const mul = /^calc\(\s*var\(--radius\)\s*\*\s*([\d.]+)\s*\)$/.exec(v.trim());
  if (mul) return base * Number(mul[1]);
  return undefined;
}
