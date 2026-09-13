/**
 * Deterministic classification of CSS properties and values.
 * Everything the rules know about "what kind of thing is this declaration" lives here.
 */

const COLOR_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-inline-color",
  "border-block-color",
  "outline-color",
  "text-decoration-color",
  "caret-color",
  "accent-color",
  "fill",
  "stroke",
  "box-shadow",
  "text-shadow",
  "column-rule-color",
]);

// Rhythm properties. Position offsets (top, left, inset) are coordinates, often legitimately arbitrary, and are not judged.
const SPACING_PREFIXES = ["margin", "padding", "gap", "row-gap", "column-gap", "scroll-margin", "scroll-padding", "text-indent"];
const POSITION_EXACT = new Set(["top", "right", "bottom", "left"]);

export function isColorProp(prop: string): boolean {
  return COLOR_PROPS.has(prop);
}

export function isSpacingProp(prop: string): boolean {
  return SPACING_PREFIXES.some((p) => prop === p || prop.startsWith(p + "-"));
}

/**
 * Category used by `className.allow` lists. Layout-ish properties collapse into named groups;
 * everything else is its own property name.
 */
export function categoryOf(prop: string): string {
  if (prop === "margin" || prop.startsWith("margin-")) return "margin";
  if (["width", "min-width", "max-width", "inline-size", "min-inline-size", "max-inline-size"].includes(prop)) return "width";
  if (["height", "min-height", "max-height", "block-size", "min-block-size", "max-block-size"].includes(prop)) return "height";
  if (["flex", "flex-grow", "flex-shrink", "flex-basis", "align-self", "order"].includes(prop)) return "flex-item";
  if (prop.startsWith("grid-column") || prop.startsWith("grid-row") || prop === "grid-area" || prop === "justify-self" || prop === "place-self") return "grid-item";
  if (prop === "position" || prop === "z-index" || POSITION_EXACT.has(prop) || prop === "inset" || prop.startsWith("inset-")) return "position";
  if (prop === "display" || prop === "visibility") return "display";
  if (prop === "overflow" || prop.startsWith("overflow-")) return "overflow";
  return prop;
}

/** Finds the `owns` key that governs a resolved property, e.g. `padding-inline` -> `padding`. */
export function ownedKey(prop: string, owns: Record<string, string | null> | undefined): string | undefined {
  if (!owns) return undefined;
  return Object.keys(owns).find((k) => {
    if (prop === k || prop.startsWith(k + "-")) return true;
    if (k === "border-radius" && prop.endsWith("radius")) return true;
    if (k === "font" && (prop === "line-height" || prop === "letter-spacing")) return true;
    if (k === "background-color" && prop === "background") return true;
    return false;
  });
}

const NAMED_COLORS = new Set([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "gray", "grey", "silver", "maroon", "olive", "lime", "aqua", "teal", "navy", "fuchsia",
  "crimson", "coral", "salmon", "tomato", "gold", "khaki", "violet", "indigo", "orchid", "plum", "tan", "beige", "ivory", "lavender", "linen", "wheat", "azure", "cyan", "magenta",
  "brown", "chocolate", "sienna", "peru", "turquoise", "skyblue", "steelblue", "royalblue", "dodgerblue", "slategray", "slategrey", "darkgray", "darkgrey", "lightgray", "lightgrey",
  "darkblue", "darkgreen", "darkred", "lightblue", "lightgreen", "hotpink", "deeppink", "firebrick", "forestgreen", "seagreen", "midnightblue", "whitesmoke", "snow", "mintcream",
]);

export interface LiteralMatch {
  literal: string;
  /** Offset of the literal within the value string. */
  offset: number;
}

