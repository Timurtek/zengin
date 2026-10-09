import { normalizeColor } from "./tokens.js";
import type { Token } from "../types.js";

/**
 * A project's brand file: the token overrides `zengin brand`, `zengin theme` and `zengin fonts` write, and the
 * one foundation a project's look lives in. The token files hold the system's defaults; this file is what the
 * browser actually shows, so it is what literals are matched against and what Figma is exported in.
 */
export const BRAND_CSS = "src/theme/brand.css";

/**
 * The custom properties a brand file sets, read the way the browser reads it. The light block is the rule whose
 * selector list holds `:root` or `[data-theme="light"]`; the dark block is `[data-theme="dark"]`. Dark falls back
 * to the light block, as the cascade does under an explicit data-theme="dark": `:root` matches there too, and the
 * brand loads after the token stylesheet. The prefers-color-scheme copy of the dark block inside @media is
 * skipped; a property set only there is reported.
 */
export interface ParsedBrandCss {
  light: Record<string, string>;
  dark: Record<string, string>;
  /** Selectors of rules that set custom properties but are neither the light nor the dark block. */
  ignored: { selector: string; properties: string[] }[];
  /** Custom properties set inside @media and nowhere outside it. */
  mediaOnly: string[];
}

const LIGHT = new Set([":root", "html", "[data-theme=light]", ":root[data-theme=light]", "html[data-theme=light]"]);
const DARK = new Set(["[data-theme=dark]", ":root[data-theme=dark]", "html[data-theme=dark]"]);
// `[data-theme="dark"]`, `[data-theme='dark']` and `[data-theme=dark]` are one selector
const canon = (s: string): string => s.replace(/\s+/g, "").replace(/["']/g, "");
const declarations = (body: string): [string, string][] =>
  [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map((d) => [d[1]!, d[2]!.replace(/\s*!important\s*$/i, "").trim()]);

export function parseBrandCss(css: string): ParsedBrandCss {
  let text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const media: string[] = [];
  // lift @media blocks out, braces and all, keeping their contents for the mediaOnly report
  for (let at = text.indexOf("@media"); at >= 0; at = text.indexOf("@media")) {
    const open = text.indexOf("{", at);
    if (open < 0) break;
    let depth = 0, i = open;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) break;
    }
    media.push(text.slice(open + 1, i));
    text = text.slice(0, at) + text.slice(i + 1);
  }
  const light: Record<string, string> = {}, dark: Record<string, string> = {};
  const ignored: ParsedBrandCss["ignored"] = [];
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = declarations(m[2]!);
    if (!decls.length) continue;
    const selectors = m[1]!.split(",").map((s) => s.trim()).filter(Boolean);
    const target = selectors.some((s) => LIGHT.has(canon(s))) ? light : selectors.every((s) => DARK.has(canon(s))) ? dark : undefined;
    if (!target) {
      ignored.push({ selector: selectors.join(", "), properties: decls.map(([k]) => k) });
      continue;
    }
    for (const [k, v] of decls) target[k] = v;
  }
  const outside = new Set([...Object.keys(light), ...Object.keys(dark)]);
  const mediaOnly = [...new Set(media.flatMap((body) => [...body.matchAll(/\{([^{}]*)\}/g)].flatMap((r) => declarations(r[1]!).map(([k]) => k))))].filter((k) => !outside.has(k));
  return { light, dark: { ...light, ...dark }, ignored, mediaOnly };
}

/** A brand's values for the tokens it overrides, by custom property, in the form the token loader writes. */
export interface BrandValues {
  light: Record<string, string>;
  /** The dark block over the light one. */
  dark: Record<string, string>;
  /** Custom properties that name no token: the brand's own variables. */
  unmatched: string[];
  /** Values that do not resolve to one the token can hold: a color that is not a color, a var() that leads nowhere. */
  unresolved: { cssVar: string; mode: "light" | "dark"; value: string }[];
}

/**
 * Resolves a parsed brand against the token files. `var(--x)` resolves to --x in the same mode, the brand's value
 * first and the token's after, then its fallback. A color token's value is normalized to the hex the token loader
 * writes; one that is not a color (`color-mix()`) is unresolved and the default stands. Other values are kept as
 * written.
 */
export function resolveBrandValues(parsed: ParsedBrandCss, light: Token[], dark: Token[] = []): BrandValues {
  const byVar = new Map(light.map((t) => [t.cssVar, t]));
  const darkByVar = new Map(dark.map((t) => [t.cssVar, t.value]));
  const out: BrandValues = { light: {}, dark: {}, unmatched: [], unresolved: [] };
  const tokenValue = (cssVar: string, mode: "light" | "dark"): string | undefined => {
    const t = byVar.get(cssVar);
    if (!t) return undefined;
    return mode === "dark" ? (darkByVar.get(cssVar) ?? t.value) : t.value;
  };
  const resolveRaw = (raw: string, mode: "light" | "dark", depth = 0): string | undefined => {
    const v = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(raw.trim());
    if (!v) return raw.trim();
    if (depth > 8) return undefined;
    const target = parsed[mode][v[1]!];
    if (target !== undefined) return resolveRaw(target, mode, depth + 1);
    return tokenValue(v[1]!, mode) ?? (v[2] !== undefined ? resolveRaw(v[2], mode, depth + 1) : undefined);
  };
  for (const prop of new Set([...Object.keys(parsed.light), ...Object.keys(parsed.dark)])) {
    const t = byVar.get(prop);
    if (!t) {
      out.unmatched.push(prop);
      continue;
    }
    for (const mode of ["light", "dark"] as const) {
      const raw = parsed[mode][prop];
      if (raw === undefined) continue;
      const resolved = resolveRaw(raw, mode);
      const value = resolved === undefined ? undefined : t.type === "color" ? normalizeColor(resolved) : resolved;
      if (value === undefined) out.unresolved.push({ cssVar: prop, mode, value: raw });
      else out[mode][prop] = value;
    }
  }
  return out;
}
