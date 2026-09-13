import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zenginui/engine";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The engine checks the reference system it ships definitions for. Components are owned files, so
 * contract and substitution rules are off; foundation rules stay on. The claim under test: every color
 * and spacing value in every component stylesheet is a token reference. Zero violations, or the system
 * is not practising what it enforces.
 */
describe("zengin on @zenginui/ui", () => {
  it("finds no violations in its own components", async () => {
    const { config, dir } = loadConfigFile(join(root, "zengin.config.yaml"));
    const resolved = resolveConfig(config, dir);
    const engine = await createEngine(resolved);
    const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
    expect(files.length).toBeGreaterThan(10);
    const violations = engine.check(files);
    expect(violations.map((v) => `${v.file}:${v.range.start.line} [${v.rule}] ${v.found}`)).toEqual([]);
  });

  it("would catch a literal slipped into a component stylesheet", async () => {
    const { config, dir } = loadConfigFile(join(root, "zengin.config.yaml"));
    const resolved = resolveConfig(config, dir);
    const engine = await createEngine(resolved);
    const violations = engine.checkFile({
      path: "src/components/button/button.css",
      content: `.z-button { background-color: #2563EB; padding: 9px; }`,
    });
    expect(violations.map((v) => v.rule)).toEqual(["color-literal", "spacing-literal"]);
    expect(violations[0]!.fix).toMatchObject({ replace: "var(--color-primary)", confidence: "exact" });
  });
});
