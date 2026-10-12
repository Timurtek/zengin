import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig, type Violation } from "../src/index.js";
import { normalizeColor } from "../src/system/tokens.js";

const token = (cssVar: string, value: string) => ({ $value: value, $extensions: { zengin: { cssVar } } });

describe("a translucent color is not the opaque one", () => {
  it("keeps the alpha when it normalizes", () => {
    expect(normalizeColor("rgba(255, 255, 255, 0.92)")).toBe("#ffffffeb");
    expect(normalizeColor("rgb(26 20 16 / 50%)")).toBe("#1a141080");
    expect(normalizeColor("rgba(26,20,16,1)")).toBe("#1a1410");
    expect(normalizeColor("rgb(26,20,16)")).toBe("#1a1410");
  });

  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-translucent-"));
    mkdirSync(join(dir, "zengin"), { recursive: true });
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "zengin", "tokens.json"),
      JSON.stringify({ color: { $type: "color", white: token("--white", "#ffffff"), scrim: token("--scrim", "rgba(0,0,0,0.5)") } }),
    );
    writeFileSync(join(dir, "zengin", "components.json"), "[]");
    writeFileSync(
      join(dir, "zengin.config.yaml"),
      `system:
  package: "acme"
  version: "1.0.0"
  definitions: ./zengin
  sources: ["acme"]
scope:
  include: ["src/**/*.tsx"]
classes:
  tailwind: false
rules:
  color-literal: { severity: error, allow: semantic }
`,
    );
    writeFileSync(
      join(dir, "src", "A.tsx"),
      `export const A = () => (
  <div>
    <i style={{ background: "rgba(255,255,255,0.92)" }} />
    <i style={{ background: "rgba(0,0,0,0.5)" }} />
    <i style={{ background: "#ffffff" }} />
    <i style={{ background: "#fefefe" }} />
    <i style={{ background: "oklch(var(--l) var(--c) 145)" }} />
    <i style={{ background: "linear-gradient(0deg, oklch(var(--l) var(--c) 145), #ffffff)" }} />
  </div>
);
`,
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  async function run(): Promise<Violation[]> {
    const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig(config, projectDir);
    const engine = await createEngine(resolved);
    return engine.check(readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude));
  }

  it("offers no opaque token as the fix for a translucent literal, and names the token that has the alpha", async () => {
    const v = await run();
    const byLine = (n: number) => v.find((x) => x.range.start.line === n);
    expect(byLine(3)!.fix.replace).toBeNull();
    expect(byLine(3)!.fix.confidence).toBe("none");
    expect(byLine(3)!.message).toContain("translucent");
    expect(byLine(4)!.fix.token).toBe("color.scrim");
    expect(byLine(4)!.fix.confidence).toBe("exact");
    expect(byLine(5)!.fix.token).toBe("color.white");
  });

  it("does not offer a translucent token as the nearest match for an opaque color", async () => {
    const near = (await run()).find((x) => x.range.start.line === 6)!;
    expect(near.fix.token).toBe("color.white");
    expect(near.fix.token).not.toBe("color.scrim");
  });

  it("finds no literal in a color function whose channels are variables, but still the one beside it", async () => {
    const v = await run();
    expect(v.find((x) => x.range.start.line === 7 && x.rule === "color-literal")).toBeUndefined();
    const gradient = v.find((x) => x.range.start.line === 8 && x.rule === "color-literal")!;
    expect(gradient.fix.token).toBe("color.white");
    expect(gradient.fix.replace).toBe('"linear-gradient(0deg, oklch(var(--l) var(--c) 145), var(--white))"');
  });
});
