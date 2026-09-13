import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEngine, resolveConfig, type Violation, type ZenginConfig } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const systemDir = join(here, "fixtures", "system");

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "zengin-surfaces-"));
  mkdirSync(join(dir, "zengin"), { recursive: true });
  mkdirSync(join(dir, "src", "app"), { recursive: true });
  mkdirSync(join(dir, "src", "marketing"), { recursive: true });
  writeFileSync(join(dir, "zengin", "tokens.json"), readFileSync(join(systemDir, "tokens.json"), "utf8"));
  writeFileSync(join(dir, "zengin", "components.json"), readFileSync(join(systemDir, "components.json"), "utf8"));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const BASE: ZenginConfig = {
  system: { package: "@zenginui/ui", version: "1.0.0", definitions: "./zengin" },
  scope: { include: ["src/**/*.{ts,tsx,css}"] },
  classes: { tailwind: false },
};

async function check(config: ZenginConfig, files: { path: string; content: string }[]): Promise<Violation[]> {
  const engine = await createEngine(resolveConfig(config, dir));
  return engine.check(files);
}

/** A Button with a prop the base system does not declare. */
const PILL = {
  path: "src/marketing/Hero.tsx",
  content: `import { Button } from "@zenginui/ui";\nexport const Hero = () => <Button shape="pill">Go</Button>;\n`,
};
const APP = {
  path: "src/app/Toolbar.tsx",
  content: `import { Button } from "@zenginui/ui";\nexport const Toolbar = () => <Button shape="pill">Go</Button>;\n`,
};

describe("a project with one design", () => {
  it("rejects a prop the system does not declare, wherever it appears", async () => {
    const v = await check(BASE, [PILL, APP]);
    expect(v.filter((x) => x.rule === "unknown-prop")).toHaveLength(2);
  });
});

describe("a surface declares a legitimate difference", () => {
  const withSurface: ZenginConfig = {
    ...BASE,
    surfaces: [
      {
        name: "marketing",
        include: ["src/marketing/**"],
        components: { Button: { props: { shape: { type: "enum", values: ["pill", "square"] } } } },
      },
    ],
  };

  it("accepts the prop on the surface that declares it", async () => {
    const v = await check(withSurface, [PILL]);
    expect(v.filter((x) => x.rule === "unknown-prop")).toEqual([]);
  });

  it("still rejects it everywhere else, so the difference is declared rather than global", async () => {
    const v = await check(withSurface, [APP]);
    const unknown = v.filter((x) => x.rule === "unknown-prop");
    expect(unknown).toHaveLength(1);
    expect(unknown[0]!.file).toBe("src/app/Toolbar.tsx");
  });

  it("checks an enum value against the surface's own list", async () => {
    const v = await check(withSurface, [
      { path: "src/marketing/Bad.tsx", content: `import { Button } from "@zenginui/ui";\nexport const Bad = () => <Button shape="round">Go</Button>;\n` },
    ]);
    const bad = v.filter((x) => x.rule === "unknown-prop-value");
    expect(bad).toHaveLength(1);
    expect(bad[0]!.message).toContain("pill");
  });

  it("keeps the base contract for props it does not mention", async () => {
    const v = await check(withSurface, [
      { path: "src/marketing/Bad2.tsx", content: `import { Button } from "@zenginui/ui";\nexport const Bad2 = () => <Button variant="ghostly">Go</Button>;\n` },
    ]);
    expect(v.filter((x) => x.rule === "unknown-prop-value")).toHaveLength(1);
  });

  it("names the surface in the inventory, so a rollup can see the split", async () => {
    const engine = await createEngine(resolveConfig(withSurface, dir));
    const inv = engine.inventory([PILL, APP]);
    expect(inv.files.find((f) => f.file === "src/marketing/Hero.tsx")?.surface).toBe("marketing");
    expect(inv.files.find((f) => f.file === "src/app/Toolbar.tsx")?.surface).toBeUndefined();
  });

  it("takes the first matching surface when two could claim a file", async () => {
    const two: ZenginConfig = {
      ...BASE,
      surfaces: [
        { name: "first", include: ["src/marketing/**"], components: { Button: { props: { shape: { type: "enum", values: ["pill"] } } } } },
        { name: "second", include: ["src/**"], components: { Button: { props: { shape: { type: "enum", values: ["square"] } } } } },
      ],
    };
    const v = await check(two, [PILL]);
    expect(v.filter((x) => x.rule === "unknown-prop-value")).toEqual([]);
  });
});

describe("a surface with its own token values", () => {
  const overlayPath = "zengin/tokens.marketing.json";

  beforeAll(() => {
    // Only what differs: the marketing surface has a wider step on the spacing scale. 20px is deliberately
    // a value the base scale does not carry, so it is a token on one surface and an arbitrary length on the other.
    const base = JSON.parse(readFileSync(join(systemDir, "tokens.json"), "utf8")) as Record<string, unknown>;
    const space = (base["space"] ?? {}) as Record<string, unknown>;
    writeFileSync(join(dir, overlayPath), JSON.stringify({ space: { ...space, 5: { $value: "20px" } } }, null, 2));
  });

  it("resolves a token the overlay adds without adding it to the base", async () => {
    const config: ZenginConfig = { ...BASE, surfaces: [{ name: "marketing", include: ["src/marketing/**"], tokens: overlayPath }] };
    const engine = await createEngine(resolveConfig(config, dir));
    const marketing = engine.check([{ path: "src/marketing/Card.css", content: ".hero { padding: 20px; }" }]);
    const app = engine.check([{ path: "src/app/Card.css", content: ".panel { padding: 20px; }" }]);
    // 20px names a token on the marketing surface, and is an arbitrary length in the app.
    expect(marketing.some((v) => v.fix.token === "space.5")).toBe(true);
    expect(app.some((v) => v.fix.token === "space.5")).toBe(false);
    expect(app.some((v) => v.rule === "spacing-literal")).toBe(true);
  });
});

describe("what a surface may not do", () => {
  it("refuses to introduce a component the system does not have", async () => {
    const config: ZenginConfig = {
      ...BASE,
      surfaces: [{ name: "marketing", include: ["src/marketing/**"], components: { Carousel: { props: {} } } }],
    };
    await expect(createEngine(resolveConfig(config, dir))).rejects.toThrow(/does not have/);
  });

  it("refuses a surface with no include patterns", () => {
    expect(() => resolveConfig({ ...BASE, surfaces: [{ name: "x", include: [] }] }, dir)).toThrow(/no include/);
  });

  it("refuses a token file that is not there", async () => {
    const config: ZenginConfig = { ...BASE, surfaces: [{ name: "x", include: ["src/**"], tokens: "zengin/missing.json" }] };
    await expect(createEngine(resolveConfig(config, dir))).rejects.toThrow(/does not exist/);
  });
});
