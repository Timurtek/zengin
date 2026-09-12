/**
 * Color math for palette derivation: sRGB hex to OKLCH and back, gamut clipping by chroma, and WCAG
 * contrast. OKLCH is used because equal steps in L look equal, which is what a hover or a soft tint needs.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex color: ${hex}`);
  let s = m[1]!;
  if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
}

const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklch([r, g, b]: [number, number, number]): Oklch {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h };
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const bb = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: [number, number, number]): boolean => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH to hex, lowering chroma until the color fits sRGB so hue and lightness survive. */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  let lin = oklchToLinearRgb({ ...color, c });
  for (let i = 0; i < 24 && !inGamut(lin); i++) {
    c *= 0.9;
    lin = oklchToLinearRgb({ ...color, c });
  }
  if (!inGamut(lin)) lin = oklchToLinearRgb({ ...color, c: 0 });
  return rgbToHex([toGamma(clamp01(lin[0])), toGamma(clamp01(lin[1])), toGamma(clamp01(lin[2]))]);
}

export function hexToOklch(hex: string): Oklch {
  return rgbToOklch(hexToRgb(hex));
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** WCAG 2 relative luminance of a hex color. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Moves `color` in lightness, step by step in `direction`, until it reaches `ratio` against `against`.
 * Returns the hex reached, or the furthest tried when the ratio cannot be met.
 */
export function pushForContrast(color: Oklch, against: string, ratio: number, direction: "darker" | "lighter"): string {
  let l = color.l;
  let hex = oklchToHex({ ...color, l });
  for (let i = 0; i < 60 && contrast(hex, against) < ratio; i++) {
    l += direction === "darker" ? -0.01 : 0.01;
    if (l < 0 || l > 1) break;
    hex = oklchToHex({ ...color, l });
  }
  return hex;
}
