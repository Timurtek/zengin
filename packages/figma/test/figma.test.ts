import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, type ComponentManifest } from "@zenginui/engine";
import { describe, expect, it } from "vitest";
import {
  codeConnectFiles,
  figmaToHex,
  firstFamily,
  fromFigmaVariables,
  hexToFigma,
  parseBrandCss,
  parseThemeCss,
  PLUGIN_FILES,
  renderBrandReport,
  renderImportReport,
  resolveBrand,
  toFigmaThemedVariables,
  toFigmaValue,
  toFigmaVariables,
  type FigmaTheme,
  type LocalVariables,
  type VariablesPayload,
} from "../src/index.js";

const ui = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "ui");
const light = JSON.parse(readFileSync(join(ui, "zengin", "tokens.json"), "utf8")) as unknown;
const dark = JSON.parse(readFileSync(join(ui, "zengin", "tokens.dark.json"), "utf8")) as unknown;
const manifests = JSON.parse(readFileSync(join(ui, "zengin", "components.json"), "utf8")) as ComponentManifest[];

describe("colors", () => {
  it("round-trips hex through Figma's 0..1 channels, with alpha when present", () => {
    expect(figmaToHex(hexToFigma("#2563EB")!)).toBe("#2563EB");
    expect(hexToFigma("#0F172ACC")).toEqual({ r: 15 / 255, g: 23 / 255, b: 42 / 255, a: 204 / 255 });
    expect(figmaToHex(hexToFigma("#0F172ACC")!)).toBe("#0F172ACC");
    expect(hexToFigma("red")).toBeUndefined();
  });
});

describe("toFigmaVariables", () => {
  const payload = toFigmaVariables(light, dark);

  it("makes one collection with Light and Dark modes and one variable per token, named like the token", () => {
    expect(payload.variableCollections).toEqual([{ action: "CREATE", id: "zengin-collection", name: "Zengin", initialModeId: "zengin-mode-light" }]);
    expect(payload.variableModes.map((m) => [m.action, m.name])).toEqual([
      ["UPDATE", "Light"],
      ["CREATE", "Dark"],
    ]);
    const names = payload.variables.map((v) => v.name);
    expect(names).toContain("color/primary");
    expect(names).toContain("color/primary/soft");
    expect(names).toContain("space/4");
    expect(names).toContain("text/lg");
    expect(payload.variables.length).toBe(loadTokens(light).length);
  });

  it("types values by what Figma can hold, converts rem to px, and sets the code syntax to the CSS variable", () => {
    const by = (name: string) => payload.variables.find((v) => v.name === name)!;
    expect(by("color/primary").resolvedType).toBe("COLOR");
    expect(by("color/primary").codeSyntax).toEqual({ WEB: "var(--color-primary)" });
    expect(by("color/primary").scopes).toContain("ALL_FILLS");
    expect(by("space/4").resolvedType).toBe("FLOAT");
    expect(by("radius/md").scopes).toEqual(["CORNER_RADIUS"]);
    expect(by("font/sans").resolvedType).toBe("STRING");
    expect(by("font/sans").scopes).toEqual(["FONT_FAMILY"]);
    expect(by("space/4").scopes).toEqual(["GAP", "WIDTH_HEIGHT"]);
    expect(by("weight/semibold").scopes).toEqual(["FONT_WEIGHT"]);
    expect(by("border/width").scopes).toEqual(["STROKE_FLOAT"]);
    expect(by("leading/normal").scopes).toEqual([]); // unitless: Figma would read 1.5 as 1.5px
    expect(toFigmaValue({ type: "dimension", value: "1.125rem", namespace: "text" })).toEqual({ type: "FLOAT", value: 18 });
    expect(toFigmaValue({ type: "duration", value: "120ms", namespace: "duration" })).toEqual({ type: "FLOAT", value: 120 });
    expect(toFigmaValue({ type: "number", value: "1.5", namespace: "leading" })).toEqual({ type: "FLOAT", value: 1.5 });
  });

  it("gives every variable a light value and a dark value, the light one where dark does not override", () => {
    const primary = payload.variables.find((v) => v.name === "color/primary")!;
    const values = payload.variableModeValues.filter((v) => v.variableId === primary.id);
    expect(values.map((v) => v.modeId)).toEqual(["zengin-mode-light", "zengin-mode-dark"]);
    expect(figmaToHex(values[0]!.value as never)).toBe("#2563EB");
    expect(figmaToHex(values[1]!.value as never)).toBe("#3B82F6");
    const space = payload.variables.find((v) => v.name === "space/4")!;
    const sv = payload.variableModeValues.filter((v) => v.variableId === space.id).map((v) => v.value);
    expect(sv).toEqual([16, 16]);
  });

  it("only uses scopes Figma accepts: ALL_FILLS never beside another fill scope, nothing falls back to ALL_SCOPES", () => {
    for (const v of payload.variables) {
      if (v.scopes.includes("ALL_FILLS")) expect(v.scopes.filter((s) => /FILLS?$/.test(s))).toEqual(["ALL_FILLS"]);
      expect(v.scopes, v.name).not.toContain("ALL_SCOPES");
    }
  });

  it("holds a font as the family Figma can load: the first in the stack", () => {
    const sans = payload.variables.find((v) => v.name === "font/sans")!;
    expect(payload.variableModeValues.find((m) => m.variableId === sans.id)!.value).toBe("Inter");
    expect(firstFamily("'IBM Plex Sans', ui-sans-serif, sans-serif")).toBe("IBM Plex Sans");
  });
});

