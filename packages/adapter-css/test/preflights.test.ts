import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig, type Violation } from "@zenginui/engine";
import { describe, expect, it } from "vitest";
import { deriveManifestFromSource, deriveManifestFromTypes, derivePackage, deriveTokensFromCss, writePackage } from "../src/index.js";

/** A project with one design-system package installed, its own files, then init and check, as a preflight runs it. */
async function preflight(pkg: { name: string; files: Record<string, string> }, project: Record<string, string>, tailwind = true): Promise<{ violations: Violation[]; config: string }> {
  const dir = mkdtempSync(join(tmpdir(), "zengin-preflight-"));
  try {
    const write = (rel: string, content: string) => {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), content);
    };
    for (const [rel, content] of Object.entries(pkg.files)) write(join("node_modules", pkg.name, rel), content);
    for (const [rel, content] of Object.entries(project)) write(rel, content);
    const d = derivePackage(dir, pkg.name);
    writePackage(dir, d);
    if (!tailwind) writeFileSync(join(dir, "zengin.config.yaml"), d.config.replace("tailwind: auto", "tailwind: false"));
    const { config } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig({ ...config, classes: { ...config.classes, tailwind } }, dir);
    const engine = await createEngine(resolved);
    return { violations: engine.check(readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude)), config: d.config };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("@theme blocks and the Tailwind 4 default scale (defects 1 and 2)", () => {
  // Comp's and Sim's shape: :root variables, an @theme inline block mapping utilities onto them, a few lengths.
  const css = `@import "tailwindcss";
:root {
  --background: #ffffff;
  --muted-foreground: #64748b;
  --primary: #2563eb;
  --radius: 0.5rem;
  --header-height: 56px;
  --sidebar-gap: 12px;
}
.dark { --background: #0b0b0c; --muted-foreground: #a1a1aa; --primary: #60a5fa; }
@theme inline {
  --color-background: var(--background);
  --color-muted-foreground: var(--muted-foreground);
  --color-primary: var(--primary);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}
@theme { --color-brand: #0e7c6b; }
`;
  const pkg = { name: "@acme/ds", files: { "package.json": JSON.stringify({ name: "@acme/ds", version: "1.0.0", exports: { "./globals.css": "./globals.css" } }), "globals.css": css } };
  const app = {
    "package.json": JSON.stringify({ name: "app", dependencies: { "@acme/ds": "1.0.0", tailwindcss: "^4" } }),
    "app/page.tsx": `export default function Page() {
  return (
    <main className="bg-background text-muted-foreground rounded-md rounded-lg gap-1.5 px-6 mt-1 text-brand">
      <p className="text-primary">Hi</p>
      <p className="bg-[#ff0000] text-red-500 rounded-xl p-[13px]">Off</p>
    </main>
  );
}
`,
  };

  it("reads literal @theme values as tokens and marks spacing as extending Tailwind's scale", () => {
    const d = deriveTokensFromCss(css);
    expect((d.tokens["color"] as Record<string, { $value: string }>)["color-brand"]?.$value).toBe("#0e7c6b");
    expect(d.tokens["space"]).toMatchObject({ $extensions: { zengin: { extendsDefault: true } } });
    const reset = deriveTokensFromCss(`:root { --gap: 12px; }\n@theme { --spacing-*: initial; --spacing-1: 4px; }`);
    expect(reset.replaced).toEqual(["spacing"]);
    expect(reset.tokens["space"]).toMatchObject({ $extensions: { zengin: { extendsDefault: false } } });
  });

  it("lists the stylesheet with the @theme block in classes.css", async () => {
    const { config } = await preflight(pkg, app);
    expect(config).toContain('css: ["node_modules/@acme/ds/globals.css"]');
  });

  it("checks utilities the @theme block defines, Tailwind's spacing steps and radii it redefines, as on-system", async () => {
    const { violations } = await preflight(pkg, app);
    // still caught: an arbitrary color, Tailwind's palette, an arbitrary length. rounded-xl is Tailwind's own
    // radius, which the system's @theme extends rather than resets.
    expect(violations.map((v) => `${v.rule} ${v.found}`).sort()).toEqual(["color-literal bg-[#ff0000]", "color-literal text-red-500", "spacing-literal p-[13px]"]);
  });

  it("a namespace the system resets is its own scale: Tailwind's other steps are off-system", async () => {
    const reset = { ...pkg, files: { ...pkg.files, "globals.css": css.replace("@theme inline {", "@theme inline { --radius-*: initial;") } };
    const { violations } = await preflight(reset, app);
    expect(violations.map((v) => `${v.rule} ${v.found}`)).toContain("token-reference rounded-xl");
  });
});

/**
 * Regressions from the 2026-10-22 preflights on dubinc/dub, trycompai/comp and simstudioai/sim. Each fixture is
 * the smallest shape of what those repos ship; the defect number is the one in the preflight note.
 */

