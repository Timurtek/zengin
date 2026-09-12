import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEngine, loadTokens, resolveConfig, type ComponentManifest, type Engine, type Violation } from "../src/index.js";

/**
 * Regressions from the second field test (vercel/ai-chatbot, Tailwind 4, 2026-09-12). A system that
 * adopted Tailwind's spacing scale, a project that declares its own variants, and a manifest with nothing
 * to say.
 */

const TOKENS = {
  color: {
    $type: "color",
    background: { $value: "#FFFFFF" },
    foreground: { $value: "#0A0A0A" },
    destructive: { $value: "#E7000B" },
    success: { $value: "#008236" },
    "chart-1": { $value: "#F54900" },
  },
};

const COMPONENTS: ComponentManifest[] = [
  {
    name: "Button",
    export: { from: "@/components/ui/button", name: "Button" },
    replaces: ["button"],
    extends: "button",
    props: { variant: { type: "enum", values: ["default", "ghost"], default: "default" } },
    className: { allow: ["margin", "width", "height", "flex-item", "grid-item", "position", "display", "overflow"] },
    owns: { "background-color": "variant", color: "variant", padding: null, "border-radius": null },
  },
  // Wraps a primitive the adapter could not read: no props, nothing extended. Uncontracted.
  { name: "Command", export: { from: "@/components/ui/command", name: "Command" }, props: {}, className: { allow: [] } },
];

let dir: string;
let engine: Engine | undefined;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "zengin-field2-"));
  writeFileSync(
    join(dir, "globals.css"),
    `@import "tailwindcss";\n@custom-variant toast-mobile (@media (max-width: 600px));\n@utility content-auto { content-visibility: auto; }\n@utility no-scrollbar { &::-webkit-scrollbar { display: none; } scrollbar-width: none; }\n:root { --background: #fff; }\n`,
  );
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function check(path: string, content: string): Promise<Violation[]> {
  engine ??= await createEngine(
    resolveConfig(
      {
        system: { package: "@/components/ui", version: "0.0.0", sources: ["@/components/ui/*"] },
        scope: { include: ["**/*.tsx"] },
        classes: { tailwind: true, css: ["globals.css"] },
      },
      dir,
    ),
    { tokens: loadTokens(TOKENS), components: COMPONENTS },
  );
  return engine.checkFile({ path, content });
}

describe("spacing on Tailwind's own scale", () => {
  it("accepts named steps that resolve to literals, and still rejects arbitrary values", async () => {
    const v = await check("app/a.tsx", `export const A = () => <div className="p-px mx-px gap-0.5 ml-[-0.15rem]" />;`);
    expect(v.map((x) => x.found)).toEqual(["ml-[-0.15rem]"]);
  });
});

describe("project-defined Tailwind rules", () => {
  it("compiles classes under a @custom-variant the project declares", async () => {
    const v = await check("app/b.tsx", `export const B = () => <div className="toast-mobile:w-[356px] toast-mobile:w-fit content-auto no-scrollbar" />;`);
    expect(v.filter((x) => x.rule === "token-reference")).toEqual([]);
  });

  it("names an unknown variant as the problem when the utility itself compiles", async () => {
    const v = await check("app/h.tsx", `export const H = () => <div className="phone:w-fit toast-mobile:w-fit" />;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.found).toBe("phone:w-fit");
    expect(v[0]!.rule).toBe("token-reference");
    expect(v[0]!.message).toMatch(/Unknown variant "phone"/);
  });

  it("matches achromatic palette values Tailwind writes with a none hue", async () => {
    const v = await check("app/g.tsx", `export const G = () => <p className="text-neutral-500" />;`);
    expect(v).toHaveLength(1);
    expect(v[0]!.fix.confidence).toBe("nearest");
    expect(v[0]!.fix.replace).toMatch(/^text-/);
  });

  it("does not report @property bookkeeping as properties a component owns", async () => {
    const v = await check(
      "app/c.tsx",
      `import { Button } from "@/components/ui/button";\nexport const C = () => <Button className="translate-x-[-50%] shadow-none">x</Button>;`,
    );
    for (const x of v) {
      expect(x.message).not.toMatch(/syntax|inherits|initial-value/);
    }
    expect(v.map((x) => x.found)).toEqual(["translate-x-[-50%]", "shadow-none"]);
  });
});

describe("placement includes display and overflow", () => {
  it("allows responsive show/hide and overflow on a system component", async () => {
    const v = await check(
      "app/d.tsx",
      `import { Button } from "@/components/ui/button";\nexport const D = () => <Button className="hidden md:flex overflow-hidden mt-2">x</Button>;`,
    );
    expect(v.filter((x) => x.rule === "classname-policy")).toEqual([]);
  });
});

describe("uncontracted components", () => {
  it("does not call props unknown on a component whose manifest declares none", async () => {
    const v = await check(
      "app/e.tsx",
      `import { Command } from "@/components/ui/command";\nexport const E = () => <Command defaultValue="x" shouldFilter={false} />;`,
    );
    expect(v.filter((x) => x.rule === "unknown-prop")).toEqual([]);
  });
});

describe("palette fixes prefer the role", () => {
  it("maps red to destructive, green to success, and falls back to value for the rest", async () => {
    const v = await check("app/f.tsx", `export const F = () => <p className="text-red-500 text-green-600 text-orange-600" />;`);
    const fixes = v.map((x) => [x.found, x.fix.replace, x.fix.confidence]);
    expect(fixes).toEqual([
      ["text-red-500", "text-destructive", "nearest"],
      ["text-green-600", "text-success", "nearest"],
      ["text-orange-600", "text-chart-1", "exact"],
    ]);
    expect(v[0]!.fix.note).toMatch(/destructive is the system's token for this role/);
  });
});