const themesDir = join(ui, "themes");
const themes: FigmaTheme[] = ["default", "zengin", "meadow", "plex", "spec-sheet", "brutal"].map((name) => ({ name, css: readFileSync(join(themesDir, name, "brand.css"), "utf8") }));

describe("parseThemeCss", () => {
  it("reads light from :root/[data-theme=light], dark from [data-theme=dark], and ignores the @media copy", () => {
    const { light: l, dark: d } = parseThemeCss(themes.find((t) => t.name === "zengin")!.css);
    expect(l["--color-primary"]).toBe("#D3442C");
    expect(d["--color-primary"]).toBe("#FC694F");
    expect(d["--font-display"]).toBe(l["--font-display"]); // dark inherits a light-only override
    const css = `:root { --a: 1px; } [data-theme="dark"] { --a: 2px; } @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --a: 9px; } }`;
    expect(parseThemeCss(css)).toEqual({ light: { "--a": "1px" }, dark: { "--a": "2px" } });
  });
});

describe("toFigmaThemedVariables", () => {
  const p = toFigmaThemedVariables(light, dark, themes);
  const col = (name: string) => p.variableCollections.find((c) => c.name === name)!;
  const variable = (name: string) => p.variables.find((v) => v.name === name)!;
  const values = (id: string) => p.variableModeValues.filter((m) => m.variableId === id);

  it("makes a Theme collection with a mode per theme beside the Zengin collection", () => {
    expect(p.variableCollections.map((c) => c.name)).toEqual(["Theme", "Zengin"]);
    expect(p.variableModes.filter((m) => m.variableCollectionId === col("Theme").id).map((m) => m.name)).toEqual(themes.map((t) => t.name));
    expect(p.variables.filter((v) => v.variableCollectionId === col("Zengin").id).length).toBe(loadTokens(light).length);
  });

  it("holds each theme's raw values in Theme, out of every picker, and points the Zengin tokens at them", () => {
    const raw = variable("light/color/primary");
    expect(raw.scopes).toEqual([]);
    expect(values(raw.id).map((v) => figmaToHex(v.value as never))).toEqual(["#2563EB", "#D3442C", "#0E7C6B", "#0F62FE", "#1B3FE4", "#FFD400"]);
    expect(values(variable("dark/color/primary").id).map((v) => figmaToHex(v.value as never))[1]).toBe("#FC694F");
    expect(values(variable("light/border/width").id).map((v) => v.value)).toEqual([1, 1, 1, 1, 1, 2]);
    expect(values(variable("light/font/display").id).map((v) => v.value)).toEqual(["Inter", "Inter Tight", "Bricolage Grotesque", "IBM Plex Sans", "Archivo", "Archivo Black"]);
    const primary = variable("color/primary");
    expect(values(primary.id).map((v) => v.value)).toEqual([
      { type: "VARIABLE_ALIAS", id: raw.id },
      { type: "VARIABLE_ALIAS", id: variable("dark/color/primary").id },
    ]);
    // tokens no theme touches keep their plain value
    expect(values(variable("space/4").id).map((v) => v.value)).toEqual([16, 16]);
    expect(p.variables.some((v) => v.name === "light/space/4")).toBe(false);
  });

  it("names a value Figma cannot hold instead of writing a wrong one", () => {
    expect(() => toFigmaThemedVariables(light, dark, [{ name: "odd", css: ":root { --color-primary: rgb(1 2 3); }" }])).toThrow(/odd.*--color-primary/);
  });
});

