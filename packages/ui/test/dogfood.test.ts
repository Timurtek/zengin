import { readFileSync, readdirSync } from "node:fs";
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

/**
 * A rule the engine cannot express, because every token here is real and used in a valid place: what is
 * wrong is which token was chosen. `--color-surface-overlay` is the 80%-alpha scrim a modal sits on top of.
 * Painting content on it composites with whatever is behind, which is how Combobox's option list shipped at
 * 1.79:1 in the light theme while every check in the repository stayed green.
 */
describe("the scrim is a backdrop", () => {
  const components = join(root, "src", "components");

  it("is used only by the two components that put something in front of it", () => {
    const used: string[] = [];
    for (const dir of readdirSync(components)) {
      const css = join(components, dir, `${dir}.css`);
      let content = "";
      try {
        content = readFileSync(css, "utf8");
      } catch {
        continue; // a component without its own stylesheet
      }
      // `var(...)`, not the bare name: a stylesheet may say in a comment why it does not use the scrim.
      if (content.includes("var(--color-surface-overlay)")) used.push(dir);
    }
    // Dialog and Sheet paint it behind themselves. Anything else is content on a scrim.
    expect(used.sort()).toEqual(["dialog", "sheet"]);
  });
});
