import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, type ComponentManifest } from "@zenginui/engine";
import { describe, expect, it } from "vitest";
import { codeConnectFiles, figmaToHex, fromFigmaVariables, hexToFigma, PLUGIN_FILES, renderImportReport, toFigmaValue, toFigmaVariables, type LocalVariables } from "../src/index.js";

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
});

describe("codeConnectFiles", () => {
  it("writes one figma.tsx per component with the manifest's enums and booleans, and the config", () => {
    const files = codeConnectFiles(manifests, { urls: { Button: "https://www.figma.com/design/abc/Zengin?node-id=1-2" } });
    expect(Object.keys(files)).toContain("figma.config.json");
    expect(JSON.parse(files["figma.config.json"]!)).toEqual({ codeConnect: { include: ["src/figma/**/*.figma.tsx"], parser: "react" } });
    const button = files["src/figma/button.figma.tsx"]!;
    expect(button).toContain('import { Button } from "@/components/ui";');
    expect(button).toContain('figma.connect(Button, "https://www.figma.com/design/abc/Zengin?node-id=1-2", {');
    expect(button).toContain('variant: figma.enum("Variant", { "Solid": "solid", "Soft": "soft", "Ghost": "ghost", "Link": "link" }),');
    expect(button).toContain('loading: figma.boolean("Loading"),');
    expect(button).toContain('children: figma.string("Label"),');
    expect(button).not.toContain("asChild");
    expect(button).not.toContain("TODO");
    const text = files["src/figma/text-field.figma.tsx"]!;
    expect(text).toContain("TODO: replace the URL");
    expect(text).toContain('label: figma.string("Label"),');
    expect(Object.keys(files).length).toBe(manifests.length + 1);
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
