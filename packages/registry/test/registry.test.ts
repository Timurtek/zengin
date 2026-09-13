import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zengin/engine";
import { afterAll, describe, expect, it } from "vitest";
import { buildRegistry, createProject, installItems, openRegistry, registryFromMemory, resolveItems, writeRegistry } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const registry = buildRegistry({ root });
const tmp = mkdtempSync(join(tmpdir(), "zengin-registry-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("buildRegistry", () => {
  it("has every Zengin UI component, the shared items, and the three templates", () => {
    const by = (t: string) => registry.items.filter((i) => i.type === t).map((i) => i.name);
    expect(by("component")).toEqual([
      "avatar", "badge", "bar-chart", "button", "card", "checkbox", "code-block", "conversation", "dialog", "line-chart", "loader", "markdown", "menu", "message",
      "popover", "progress", "prompt-input", "reasoning", "select", "separator", "sheet", "skeleton", "sources", "sparkline", "suggestions", "switch", "table",
      "tabs", "text-area", "text-field", "toast", "tool-call", "tooltip",
    ]);
    expect(by("template")).toEqual(["blank", "marketing", "review", "saas", "chat"]);
    expect(by("lib")).toEqual(["lib-chart", "lib-cx", "lib-markdown"]);
    // A component that composes others depends on them, so `zengin add markdown` brings code-block and table.
    expect(registry.items.find((i) => i.name === "markdown")!.registryDependencies).toEqual(expect.arrayContaining(["lib-markdown", "code-block", "table"]));
    // A chart component depends on the chart helper as well as cx, and imports both through the alias.
    const line = registry.items.find((i) => i.name === "line-chart")!;
    expect(line.registryDependencies).toEqual(expect.arrayContaining(["foundation", "lib-chart", "lib-cx"]));
    expect(line.files.find((f) => f.kind === "component")!.content).toContain('from "@/lib/chart"');
    expect(registry.items.find((i) => i.name === "foundation")!.files.map((f) => f.path)).toEqual(expect.arrayContaining(["src/styles/chart.css", "src/styles/motion.css"]));
    expect(by("definitions")).toEqual(["foundation"]);
    expect(registry.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("rewrites package imports to the project layout and records the packages a component needs", () => {
    const dialog = registry.items.find((i) => i.name === "dialog")!;
    const tsx = dialog.files.find((f) => f.kind === "component")!;
    expect(tsx.path).toBe("src/components/ui/dialog/dialog.tsx");
    expect(tsx.content).toContain('from "@/lib/cx"');
    expect(tsx.content).not.toContain("internal/cx");
    expect(tsx.content).not.toMatch(/from "\.\.?\/[^"]+\.js"/);
    expect(Object.keys(dialog.dependencies)).toContain("@radix-ui/react-dialog");
    expect(dialog.registryDependencies).toEqual(expect.arrayContaining(["lib-cx", "foundation"]));
    expect(dialog.manifest?.export.from).toBe("@/components/ui");
    expect(dialog.files.some((f) => f.kind === "story" && f.content.includes('from "@/components/ui"'))).toBe(true);
  });

  it("derives templates from the example apps with their imports pointed at the project", () => {
    const marketing = registry.items.find((i) => i.name === "marketing")!;
    const paths = marketing.files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["index.html", "vercel.json", "src/main.tsx", "src/theme/brand.css", "src/data/sample.json"]));
    expect(paths.some((p) => p.includes("generated"))).toBe(false);
    for (const f of marketing.files) expect(f.content, f.path).not.toMatch(/from "@zengin\/ui/); // prose may still name the package
    expect(marketing.files.find((f) => f.path === "src/main.tsx")!.content).toContain('import "./styles/index.css"');
    // Every template's entry point loads the brand file, or themes and brands would change nothing; the
    // site's preview harness never ships in a template; every template names the app it is derived from.
    for (const name of ["blank", "marketing", "review"]) {
      const item = registry.items.find((i) => i.name === name)!;
      const main = item.files.find((f) => f.path === "src/main.tsx")!;
      expect(main.content, `${name} main.tsx`).toContain('import "./theme/brand.css"');
      expect(main.content, `${name} main.tsx`).not.toContain("preview-theme");
      expect(item.files.some((f) => f.path.includes("preview-theme")), `${name} files`).toBe(false);
      expect(item.source).toMatch(/^examples\//);
    }
    expect(registry.items.find((i) => i.name === "blank")!.source).toBe("examples/blank");
    // The default theme spells out the system's tokens so it resets any brand it is applied over.
    const def = registry.items.find((i) => i.name === "default")!;
    expect(def.files[0]!.content).toContain("--color-primary: #2563eb;");
    expect(def.files[0]!.content).toContain('[data-theme="dark"]');
    expect(marketing.registryDependencies).toEqual(["foundation", "lib-cx", "badge", "button", "card", "checkbox", "code-block", "skeleton", "table", "tabs", "text-field", "tooltip"]); // code-block is imported under an alias
  });

  it("round-trips through static files", async () => {
    const out = join(tmp, "r");
    writeRegistry(registry, out);
    const source = openRegistry(out);
    const index = await source.index();
    expect(index.items.length).toBe(registry.items.length);
    expect((index.items[0] as { files?: unknown }).files).toBeUndefined();
    const button = await source.item("button");
    expect(button.files.length).toBe(3);
  });
});

describe("resolveItems", () => {
  it("orders dependencies first and names unknown items", async () => {
    const source = registryFromMemory(registry);
    const items = await resolveItems(source, ["dialog", "button"]);
    const names = items.map((i) => i.name);
    expect(names.indexOf("lib-cx")).toBeLessThan(names.indexOf("dialog"));
    expect(names.indexOf("foundation")).toBeLessThan(names.indexOf("dialog"));
    expect(new Set(names).size).toBe(names.length);
    await expect(resolveItems(source, ["buton"])).rejects.toThrow(/no item "buton".*Available: /);
  });
});

describe("createProject", () => {
  it("scaffolds the marketing template, owned components and all, and the engine finds it clean", async () => {
    const dir = join(tmp, "acme-site");
    const r = await createProject({ dir, template: "marketing", source: registryFromMemory(registry), local: root });
    expect(r.violations).toBe(0);
    expect(r.install.components.sort()).toEqual(["Badge", "Button", "Card", "Checkbox", "CodeBlock", "Skeleton", "Table", "Tabs", "TextField", "Tooltip"]);

    const button = readFileSync(join(dir, "src/components/ui/button/button.tsx"), "utf8");
    expect(button.startsWith(`/* zengin-owned Button, forked from @zengin/ui@${registry.version} */`)).toBe(true);
    expect(readFileSync(join(dir, "src/components/ui/index.ts"), "utf8")).toContain('export * from "./button/button";');
    expect(readFileSync(join(dir, "src/styles/index.css"), "utf8")).toContain('@import "../components/ui/button/button.css";');
    expect(existsSync(join(dir, "src/styles/generated/tokens.css"))).toBe(true);
    expect(existsSync(join(dir, ".storybook/preview.tsx"))).toBe(true);
    expect(existsSync(join(dir, "stories/tabs.stories.tsx"))).toBe(true);
    // The template's own brand file wins over the starter one.
    expect(readFileSync(join(dir, "src/theme/brand.css"), "utf8")).toContain("--font-display");

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string; dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(pkg.name).toBe("acme-site");
    expect(pkg.dependencies["@radix-ui/react-dialog"]).toBeUndefined(); // the marketing page does not use Dialog
    expect(pkg.dependencies["@radix-ui/react-tabs"]).toBeDefined();
    expect(pkg.devDependencies["@zengin/cli"]).toMatch(/^link:/);
  });

  it("scaffolds blank without Storybook, and add brings in more components with their manifest and packages", async () => {
    const dir = join(tmp, "blank-app");
    const source = registryFromMemory(registry);
    const r = await createProject({ dir, template: "blank", source, storybook: false });
    expect(r.violations).toBe(0);
    expect(r.install.components.sort()).toEqual(["Button", "Card"]);
    expect(existsSync(join(dir, ".storybook"))).toBe(false);
    expect(existsSync(join(dir, "stories"))).toBe(false);

    const items = await resolveItems(source, ["dialog"]);
    const added = installItems({ projectDir: dir, items, version: registry.version });
    expect(added.written).toContain("src/components/ui/dialog/dialog.tsx");
    expect(added.skipped).toContain("src/lib/cx.ts"); // already there from create
    expect(added.components.sort()).toEqual(["Button", "Card", "Dialog"]);
    expect(added.dependencies["@radix-ui/react-dialog"]).toBeDefined();

    // Still clean after the addition, with the new component contracted.
    const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig(config, projectDir);
    const engine = await createEngine(resolved);
    const files = readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude);
    expect(engine.check(files)).toEqual([]);
    const dialogFile = files.find((f) => f.path.endsWith("dialog/dialog.tsx"))!;
    expect(engine.kindOf(dialogFile)).toBe("owned");
  });

  it("refuses a non-empty directory and an unknown template", async () => {
    const source = registryFromMemory(registry);
    await expect(createProject({ dir: join(tmp, "blank-app"), source })).rejects.toThrow(/not empty/);
    await expect(createProject({ dir: join(tmp, "nope"), template: "shop", source })).rejects.toThrow(/Templates: blank, marketing, review, saas/);
  });
});

describe("the saas template on mock data", () => {
  it("ships its mock schema and generated rows, and a created project can regenerate them", async () => {
    const saas = registry.items.find((i) => i.name === "saas" && i.type === "template")!;
    const paths = saas.files.map((f) => f.path);
    expect(paths).toContain("mock.json");
    expect(paths).toEqual(expect.arrayContaining(["src/mock/rng.ts", "src/mock/customers.ts", "src/mock/metrics.ts", "src/data.ts"]));
    expect(saas.files.find((f) => f.path === "src/mock/events.ts")!.content).toContain('import { customers } from "./customers";');

    const dir = join(tmp, "saas-app");
    const r = await createProject({ dir, template: "saas", source: registryFromMemory(registry), storybook: false });
    expect(r.violations).toBe(0);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["mock"]).toBe("zengin mock --schema mock.json");
    expect(existsSync(join(dir, "mock.json"))).toBe(true);
    expect(readFileSync(join(dir, "src/mock/customers.ts"), "utf8")).toContain("export const customers: Customer[]");
  });
});
