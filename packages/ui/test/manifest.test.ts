import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, type ComponentManifest } from "@zengin/engine";
import { describe, expect, it } from "vitest";
import * as ui from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const manifests = JSON.parse(readFileSync(join(root, "zengin", "components.json"), "utf8")) as ComponentManifest[];
const tokensCss = readFileSync(join(root, "src", "styles", "generated", "tokens.css"), "utf8");

/** Every CSS variable the components reference. */
function referencedVars(): Set<string> {
  const out = new Set<string>();
  const dir = join(root, "src", "components");
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".css")) {
        for (const m of readFileSync(p, "utf8").matchAll(/var\((--[\w-]+)/g)) out.add(m[1]!);
      }
    }
  };
  walk(dir);
  return out;
}

describe("components.json against the implementation", () => {
  it("every manifest names an exported component with the declared export name", () => {
    for (const m of manifests) {
      expect(m.export.from).toBe("@zengin/ui");
      expect(m.export.name).toBe(m.name);
      expect(ui, m.name).toHaveProperty(m.name);
    }
  });

  it("every exported component has a manifest", () => {
    const exported = Object.keys(ui).filter((k) => /^[A-Z]/.test(k));
    expect(exported.sort()).toEqual(manifests.map((m) => m.name).sort());
  });

  it("declared sub-parts exist on the component object", () => {
    for (const m of manifests) {
      const comp = (ui as Record<string, unknown>)[m.name] as Record<string, unknown>;
      for (const slot of m.slots ?? []) {
        if (/^[A-Z]/.test(slot)) expect(comp, `${m.name}.${slot}`).toHaveProperty(slot);
      }
    }
  });

  it("every component has a story file, and every enum prop with more than one value has a matrix or size story", () => {
    for (const m of manifests) {
      const file = m.name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      const story = join(root, "stories", `${file}.stories.tsx`);
      expect(existsSync(story), `${m.name}: stories/${file}.stories.tsx`).toBe(true);
      const src = readFileSync(story, "utf8");
      expect(src, `${m.name} story reads its manifest`).toContain(`argTypesFor("${m.name}")`);
    }
  });

  it("enum defaults are among the declared values", () => {
    for (const m of manifests) {
      for (const [name, p] of Object.entries(m.props ?? {})) {
        if (p.type === "enum" && p.default !== undefined) {
          expect(p.values, `${m.name}.${name}`).toContain(p.default);
        }
      }
    }
  });

  it("every enum value has a matching stylesheet rule", () => {
    // A variant the CSS does not style is a variant that does nothing.
    const cssByComponent: Record<string, string> = {};
    for (const m of manifests) {
      const file = m.name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      cssByComponent[m.name] = readFileSync(join(root, "src", "components", file, `${file}.css`), "utf8");
    }
    const styled: Record<string, string[]> = {
      Button: ["variant", "tone", "size", "align"],
      Badge: ["variant", "tone", "size"],
      Card: ["variant", "padding"],
      TextField: ["size"],
      Checkbox: ["size"],
      Dialog: ["size"],
      Tabs: ["variant", "size"],
      Select: ["size"],
      Switch: ["size"],
      Toast: ["position", "tone"],
      Table: ["density"],
      Avatar: ["size", "shape"],
      Skeleton: ["variant"],
      Sheet: ["side", "size"],
      Popover: ["size"],
      Progress: ["size", "tone"],
      Separator: ["orientation"],
      TextArea: ["size", "resize"],
      Sparkline: ["tone"],
      Message: ["role"],
      Loader: ["size"],
      Suggestions: ["layout"],
      PromptInput: ["status"],
      ToolCall: ["state"],
    };
    for (const [comp, props] of Object.entries(styled)) {
      const m = manifests.find((x) => x.name === comp)!;
      for (const prop of props) {
        for (const value of m.props![prop]!.values!) {
          expect(cssByComponent[comp], `${comp} ${prop}=${value}`).toContain(`[data-${prop}="${value}"]`);
        }
      }
    }
  });
});

describe("tokens", () => {
  it("every variable the components reference is defined by the theme", () => {
    const defined = new Set([...tokensCss.matchAll(/(--[\w-]+):/g)].map((m) => m[1]!));
    const missing = [...referencedVars()].filter((v) => !defined.has(v) && !v.startsWith("--radix-"));
    expect(missing).toEqual([]);
  });

  it("the dark theme overrides only tokens the light theme defines, and only colors", () => {
    const light = loadTokens(JSON.parse(readFileSync(join(root, "zengin", "tokens.json"), "utf8")));
    const dark = loadTokens(JSON.parse(readFileSync(join(root, "zengin", "tokens.dark.json"), "utf8")));
    const lightVars = new Set(light.map((t) => t.cssVar));
    for (const t of dark) {
      expect(lightVars.has(t.cssVar), t.cssVar).toBe(true);
      expect(t.type).toBe("color");
    }
  });

  it("uses only semantic color names, no palette scales", () => {
    const light = loadTokens(JSON.parse(readFileSync(join(root, "zengin", "tokens.json"), "utf8")));
    for (const t of light.filter((t) => t.namespace === "color")) {
      expect(t.key, t.name).not.toMatch(/-\d{2,3}$/);
    }
  });
});
