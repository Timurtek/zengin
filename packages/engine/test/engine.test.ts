import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig, type Violation } from "../src/index.js";
import { compareVersions } from "../src/config.js";
import { loadTokens, TokenIndex } from "../src/system/tokens.js";
import { StylesheetIndex } from "../src/resolve/stylesheet.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Each fixture project is the three violation examples in one styling approach. */
const PROJECTS = [
  { name: "tailwind", dir: join(here, "fixtures", "project"), expected: "violations.json" },
  { name: "plain css", dir: join(here, "fixtures", "project-css"), expected: "violations-css.json" },
] as const;

async function run(dir: string): Promise<Violation[]> {
  const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
  const resolved = resolveConfig(config, projectDir);
  const engine = await createEngine(resolved);
  const files = readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude);
  return engine.check(files);
}

const ALL_RULES = [
  "classname-policy",
  "color-literal",
  "component-substitution",
  "spacing-literal",
  "token-reference",
  "unknown-prop",
  "unknown-prop-value",
];

describe.each(PROJECTS)("engine on the three violation examples ($name)", ({ dir, expected }) => {
  it("returns exactly the expected violations, byte for byte", async () => {
    const violations = await run(dir);
    await expect(JSON.stringify(violations, null, 2) + "\n").toMatchFileSnapshot(`./fixtures/expected/${expected}`);
  });

  it("is deterministic across runs", async () => {
    expect(await run(dir)).toEqual(await run(dir));
  });

  it("never reports the foundation file", async () => {
    const files = (await run(dir)).map((v) => v.file);
    expect(files.some((f) => f.startsWith("src/theme/"))).toBe(false);
  });

  it("reports the three example files", async () => {
    const files = new Set((await run(dir)).map((v) => v.file));
    for (const f of ["ApproveBar.tsx", "RejectButton.tsx", "ConfirmReject.tsx"]) {
      expect(files.has(`src/features/review/${f}`), f).toBe(true);
    }
  });
});

describe("tailwind fixture", () => {
  const dir = PROJECTS[0].dir;

  it("covers every rule kind at least once", async () => {
    const rules = new Set((await run(dir)).map((v) => v.rule));
    expect([...rules].sort()).toEqual(ALL_RULES);
  });

  it("keeps foundation rules on in owned files and turns substitution off", async () => {
    const owned = (await run(dir)).filter((v) => v.file === "src/components/ui/badge.tsx");
    expect(owned.map((v) => v.rule)).toEqual(["color-literal"]);
  });

  it("honours suppressions only when a reason is given", async () => {
    const hero = (await run(dir)).filter((v) => v.file === "src/marketing/Hero.tsx" && v.rule === "color-literal");
    expect(hero).toHaveLength(1);
    expect(hero[0]!.found).toBe("text-[#64748B]");
    expect(hero[0]!.note).toMatch(/reason is required/);
  });
});

describe("plain css fixture", () => {
  const dir = PROJECTS[1].dir;

  it("covers every rule kind without a class compiler", async () => {
    const rules = new Set((await run(dir)).map((v) => v.rule));
    expect([...rules].sort()).toEqual(ALL_RULES);
  });

  it("resolves className through the project's own stylesheet", async () => {
    const policy = (await run(dir)).filter((v) => v.rule === "classname-policy" && v.found === "reject-button");
    expect(policy).toHaveLength(1);
    expect(policy[0]!.message).toContain("in src/features/review/reject-button.css");
    expect(policy[0]!.message).toContain("background");
  });

  it("recognises raw buttons styled through stylesheet classes", async () => {
    const sub = (await run(dir)).filter((v) => v.rule === "component-substitution" && v.found.startsWith("<button"));
    expect(sub.map((v) => v.file)).toEqual(["src/features/review/ApproveBar.tsx", "src/features/review/ConfirmReject.tsx"]);
    for (const v of sub) expect(v.message).toMatch(/Raw <button> styled as a system Button/);
  });

  it("does not report unknown class names as missing tokens", async () => {
    const tokenRefs = (await run(dir)).filter((v) => v.rule === "token-reference");
    expect(tokenRefs.every((v) => v.file.endsWith(".css"))).toBe(true);
  });

  it("checks a single file against stylesheets loaded up front", async () => {
    const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig(config, projectDir);
    const engine = await createEngine(resolved);
    const files = readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude);
    const reject = files.find((f) => f.path.endsWith("RejectButton.tsx"))!;

    const blind = engine.checkFile(reject).filter((v) => v.rule === "classname-policy" && v.found === "reject-button");
    expect(blind).toHaveLength(0);

    engine.loadStylesheets(files);
    const sighted = engine.checkFile(reject).filter((v) => v.rule === "classname-policy" && v.found === "reject-button");
    expect(sighted).toHaveLength(1);
  });
});

describe("stylesheet index", () => {
  it("indexes simple class selectors and skips compound ones", () => {
    const idx = StylesheetIndex.from([
      {
        path: "a.css",
        content: `.btn { padding: 4px; --x: 1; } .btn:hover { color: red; } .card .btn { margin: 0; } .btn.primary { color: blue; }`,
      },
    ]);
    expect(idx.resolve("btn")?.decls).toEqual([
      { prop: "padding", value: "4px" },
      { prop: "color", value: "red" },
    ]);
    expect(idx.resolve("card")).toBeNull();
    expect(idx.resolve("primary")).toBeNull();
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
    expect(idx.exactColor("white")).toBeUndefined();
    expect(idx.matchSpacing("12px").exact?.name).toBe("space.3");
    expect(idx.matchSpacing("13px").below?.token.name).toBe("space.3");
  });
});

describe("config", () => {
  it("compares semver triples", () => {
    expect(compareVersions("1.3.0", "1.2.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.9", "1.10.0")).toBeLessThan(0);
  });

  it("leaves the tailwind adapter off when the project does not depend on it", () => {
    const resolved = resolveConfig({ system: { package: "@zengin/ui", version: "1.0.0" } }, PROJECTS[1].dir);
    expect(resolved.classes.tailwind).toBe(false);
  });
});
