import type { Token, TokenType } from "../types.js";

/**
 * DTCG (W3C Design Tokens Community Group) JSON loader.
 * Tokens are objects carrying `$value`; anything else is a group. `$type` is inherited from groups.
 * Alias values of the form `{color.primary}` are resolved against the same file.
 */

const NAMESPACE_BY_GROUP: Record<string, string> = {
  color: "color",
  space: "spacing",
  spacing: "spacing",
  radius: "radius",
  shadow: "shadow",
  text: "text",
  font: "font",
  weight: "font-weight",
  leading: "leading",
  tracking: "tracking",
  duration: "duration",
  ease: "ease",
};

interface RawToken {
  path: string[];
  type: TokenType;
  raw: unknown;
}

function collect(node: unknown, path: string[], inherited: TokenType | undefined, out: RawToken[]): void {
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;
  const type = (obj["$type"] as TokenType | undefined) ?? inherited;
  if ("$value" in obj) {
    out.push({ path, type: type ?? "string", raw: obj["$value"] });
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("$")) continue;
    collect(v, [...path, k], type, out);
  }
}

function stringify(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) return raw.map(stringify).join(", ");
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    // DTCG dimension: { value: 12, unit: "px" }
    if ("unit" in o && "value" in o) return `${o["value"]}${o["unit"]}`;
    // DTCG shadow
    if ("offsetX" in o) {
      return [o["offsetX"], o["offsetY"], o["blur"], o["spread"], o["color"]].map(stringify).join(" ");
    }
  }
  return JSON.stringify(raw);
}

export function loadTokens(json: unknown): Token[] {
  const raws: RawToken[] = [];
  collect(json, [], undefined, raws);
  const byPath = new Map(raws.map((r) => [r.path.join("."), r]));

  const resolve = (raw: unknown, depth = 0): unknown => {
    if (depth > 10) throw new Error("Token alias cycle");
    if (typeof raw === "string") {
      const m = /^\{([^}]+)\}$/.exec(raw.trim());
      if (m) {
        const target = byPath.get(m[1]!) ?? byPath.get(`${m[1]!}.DEFAULT`);
        if (!target) throw new Error(`Token alias not found: ${raw}`);
        return resolve(target.raw, depth + 1);
      }
    }
    return raw;
  };

  return raws.map((r) => {
    const [group, ...rest] = r.path;
    const namespace = NAMESPACE_BY_GROUP[group!] ?? group!;
    const keyParts = rest.filter((p) => p !== "DEFAULT");
    const key = keyParts.join("-");
    const name = [group, ...keyParts].join(".");
    return {
      name,
      path: r.path.join("."),
      type: r.type,
      value: normalizeValue(stringify(resolve(r.raw)), r.type),
      cssVar: key ? `--${namespace}-${key}` : `--${namespace}`,
      namespace,
      key,
    };
  });
}

function normalizeValue(v: string, type: TokenType): string {
  return type === "color" ? (normalizeColor(v) ?? v) : v;
}

/**
 * Returns a lowercase `#rrggbb` (or `#rrggbbaa`), or undefined when the value is not a hex, rgb or oklch
 * literal. oklch is converted to sRGB so Tailwind's default palette can be compared against system tokens.
 */
export function normalizeColor(v: string): string | undefined {
  const s = v.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3 || h.length === 4) return "#" + [...h].map((c) => c + c).join("");
    if (h.length === 6 || h.length === 8) return "#" + h;
    return undefined;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(s);
  if (rgb) return toHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\s*\)$/.exec(s);
  if (oklch) {
    const L = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    const [r, g, b] = oklchToRgb(L, Number(oklch[3]), Number(oklch[4]));
    return toHex(r, g, b);
  }
  return undefined;
}

function toHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** OKLCH -> sRGB (0..255), per the CSS Color 4 reference conversion. */
function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (c: number) => {
    const x = Math.max(0, Math.min(1, c));
    return (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255;
  };
  return [gamma(lr), gamma(lg), gamma(lb)];
}

export function hexToRgb(hex: string): [number, number, number] | undefined {
  const n = normalizeColor(hex);
  if (!n) return undefined;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

/** Tailwind v4 `@theme` block generated from the token set. Values are emitted resolved. */
export function toThemeCss(tokens: Token[]): string {
  const lines = tokens.map((t) => `  ${t.cssVar}: ${t.value};`);
  return `@theme {\n${lines.join("\n")}\n}\n`;
}

export interface SpacingStep {
  token: Token;
  px: number;
}

export class TokenIndex {
  readonly byVar = new Map<string, Token>();
  readonly byName = new Map<string, Token>();
  readonly colors: Token[];
  readonly namespaces: Set<string>;
  private readonly scale: SpacingStep[];

  constructor(readonly tokens: Token[]) {
    for (const t of tokens) {
      this.byVar.set(t.cssVar, t);
      this.byName.set(t.name, t);
    }
    this.colors = tokens.filter((t) => t.type === "color");
    this.namespaces = new Set(tokens.map((t) => t.namespace));
    this.scale = tokens
      .filter((t) => t.namespace === "spacing")
      .map((token) => ({ token, px: toPx(token.value) }))
      .filter((s): s is SpacingStep => s.px !== undefined)
      .sort((a, b) => a.px - b.px);
  }

  exactColor(literal: string): Token | undefined {
    return this.exactColors(literal)[0];
  }

  /** Every token sharing the literal's value. More than one means the semantic choice is the reader's. */
  exactColors(literal: string): Token[] {
    const n = normalizeColor(literal);
    if (!n) return [];
    return this.colors.filter((t) => t.value === n);
  }

  /** Nearest color by RGB distance. Undefined when the literal is not a parseable hex/rgb value. */
  nearestColor(literal: string): Token | undefined {
    const rgb = hexToRgb(literal);
    if (!rgb) return undefined;
    let best: Token | undefined;
    let bestD = Infinity;
    for (const t of this.colors) {
      const c = hexToRgb(t.value);
      if (!c) continue;
      const d = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** Exact spacing token for a length, or the scale neighbours around it. */
  matchSpacing(literal: string): { px?: number; exact?: Token; below?: SpacingStep; above?: SpacingStep } {
    const px = toPx(literal);
    if (px === undefined) return {};
    let below: SpacingStep | undefined;
    let above: SpacingStep | undefined;
    let exact: Token | undefined;
    for (const s of this.scale) {
      if (s.px === px) exact = s.token;
      if (s.px < px) below = s;
      if (s.px > px && !above) above = s;
    }
    return { px, exact, below, above };
  }
}

export function toPx(v: string): number | undefined {
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(v.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return undefined;
  if (m[2] === "rem" || m[2] === "em") return n * 16;
  if (m[2] === "px" || n === 0) return n;
  return undefined;
}
