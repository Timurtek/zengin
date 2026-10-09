import { loadTokens, type Token } from "@zenginui/engine";
import { parseBrandCss } from "@zenginui/engine";

/**
 * Tokens to Figma variables and back. One rule carries both directions: the variable is named like the
 * token, with slashes for dots (`color.primary.soft` is `color/primary/soft`), and its code syntax is the
 * CSS custom property. That is the Carbon model: the same names in code and in design.
 */

export type FigmaType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type FigmaValue = FigmaColor | number | string | boolean;

/** A value that points at another variable; in a payload the id is the other variable's temporary id. */
export interface FigmaAlias {
  type: "VARIABLE_ALIAS";
  id: string;
}

/** The payload of POST /v1/files/:key/variables, and what the plugin imports. Ids are temporary. */
export interface VariablesPayload {
  variableCollections: { action: "CREATE"; id: string; name: string; initialModeId: string }[];
  variableModes: { action: "CREATE" | "UPDATE"; id: string; name: string; variableCollectionId: string }[];
  variables: { action: "CREATE"; id: string; name: string; variableCollectionId: string; resolvedType: FigmaType; scopes: string[]; codeSyntax?: { WEB: string }; description?: string }[];
  variableModeValues: { variableId: string; modeId: string; value: FigmaValue | FigmaAlias }[];
}

/** The shape of GET /v1/files/:key/variables/local, and what the plugin exports. */
export interface LocalVariables {
  meta: {
    variableCollections: Record<string, { id: string; name: string; modes: { modeId: string; name: string }[]; defaultModeId: string }>;
    variables: Record<string, { id: string; name: string; resolvedType: FigmaType; variableCollectionId: string; valuesByMode: Record<string, FigmaValue | FigmaAlias>; codeSyntax?: { WEB?: string } }>;
  };
}

/**
 * Which property pickers show a variable, keyed by the engine's token namespace (`spacing`, `font-weight`,
 * not the group name). ALL_FILLS already covers text fills; Figma refuses it beside TEXT_FILL. Families whose
 * values Figma cannot bind as they are (unitless line heights, em letter spacing, shadow lists, motion) are
 * kept out of every picker: they are in the file for the record and for import, not for binding.
 */
export const SCOPES: Record<string, string[]> = {
  color: ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"],
  spacing: ["GAP", "WIDTH_HEIGHT"],
  radius: ["CORNER_RADIUS"],
  border: ["STROKE_FLOAT"],
  text: ["FONT_SIZE"],
  "font-weight": ["FONT_WEIGHT"],
  font: ["FONT_FAMILY"],
  breakpoint: ["WIDTH_HEIGHT"],
  leading: [],
  tracking: [],
  shadow: [],
  duration: [],
  ease: [],
};

const REM = 16;

export function variableName(token: Pick<Token, "name">): string {
  return token.name.replace(/\./g, "/");
}

/** The first family of a CSS font stack, unquoted: the one a Figma font picker can load. */
export function firstFamily(stack: string): string {
  return stack.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "");
}

/** A stack with its first family replaced, the fallbacks kept. */
function withFirstFamily(stack: string, family: string): string {
  const rest = stack.split(",").slice(1).map((s) => s.trim()).filter(Boolean);
  const head = /\s/.test(family) ? `'${family}'` : family;
  return [head, ...rest].join(", ");
}

/** The Figma type and value for a token, or undefined for values Figma cannot hold (a shadow list, an easing). */
export function toFigmaValue(token: Pick<Token, "type" | "value" | "namespace">): { type: FigmaType; value: FigmaValue } | undefined {
  if (token.type === "color") {
    const c = hexToFigma(token.value);
    return c ? { type: "COLOR", value: c } : undefined;
  }
  // A font variable holds the family Figma can load; the fallbacks stay in code.
  if (token.namespace === "font") return { type: "STRING", value: firstFamily(token.value) };
  const v = token.value.trim();
  const px = /^(-?\d*\.?\d+)px$/.exec(v);
  if (px) return { type: "FLOAT", value: Number(px[1]) };
  const rem = /^(-?\d*\.?\d+)rem$/.exec(v);
  if (rem) return { type: "FLOAT", value: Number(rem[1]) * REM };
  const ms = /^(-?\d*\.?\d+)ms$/.exec(v);
  if (ms) return { type: "FLOAT", value: Number(ms[1]) };
  if (/^-?\d*\.?\d+$/.test(v)) return { type: "FLOAT", value: Number(v) };
  return { type: "STRING", value: v };
}

