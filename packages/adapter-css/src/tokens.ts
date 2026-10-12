import { normalizeColor } from "@zenginui/engine";
import postcss, { type Rule, type AtRule } from "postcss";

/**
 * Tokens from a stylesheet's custom properties. The variable names stay as they are, recorded in
 * `$extensions.zengin.cssVar`, so the engine recognises `var(--surface-base)` as a token and suggests
 * `var(--surface-base)` as a fix, in the project's own vocabulary. Values are grouped by what they are
 * (a color, a radius, a space) so the rules know which scale a literal belongs to.
 */

export type Group = "color" | "space" | "radius" | "text" | "font" | "shadow" | "other";

export interface CssToken {
  /** The variable, e.g. `--surface-base`. */
  cssVar: string;
  group: Group;
  /** Raw value as written; aliases are `var(--x)`. */
  value: string;
  /** Resolved literal, aliases followed, for classification and for the dark file. */
  resolved: string;
}

export interface CssDerivation {
  light: CssToken[];
  dark: CssToken[];
  tokens: Record<string, unknown>;
  tokensDark: Record<string, unknown> | undefined;
  report: { light: number; dark: number; byGroup: Record<string, number>; skipped: string[] };
}

const LIGHT_SELECTOR = /^(:root|html|:host)(\s*,\s*(:root|html|:host))*$|\[data-theme="light"\]|\.light\b/;
const DARK_SELECTOR = /\[data-theme="dark"\]|\.dark\b|\[data-mode="dark"\]|\.theme-dark\b/;

export interface CssOptions {
  /** Selectors the design system names as its alternate theme, e.g. `[data-theme="night"]`. Their variables are the overrides. */
  themeSelectors?: string[];
}

export function deriveTokensFromCss(css: string, opts: CssOptions = {}): CssDerivation {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const root = postcss.parse(css);
  const named = new Set((opts.themeSelectors ?? []).map(normalizeSelector));

  root.walkRules((rule: Rule) => {
    const inDarkMedia = hasAncestorMedia(rule, /prefers-color-scheme:\s*dark/);
    const isDark = inDarkMedia || DARK_SELECTOR.test(rule.selector) || rule.selectors.some((s) => named.has(normalizeSelector(s)));
    const isLight = !isDark && (LIGHT_SELECTOR.test(rule.selector) || /:root|\bhtml\b/.test(rule.selector));
    if (!isDark && !isLight) return;
    rule.each((node) => {
      if (node.type !== "decl" || !node.prop.startsWith("--")) return;
      (isDark ? dark : light).set(node.prop, node.value.trim());
    });
  });

  const resolveIn = (map: Map<string, string>, fallback: Map<string, string>, v: string, depth = 0): string => {
    const m = /^var\((--[\w-]+)\)$/.exec(v.trim());
    if (!m || depth > 12) return v;
    const target = map.get(m[1]!) ?? fallback.get(m[1]!);
    return target === undefined ? v : resolveIn(map, fallback, target, depth + 1);
  };

  const lightTokens: CssToken[] = [];
  const skipped: string[] = [];
  for (const [cssVar, value] of light) {
    const resolved = resolveIn(light, light, value);
    const group = classify(cssVar, resolved);
    if (!group) {
      skipped.push(cssVar);
      continue;
    }
    lightTokens.push({ cssVar, group, value, resolved });
  }
  const lightVars = new Set(lightTokens.map((t) => t.cssVar));
  const darkTokens: CssToken[] = [];
  for (const [cssVar, value] of dark) {
    if (!lightVars.has(cssVar)) continue; // a dark-only variable is not a token the light theme defines
    const resolved = resolveIn(dark, light, value);
    const group = lightTokens.find((t) => t.cssVar === cssVar)!.group;
    darkTokens.push({ cssVar, group, value, resolved });
  }

  const groupOf = new Map(lightTokens.map((t) => [t.cssVar, t.group]));
  const byGroup: Record<string, number> = {};
  for (const t of lightTokens) byGroup[t.group] = (byGroup[t.group] ?? 0) + 1;

  return {
    light: lightTokens,
    dark: darkTokens,
    tokens: toDtcg(lightTokens, groupOf, "Derived from the project's stylesheet by `zengin init --from package`. Variable names are kept; see $extensions.zengin.cssVar."),
    tokensDark: darkTokens.length ? toDtcg(darkTokens, groupOf, "Dark overrides, derived from the stylesheet's dark block.") : undefined,
    report: { light: lightTokens.length, dark: darkTokens.length, byGroup, skipped },
  };
}

