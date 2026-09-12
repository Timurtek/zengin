import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig, type Violation } from "../src/index.js";
import { compareVersions } from "../src/config.js";
import { loadTokens, TokenIndex } from "../src/system/tokens.js";

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = join(here, "fixtures", "project");

async function run(): Promise<Violation[]> {
  const { config, dir } = loadConfigFile(join(projectDir, "zengin.config.yaml"));
  const resolved = resolveConfig(config, dir);
  const engine = await createEngine(resolved);
  const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
  return engine.check(files);
}

describe("engine on the three violation examples", () => {
  it("returns exactly the expected violations, byte for byte", async () => {
    const violations = await run();
    await expect(JSON.stringify(violations, null, 2) + "\n").toMatchFileSnapshot("./fixtures/expected/violations.json");
  });

  it("is deterministic across runs", async () => {
    const a = await run();
    const b = await run();
    expect(b).toEqual(a);
  });

  it("covers every rule kind at least once", async () => {
    const rules = new Set((await run()).map((v) => v.rule));
    expect([...rules].sort()).toEqual([
      "classname-policy",
      "color-literal",
      "component-substitution",
      "spacing-literal",
      "token-reference",
      "unknown-prop",
      "unknown-prop-value",
    ]);
  });

  it("never reports the foundation file", async () => {
    const files = (await run()).map((v) => v.file);
    expect(files.some((f) => f.startsWith("src/theme/"))).toBe(false);
  });

  it("keeps foundation rules on in owned files and turns substitution off", async () => {
    const owned = (await run()).filter((v) => v.file === "src/components/ui/badge.tsx");
    expect(owned.map((v) => v.rule)).toEqual(["color-literal"]);
  });

  it("honours suppressions only when a reason is given", async () => {
    const hero = (await run()).filter((v) => v.file === "src/marketing/Hero.tsx" && v.rule === "color-literal");
    expect(hero).toHaveLength(1);
    expect(hero[0]!.found).toBe("text-[#64748B]");
    expect(hero[0]!.note).toMatch(/reason is required/);
  });
});

describe("tokens", () => {
  it("loads DTCG groups, DEFAULT keys and aliases", () => {
    const tokens = loadTokens({
      color: { $type: "color", primary: { DEFAULT: { $value: "#3b82f6" }, hover: { $value: "#2563EB" } }, brand: { $value: "{color.primary}" } },
      space: { $type: "dimension", "3": { $value: { value: 12, unit: "px" } } },
    });
    const idx = new TokenIndex(tokens);
    expect(idx.byName.get("color.primary")?.cssVar).toBe("--color-primary");
    expect(idx.byName.get("color.primary.hover")?.cssVar).toBe("--color-primary-hover");
    expect(idx.byName.get("color.brand")?.value).toBe("#3b82f6");
    expect(idx.exactColor("#3B82F6")?.name).toBe("color.primary");
    expect(idx.matchSpacing("12px").exact?.name).toBe("space.3");
    expect(idx.matchSpacing("13px").below?.token.name).toBe("space.3");
  });
});

describe("versions", () => {
  it("compares semver triples", () => {
    expect(compareVersions("1.3.0", "1.2.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.9", "1.10.0")).toBeLessThan(0);
  });
});