/** The scopes for a token's variable; a namespace the map does not know is shown everywhere, as before. */
function scopesFor(namespace: string): string[] {
  return SCOPES[namespace] ?? ["ALL_SCOPES"];
}

export interface ToFigmaOptions {
  /** Collection name. Default "Zengin". */
  collection?: string;
  /** Mode names. Default Light and Dark. */
  modes?: { light: string; dark: string };
  /**
   * Values that win over the token files, by custom property: a project's brand (resolveBrand). A dark entry wins
   * in Dark; without one, a light entry does, as the cascade has it.
   */
  overrides?: { light?: Record<string, string>; dark?: Record<string, string> };
}

/**
 * Both token files to one payload: a collection with Light and Dark modes, one variable per token, dark
 * values where the dark file overrides and light values elsewhere, code syntax set to the CSS variable.
 */
export function toFigmaVariables(light: unknown, dark: unknown | undefined, opts: ToFigmaOptions = {}): VariablesPayload {
  const collection = opts.collection ?? "Zengin";
  const modes = opts.modes ?? { light: "Light", dark: "Dark" };
  const lightTokens = loadTokens(light);
  const darkTokens = dark ? loadTokens(dark) : [];
  const darkByVar = new Map(darkTokens.map((t) => [t.cssVar, t]));
  const colId = "zengin-collection";
  const lightId = "zengin-mode-light";
  const darkId = "zengin-mode-dark";

  const payload: VariablesPayload = {
    variableCollections: [{ action: "CREATE", id: colId, name: collection, initialModeId: lightId }],
    variableModes: [
      { action: "UPDATE", id: lightId, name: modes.light, variableCollectionId: colId },
      ...(dark ? [{ action: "CREATE" as const, id: darkId, name: modes.dark, variableCollectionId: colId }] : []),
    ],
    variables: [],
    variableModeValues: [],
  };

  const over = { light: opts.overrides?.light ?? {}, dark: opts.overrides?.dark ?? {} };
  lightTokens.forEach((t, i) => {
    const lv = toFigmaValue({ ...t, value: over.light[t.cssVar] ?? t.value });
    if (!lv) return;
    const id = `zengin-var-${i}`;
    payload.variables.push({
      action: "CREATE",
      id,
      name: variableName(t),
      variableCollectionId: colId,
      resolvedType: lv.type,
      scopes: scopesFor(t.namespace),
      codeSyntax: { WEB: `var(${t.cssVar})` },
    });
    payload.variableModeValues.push({ variableId: id, modeId: lightId, value: lv.value });
    if (dark) {
      const d = darkByVar.get(t.cssVar);
      // the brand's dark value, else its light one over a token's dark (an explicit data-theme="dark" still matches :root), else the dark token
      const raw = over.dark[t.cssVar] ?? over.light[t.cssVar] ?? d?.value;
      const dv = raw !== undefined ? toFigmaValue({ ...(d ?? t), value: raw }) : undefined;
      payload.variableModeValues.push({ variableId: id, modeId: darkId, value: dv?.value ?? lv.value });
    }
  });
  return payload;
}

/** A registry theme: its name and its brand.css, which overrides custom properties and nothing else. */
export interface FigmaTheme {
  name: string;
  css: string;
}

/**
 * The custom properties a theme stylesheet sets, light and dark. Light is the rule whose selector list holds
 * `:root` or `[data-theme="light"]`; dark is the rule for `[data-theme="dark"]` alone. The prefers-color-scheme
 * copy inside @media repeats dark and is ignored. Dark falls back to the light override, as the cascade does.
 */
export function parseThemeCss(css: string): { light: Record<string, string>; dark: Record<string, string> } {
  const { light, dark } = parseBrandCss(css);
  return { light, dark };
}

export interface ThemedOptions extends ToFigmaOptions {
  /** The collection holding each theme's raw values. Default "Theme". */
  themeCollection?: string;
}