/** Color literals inside a CSS value: hex, rgb/hsl/oklch/lab functions, and named colors. */
export function findColorLiterals(value: string): LiteralMatch[] {
  const out: LiteralMatch[] = [];
  const re = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\([^)]*\)|\b[a-zA-Z]+\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const lit = m[0];
    if (lit.startsWith("#") || lit.includes("(")) {
      if (isTransparent(lit)) continue; // #0000 and rgba(0 0 0 / 0) are `transparent`, a keyword, not a color choice
      out.push({ literal: lit, offset: m.index });
    } else if (NAMED_COLORS.has(lit.toLowerCase())) {
      // Skip identifiers that are part of a var() name or function keyword context.
      const before = value.slice(0, m.index);
      if (/--[\w-]*$/.test(before)) continue;
      out.push({ literal: lit, offset: m.index });
    }
  }
  return out;
}

/** A hex with a zero alpha channel, or an rgb()/hsl() whose alpha is 0: fully transparent, whatever the channels say. */
export function isTransparent(lit: string): boolean {
  const hex = /^#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/.exec(lit);
  if (hex) {
    const alpha = hex[1]!.length === 4 ? hex[1]!.slice(3) : hex[1]!.slice(6);
    return /^0+$/.test(alpha);
  }
  const fn = /^(?:rgba?|hsla?)\(([^)]*)\)$/.exec(lit);
  if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean);
    return parts.length === 4 && /^0(\.0+)?%?$/.test(parts[3]!);
  }
  return false;
}

/** Non-zero px/rem/em lengths inside a CSS value. `0`, percentages, and `auto` are not literals. */
export function findLengthLiterals(value: string): LiteralMatch[] {
  const out: LiteralMatch[] = [];
  const re = /(?<![\w.-])-?\d*\.?\d+(px|rem|em)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (parseFloat(m[0]) === 0) continue;
    // Inside a var() fallback or a custom property name, leave it alone.
    const before = value.slice(0, m.index);
    if (/--[\w-]*$/.test(before)) continue;
    out.push({ literal: m[0], offset: m.index });
  }
  return out;
}

/** `var(--name)` references inside a value. */
export function findVarRefs(value: string): LiteralMatch[] {
  const out: LiteralMatch[] = [];
  const re = /var\(\s*(--[\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) out.push({ literal: m[1]!, offset: m.index + m[0].indexOf(m[1]!) });
  return out;
}

/**
 * Tailwind utility namespaces whose suffix is a theme key. A class in one of these namespaces that
 * fails to compile is a reference to a token that does not exist, not a custom CSS class.
 */
const TOKEN_UTILITY_PREFIXES = [
  "bg", "text", "border", "border-x", "border-y", "border-t", "border-r", "border-b", "border-l", "ring", "ring-offset", "outline", "fill", "stroke", "shadow", "inset-shadow",
  "rounded", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl",
  "p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe", "m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me",
  "gap", "gap-x", "gap-y", "space-x", "space-y", "inset", "inset-x", "inset-y", "top", "right", "bottom", "left", "start", "end",
  "w", "h", "size", "min-w", "max-w", "min-h", "max-h", "basis",
  "font", "leading", "tracking", "decoration", "accent", "caret", "divide", "placeholder", "indent", "scroll-m", "scroll-p",
  "duration", "ease", "delay",
];

/** The namespace of a base utility when it is one that references theme keys, else undefined. */
export function tokenUtilityPrefix(base: string): string | undefined {
  let best: string | undefined;
  for (const p of TOKEN_UTILITY_PREFIXES) {
    if (base.startsWith(p + "-") && (!best || p.length > best.length)) best = p;
  }
  return best;
}

/** Replaces several literals in a value with `var()` references in one pass, by offset, so earlier edits do not shift later ones. */
export function rewriteAll(value: string, edits: { literal: string; offset: number; cssVar: string }[]): string {
  let out = value;
  for (const e of [...edits].sort((a, b) => b.offset - a.offset)) {
    out = out.slice(0, e.offset) + `var(${e.cssVar})` + out.slice(e.offset + e.literal.length);
  }
  return out;
}

/** Rewrites an arbitrary-value utility to reference a theme key: `bg-[#3B82F6]` + `primary` -> `bg-primary`. */
export function rewriteArbitrary(candidate: string, key: string): string | undefined {
  const m = /^(.*?)-\[[^\]]*\]$/.exec(candidate);
  if (!m) return undefined;
  return `${m[1]}-${key}`;
}
