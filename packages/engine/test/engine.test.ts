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

describe("tokens with their own variable names", () => {
  it("honors $extensions.zengin.cssVar instead of deriving --group-key", () => {
    const tokens = loadTokens({
      color: {
        $type: "color",
        "surface-base": { $value: "#ffffff", $extensions: { zengin: { cssVar: "--surface-base" } } },
        primary: { $value: "{color.surface-base}", $extensions: { zengin: { cssVar: "--primary" } } },
        plain: { $value: "#000000" },
      },
    });
    const idx = new TokenIndex(tokens);
    expect(idx.byName.get("color.surface-base")?.cssVar).toBe("--surface-base");
    expect(idx.byName.get("color.primary")?.cssVar).toBe("--primary");
    expect(idx.byName.get("color.primary")?.value).toBe("#ffffff");
    expect(idx.byName.get("color.plain")?.cssVar).toBe("--color-plain");
    expect(idx.byVar.get("--surface-base")?.name).toBe("color.surface-base");
  });
});

describe("external stylesheets (classes.css)", () => {
  it("resolves as external and reports their literals at the use, like compiled utilities", async () => {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "zengin-external-"));
    try {
      mkdirSync(join(dir, "zengin"), { recursive: true });
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "zengin", "tokens.json"), JSON.stringify({ color: { $type: "color", surface: { $value: "#ffffff", $extensions: { zengin: { cssVar: "--surface" } } } } }));
      writeFileSync(join(dir, "zengin", "components.json"), "[]");
      writeFileSync(join(dir, "vendor.css"), ".bg-white{background-color:#fff}.w-full{width:100%}.bg-surface{background-color:var(--surface)}");
      writeFileSync(join(dir, "src", "a.tsx"), 'export const A = () => <div className="bg-white w-full bg-surface" />;\n');
      const resolved = resolveConfig({ system: { package: "x", version: "1.0.0", definitions: "./zengin" }, scope: { include: ["src/**"] }, classes: { tailwind: false, css: ["vendor.css"] } }, dir);
      const engine = await createEngine(resolved);
      const violations = engine.check(readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude));
      expect(violations.map((v) => [v.rule, v.found])).toEqual([["color-literal", "bg-white"]]);
      expect(violations[0]!.fix.candidates ?? [violations[0]!.fix.token]).toContain("color.surface");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("color literals", () => {
  it("does not count fully transparent values as color choices", async () => {
    const { findColorLiterals } = await import("../src/resolve/css-props.js");
    expect(findColorLiterals("#0000")).toEqual([]);
    expect(findColorLiterals("#00000000")).toEqual([]);
    expect(findColorLiterals("rgba(0, 0, 0, 0)")).toEqual([]);
    expect(findColorLiterals("rgb(0 0 0 / 0)")).toEqual([]);
    expect(findColorLiterals("#000")).toHaveLength(1);
    expect(findColorLiterals("#0001")).toHaveLength(1);
    expect(findColorLiterals("rgba(0, 0, 0, 0.7)")).toHaveLength(1);
  });
});

describe("owned pragma", () => {
  it("reads the component, the version and the optional hash", async () => {
    const { readOwnedPragma } = await import("../src/scope.js");
    expect(readOwnedPragma("/* zengin-owned Button, forked from @zenginui/ui@1.2.0, sha 3f9a1c0b2d4e */\nexport {}")).toEqual({ component: "Button", forkedFrom: "@zenginui/ui@1.2.0", sha: "3f9a1c0b2d4e" });
    expect(readOwnedPragma("/* zengin-owned Button, forked from @zenginui/ui@1.2.0 */\nexport {}")).toEqual({ component: "Button", forkedFrom: "@zenginui/ui@1.2.0" });
    expect(readOwnedPragma("/* zengin-owned */")).toEqual({ component: undefined, forkedFrom: undefined });
  });
});

describe("shadowed sources", () => {
  it("match globs, so one manifest entry covers every react-icons module", async () => {
    const { ComponentIndex } = await import("../src/system/components.js");
    const idx = new ComponentIndex([{ name: "Icon", export: { from: "@/lib/icons", name: "Icon" }, replaces: ["react-icons/*#*", "lucide-react#*"] }], ["@/components/ui"]);
    expect(idx.replacementFor("react-icons/lu", "LuSearch")?.component.name).toBe("Icon");
    expect(idx.replacementFor("react-icons/hi2", "HiOutlineXMark")?.component.name).toBe("Icon");
    expect(idx.replacementFor("lucide-react", "Search")?.component.name).toBe("Icon");
    expect(idx.replacementFor("react-icons", "IconBase")).toBeUndefined();
    expect(idx.replacementFor("@tabler/icons-react", "IconX")).toBeUndefined();
  });
});

describe("config", () => {
  it("compares semver triples", () => {
    expect(compareVersions("1.3.0", "1.2.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.9", "1.10.0")).toBeLessThan(0);
  });

  it("leaves the tailwind adapter off when the project does not depend on it", () => {
    const resolved = resolveConfig({ system: { package: "@zenginui/ui", version: "1.0.0" } }, PROJECTS[1].dir);
    expect(resolved.classes.tailwind).toBe(false);
  });
});