/**
 * Tokens and themes to one payload in two collections. "Theme" has a mode per theme and holds, for every token
 * some theme overrides, its light and dark value in each (`light/color/primary`, `dark/color/primary`), out of
 * every picker. "Zengin" is the same collection toFigmaVariables makes, except that those tokens alias into
 * Theme. A frame set to Theme = meadow and Zengin = Dark resolves meadow's dark values, so a file switches theme
 * with one mode picker, within a plan's per-collection mode limit (themes, not themes times schemes).
 */
export function toFigmaThemedVariables(light: unknown, dark: unknown | undefined, themes: FigmaTheme[], opts: ThemedOptions = {}): VariablesPayload {
  if (!themes.length) throw new Error("toFigmaThemedVariables needs at least one theme.");
  const base = toFigmaVariables(light, dark, opts);
  const tokens = loadTokens(light);
  const darkByVar = new Map((dark ? loadTokens(dark) : []).map((t) => [t.cssVar, t]));
  const parsed = themes.map((t) => ({ name: t.name, ...parseThemeCss(t.css) }));
  const themed = tokens.filter((t) => parsed.some((p) => t.cssVar in p.light || t.cssVar in p.dark));

  const colId = "theme-collection";
  const modeIds = themes.map((_, i) => `theme-mode-${i}`);
  const payload: VariablesPayload = {
    variableCollections: [{ action: "CREATE", id: colId, name: opts.themeCollection ?? "Theme", initialModeId: modeIds[0]! }, ...base.variableCollections],
    variableModes: [...themes.map((t, i) => ({ action: i ? ("CREATE" as const) : ("UPDATE" as const), id: modeIds[i]!, name: t.name, variableCollectionId: colId })), ...base.variableModes],
    variables: [],
    variableModeValues: [],
  };

  const aliasFor = new Map<string, { light: string; dark: string }>();
  themed.forEach((t, i) => {
    const type = toFigmaValue(t)?.type;
    if (!type) return;
    const ids = { light: `theme-var-${i}-light`, dark: `theme-var-${i}-dark` };
    aliasFor.set(variableName(t), ids);
    for (const scheme of ["light", "dark"] as const) {
      payload.variables.push({
        action: "CREATE",
        id: ids[scheme],
        name: `${scheme}/${variableName(t)}`,
        variableCollectionId: colId,
        resolvedType: type,
        scopes: [],
        description: `${variableName(t)} in the ${scheme} scheme, per theme. Bind to ${opts.collection ?? "Zengin"}/${variableName(t)}, not to this.`,
      });
      parsed.forEach((p, m) => {
        const fallback = scheme === "dark" ? (darkByVar.get(t.cssVar)?.value ?? t.value) : t.value;
        const raw = p[scheme][t.cssVar] ?? fallback;
        const fv = toFigmaValue({ ...t, value: raw });
        if (!fv || fv.type !== type) throw new Error(`Theme "${p.name}" sets ${t.cssVar} to "${raw}" (${scheme}), which Figma cannot hold as ${type}.`);
        payload.variableModeValues.push({ variableId: ids[scheme], modeId: modeIds[m]!, value: fv.value });
      });
    }
  });

  // The Zengin collection as toFigmaVariables makes it, with themed tokens pointing into Theme.
  const darkMode = base.variableModes[1]?.id;
  payload.variables.push(...base.variables);
  for (const mv of base.variableModeValues) {
    const v = base.variables.find((x) => x.id === mv.variableId)!;
    const alias = aliasFor.get(v.name);
    if (!alias) payload.variableModeValues.push(mv);
    else payload.variableModeValues.push({ ...mv, value: { type: "VARIABLE_ALIAS", id: mv.modeId === darkMode ? alias.dark : alias.light } });
  }
  return payload;
}

export interface ImportChange {
  path: string;
  mode: "light" | "dark";
  before: string | undefined;
  after: string;
}

export interface ImportReport {
  collection: string;
  /** Tokens whose value differs in Figma. */
  changed: ImportChange[];
  /** Variables in Figma with no token in code. Written under their group when `write` includes them. */
  added: ImportChange[];
  /** Tokens in code with no variable in Figma. Left alone. */
  missing: string[];
  /** Variables Figma holds that cannot map back (aliases that lead nowhere, unknown types). */
  skipped: string[];
  /**
   * Changes to tokens the brand file sets in that mode. Their value lives in brand.css, so they are reported
   * against the brand's value and never written to the token files, which hold the system's defaults.
   */
  brand: ImportChange[];
  light: unknown;
  dark: unknown;
}