/** The GET shape, built from a payload as the plugin's export or the REST API would return it. */
function asLocal(edit: (vars: LocalVariables["meta"]["variables"]) => void): LocalVariables {
  const p = toFigmaVariables(light, dark);
  const local: LocalVariables = { meta: { variableCollections: {}, variables: {} } };
  const col = p.variableCollections[0]!;
  local.meta.variableCollections[col.id] = { id: col.id, name: col.name, modes: p.variableModes.map((m) => ({ modeId: m.id, name: m.name })), defaultModeId: "zengin-mode-light" };
  for (const v of p.variables) {
    const valuesByMode: Record<string, never> = {};
    for (const mv of p.variableModeValues) if (mv.variableId === v.id) (valuesByMode as Record<string, unknown>)[mv.modeId] = mv.value;
    local.meta.variables[v.id] = { id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId, valuesByMode, codeSyntax: v.codeSyntax };
  }
  edit(local.meta.variables);
  return local;
}

describe("fromFigmaVariables", () => {
  it("reports nothing when Figma matches code", () => {
    const r = fromFigmaVariables(asLocal(() => {}), light, dark);
    expect(r.changed).toEqual([]);
    expect(r.added).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(loadTokens(r.light).map((t) => [t.cssVar, t.value])).toEqual(loadTokens(light).map((t) => [t.cssVar, t.value]));
  });

  it("brings a designer's changes back with the token's own unit, and reports new and missing variables", () => {
    const local = asLocal((vars) => {
      const primary = Object.values(vars).find((v) => v.name === "color/primary")!;
      primary.valuesByMode["zengin-mode-light"] = hexToFigma("#1B3FE4")!;
      const lg = Object.values(vars).find((v) => v.name === "text/lg")!;
      lg.valuesByMode["zengin-mode-light"] = 20;
      const four = Object.values(vars).find((v) => v.name === "space/4")!;
      four.valuesByMode["zengin-mode-dark"] = 18; // a dark override that did not exist
      vars["new"] = { id: "new", name: "color/accent", resolvedType: "COLOR", variableCollectionId: "zengin-collection", valuesByMode: { "zengin-mode-light": hexToFigma("#FF0088")!, "zengin-mode-dark": hexToFigma("#FF66B2")! } };
      delete vars[Object.values(vars).find((v) => v.name === "radius/sm")!.id];
    });
    const r = fromFigmaVariables(local, light, dark);
    expect(r.changed).toEqual(
      expect.arrayContaining([
        { path: "color.primary.DEFAULT", mode: "light", before: "#2563eb", after: "#1B3FE4" }, // the engine keeps values lowercase
        { path: "text.lg", mode: "light", before: "1.125rem", after: "1.25rem" },
        { path: "space.4", mode: "dark", before: undefined, after: "18px" },
      ]),
    );
    expect(r.changed.length).toBe(3);
    expect(r.added.map((a) => [a.path, a.mode, a.after])).toEqual([
      ["color.accent", "light", "#FF0088"],
      ["color.accent", "dark", "#FF66B2"],
    ]);
    expect(r.missing).toEqual(["radius/sm"]);
    const out = loadTokens(r.light);
    expect(out.find((t) => t.cssVar === "--color-primary")!.value).toBe("#1b3fe4"); // the loader lowercases colors
    expect(out.find((t) => t.cssVar === "--text-lg")!.value).toBe("1.25rem");
    expect(out.find((t) => t.cssVar === "--color-accent")!.value).toBe("#ff0088");
    expect(loadTokens(r.dark).find((t) => t.cssVar === "--spacing-4")!.value).toBe("18px");
    expect(renderImportReport(r)).toContain("changed  color.primary.DEFAULT (light): #2563eb -> #1B3FE4");
  });

  it("skips aliases and names the collections when the one asked for is missing", () => {
    const local = asLocal((vars) => {
      const primary = Object.values(vars).find((v) => v.name === "color/primary")!;
      primary.valuesByMode["zengin-mode-dark"] = { type: "VARIABLE_ALIAS", id: "x" } as never;
    });
    const r = fromFigmaVariables(local, light, dark);
    expect(r.skipped).toEqual(["color/primary (dark): alias"]);
    expect(() => fromFigmaVariables(local, light, dark, { collection: "Brand" })).toThrow(/Collections: Zengin/);
  });

  it("follows aliases into the Theme collection: the default theme reads back as the token files, another theme as its own values", () => {
    const local = fromPayload(toFigmaThemedVariables(light, dark, themes));
    const r = fromFigmaVariables(local, light, dark);
    expect([r.changed, r.added, r.missing, r.skipped]).toEqual([[], [], [], []]);
    const meadow = fromFigmaVariables(local, light, dark, { theme: "meadow" });
    expect(meadow.changed).toEqual(expect.arrayContaining([{ path: "color.primary.DEFAULT", mode: "light", before: "#2563eb", after: "#0E7C6B" }]));
    const font = meadow.changed.find((c) => c.path === "font.sans" && c.mode === "light")!;
    expect(font.after.startsWith("'IBM Plex Sans', ")).toBe(true); // the family changes, the fallbacks stay
  });
});

