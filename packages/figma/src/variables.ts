import { loadTokens, type Token } from "@zengin/engine";

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

/** The payload of POST /v1/files/:key/variables, and what the plugin imports. Ids are temporary. */
export interface VariablesPayload {
  variableCollections: { action: "CREATE"; id: string; name: string; initialModeId: string }[];
  variableModes: { action: "CREATE" | "UPDATE"; id: string; name: string; variableCollectionId: string }[];
  variables: { action: "CREATE"; id: string; name: string; variableCollectionId: string; resolvedType: FigmaType; scopes: string[]; codeSyntax: { WEB: string }; description?: string }[];
  variableModeValues: { variableId: string; modeId: string; value: FigmaValue }[];
}

/** The shape of GET /v1/files/:key/variables/local, and what the plugin exports. */
export interface LocalVariables {
  meta: {
    variableCollections: Record<string, { id: string; name: string; modes: { modeId: string; name: string }[]; defaultModeId: string }>;
    variables: Record<string, { id: string; name: string; resolvedType: FigmaType; variableCollectionId: string; valuesByMode: Record<string, FigmaValue | { type: "VARIABLE_ALIAS"; id: string }>; codeSyntax?: { WEB?: string } }>;
  };
}

const SCOPES: Record<string, string[]> = {
  color: ["ALL_FILLS", "STROKE_COLOR", "TEXT_FILL", "EFFECT_COLOR"],
  space: ["GAP", "WIDTH_HEIGHT"],
  radius: ["CORNER_RADIUS"],
  text: ["FONT_SIZE"],
  weight: ["FONT_WEIGHT"],
  leading: ["LINE_HEIGHT"],
  font: ["FONT_FAMILY"],
  breakpoint: ["WIDTH_HEIGHT"],
};

const REM = 16;

export function variableName(token: Pick<Token, "name">): string {
  return token.name.replace(/\./g, "/");
}

/** The Figma type and value for a token, or undefined for values Figma cannot hold (a shadow list, an easing). */
export function toFigmaValue(token: Pick<Token, "type" | "value" | "namespace">): { type: FigmaType; value: FigmaValue } | undefined {
  if (token.type === "color") {
    const c = hexToFigma(token.value);
    return c ? { type: "COLOR", value: c } : undefined;
  }
  const v = token.value.trim();
  const px = /^(-?\d*\.?\d+)px$/.exec(v);
  if (px) return { type: "FLOAT", value: Number(px[1]) };
  const rem = /^(-?\d*\.?\d+)rem$/.exec(v);
  if (rem) return { type: "FLOAT", value: Number(rem[1]) * REM };
  const ms = /^(-?\d*\.?\d+)ms$/.exec(v);
  if (ms) return { type: "FLOAT", value: Number(ms[1]) };
  if (/^-?\d*\.?\d+$/.test(v)) return { type: "FLOAT", value: Number(v) };
  if (token.namespace === "font" || token.namespace === "ease" || token.namespace === "shadow") return { type: "STRING", value: v };
  return { type: "STRING", value: v };
}

export interface ToFigmaOptions {
  /** Collection name. Default "Zengin". */
  collection?: string;
  /** Mode names. Default Light and Dark. */
  modes?: { light: string; dark: string };
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

  lightTokens.forEach((t, i) => {
    const lv = toFigmaValue(t);
    if (!lv) return;
    const id = `zengin-var-${i}`;
    payload.variables.push({
      action: "CREATE",
      id,
      name: variableName(t),
      variableCollectionId: colId,
      resolvedType: lv.type,
      scopes: SCOPES[t.namespace] ?? ["ALL_SCOPES"],
      codeSyntax: { WEB: `var(${t.cssVar})` },
    });
    payload.variableModeValues.push({ variableId: id, modeId: lightId, value: lv.value });
    if (dark) {
      const d = darkByVar.get(t.cssVar);
      const dv = d ? toFigmaValue(d) : undefined;
      payload.variableModeValues.push({ variableId: id, modeId: darkId, value: dv?.value ?? lv.value });
    }
  });
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
  /** Variables Figma holds that cannot map back (aliases to other collections, unknown types). */
  skipped: string[];
  light: unknown;
  dark: unknown;
}

export interface FromFigmaOptions {
  /** Collection to read. Default: the one named Zengin, else the only one. */
  collection?: string;
  modes?: { light: string; dark: string };
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
  const report: ImportReport = { collection: col.name, changed: [], added: [], missing: [], skipped: [], light: lightOut, dark: darkOut };
  const seen = new Set<string>();

  for (const v of Object.values(local.meta.variables)) {
    if (v.variableCollectionId !== col.id) continue;
    seen.add(v.name);
    const token = byName.get(v.name);
    const namespace = v.name.split("/")[0]!;
    const apply = (mode: "light" | "dark", modeId: string, tree: unknown): void => {
      const raw = v.valuesByMode[modeId];
      if (raw === undefined) return;
      if (typeof raw === "object" && raw !== null && "type" in raw && raw.type === "VARIABLE_ALIAS") {
        report.skipped.push(`${v.name} (${mode}): alias`);
        return;
      }
      const after = fromFigmaValue(v.resolvedType, raw as FigmaValue, token, namespace);
      if (after === undefined) {
        report.skipped.push(`${v.name} (${mode}): ${v.resolvedType}`);
        return;
      }
      const path = token ? token.path : `${v.name.replace(/\//g, ".")}`;
      const before = token ? (mode === "light" ? token.value : darkValue(dark, token)) : undefined;
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
  const lines = [`Collection "${r.collection}": ${r.changed.length} changed, ${r.added.length} new, ${r.missing.length} missing in Figma, ${r.skipped.length} skipped.`];
  for (const c of r.changed) lines.push(`  changed  ${c.path} (${c.mode}): ${c.before} -> ${c.after}`);
  for (const c of r.added) lines.push(`  new      ${c.path} (${c.mode}): ${c.after}`);
  for (const m of r.missing) lines.push(`  missing  ${m}`);
  for (const s of r.skipped) lines.push(`  skipped  ${s}`);
  return lines.join("\n");
}