export interface FromFigmaOptions {
  /** Collection to read. Default: the one named Zengin, else the only one. */
  collection?: string;
  modes?: { light: string; dark: string };
  /** The mode to read in the collections an alias leads into (the Theme collection). Default: each one's default mode. */
  theme?: string;
  /** The project's brand (resolveBrand): what the file was exported with, and what --write must not touch. */
  brand?: { light: Record<string, string>; dark: Record<string, string> };
}

/**
 * Figma variables back into the token files: values the designer changed in Figma become the values in
 * code, with a report of what changed, what is new, what is missing. Returns new token trees; nothing is
 * written here. Units follow the existing token: a text size kept in rem stays in rem.
 */
export function fromFigmaVariables(local: LocalVariables, light: unknown, dark: unknown | undefined, opts: FromFigmaOptions = {}): ImportReport {
  const modes = opts.modes ?? { light: "Light", dark: "Dark" };
  const collections = Object.values(local.meta.variableCollections);
  // A named collection must exist; without a name, the one called Zengin, or the only one there is.
  const col = collections.find((c) => c.name === (opts.collection ?? "Zengin")) ?? (opts.collection === undefined && collections.length === 1 ? collections[0] : undefined);
  if (!col) throw new Error(`No variable collection named "${opts.collection ?? "Zengin"}". Collections: ${collections.map((c) => c.name).join(", ") || "none"}.`);
  const lightMode = col.modes.find((m) => m.name === modes.light) ?? col.modes.find((m) => m.modeId === col.defaultModeId);
  const darkMode = col.modes.find((m) => m.name === modes.dark);
  if (!lightMode) throw new Error(`Collection "${col.name}" has no mode named "${modes.light}".`);

  const lightOut = clone(light);
  const darkOut = clone(dark ?? {});
  const lightTokens = loadTokens(light);
  const byName = new Map(lightTokens.map((t) => [variableName(t), t]));
  const report: ImportReport = { collection: col.name, changed: [], added: [], missing: [], skipped: [], brand: [], light: lightOut, dark: darkOut };
  const seen = new Set<string>();

  // An alias is followed to the value it lands on: in this collection, the same mode; in another (the Theme
  // collection), the mode named by opts.theme, else that collection's default. A missing target or a cycle is skipped.
  const isAlias = (x: unknown): x is FigmaAlias => typeof x === "object" && x !== null && "type" in x && (x as FigmaAlias).type === "VARIABLE_ALIAS";
  const follow = (raw: FigmaValue | FigmaAlias, modeId: string): FigmaValue | undefined => {
    let value: FigmaValue | FigmaAlias | undefined = raw, mode = modeId;
    for (let hops = 0; isAlias(value); hops++) {
      const target: LocalVariables["meta"]["variables"][string] | undefined = local.meta.variables[value.id];
      if (!target || hops > 8) return undefined;
      if (target.variableCollectionId !== col.id) {
        const tc = local.meta.variableCollections[target.variableCollectionId];
        if (!tc) return undefined;
        mode = (opts.theme !== undefined ? tc.modes.find((m) => m.name === opts.theme)?.modeId : undefined) ?? tc.defaultModeId;
      }
      value = target.valuesByMode[mode];
    }
    return value;
  };

  for (const v of Object.values(local.meta.variables)) {
    if (v.variableCollectionId !== col.id) continue;
    seen.add(v.name);
    const token = byName.get(v.name);
    const namespace = v.name.split("/")[0]!;
    const apply = (mode: "light" | "dark", modeId: string, tree: unknown): void => {
      const stored = v.valuesByMode[modeId];
      if (stored === undefined) return;
      const raw = follow(stored, modeId);
      if (raw === undefined) {
        report.skipped.push(`${v.name} (${mode}): alias`);
        return;
      }
      let after = fromFigmaValue(v.resolvedType, raw, token, namespace);
      if (after === undefined) {
        report.skipped.push(`${v.name} (${mode}): ${v.resolvedType}`);
        return;
      }
      const branded = token ? opts.brand?.[mode][token.cssVar] : undefined;
      // Figma holds a font's first family; the stack's fallbacks live in code and are kept.
      if (token && token.namespace === "font") {
        const stack = branded ?? (mode === "light" ? token.value : darkValue(dark, token)) ?? token.value;
        after = firstFamily(stack) === after ? stack : withFirstFamily(stack, after);
      }
      const path = token ? token.path : `${v.name.replace(/\//g, ".")}`;
      if (branded !== undefined) {
        if (normalize(branded) !== normalize(after)) report.brand.push({ path, mode, before: branded, after });
        return;
      }
      const before =token ? (mode === "light" ? token.value : darkValue(dark, token)) : undefined;
      if (mode === "dark" && before === undefined && token && after === token.value) return; // no dark override, same as light: nothing to write
      if (before !== undefined && normalize(before) === normalize(after)) return;
      setValue(tree, path.split("."), after);
      (token ? report.changed : report.added).push({ path, mode, before, after });
    };
    apply("light", lightMode.modeId, lightOut);
    if (darkMode) apply("dark", darkMode.modeId, darkOut);
  }
  for (const t of lightTokens) if (!seen.has(variableName(t))) report.missing.push(variableName(t));
  return report;
}

