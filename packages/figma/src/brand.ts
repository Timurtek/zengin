import { loadTokens, normalizeColor, type Token } from "@zenginui/engine";
import { toFigmaValue } from "./variables.js";

/**
 * A project's brand file, read the way the browser reads it, as values for the tokens it overrides.
 *
 * brand.css is a foundation: it redefines token custom properties and the token files stay the system's
 * defaults. The light block is the rule whose selector list holds `:root` or `[data-theme="light"]`; the dark
 * block is `[data-theme="dark"]`. Dark falls back to the light block, as the cascade does under an explicit
 * data-theme="dark": `:root` matches there too, and brand.css loads after the token stylesheet. The
 * prefers-color-scheme copy of the dark block inside @media is skipped; a property set only there is reported.
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

/** The values a brand gives the tokens, in the form the token files use, and what it could not give. */
export interface BrandOverlay {
  /** Token custom property to value, light. Only tokens the brand sets. */
  light: Record<string, string>;
  /** Token custom property to value, dark: the dark block over the light one. */
  dark: Record<string, string>;
  /** One entry per token the brand overrides, with the value in each mode it sets. */
  overridden: { path: string; cssVar: string; light?: string; dark?: string }[];
  /** Custom properties that name no token: the brand's own variables. Not exported. */
  unmatched: string[];
  /** Values Figma cannot hold (color-mix, calc, an unresolvable var()). The token's default stands for that mode. */
  unsupported: { cssVar: string; mode: "light" | "dark"; value: string }[];
  ignored: ParsedBrandCss["ignored"];
  mediaOnly: string[];
}

/**
 * Resolves a brand file against the token files. `var(--x)` resolves to --x in the same mode, the brand's
 * value first and the token's after; colors are normalized to hex the way the token loader writes them; a value
 * whose Figma type differs from the token's (calc() for a radius) is left out and reported.
 */
export function resolveBrand(css: string, light: unknown, dark: unknown | undefined): BrandOverlay {
  const parsed = parseBrandCss(css);
  const tokens = loadTokens(light);
  const darkByVar = new Map((dark ? loadTokens(dark) : []).map((t) => [t.cssVar, t.value]));
  const byVar = new Map(tokens.map((t) => [t.cssVar, t]));
  const overlay: BrandOverlay = { light: {}, dark: {}, overridden: [], unmatched: [], unsupported: [], ignored: parsed.ignored, mediaOnly: parsed.mediaOnly };

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
  const accept = (t: Token, raw: string, mode: "light" | "dark"): string | undefined => {
    const resolved = resolveRaw(raw, mode);
    if (resolved === undefined) return undefined;
    const value = t.type === "color" ? normalizeColor(resolved) : resolved;
    if (value === undefined) return undefined;
    const want = toFigmaValue(t)?.type;
    const got = toFigmaValue({ ...t, value })?.type;
    return want !== undefined && got === want ? value : undefined;
  };

  for (const prop of new Set([...Object.keys(parsed.light), ...Object.keys(parsed.dark)])) {
    const t = byVar.get(prop);
    if (!t) {
      overlay.unmatched.push(prop);
      continue;
    }
    const entry: BrandOverlay["overridden"][number] = { path: t.path, cssVar: prop };
    for (const mode of ["light", "dark"] as const) {
      const raw = parsed[mode][prop];
      if (raw === undefined) continue;
      const value = accept(t, raw, mode);
      if (value === undefined) {
        overlay.unsupported.push({ cssVar: prop, mode, value: raw });
        continue;
      }
      overlay[mode][prop] = value;
      entry[mode] = value;
    }
    if (entry.light !== undefined || entry.dark !== undefined) overlay.overridden.push(entry);
  }
  return overlay;
}

/** A readable summary of what a brand file did to an export, for the terminal. */
export function renderBrandReport(o: BrandOverlay, file: string): string {
  const lines = [`Brand: ${file} overrides ${o.overridden.length} token${o.overridden.length === 1 ? "" : "s"}${o.unmatched.length ? `; ${o.unmatched.length} of its custom properties name no token` : ""}.`];
  for (const e of o.overridden) {
    const both = e.light !== undefined && e.light === e.dark;
    const modes = both ? `${e.light} (light and dark)` : [e.light !== undefined ? `${e.light} (light)` : "", e.dark !== undefined ? `${e.dark} (dark)` : ""].filter(Boolean).join(", ");
    lines.push(`  brand      ${e.path}: ${modes}`);
  }
  for (const u of o.unmatched) lines.push(`  unmatched  ${u}: no token by that name, not exported`);
  for (const u of o.unsupported) lines.push(`  not read   ${u.cssVar} (${u.mode}): "${u.value}" is not a value Figma can hold for this token; the default stands`);
  for (const i of o.ignored) lines.push(`  ignored    ${i.selector}: ${i.properties.length} custom ${i.properties.length === 1 ? "property" : "properties"} under a selector that is neither the light block (:root, [data-theme="light"]) nor [data-theme="dark"]`);
  for (const m of o.mediaOnly) lines.push(`  ignored    ${m}: set only inside @media; a dark value belongs in [data-theme="dark"]`);
  return lines.join("\n");
}