describe("a project's brand", () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "brand.css"), "utf8");
  const brand = resolveBrand(css, light, dark);

  /** The token trees with the brand written into them by hand: what the export has to equal. */
  function overlaid(): { light: unknown; dark: unknown } {
    const l = JSON.parse(JSON.stringify(light)) as Record<string, unknown>;
    const d = JSON.parse(JSON.stringify(dark)) as Record<string, unknown>;
    const put = (tree: Record<string, unknown>, path: string, type: string, value: string): void => {
      const keys = path.split(".");
      let node = tree;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
      node[keys.at(-1)!] = { $type: type, $value: value };
    };
    for (const t of loadTokens(light)) {
      const lv = brand.light[t.cssVar], dv = brand.dark[t.cssVar];
      if (lv !== undefined) put(l, t.path, t.type, lv);
      if (dv !== undefined) put(d, t.path, t.type, dv);
    }
    return { light: l, dark: d };
  }

  it("reads the light block, the dark block over it, and skips the prefers-color-scheme copy and comments", () => {
    const p = parseBrandCss(css);
    expect(p.light["--color-primary"]).toBe("#1e6b3c");
    expect(p.dark["--color-primary"]).toBe("#c8f542");
    expect(p.dark["--radius-md"]).toBe("4px"); // set in light only: the cascade carries it into dark
    expect(p.mediaOnly).toEqual([]); // the @media copy repeats the dark block
    expect(p.ignored).toEqual([]); // .brand-mark sets no custom property
  });

  it("exports the token files with the brand over them: the same payload as tokens with the brand written in", () => {
    const o = overlaid();
    expect(toFigmaVariables(light, dark, { overrides: brand })).toEqual(toFigmaVariables(o.light, o.dark));
  });

  it("puts the brand's values in Light and Dark, and its type and shape in both", () => {
    const p = toFigmaVariables(light, dark, { overrides: brand });
    const value = (name: string, mode: string) => p.variableModeValues.find((m) => m.variableId === p.variables.find((v) => v.name === name)!.id && m.modeId === mode)!.value;
    expect(figmaToHex(value("color/primary", "zengin-mode-light") as never)).toBe("#1E6B3C");
    expect(figmaToHex(value("color/primary", "zengin-mode-dark") as never)).toBe("#C8F542");
    expect(figmaToHex(value("color/surface", "zengin-mode-light") as never)).toBe("#F4F8F5");
    expect(figmaToHex(value("color/surface", "zengin-mode-dark") as never)).toBe("#0D1A14");
    expect(figmaToHex(value("color/primary/soft-foreground", "zengin-mode-dark") as never)).toBe("#C8F542"); // var() resolves per mode
    for (const mode of ["zengin-mode-light", "zengin-mode-dark"]) {
      expect(value("font/sans", mode)).toBe("Hanken Grotesk");
      expect(value("radius/md", mode)).toBe(4);
      expect(value("text/sm", mode)).toBe(13);
    }
    // a token the brand leaves alone keeps the system's value in each mode
    expect(figmaToHex(value("color/danger", "zengin-mode-dark") as never)).toBe(figmaToHex(toFigmaValue(loadTokens(dark).find((t) => t.cssVar === "--color-danger")!)!.value as never));
  });

  it("reports what it overrode and what names no token", () => {
    expect(brand.unmatched).toEqual(["--color-text-faint"]);
    expect(brand.unsupported).toEqual([]);
    expect(brand.overridden.find((e) => e.cssVar === "--color-primary")).toEqual({ path: "color.primary.DEFAULT", cssVar: "--color-primary", light: "#1e6b3c", dark: "#c8f542" });
    const text = renderBrandReport(brand, "src/theme/brand.css");
    expect(text).toContain("Brand: src/theme/brand.css overrides 15 tokens; 1 of its custom properties name no token.");
    expect(text).toContain("brand      radius.md: 4px (light and dark)");
    expect(text).toContain("unmatched  --color-text-faint: no token by that name, not exported");
  });

  it("names what it cannot read instead of exporting it: values Figma cannot hold, other selectors, @media only", () => {
    const odd = resolveBrand(
      `:root { --color-primary: color-mix(in srgb, red 50%, blue); --radius-md: calc(2px + 2px); --color-surface: rgb(244 248 245); }
       .dark { --color-primary: #c8f542; }
       [data-theme='dark'] { --color-text: var(--nope, #e9f5ee); }
       @media (prefers-color-scheme: dark) { :root { --color-focus: #c8f542; } }`,
      light,
      dark,
    );
    expect(odd.unsupported).toEqual([
      { cssVar: "--color-primary", mode: "light", value: "color-mix(in srgb, red 50%, blue)" },
      { cssVar: "--color-primary", mode: "dark", value: "color-mix(in srgb, red 50%, blue)" },
      { cssVar: "--radius-md", mode: "light", value: "calc(2px + 2px)" },
      { cssVar: "--radius-md", mode: "dark", value: "calc(2px + 2px)" },
    ]);
    expect(odd.light["--color-surface"]).toBe("#f4f8f5"); // rgb() normalized the way the token loader writes colors
    expect(odd.dark["--color-text"]).toBe("#e9f5ee"); // var() falls back when it names nothing; single quotes are the same selector
    expect(odd.ignored).toEqual([{ selector: ".dark", properties: ["--color-primary"] }]);
    expect(odd.mediaOnly).toEqual(["--color-focus"]);
    expect(odd.light["--color-primary"]).toBeUndefined(); // the default stands
  });

  it("imports against the brand: nothing changed after a round trip, and a change to a brand token is never written", () => {
    const exported = fromPayload(toFigmaVariables(light, dark, { overrides: brand }));
    const clean = fromFigmaVariables(exported, light, dark, { brand });
    expect([clean.changed, clean.added, clean.brand, clean.skipped]).toEqual([[], [], [], []]);
    // without the brand the same file reads as a wholesale change to the defaults: the bug this guards
    expect(fromFigmaVariables(exported, light, dark).changed.length).toBeGreaterThan(20);

    const edited = fromPayload(toFigmaVariables(light, dark, { overrides: brand }));
    const set = (name: string, mode: string, hex: string) => {
      Object.values(edited.meta.variables).find((v) => v.name === name)!.valuesByMode[mode] = hexToFigma(hex)!;
    };
    set("color/primary", "zengin-mode-light", "#2E7D4F"); // the brand sets it
    set("color/danger", "zengin-mode-light", "#C0392B"); // the brand does not
    const r = fromFigmaVariables(edited, light, dark, { brand });
    expect(r.brand).toEqual([{ path: "color.primary.DEFAULT", mode: "light", before: "#1e6b3c", after: "#2E7D4F" }]);
    expect(r.changed.map((c) => [c.path, c.mode, c.after])).toEqual([["color.danger.DEFAULT", "light", "#C0392B"]]);
    const out = loadTokens(r.light);
    expect(out.find((t) => t.cssVar === "--color-primary")!.value).toBe("#2563eb"); // the default, untouched
    expect(out.find((t) => t.cssVar === "--color-danger")!.value).toBe("#c0392b");
    expect(loadTokens(r.dark).map((t) => [t.cssVar, t.value])).toEqual(loadTokens(dark).map((t) => [t.cssVar, t.value]));
    expect(renderImportReport(r)).toContain("brand    color.primary.DEFAULT (light): #1e6b3c -> #2E7D4F");
  });
});

