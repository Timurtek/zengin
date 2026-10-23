import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEngine, readProjectFiles, resolveConfig } from "../src/index.js";
import { loadTailwind } from "../src/resolve/tailwind.js";

/**
 * A Tailwind 3 project, Dub's shape: colors in tailwind.config as `rgb(var(--x) / <alpha-value>)` over RGB
 * channels in the stylesheet. The project's own node_modules holds Tailwind 3; the engine's holds Tailwind 4.
 */
const here = dirname(fileURLToPath(import.meta.url));
const tailwind3 = join(here, "..", "node_modules", "tailwindcss3");

describe("Tailwind 3 projects (defect 8)", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-tw3-"));
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    try {
      symlinkSync(tailwind3, join(dir, "node_modules", "tailwindcss"), "junction");
    } catch {
      cpSync(tailwind3, join(dir, "node_modules", "tailwindcss"), { recursive: true, dereference: true });
    }
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "web", devDependencies: { tailwindcss: "^3.4.0" } }));
    writeFileSync(
      join(dir, "tailwind.config.js"),
      `module.exports = {
  content: ["./src/**/*.tsx"],
  theme: { extend: { colors: { "bg-default": "rgb(var(--bg-default) / <alpha-value>)", "content-emphasis": "rgb(var(--content-emphasis) / <alpha-value>)" } } },
};
`,
    );
    mkdirSync(join(dir, "zengin"), { recursive: true });
    writeFileSync(
      join(dir, "zengin", "tokens.json"),
      JSON.stringify({
        color: {
          $type: "color",
          "bg-default": { $value: "#ffffff", $extensions: { zengin: { cssVar: "--bg-default", reference: "rgb(var(--bg-default))" } } },
          "content-emphasis": { $value: "#171717", $extensions: { zengin: { cssVar: "--content-emphasis", reference: "rgb(var(--content-emphasis))" } } },
        },
      }),
    );
    writeFileSync(join(dir, "zengin", "components.json"), "[]");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.tsx"), 'export const A = () => <div className="bg-bg-default text-content-emphasis p-4 bg-red-500 text-[#171717]" />;\n');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("loads the project's Tailwind, not zengin's", () => {
    const found = loadTailwind(dir)!;
    expect(found.from).toBe("project");
    expect(found.version.startsWith("3.")).toBe(true);
  });

  it("resolves classes through the project's config: its colors are tokens, the default palette and a literal are not", async () => {
    const config = resolveConfig({ system: { package: "@dub/ui", version: "0.3.21", definitions: "./zengin" }, scope: { include: ["src/**"] }, classes: { tailwind: true } }, dir);
    const engine = await createEngine(config);
    const violations = engine.check(readProjectFiles(dir, config.scope.include, config.scope.exclude));
    expect(violations.map((v) => `${v.rule} ${v.found}`).sort()).toEqual(["color-literal bg-red-500", "color-literal text-[#171717]"]);
    const literal = violations.find((v) => v.found === "text-[#171717]")!;
    expect(literal.fix.confidence).toBe("exact");
  });

  it("with the palette allowed, a palette step passes though Tailwind 3 compiles it to a literal", async () => {
    const config = resolveConfig({ system: { package: "@dub/ui", version: "0.3.21", definitions: "./zengin" }, scope: { include: ["src/**"] }, classes: { tailwind: true }, rules: { "color-literal": { severity: "error", allow: "palette" } } }, dir);
    const engine = await createEngine(config);
    const found = engine.check(readProjectFiles(dir, config.scope.include, config.scope.exclude)).map((v) => v.found);
    expect(found).toEqual(["text-[#171717]"]);
  });
});
