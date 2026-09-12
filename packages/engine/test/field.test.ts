import { describe, expect, it } from "vitest";
import { createEngine, loadTokens, resolveConfig, type ComponentManifest, type Engine, type Violation } from "../src/index.js";

/**
 * Regressions from the first field test (shadcn/taxonomy, 2026-09-12). Each case is a false positive or
 * false negative the run exposed, reduced to its smallest form. Definitions are inline so the tests do not
 * depend on the fixture projects.
 */

const TOKENS = {
  color: { $type: "color", primary: { DEFAULT: { $value: "#0F172A" }, foreground: { $value: "#F8FAFC" } }, destructive: { $value: "#FF0000" }, muted: { foreground: { $value: "#64748B" } } },
  radius: { $type: "dimension", $extensions: { zengin: { extendsDefault: true } }, lg: { $value: "0.5rem" } },
  font: { $type: "fontFamily", $extensions: { zengin: { extendsDefault: true } }, sans: { $value: "Inter, sans-serif" } },
};

const COMPONENTS: ComponentManifest[] = [
  {
    name: "Button",
    export: { from: "@/components/ui/button", name: "Button" },
    replaces: ["button"],
    extends: "button",
    props: { variant: { type: "enum", values: ["default", "outline"], default: "default" } },
    className: { allow: ["margin", "width", "flex-item", "grid-item", "position"] },
    owns: { "background-color": "variant", color: "variant", padding: null, "border-radius": null },
  },
  { name: "Input", export: { from: "@/components/ui/input", name: "Input" }, replaces: ["input"], extends: "input", props: {}, className: { allow: ["margin", "width"] } },
  { name: "Label", export: { from: "@/components/ui/label", name: "Label" }, extends: "label", props: {}, className: { allow: ["margin"] } },
  { name: "Avatar", export: { from: "@/components/ui/avatar", name: "Avatar" }, replaces: ["@radix-ui/react-avatar#*"], props: {}, className: { allow: [] } },
];

let engine: Engine | undefined;
async function check(path: string, content: string): Promise<Violation[]> {
  engine ??= await createEngine(
    resolveConfig(
      { system: { package: "@/components/ui", version: "0.0.0", sources: ["@/components/ui/*"] }, scope: { include: ["**/*.tsx"] }, classes: { tailwind: true } },
      process.cwd(),
    ),
    { tokens: loadTokens(TOKENS), components: COMPONENTS },
  );
  return engine.checkFile({ path, content });
}

describe("field regressions: substitution", () => {
  it("ignores type-only imports and *Props names from shadowed packages", async () => {
    const v = await check(
      "components/user-avatar.tsx",
      `import type { AvatarProps } from "@radix-ui/react-avatar";\nimport { AvatarProps as P } from "@radix-ui/react-avatar";\nexport const x = 1;`,
    );
    expect(v.filter((x) => x.rule === "component-substitution")).toEqual([]);
  });

  it("catches a raw element styled with the system's variant function", async () => {
    const v = await check(
      "components/editor.tsx",
      `import { buttonVariants } from "@/components/ui/button";\nimport { cn } from "@/lib/utils";\nexport const E = () => <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Save</button>;`,
    );
    const sub = v.filter((x) => x.rule === "component-substitution");
    expect(sub).toHaveLength(1);
    expect(sub[0]!.message).toMatch(/styled with buttonVariants\(\)/);
    expect(sub[0]!.fix.replace).toBe("<Button>Save</Button>");
    expect(sub[0]!.fix.note).toMatch(/Pass the buttonVariants\(\) arguments as props/);
  });

  it("leaves a raw button with only layout classes alone", async () => {
    const v = await check("components/main-nav.tsx", `export const N = () => <button className="flex items-center gap-2 md:hidden">Menu</button>;`);
    expect(v.filter((x) => x.rule === "component-substitution")).toEqual([]);
  });
});

describe("field regressions: contract", () => {
  it("does not treat sr-only on a system component as restyling", async () => {
    const v = await check("components/form.tsx", `import { Label } from "@/components/ui/label";\nexport const F = () => <Label className="sr-only" htmlFor="email">Email</Label>;`);
    expect(v.filter((x) => x.rule === "classname-policy")).toEqual([]);
  });

  it("passes every standard input attribute through an extends=input component", async () => {
    const v = await check(
      "components/auth.tsx",
      `import { Input } from "@/components/ui/input";\nexport const A = () => <Input id="e" type="email" autoCapitalize="none" autoComplete="email" autoCorrect="off" size={32} spellCheck={false} inputMode="email" />;`,
    );
    expect(v.filter((x) => x.rule === "unknown-prop")).toEqual([]);
  });

  it("still reports a prop that is not an HTML attribute", async () => {
    const v = await check("components/auth.tsx", `import { Input } from "@/components/ui/input";\nexport const A = () => <Input tone="danger" />;`);
    expect(v.map((x) => x.rule)).toEqual(["unknown-prop"]);
    expect(v[0]!.message).toMatch(/passes <input> attributes through/);
  });
});

describe("field regressions: foundation", () => {
  it("does not judge position offsets as spacing", async () => {
    const v = await check("app/page.tsx", `export const P = () => <div className="absolute left-[-200px] top-[1px] p-4" style={{ top: "3px" }} />;`);
    expect(v.filter((x) => x.rule === "spacing-literal")).toEqual([]);
  });

  it("treats Tailwind's default scale as on-system when the system defines no spacing tokens, and suggests its steps", async () => {
    const v = await check("app/page.tsx", `export const P = () => <div className="p-3.5 mt-6 px-[1px] gap-[13px]" />;`);
    const spacing = v.filter((x) => x.rule === "spacing-literal");
    expect(spacing.map((x) => x.found)).toEqual(["px-[1px]", "gap-[13px]"]);
    expect(spacing[0]!.fix).toMatchObject({ replace: "px-px", confidence: "exact" });
    expect(spacing[1]!.fix).toMatchObject({ replace: "gap-3", confidence: "nearest" });
  });

  it("keeps default-theme references in namespaces the system extends rather than replaces", async () => {
    const v = await check("app/page.tsx", `export const P = () => <code className="rounded-2xl font-mono rounded-lg">x</code>;`);
    expect(v.filter((x) => x.rule === "token-reference")).toEqual([]);
  });

  it("still reports a class that references nothing", async () => {
    const v = await check("app/page.tsx", `export const P = () => <a className="hover:text-brand divide-border-200">x</a>;`);
    expect(v.map((x) => x.found)).toEqual(["hover:text-brand", "divide-border-200"]);
  });

  it("finds the typo shadcn shipped", async () => {
    const v = await check("components/ui/command.tsx", `export const C = () => <input className="placeholder:text-foreground-muted text-muted-foreground" />;`);
    expect(v.map((x) => x.found)).toEqual(["placeholder:text-foreground-muted"]);
  });
});