describe("a dark file that aliases light tokens", () => {
  // what the CSS adapter writes: the dark file names light palette steps rather than restating hex
  const aLight = { color: { $type: "color", "gray-100": { $value: "#F3F4F6" }, "gray-900": { $value: "#111827" }, surface: { $value: "{color.gray-100}" }, text: { $value: "{color.gray-900}" } }, radius: { md: { $value: "6px" } } };
  const aDark = { color: { surface: { $value: "{color.gray-900}" }, text: { $value: "{color.gray-100}" } } };
  const value = (p: VariablesPayload, name: string, mode: string) => p.variableModeValues.find((m) => m.variableId === p.variables.find((v) => v.name === name)!.id && m.modeId === mode)!.value;

  it("exports, resolving the aliases against the light file", () => {
    const p = toFigmaVariables(aLight, aDark);
    expect(figmaToHex(value(p, "color/surface", "zengin-mode-dark") as never)).toBe("#111827");
    expect(figmaToHex(value(p, "color/text", "zengin-mode-dark") as never)).toBe("#F3F4F6");
    expect(figmaToHex(value(p, "color/gray-100", "zengin-mode-dark") as never)).toBe("#F3F4F6"); // not in the dark file: the light value
  });

  it("exports with themes and with a brand, and imports back clean", () => {
    expect(() => toFigmaThemedVariables(aLight, aDark, [{ name: "default", css: ":root { --color-surface: #FFFFFF; }" }])).not.toThrow();
    const brand = resolveBrand('[data-theme="dark"] { --color-text: var(--color-surface); }', aLight, aDark);
    expect(brand.dark["--color-text"]).toBe("#111827"); // var() reads the dark surface, an alias into light
    const r = fromFigmaVariables(fromPayload(toFigmaVariables(aLight, aDark)), aLight, aDark);
    expect([r.changed, r.added, r.missing, r.skipped]).toEqual([[], [], [], []]);
  });
});

