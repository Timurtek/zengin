import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { applyTheme, brandProject, buildRegistry, contrast, createProject, derivePalette, fontsHref, hexToOklch, listThemes, oklchToHex, patchIndexHtml, primaryFromSvg, registryFromMemory, renderBrandCss } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const registry = buildRegistry({ root });
const source = registryFromMemory(registry);
const tmp = mkdtempSync(join(tmpdir(), "zengin-brand-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("color", () => {
  it("round-trips hex through OKLCH", () => {
    for (const hex of ["#1B3FE4", "#0E7C6B", "#FFFFFF", "#000000", "#B45309"]) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it("clips out-of-gamut colors by lowering chroma, keeping hue and lightness", () => {
    const loud = { l: 0.6, c: 0.4, h: 140 };
    const hex = oklchToHex(loud);
    const back = hexToOklch(hex);
    expect(Math.abs(back.l - 0.6)).toBeLessThan(0.03);
    expect(Math.abs(back.h - 140)).toBeLessThan(4);
    expect(back.c).toBeLessThan(0.4);
  });

  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBe(1);
  });
});

describe("derivePalette", () => {
  const cases = ["#1B3FE4", "#0E7C6B", "#FACC15", "#DC2626", "#7C3AED", "#F97316", "#94A3B8"];
  for (const hex of cases) {
    it(`meets AA for every pairing the components rely on, from ${hex}`, () => {
      const p = derivePalette(hex);
      for (const scheme of [p.light, p.dark]) {
        expect(contrast(scheme["--color-text"]!, scheme["--color-surface"]!)).toBeGreaterThanOrEqual(7);
        expect(contrast(scheme["--color-text-muted"]!, scheme["--color-surface"]!)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(scheme["--color-primary"]!, scheme["--color-surface"]!)).toBeGreaterThanOrEqual(3);
        expect(contrast(scheme["--color-on-primary"]!, scheme["--color-primary"]!)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(scheme["--color-primary-soft-foreground"]!, scheme["--color-primary-soft"]!)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(scheme["--color-on-neutral"]!, scheme["--color-neutral"]!)).toBeGreaterThanOrEqual(4.5);
      }
      expect(Object.keys(p.light).sort()).toEqual(Object.keys(p.dark).sort());
      // Every value is a hex color the engine's loader accepts (plus the alpha overlay).
      for (const v of [...Object.values(p.light), ...Object.values(p.dark)]) expect(v).toMatch(/^#[0-9A-F]{6}(CC)?$/);
    });
  }

  it("keeps the hue of the primary in the light primary and tints the neutrals toward it", () => {
    const p = derivePalette("#0E7C6B");
    expect(Math.abs(hexToOklch(p.light["--color-primary"]!).h - hexToOklch("#0E7C6B").h)).toBeLessThan(3);
    const raised = hexToOklch(p.light["--color-surface-raised"]!);
    expect(raised.c).toBeGreaterThan(0);
    expect(raised.c).toBeLessThan(0.02);
  });

  it("uses dark text on a primary too light for white", () => {
    const p = derivePalette("#FACC15");
    expect(p.light["--color-on-primary"]).not.toBe("#FFFFFF");
  });
});

describe("primaryFromSvg", () => {
  it("picks the most saturated painted color and ignores greys, white and black", () => {
    const svg = '<svg><rect fill="#FFFFFF"/><path stroke="#333" fill="rgb(14, 124, 107)"/><circle fill="#9CA3AF"/><g fill="#1B3FE4"/></svg>';
    expect(primaryFromSvg(svg)).toBe("#1B3FE4");
    expect(primaryFromSvg('<svg><rect fill="#000"/><rect fill="#eee"/></svg>')).toBeUndefined();
  });
});

describe("renderBrandCss and the html patch", () => {
  it("writes both schemes, fonts, radii and the wordmark, and links fonts once", () => {
    const css = renderBrandCss({ name: "Acme", palette: derivePalette("#1B3FE4"), fontDisplay: "Archivo", fontSans: "Inter", radius: "sharp", logo: false });
    expect(css).toContain('--font-display: "Archivo", "Inter",');
    expect(css).toContain("--radius-xl: 0px;");
    expect(css).toContain('[data-theme="dark"] {');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(".brand-mark {");

    const dir = join(tmp, "html");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), "<!doctype html>\n<html>\n  <head>\n    <title>old</title>\n  </head>\n  <body></body>\n</html>\n");
    patchIndexHtml(dir, { title: "Acme <1>", themeColor: "#1B3FE4", icon: "/favicon.svg", fonts: fontsHref(["Archivo"]) });
    patchIndexHtml(dir, { fonts: fontsHref(["Inter", "Inter"]) });
    const html = readFileSync(join(dir, "index.html"), "utf8");
    expect(html).toContain("<title>Acme &lt;1&gt;</title>");
    expect(html).toContain('<meta name="theme-color" content="#1B3FE4" />');
    expect(html).toContain('<link rel="icon" href="/favicon.svg" />');
    expect(html.match(/data-zengin="fonts"/g)).toHaveLength(1);
    expect(html).toContain("family=Inter:wght@400;500;600;700&display=swap");
    expect(html).not.toContain("Archivo");
  });
});