function normalizeSelector(s: string): string {
  return s.replace(/["']/g, "").replace(/\s+/g, "").trim();
}

/** Which scale a variable belongs to, from its value first and its name second. Unknown kinds are skipped. */
export function classify(cssVar: string, resolved: string): Group | undefined {
  const name = cssVar.toLowerCase();
  const v = resolved.trim();
  if (isColor(v)) return "color";
  // Tracking is typography, not space: `-0.02em` is not a gap a spacing rule should offer.
  if (/letter-spacing|^--ls-|^--tracking/.test(name)) return "other";
  // A border width is not a gap: `gap: 1` must not be told to use `--bw`.
  if (/border-width|^--bw(-|$)/.test(name)) return "other";
  if (/^-?\d*\.?\d+(px|rem|em)$/.test(v)) {
    if (/radius|rounded|^--r-/.test(name)) return "radius";
    if (/font-size|text-|size-(xs|sm|md|lg|xl)|-text$|^--fs-/.test(name)) return "text";
    if (/padding|margin|gap|space|spacing|inset/.test(name)) return "space";
    return "space";
  }
  if (v === "0") {
    if (/radius|^--r-/.test(name)) return "radius";
    if (/space|spacing|gap|padding|margin|^--sp-/.test(name)) return "space";
  }
  if (/^\d+(\.\d+)?$/.test(v)) return "other";
  // `--fg: 226,224,247` is used as rgba(var(--fg), .5). It is a variable the system defines, not a color on its own.
  if (/^\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*,\s*|\s+)\d{1,3}$/.test(v)) return "other";
  if (/^(repeating-)?(linear|radial|conic)-gradient\(/.test(v)) return "other";
  if (/font-family|^--font(-|$)/.test(name) || /(sans-serif|serif|monospace)\s*$/.test(v)) return "font";
  if (/shadow/.test(name) || /^\d.*px.*(rgb|#|oklch|hsl)/.test(v)) return "shadow";
  if (/^var\(/.test(v)) return undefined; // an alias to something not defined here
  if (/^(ease(-in|-out|-in-out)?|linear|(cubic-bezier|steps|linear)\(.*\)|\d*\.?\d+m?s)$/.test(v) || /duration|easing|transition/.test(name)) return "other";
  return undefined;
}

function isColor(v: string): boolean {
  if (normalizeColor(v)) return true;
  return /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/.test(v) || v === "transparent" || v === "currentColor";
}

const GROUP_TYPE: Record<Group, string> = { color: "color", space: "dimension", radius: "dimension", text: "dimension", font: "fontFamily", shadow: "shadow", other: "string" };

/** A DTCG tree: one group per kind, each variable a token keyed by its name without the dashes. */
function toDtcg(tokens: CssToken[], groupOf: Map<string, Group>, description: string): Record<string, unknown> {
  const out: Record<string, unknown> = { $description: description };
  for (const t of tokens) {
    const group = (out[t.group] ??= { $type: GROUP_TYPE[t.group] }) as Record<string, unknown>;
    const key = t.cssVar.slice(2);
    // An alias to another variable in the file becomes a DTCG alias when the target is a light token of the same group.
    const alias = /^var\((--[\w-]+)\)$/.exec(t.value);
    const value = alias && groupOf.get(alias[1]!) === t.group ? `{${t.group}.${alias[1]!.slice(2)}}` : t.resolved;
    group[key] = { $value: value, $extensions: { zengin: { cssVar: t.cssVar } } };
  }
  return out;
}

function hasAncestorMedia(rule: Rule, params: RegExp): boolean {
  let p = rule.parent;
  while (p) {
    if (p.type === "atrule" && (p as AtRule).name === "media" && params.test((p as AtRule).params)) return true;
    p = p.parent as typeof p;
  }
  return false;
}