describe("cva constants named <name>Variants (defect 4)", () => {
  // What tsc emits for a shadcn Button: the cva constant is a function type, named buttonVariants.
  const dts = `import * as React from "react";
import { type VariantProps } from "class-variance-authority";
declare const buttonVariants: (props?: ({
    variant?: "default" | "destructive" | "outline" | "ghost" | null | undefined;
    size?: "default" | "sm" | "lg" | "icon" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}
declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
declare const badgeVariants: (props?: ({
    tone?: "neutral" | "danger" | null | undefined;
    inset?: boolean | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
declare function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: string }): React.JSX.Element;
export { Badge, Button, badgeVariants, buttonVariants };
`;
  const d = deriveManifestFromTypes(dts, { importFrom: "@acme/ui" });
  const byName = (n: string) => d.components.find((c) => c.name === n)!;

  it("reads cva's emitted type through VariantProps<typeof buttonVariants>", () => {
    expect(byName("Button").props!["variant"]).toMatchObject({ type: "enum", values: ["default", "destructive", "outline", "ghost"] });
    expect(byName("Button").props!["size"]).toMatchObject({ values: ["default", "sm", "lg", "icon"] });
    expect(byName("Button").props!["asChild"]).toEqual({ type: "boolean" });
  });

  it("links <name>Variants to its component by name when the props type does not say, and skips boolean variants", () => {
    expect(byName("Badge").props!["tone"]).toMatchObject({ type: "enum", values: ["neutral", "danger"] });
    expect(byName("Badge").owns).toEqual({});
    expect(d.report.withVariants).toBe(2);
  });

  it("reads cva() and tv() calls in source", () => {
    const src = `import { cva, type VariantProps } from "class-variance-authority";
import { tv } from "tailwind-variants";
const chipVariants = cva("inline-flex", { variants: { size: { sm: "h-6", md: "h-8" }, selected: { true: "ring", false: "" } }, defaultVariants: { size: "md" } });
const stack = tv({ variants: { gap: { 1: "gap-1", 2: "gap-2" }, justify: { start: "", between: "" } } });
export interface ChipProps extends VariantProps<typeof chipVariants> { label: string }
export function Chip({ label, size }: ChipProps) { return <span className={chipVariants({ size })}>{label}</span>; }
export interface StackProps extends VariantProps<typeof stack> { children?: React.ReactNode }
export function Stack({ gap, justify, children }: StackProps) { return <div className={stack({ gap, justify })}>{children}</div>; }
`;
    const s = deriveManifestFromSource([{ path: "src/ui/chip.tsx", content: src }], { importFrom: "@/ui" });
    const chip = s.components.find((c) => c.name === "Chip")!;
    expect(chip.props!["size"]).toMatchObject({ type: "enum", values: ["sm", "md"] });
    expect(chip.props!["selected"]).toBeUndefined();
    const st = s.components.find((c) => c.name === "Stack")!;
    expect(st.props!["gap"]).toMatchObject({ values: ["1", "2"] });
    expect(st.props!["justify"]).toMatchObject({ values: ["start", "between"] });
  });
});

describe("--text-* holds colors and sizes (defect 3)", () => {
  // Sim's shape: colors named --text-* on :root, the type scale in @theme inline under the same prefix.
  const css = `:root {
  --background: #ffffff;
  --text-primary: #1a1a1a;
  --text-muted: #7a7a7a;
  --text-body: #434343;
}
.dark { --text-muted: #6e6e6e; --text-body: #c1c1c1; }
@theme inline {
  --breakpoint-sm: 640px;
  --text-micro: 10px;
  --text-caption: 12px;
  --text-small: 13px;
  --color-background: var(--background);
}
`;
  const pkg = { name: "@sim/emcn", files: { "package.json": JSON.stringify({ name: "@sim/emcn", version: "0.1.0", exports: { "./globals.css": "./globals.css" } }), "globals.css": css } };
  const app = {
    "package.json": JSON.stringify({ name: "sim", dependencies: { "@sim/emcn": "0.1.0", tailwindcss: "^4" } }),
    "app/page.tsx": `export default function Page() {
  return <p className="bg-background text-caption text-small text-micro text-[var(--text-muted)]">Hi</p>;
}
`,
  };

  it("classifies by value: the colors are colors, the lengths are type sizes, breakpoints are neither", () => {
    const d = deriveTokensFromCss(css);
    expect(Object.keys(d.tokens["color"] as object)).toEqual(expect.arrayContaining(["text-primary", "text-muted", "text-body"]));
    expect(Object.keys(d.tokens["text"] as object).filter((k) => !k.startsWith("$")).sort()).toEqual(["text-caption", "text-micro", "text-small"]);
    expect(d.tokens["space"]).toBeUndefined();
  });

  it("checks the type scale and the text colors as on-system", async () => {
    const { violations } = await preflight(pkg, app);
    expect(violations.map((v) => `${v.rule} ${v.found}`)).toEqual([]);
  });
});