/** The GET shape for any payload: temporary ids stand in for real ones, the first mode is the default. */
function fromPayload(p: VariablesPayload): LocalVariables {
  const local: LocalVariables = { meta: { variableCollections: {}, variables: {} } };
  for (const c of p.variableCollections) {
    local.meta.variableCollections[c.id] = { id: c.id, name: c.name, modes: p.variableModes.filter((m) => m.variableCollectionId === c.id).map((m) => ({ modeId: m.id, name: m.name })), defaultModeId: c.initialModeId };
  }
  for (const v of p.variables) {
    const valuesByMode: Record<string, never> = {};
    for (const mv of p.variableModeValues) if (mv.variableId === v.id) (valuesByMode as Record<string, unknown>)[mv.modeId] = mv.value;
    local.meta.variables[v.id] = { id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId, valuesByMode, codeSyntax: v.codeSyntax };
  }
  return local;
}

describe("codeConnectFiles", () => {
  it("writes one Code Connect template per component with the manifest's enums and booleans, and the config", () => {
    const files = codeConnectFiles(manifests, { urls: { Button: "https://www.figma.com/design/abc/Zengin?node-id=1-2" } });
    expect(JSON.parse(files["figma.config.json"]!)).toEqual({ codeConnect: { include: ["src/figma/**/*.figma.ts"], label: "React", language: "tsx" } });
    const button = files["src/figma/button.figma.ts"]!;
    expect(button.startsWith("// url=https://www.figma.com/design/abc/Zengin?node-id=1-2\n// component=Button\n")).toBe(true);
    expect(button).toContain('import figma from "figma"');
    expect(button).toContain(`imports: ["import { Button } from \\"@/components/ui\\";"]`);
    expect(button).toContain('const variant = figma.selectedInstance.getEnum("Variant", {\n  "Solid": "solid",');
    expect(button).toContain('const loading = figma.selectedInstance.getBoolean("Loading")');
    expect(button).toContain('const children = figma.selectedInstance.getString("Label")');
    expect(button).toContain('example: figma.code`<Button${figma.helpers.react.renderProp("variant", variant)}');
    expect(button).not.toContain("asChild");
    expect(button).not.toContain("TODO");
    const text = files["src/figma/text-field.figma.ts"]!;
    expect(text).toContain("TODO: replace the URL");
    expect(text).toContain('const label = figma.selectedInstance.getString("Label")');
    expect(Object.keys(files).length).toBe(manifests.length + 1);
    expect(codeConnectFiles(manifests, { alias: "@zenginui/ui" })["src/figma/button.figma.ts"]).toContain(`import { Button } from \\"@zenginui/ui\\";`);
  });

  it("leaves out form plumbing a design file has no property for", () => {
    const select = codeConnectFiles(manifests)["src/figma/select.figma.ts"]!;
    expect(select).toContain('getEnum("Size"');
    expect(select).toContain('getBoolean("Open")');
    expect(select).toContain('getString("Value")');
    for (const gone of ["Default value", "Default open", '"Name"', '"Id"']) expect(select).not.toContain(gone);
  });

  it("writes valid identifiers, reads Label once, and skips direction and image URLs", () => {
    const files = codeConnectFiles(manifests);
    const chart = files["src/figma/line-chart.figma.ts"]!;
    expect(chart).toContain('const ariaLabel = figma.selectedInstance.getString("Aria label")');
    expect(chart).toContain('renderProp("aria-label", ariaLabel)');
    expect(chart).not.toMatch(/const [\w$]*-/);
    expect(files["src/figma/loader.figma.ts"]!.match(/getString\("Label"\)/g)!.length).toBe(1);
    expect(files["src/figma/menu.figma.ts"]).not.toContain('"Dir"');
    expect(files["src/figma/avatar.figma.ts"]).not.toContain('"Src"');
    expect(files["src/figma/message.figma.ts"]).not.toContain('"Avatar src"');
  });
});

describe("plugin", () => {
  it("ships a manifest, a UI and code that import and export", () => {
    expect(JSON.parse(PLUGIN_FILES["manifest.json"]!)).toMatchObject({ name: "Zengin variables", main: "code.js", ui: "ui.html" });
    expect(PLUGIN_FILES["code.js"]).toContain("createVariableCollection");
    expect(PLUGIN_FILES["code.js"]).toContain("setVariableCodeSyntax");
    expect(PLUGIN_FILES["code.js"]).toContain("getLocalVariablesAsync");
    expect(PLUGIN_FILES["ui.html"]).toContain('id="import"');
  });
});