describe("themes", () => {
  it("are in the registry with their fonts", async () => {
    const themes = await listThemes(source);
    expect(themes.map((t) => t.name)).toEqual(["brutal", "default", "meadow", "plex", "spec-sheet", "zengin"]);
    expect(themes.find((t) => t.name === "brutal")!.fonts).toEqual(["Archivo Black", "Public Sans", "Space Mono"]);
    expect(themes.find((t) => t.name === "spec-sheet")!.fonts).toEqual(["Archivo", "Schibsted Grotesk", "JetBrains Mono"]);
  });

  it("apply to a created project, replacing the brand file and the fonts link, and the project stays clean", async () => {
    const dir = join(tmp, "themed");
    const r = await createProject({ dir, template: "blank", source, storybook: false, theme: "plex" });
    expect(r.violations).toBe(0);
    expect(readFileSync(join(dir, "src/theme/brand.css"), "utf8")).toContain("--color-primary: #0F62FE;");
    expect(readFileSync(join(dir, "index.html"), "utf8")).toContain("family=IBM+Plex+Sans");

    const applied = await applyTheme({ projectDir: dir, name: "spec-sheet", source });
    expect(applied.files).toEqual(["src/theme/brand.css"]);
    const html = readFileSync(join(dir, "index.html"), "utf8");
    expect(html).toContain("family=Archivo");
    expect(html).not.toContain("family=IBM+Plex+Sans");
    expect(html.match(/data-zengin="fonts"/g)).toHaveLength(1);
    await expect(applyTheme({ projectDir: dir, name: "nope", source })).rejects.toThrow(/Themes: brutal, default, meadow, plex, spec-sheet, zengin/);
  });
});

describe("brandProject", () => {
  it("brands a project from a logo, writes the files, patches index.html, and the project stays clean", async () => {
    const dir = join(tmp, "branded");
    await createProject({ dir, template: "blank", source, storybook: false });
    const logo = join(dir, "logo.svg");
    writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#0E7C6B"/></svg>');

    const r = await brandProject({ projectDir: dir, name: "Acme Reviews", logo: "logo.svg", fontDisplay: "Archivo", fontSans: "Inter", radius: "round" });
    expect(r.primarySource).toBe("logo");
    expect(r.primary).toBe("#0E7C6B");
    expect(r.violations).toBe(0);
    expect(r.files).toEqual(expect.arrayContaining(["public/logo.svg", "src/theme/brand.css", "zengin/brand.json", "src/brand.ts", "src/components/brand-mark.tsx", "index.html"]));
    expect(existsSync(join(dir, "public/favicon.svg"))).toBe(false); // the SVG logo is the icon
    const html = readFileSync(join(dir, "index.html"), "utf8");
    expect(html).toContain("<title>Acme Reviews</title>");
    expect(html).toContain('<link rel="icon" href="/logo.svg" />');
    expect(html).toContain("family=Archivo");
    expect(readFileSync(join(dir, "src/theme/brand.css"), "utf8")).toContain("--radius-xl: 24px;");
    expect(JSON.parse(readFileSync(join(dir, "zengin/brand.json"), "utf8"))).toMatchObject({ name: "Acme Reviews", primary: "#0E7C6B", logo: "public/logo.svg", radius: "round" });
    for (const c of r.contrast) expect(c.ratio, c.pair).toBeGreaterThanOrEqual(3);
  });

  it("brands from a color alone, with a generated favicon and the system primary as the fallback", async () => {
    const dir = join(tmp, "branded-2");
    await createProject({ dir, template: "blank", source, storybook: false });
    const r = await brandProject({ projectDir: dir, name: "Nova", primary: "#7c3aed" });
    expect(r.primary).toBe("#7C3AED");
    expect(r.primarySource).toBe("option");
    expect(readFileSync(join(dir, "public/favicon.svg"), "utf8")).toContain(">N<");
    expect(r.violations).toBe(0);

    const s = await brandProject({ projectDir: dir, name: "Nova" });
    expect(s.primarySource).toBe("system");
    expect(s.primary).toBe("#2563EB");
    await expect(brandProject({ projectDir: dir, name: "Nova", primary: "blue" })).rejects.toThrow(/hex color/);
  });
});
