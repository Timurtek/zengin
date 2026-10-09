import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig, type Violation } from "../src/index.js";
import { compareVersions } from "../src/config.js";
import { loadDarkTokens, loadTokens, TokenIndex } from "../src/system/tokens.js";
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

describe("a var() the system cannot account for", () => {
  // Field test 4 (TekJobs, 2026-09-14): an agent wrote `var(--tracking-wide)` against a system with no
  // tracking family. Nothing reported it, and the browser renders nothing with no error anywhere.
  const dir = mkdtempSync(join(tmpdir(), "zengin-vars-"));
  beforeAll(() => {
    mkdirSync(join(dir, "zengin"), { recursive: true });
    mkdirSync(join(dir, "src", "theme"), { recursive: true });
    writeFileSync(join(dir, "zengin", "tokens.json"), readFileSync(join(here, "fixtures", "system", "tokens.json"), "utf8"));
    writeFileSync(join(dir, "zengin", "components.json"), readFileSync(join(here, "fixtures", "system", "components.json"), "utf8"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "vars", dependencies: { "@radix-ui/react-popover": "1.0.0" } }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const config = { system: { package: "@zenginui/ui", version: "1.0.0", definitions: "./zengin" }, scope: { include: ["src/**/*.css"] }, classes: { tailwind: false } };
  const run = async (files: { path: string; content: string }[]) => {
    const engine = await createEngine(resolveConfig(config, dir));
    engine.loadStylesheets(files);
    return engine.check(files);
  };

  it("reports a name in a namespace the system does not have at all", async () => {
    const v = await run([{ path: "src/a.css", content: ".x { letter-spacing: var(--tracking-wide); }" }]);
    expect(v.map((x) => x.rule)).toEqual(["token-reference"]);
    expect(v[0]!.message).toContain("resolves to nothing at runtime");
  });

  it("says nothing about a custom property the project declares in another file", async () => {
    // The theme layer defines it and a component uses it. That is the project's own property, not a typo.
    const v = await run([
      { path: "src/theme/local.css", content: ":root { --tracking-wide: 0.08em; }" },
      { path: "src/a.css", content: ".x { letter-spacing: var(--tracking-wide); }" },
    ]);
    expect(v).toEqual([]);
  });

  it("says nothing about a property a dependency sets at runtime", async () => {
    // Radix writes this onto the element from JavaScript; no stylesheet will ever declare it.
    const v = await run([{ path: "src/a.css", content: ".x { transform-origin: var(--radix-popover-content-transform-origin); }" }]);
    expect(v).toEqual([]);
  });

  it("still reports a name inside a namespace the system does own", async () => {
    const v = await run([{ path: "src/a.css", content: ".x { color: var(--color-not-a-token); }" }]);
    expect(v.map((x) => x.rule)).toEqual(["token-reference"]);
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

describe("a project's brand", () => {
  const tokens = { color: { $type: "color", primary: { $value: "#3B82F6" }, surface: { $value: "#FFFFFF" }, text: { $value: "#0F172A" }, border: { $value: "#E2E8F0" } }, space: { $type: "dimension", "3": { $value: "12px" }, "4": { $value: "16px" } } };
  const dark = { color: { $type: "color", primary: { $value: "#60A5FA" }, surface: { $value: "#0F172A" }, text: { $value: "#F1F5F9" } } };
  const brandCss = `/* The brand. */
:root,
[data-theme="light"] {
  --color-primary: #1e6b3c;
  --color-surface: #f4f8f5;
  --spacing-4: 18px;
  --brand-only: 2px;
}
[data-theme="dark"] {
  --color-primary: #c8f542;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --color-primary: #c8f542; }
}
`;
  const component = 'export const A = () => <div style={{ color: "#1E6B3C", background: "#C8F542", borderColor: "#3B82F6", outlineColor: "#F1F5F9" }} />;\n';

  async function run(config: Record<string, unknown> = {}) {
    const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "zengin-brand-"));
    try {
      mkdirSync(join(dir, "zengin"), { recursive: true });
      mkdirSync(join(dir, "src", "theme"), { recursive: true });
      writeFileSync(join(dir, "zengin", "tokens.json"), JSON.stringify(tokens));
      writeFileSync(join(dir, "zengin", "tokens.dark.json"), JSON.stringify(dark));
      writeFileSync(join(dir, "zengin", "components.json"), "[]");
      writeFileSync(join(dir, "src", "theme", "brand.css"), brandCss);
      writeFileSync(join(dir, "src", "a.tsx"), component);
      const resolved = resolveConfig({ system: { package: "x", version: "1.0.0", definitions: "./zengin", ...config }, scope: { include: ["src/**"], foundations: ["src/theme/**"] }, classes: { tailwind: false } }, dir);
      const engine = await createEngine(resolved);
      const violations = engine.check(readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude)).filter((v) => v.rule === "color-literal");
      const by = (found: string) => violations.find((v) => v.found.includes(found))!;
      return { engine, by };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("matches literals against the brand's values, light and dark, and no longer against the defaults it replaces", async () => {
    const { by } = await run();
    expect([by("#1E6B3C").fix.token, by("#1E6B3C").fix.confidence]).toEqual(["color.primary", "exact"]);
    expect(by("#1E6B3C").message).toContain("matches color.primary in the project's brand");
    expect([by("#C8F542").fix.token, by("#C8F542").fix.confidence]).toEqual(["color.primary", "exact"]);
    expect(by("#C8F542").message).toContain("in the project's brand (dark)");
    // the default primary is not what this project paints any more: a guess, not a match
    expect(by("#3B82F6").fix.confidence).toBe("nearest");
    // a dark value the brand leaves alone still comes from the dark token file
    expect([by("#F1F5F9").fix.token, by("#F1F5F9").fix.confidence]).toEqual(["color.text", "exact"]);
    expect(by("#F1F5F9").message).toContain("in the dark theme");
  });

  it("shows the brand's values and what it could not place", async () => {
    const { engine } = await run();
    expect(engine.tokens.find((t) => t.cssVar === "--color-primary")!.value).toBe("#1e6b3c");
    expect(engine.definitions.tokens.find((t) => t.cssVar === "--color-primary")!.value).toBe("#3b82f6"); // the defaults stay the defaults
    expect(engine.brand?.unmatched).toEqual(["--brand-only"]);
    expect(engine.brand?.dark["--color-surface"]).toBe("#f4f8f5"); // set in light only: the cascade carries it into dark
  });

  it("brand: false matches the token files alone", async () => {
    const { engine, by } = await run({ brand: false });
    expect(engine.brand).toBeUndefined();
    expect([by("#3B82F6").fix.token, by("#3B82F6").fix.confidence]).toEqual(["color.primary", "exact"]);
    expect(by("#3B82F6").message).toContain("in the default theme");
    expect(by("#1E6B3C").fix.confidence).toBe("nearest");
  });

  it("puts the brand's spacing on the scale", () => {
    const idx = new TokenIndex(loadTokens(tokens), { brand: { light: { "--spacing-4": "18px" }, dark: { "--spacing-4": "18px" } } });
    expect(idx.matchSpacing("18px").exact?.name).toBe("space.4");
    expect(idx.matchSpacing("16px").exact).toBeUndefined();
  });
});

describe("the dark token file", () => {
  it("resolves aliases into the light file and keeps the light token's variable name", () => {
    const light = { color: { $type: "color", "gray-100": { $value: "#F3F4F6" }, surface: { $value: "#FFFFFF", $extensions: { zengin: { cssVar: "--surface" } } }, text: { $value: "#111111" } } };
    const dark = { color: { surface: { $value: "{color.gray-100}" } } };
    expect(loadDarkTokens(light, dark).map((t) => [t.path, t.cssVar, t.value])).toEqual([["color.surface", "--surface", "#f3f4f6"]]);
  });
});
