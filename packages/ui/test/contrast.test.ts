import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, type Token } from "@zenginui/engine";
import { describe, expect, it } from "vitest";

/**
 * WCAG contrast over the token pairs the components actually put together, in both themes. Found the
 * first time by Storybook's accessibility addon on the Button variant matrix; kept here so a token edit
 * cannot regress it silently.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const light = loadTokens(JSON.parse(readFileSync(join(root, "zengin", "tokens.json"), "utf8")));
const darkOverrides = loadTokens(JSON.parse(readFileSync(join(root, "zengin", "tokens.dark.json"), "utf8")));

function theme(overrides: Token[]): Map<string, string> {
  const m = new Map(light.map((t) => [t.name, t.value]));
  for (const t of overrides) m.set(t.name, t.value);
  return m;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TONES = ["primary", "danger", "success", "warning", "neutral"];
const AA = 4.5;

/** [foreground, background, what it is] */
function pairs(): [string, string, string][] {
  const out: [string, string, string][] = [
    ["color.text", "color.surface", "body text"],
    ["color.text-muted", "color.surface", "muted text"],
    ["color.text", "color.surface-raised", "text on raised"],
    ["color.text", "color.surface-sunken", "text on sunken"],
    ["color.text-muted", "color.surface-raised", "muted on raised"],
    ["color.danger", "color.surface", "field error text"],
  ];
  for (const tone of TONES) {
    out.push([`color.on-${tone}`, `color.${tone}`, `solid ${tone}`]);
    out.push([`color.${tone}.soft-foreground`, `color.${tone}.soft`, `soft ${tone}`]);
    if (tone !== "neutral") out.push([`color.${tone}`, `color.surface`, `ghost, link and outline ${tone}`]);
  }
  return out;
}

describe.each([
  ["light", theme([])],
  ["dark", theme(darkOverrides)],
])("%s theme meets WCAG AA on every component pairing", (_name, t) => {
  it.each(pairs())("%s on %s (%s)", (fg, bg, _what) => {
    const f = t.get(fg);
    const b = t.get(bg);
    expect(f, fg).toBeDefined();
    expect(b, bg).toBeDefined();
    expect(contrast(f!, b!), `${fg} on ${bg}: ${contrast(f!, b!).toFixed(2)}`).toBeGreaterThanOrEqual(AA);
  });
});
