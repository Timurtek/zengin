import { loadTokens, parseBrandCss, resolveBrandValues, type ParsedBrandCss } from "@zenginui/engine";
import { toFigmaValue } from "./variables.js";

/**
 * A project's brand file as values for the tokens it overrides. Parsing and resolving are the engine's
 * (parseBrandCss, resolveBrandValues), the same reading the engine matches literals against; what is added here
 * is Figma's own limit, a value whose Figma type differs from the token's.
 */
export { parseBrandCss, type ParsedBrandCss };

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
  const values = resolveBrandValues(parsed, tokens, dark ? loadTokens(dark) : []);
  const overlay: BrandOverlay = { light: {}, dark: {}, overridden: [], unmatched: values.unmatched, unsupported: [...values.unresolved], ignored: parsed.ignored, mediaOnly: parsed.mediaOnly };
  for (const t of tokens) {
    const entry: BrandOverlay["overridden"][number] = { path: t.path, cssVar: t.cssVar };
    for (const mode of ["light", "dark"] as const) {
      const value = values[mode][t.cssVar];
      if (value === undefined) continue;
      // Figma holds a variable as one type: a value that is not the token's (calc() for a radius) cannot go in
      if (toFigmaValue({ ...t, value })?.type !== toFigmaValue(t)?.type) {
        overlay.unsupported.push({ cssVar: t.cssVar, mode, value: parsed[mode][t.cssVar]! });
        continue;
      }
      overlay[mode][t.cssVar] = value;
      entry[mode] = value;
    }
    if (entry.light !== undefined || entry.dark !== undefined) overlay.overridden.push(entry);
  }
  // the order the brand file sets them in, light then dark, as the report reads
  const order = [...new Set([...Object.keys(parsed.light), ...Object.keys(parsed.dark)])];
  overlay.overridden.sort((x, y) => order.indexOf(x.cssVar) - order.indexOf(y.cssVar));
  overlay.unsupported.sort((x, y) => order.indexOf(x.cssVar) - order.indexOf(y.cssVar) || (x.mode === y.mode ? 0 : x.mode === "light" ? -1 : 1));
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
