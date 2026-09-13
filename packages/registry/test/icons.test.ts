import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zenginui/engine";
import { describe, expect, it } from "vitest";
import { applyIcons, buildRegistry, createProject, ICON_NAMES, ICON_SETS, registryFromMemory, renderIconsModule } from "../src/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

describe("icon sets", () => {
  it("name exactly Zengin UI's vocabulary", () => {
    const src = readFileSync(join(root, "packages", "ui", "src", "internal", "icons.tsx"), "utf8");
    const names = [...src.matchAll(/^  ([A-Z][A-Za-z]*): "/gm)].map((m) => m[1]);
    expect(names).toEqual([...ICON_NAMES]);
    for (const set of Object.values(ICON_SETS)) expect(Object.keys(set.names).sort()).toEqual([...ICON_NAMES].sort());
  });

  it("map every name to an export react-icons actually has", async () => {
    for (const [name, set] of Object.entries(ICON_SETS)) {
      const mod = (await import(set.module)) as Record<string, unknown>;
      const missing = Object.entries(set.names).filter(([, exported]) => typeof mod[exported] !== "function").map(([k, v]) => `${k} -> ${v}`);
      expect(missing, `${name} (${set.module})`).toEqual([]);
    }
  });

  it("render a module with the default file's API", () => {
    const src = renderIconsModule("lucide", ICON_SETS["lucide"]!);
    expect(src).toContain('from "react-icons/lu"');
    expect(src).toContain("  Search: LuSearch,");
    expect(src).toContain("export const Icon = {");
    expect(src).toContain("export function setIconSet");
    expect(src).toContain("export type IconName");
  });

  it("apply to a created project: the lib is rewritten, react-icons is a dependency, and the project stays clean", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "zengin-icons-"));
    try {
      const registry = buildRegistry({ root });
      const source = registryFromMemory(registry);
      expect(registry.items.filter((i) => i.type === "icons").map((i) => i.name)).toEqual(Object.keys(ICON_SETS).map((n) => `icons-${n}`));
      const dir = join(tmp, "app");
      await createProject({ dir, template: "saas", source, storybook: false });
      const before = readFileSync(join(dir, "src/lib/icons.tsx"), "utf8");
      expect(before).toContain("const PATHS = {"); // the default drawings came with the template
      expect(JSON.parse(readFileSync(join(dir, "zengin/components.json"), "utf8")).some((m: { name: string }) => m.name === "Icon")).toBe(true);

      const r = await applyIcons({ projectDir: dir, name: "tabler", source });
      expect(r.replaced).toBe(true);
      expect(r.files).toEqual(["src/lib/icons.tsx"]);
      expect(r.dependencies).toEqual({ "react-icons": expect.stringMatching(/^\^5/) });
      const after = readFileSync(join(dir, "src/lib/icons.tsx"), "utf8");
      expect(after).toContain('from "react-icons/tb"');
      expect(after).toContain("  Search: TbSearch,");
      expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies["react-icons"]).toMatch(/^\^5/);

      // The engine: the rewritten lib is owned, and a stray direct import in app code is a substitution.
      const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
      const resolved = resolveConfig(config, projectDir);
      const engine = await createEngine(resolved);
      expect(engine.check(readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude))).toEqual([]);
      const stray = engine.check([{ path: "src/Stray.tsx", content: 'import { LuSearch } from "react-icons/lu";\nexport const S = () => <LuSearch />;\n' }]);
      expect(stray.map((v) => v.rule)).toEqual(["component-substitution"]);
      expect(stray[0]!.message).toContain("Use Icon from @/lib/icons");
      await expect(applyIcons({ projectDir: dir, name: "nope", source })).rejects.toThrow(/Sets: lucide, tabler/);
      expect(existsSync(join(dir, "src/lib/icons.tsx"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