function fromFigmaValue(type: FigmaType, value: FigmaValue, token: Token | undefined, namespace: string): string | undefined {
  if (type === "COLOR") return typeof value === "object" ? figmaToHex(value as FigmaColor) : undefined;
  if (type === "FLOAT" && typeof value === "number") {
    const unit = token ? unitOf(token.value) : namespace === "duration" ? "ms" : namespace === "weight" || namespace === "leading" ? "" : "px";
    if (unit === "rem") return `${trim(value / REM)}rem`;
    if (unit === "px") return `${trim(value)}px`;
    if (unit === "ms") return `${trim(value)}ms`;
    return trim(value);
  }
  if (type === "STRING" && typeof value === "string") return value;
  return undefined;
}

function unitOf(v: string): string {
  const m = /^-?\d*\.?\d+(px|rem|ms)?$/.exec(v.trim());
  return m ? (m[1] ?? "") : "";
}

function trim(n: number): string {
  return String(Number(n.toFixed(4)));
}

function darkValue(dark: unknown, token: Token): string | undefined {
  if (!dark) return undefined;
  const t = loadTokens(dark).find((d) => d.cssVar === token.cssVar);
  return t?.value;
}

function normalize(v: string): string {
  return v.trim().toLowerCase();
}

/** Sets `$value` at a dotted path in a DTCG tree, creating groups on the way; a group with children gets a DEFAULT. */
function setValue(tree: unknown, path: string[], value: string): void {
  let node = tree as Record<string, unknown>;
  for (let i = 0; i < path.length; i++) {
    const key = path[i]!;
    const last = i === path.length - 1;
    if (last) {
      const existing = node[key];
      if (existing && typeof existing === "object" && !("$value" in (existing as object))) {
        // A group at this path: the value lives in its DEFAULT.
        (existing as Record<string, unknown>)["DEFAULT"] = { ...((existing as Record<string, unknown>)["DEFAULT"] as object | undefined), $value: value };
      } else {
        node[key] = { ...((existing as object | undefined) ?? {}), $value: value };
      }
      return;
    }
    if (!node[key] || typeof node[key] !== "object") node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function hexToFigma(hex: string): FigmaColor | undefined {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1]!, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
}

export function figmaToHex(c: FigmaColor): string {
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0").toUpperCase();
  const base = `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  return c.a < 1 ? `${base}${to(c.a)}` : base;
}

/** A readable summary of an import, for the terminal. */
export function renderImportReport(r: ImportReport): string {
  const lines = [`Collection "${r.collection}": ${r.changed.length} changed, ${r.added.length} new, ${r.missing.length} missing in Figma, ${r.skipped.length} skipped${r.brand.length ? `, ${r.brand.length} set by the brand file` : ""}.`];
  for (const c of r.changed) lines.push(`  changed  ${c.path} (${c.mode}): ${c.before} -> ${c.after}`);
  for (const c of r.added) lines.push(`  new      ${c.path} (${c.mode}): ${c.after}`);
  for (const m of r.missing) lines.push(`  missing  ${m}`);
  for (const s of r.skipped) lines.push(`  skipped  ${s}`);
  for (const c of r.brand) lines.push(`  brand    ${c.path} (${c.mode}): ${c.before} -> ${c.after}`);
  return lines.join("\n");
}
