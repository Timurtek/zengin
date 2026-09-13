import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readOwnedPragma } from "@zengin/engine";
import { afterAll, describe, expect, it } from "vitest";
import { applyUpgrade, buildRegistry, createProject, diffLines, planUpgrade, registryFromMemory, type Registry } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const tmp = mkdtempSync(join(tmpdir(), "zengin-upgrade-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A newer registry: the version bumped and some files changed, the way a release changes them. */
function newer(registry: Registry, version: string, changes: Record<string, (content: string) => string>): Registry {
  return {
    ...registry,
    version,
    items: registry.items.map((i) => ({ ...i, files: i.files.map((f) => (changes[f.path] ? { ...f, content: changes[f.path]!(f.content) } : f)) })),
  };
}

describe("zengin upgrade", () => {
  const registry = buildRegistry({ root });
  const source = registryFromMemory(registry);
  const dir = join(tmp, "app");

  it("installs owned files with a content hash in the pragma", async () => {
    await createProject({ dir, template: "blank", source, storybook: false });
    const button = readFileSync(join(dir, "src/components/ui/button/button.tsx"), "utf8");
    const pragma = readOwnedPragma(button)!;
    expect(pragma.component).toBe("Button");
    expect(pragma.forkedFrom).toBe(`@zengin/ui@${registry.version}`);
    expect(pragma.sha).toMatch(/^[0-9a-f]{12}$/);
    expect(readOwnedPragma(readFileSync(join(dir, "src/components/ui/button/button.css"), "utf8"))?.sha).toMatch(/^[0-9a-f]{12}$/);
  });

  it("reports everything current against the registry it came from", async () => {
    const plan = await planUpgrade({ projectDir: dir, source });
    expect(plan.projectVersion).toBe(registry.version);
    expect(plan.entries.length).toBeGreaterThan(2);
    expect(new Set(plan.entries.map((e) => e.state))).toEqual(new Set(["current"]));
    expect(plan.items).toEqual(expect.arrayContaining(["button", "card", "lib-cx"]));
  });

  it("takes upstream changes the project did not touch, and moves the pinned version", async () => {
    const next = newer(registry, "9.9.0", {
      "src/components/ui/button/button.tsx": (c) => c + "\n// upstream: a fix\n",
      "src/components/ui/card/card.css": (c) => c + "\n/* upstream: a new rule */\n",
    });
    const nextSource = registryFromMemory(next);
    const plan = await planUpgrade({ projectDir: dir, source: nextSource });
    const states = Object.fromEntries(plan.entries.map((e) => [e.path, e.state]));
    expect(states["src/components/ui/button/button.tsx"]).toBe("upstream");
    expect(states["src/components/ui/card/card.css"]).toBe("upstream");
    expect(states["src/components/ui/card/card.tsx"]).toBe("current");

    const r = await applyUpgrade(plan, { projectDir: dir, source: nextSource });
    expect(r.written.sort()).toEqual(["src/components/ui/button/button.tsx", "src/components/ui/card/card.css"]);
    expect(r.skipped).toEqual([]);
    expect(r.versionBumped).toBe(true);
    const button = readFileSync(join(dir, "src/components/ui/button/button.tsx"), "utf8");
    expect(button).toContain("// upstream: a fix");
    expect(readOwnedPragma(button)?.forkedFrom).toBe("@zengin/ui@9.9.0");
    expect(readFileSync(join(dir, "zengin.config.yaml"), "utf8")).toMatch(/version: "9\.9\.0"/);
    expect((await planUpgrade({ projectDir: dir, source: nextSource })).entries.every((e) => e.state === "current")).toBe(true);
  });

  it("leaves a local edit alone, and holds a conflict until --force", async () => {
    const cardPath = join(dir, "src/components/ui/card/card.tsx");
    writeFileSync(cardPath, readFileSync(cardPath, "utf8") + "\n// local: our tweak\n");
    const base = newer(registry, "9.9.0", { "src/components/ui/button/button.tsx": (c) => c + "\n// upstream: a fix\n", "src/components/ui/card/card.css": (c) => c + "\n/* upstream: a new rule */\n" });

    // Upstream did not touch card.tsx: the edit is the project's business.
    const same = await planUpgrade({ projectDir: dir, source: registryFromMemory(base) });
    expect(same.entries.find((e) => e.path === "src/components/ui/card/card.tsx")?.state).toBe("local");
    expect((await applyUpgrade(same, { projectDir: dir, source: registryFromMemory(base) })).written).toEqual([]);

    // Upstream touched it too: a conflict, with a diff, skipped without force.
    const both = newer(base, "10.0.0", { "src/components/ui/card/card.tsx": (c) => c + "\n// upstream: reworked\n" });
    const bothSource = registryFromMemory(both);
    const plan = await planUpgrade({ projectDir: dir, source: bothSource });
    const card = plan.entries.find((e) => e.path === "src/components/ui/card/card.tsx")!;
    expect(card.state).toBe("conflict");
    expect(card.diff).toContain("--- local");
    expect(card.diff).toContain("-// local: our tweak");
    expect(card.diff).toContain("+// upstream: reworked");
    const held = await applyUpgrade(plan, { projectDir: dir, source: bothSource });
    expect(held.skipped.map((e) => e.path)).toEqual(["src/components/ui/card/card.tsx"]);
    expect(held.versionBumped).toBe(false);
    expect(readFileSync(cardPath, "utf8")).toContain("// local: our tweak");

    const forced = await applyUpgrade(plan, { projectDir: dir, source: bothSource, force: true });
    expect(forced.written).toEqual(["src/components/ui/card/card.tsx"]);
    expect(forced.versionBumped).toBe(true);
    expect(readFileSync(cardPath, "utf8")).toContain("// upstream: reworked");
    expect(readFileSync(cardPath, "utf8")).not.toContain("// local: our tweak");
  });

  it("cannot tell the sides apart without a hash, and says so", async () => {
    const buttonPath = join(dir, "src/components/ui/button/button.tsx");
    const stripped = readFileSync(buttonPath, "utf8").replace(/^\/\* zengin-owned[^\n]*\*\/\n/, "/* zengin-owned Button, forked from @zengin/ui@0.0.1 */\n");
    writeFileSync(buttonPath, stripped + "\n// something\n");
    const plan = await planUpgrade({ projectDir: dir, source, only: ["button"] });
    expect(plan.entries.map((e) => [e.path, e.state])).toEqual([
      ["src/components/ui/button/button.css", "current"],
      ["src/components/ui/button/button.tsx", "unknown"],
    ]);
    expect(plan.entries[1]!.from).toBe("@zengin/ui@0.0.1");
  });

  it("diffs with context and hunks", () => {
    const d = diffLines("a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\n", "a\nb\nc\nd\ne\nF\ng\nh\ni\nj\nk\n", 1);
    expect(d).toBe("--- local\n+++ upstream\n@@\n e\n-f\n+F\n g");
  });
});
