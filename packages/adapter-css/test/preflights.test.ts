import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig, type Violation } from "@zenginui/engine";
import { describe, expect, it } from "vitest";
import { deriveManifestFromSource, deriveManifestFromTypes, derivePackage, deriveTokensFromCss, renderReport, writePackage } from "../src/index.js";
import { deriveScope } from "../src/scope.js";

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

  it("links <name>Variants to its component by name when the props type does not say, and reads boolean variants as booleans", () => {
    expect(byName("Badge").props!["tone"]).toMatchObject({ type: "enum", values: ["neutral", "danger"] });
    expect(byName("Badge").props!["inset"]).toEqual({ type: "boolean" });
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
    expect(chip.props!["selected"]).toEqual({ type: "boolean" }); // a boolean variant is a boolean prop
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

describe("RGB channel triples are colors (defect 7)", () => {
  // Dub's Tailwind 3 shape: channels on :root, used as rgb(var(--x) / <alpha-value>) in the Tailwind preset.
  const css = `:root {
  --bg-default: 255 255 255;
  --content-emphasis: 23, 23, 23;
  --radius: 8px;
}
.dark { --bg-default: 0 0 0; }
`;

  it("reads them as colors with their hex, referred to as rgb(var(--x))", () => {
    const d = deriveTokensFromCss(css);
    const color = d.tokens["color"] as Record<string, { $value: string; $extensions: { zengin: Record<string, string> } }>;
    expect(color["bg-default"]).toEqual({ $value: "#ffffff", $extensions: { zengin: { cssVar: "--bg-default", reference: "rgb(var(--bg-default))" } } });
    expect(color["content-emphasis"]!.$value).toBe("#171717");
    expect((d.tokensDark!["color"] as typeof color)["bg-default"]!.$value).toBe("#000000");
  });

  it("suggests rgb(var(--x)) as the fix, not var(--x)", async () => {
    const pkg = { name: "@dub/ui", files: { "package.json": JSON.stringify({ name: "@dub/ui", version: "0.3.21", exports: { "./styles.css": "./styles.css" } }), "styles.css": css } };
    const app = { "package.json": JSON.stringify({ name: "web" }), "app/page.tsx": `export default function Page() {\n  return <p style={{ color: "#171717", padding: 8 }}>Hi</p>;\n}\n` };
    const { violations } = await preflight(pkg, app, false);
    const color = violations.find((v) => v.rule === "color-literal")!;
    expect(color.fix).toMatchObject({ replace: '"rgb(var(--content-emphasis))"', confidence: "exact" });
  });
});

describe("tokens outside the package's own stylesheet (defect 6)", () => {
  function project(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "zengin-tokens-"));
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), content);
    }
    return dir;
  }
  const dts = "import * as React from 'react';\ndeclare function Button(props: { variant?: 'primary' | 'secondary' }): React.JSX.Element;\nexport { Button };\n";

  it("finds them in a dependency of the package (Dub's @dub/tailwind-config)", () => {
    const dir = project({
      "node_modules/@dub/ui/package.json": JSON.stringify({ name: "@dub/ui", version: "0.3.21", types: "dist/index.d.ts", dependencies: { "@dub/tailwind-config": "0.0.1" } }),
      "node_modules/@dub/ui/dist/index.d.ts": dts,
      "node_modules/@dub/ui/dist/index.css": ".bg-white{background-color:#fff}",
      "node_modules/@dub/tailwind-config/package.json": JSON.stringify({ name: "@dub/tailwind-config", exports: { "./themes.css": "./themes.css" } }),
      "node_modules/@dub/tailwind-config/themes.css": ":root { --bg-default: 255 255 255; --content-default: 64 64 64; }",
    });
    try {
      const d = derivePackage(dir, "@dub/ui");
      expect(d.report.themeFile).toBe("node_modules/@dub/tailwind-config/themes.css");
      expect(d.report.tokenCount).toBe(2);
      expect(d.report.componentCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds them in the project when the package ships no stylesheet (Sim's globals.css)", () => {
    const dir = project({
      "node_modules/@sim/emcn/package.json": JSON.stringify({ name: "@sim/emcn", version: "0.1.0", types: "index.d.ts" }),
      "node_modules/@sim/emcn/index.d.ts": dts,
      "app/_styles/globals.css": ":root { --surface-1: #ffffff; --text-muted: #7a7a7a; }\n@theme inline { --text-caption: 12px; }",
    });
    try {
      const d = derivePackage(dir, "@sim/emcn");
      expect(d.report.themeFile).toBe("app/_styles/globals.css");
      expect(d.config).toContain('css: ["app/_styles/globals.css"]');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("takes the stylesheets --tokens names over everything, and says what to do when nothing holds tokens", () => {
    const dir = project({
      "node_modules/@acme/ui/package.json": JSON.stringify({ name: "@acme/ui", version: "1.0.0", types: "index.d.ts" }),
      "node_modules/@acme/ui/index.d.ts": dts,
      "theme/a.css": ":root { --brand: #0e7c6b; }",
      "theme/b.css": ":root { --gap: 12px; }",
    });
    try {
      const d = derivePackage(dir, "@acme/ui", { tokens: ["theme/a.css", "theme/b.css"] });
      expect(d.report.themeFile).toBe("theme/a.css + theme/b.css");
      expect(d.report.tokenCount).toBe(2);
      rmSync(join(dir, "theme"), { recursive: true });
      expect(() => derivePackage(dir, "@acme/ui")).toThrow(/ships no stylesheet.*--tokens <path/);
      expect(() => derivePackage(dir, "@acme/ui", { tokens: ["theme/a.css"] })).toThrow(/no stylesheet at theme\/a.css/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("packages that ship barrels and TypeScript source (defect 5)", () => {
  function project(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "zengin-source-"));
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), content);
    }
    return dir;
  }
  const css = ":root { --primary: #2563eb; --muted: #f4f4f5; }";

  it("follows export * barrels through declaration files", () => {
    const dir = project({
      "node_modules/@acme/ui/package.json": JSON.stringify({ name: "@acme/ui", version: "2.0.0", types: "dist/index.d.ts", exports: { "./styles.css": "./styles.css" } }),
      "node_modules/@acme/ui/styles.css": css,
      "node_modules/@acme/ui/dist/index.d.ts": 'export * from "./components/index.js";\n',
      "node_modules/@acme/ui/dist/components/index.d.ts": 'export * from "./button.js";\nexport { Badge } from "./badge.js";\n',
      "node_modules/@acme/ui/dist/components/button.d.ts": "import * as React from 'react';\nexport interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'solid' | 'ghost' }\nexport declare function Button(props: ButtonProps): React.JSX.Element;\n",
      "node_modules/@acme/ui/dist/components/badge.d.ts": "import * as React from 'react';\ndeclare function Badge(props: { tone?: 'info' | 'danger' }): React.JSX.Element;\nexport { Badge };\n",
    });
    try {
      const d = derivePackage(dir, "@acme/ui");
      expect(d.components.map((c) => c.name).sort()).toEqual(["Badge", "Button"]);
      expect(d.components.find((c) => c.name === "Button")!.props!["variant"]).toMatchObject({ values: ["solid", "ghost"] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads a package whose types entry is TypeScript source (Comp, Sim): components, cva variants, owns and replaces", () => {
    const dir = project({
      "node_modules/@acme/ds/package.json": JSON.stringify({ name: "@acme/ds", version: "1.1.19", types: "./src/index.ts", exports: { ".": { types: "./src/index.ts" }, "./globals.css": "./src/styles/globals.css" } }),
      "node_modules/@acme/ds/src/styles/globals.css": css,
      "node_modules/@acme/ds/src/index.ts": 'export * from "./components/ui";\n',
      "node_modules/@acme/ds/src/components/ui/index.ts": 'export * from "../atoms";\n',
      "node_modules/@acme/ds/src/components/atoms/index.ts": 'export * from "./button";\nexport * from "./text";\n',
      "node_modules/@acme/ds/src/components/atoms/button.tsx": `import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
const buttonVariants = cva("inline-flex", { variants: { variant: { default: "bg-primary", ghost: "" }, size: { sm: "h-8", lg: "h-10" } } });
type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & VariantProps<typeof buttonVariants> & { loading?: boolean };
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ variant, size, ...props }, ref) => <button ref={ref} className={buttonVariants({ variant, size })} {...props} />);
Button.displayName = "Button";
export { Button, buttonVariants };
export type { ButtonProps };
`,
      "node_modules/@acme/ds/src/components/atoms/text.tsx": `import * as React from "react";
export interface TextProps { variant?: "body" | "muted"; size?: "sm" | "md"; children?: React.ReactNode }
export function Text({ variant = "body", size = "md", children }: TextProps) { return <p data-variant={variant} data-size={size}>{children}</p>; }
`,
    });
    try {
      const d = derivePackage(dir, "@acme/ds");
      expect(d.report.typesFile).toBe("node_modules/@acme/ds/src/index.ts");
      const button = d.components.find((c) => c.name === "Button")!;
      expect(button.props!["variant"]).toMatchObject({ values: ["default", "ghost"] });
      expect(button.props!["loading"]).toEqual({ type: "boolean" });
      expect(button.replaces).toEqual(["button"]);
      expect(button.owns).toMatchObject({ "background-color": "variant", padding: "size" });
      expect(d.components.find((c) => c.name === "Text")!.props!["variant"]).toMatchObject({ values: ["body", "muted"] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("a design system that styles with Tailwind's palette", () => {
  it("writes allow: palette when the package's own code uses ten or more palette classes, and says so", () => {
    const palette = ["neutral-50", "neutral-100", "neutral-200", "neutral-500", "neutral-900", "red-500", "red-600", "green-500", "blue-500", "amber-500"].map((p) => `.bg-${p}{background-color:#000}`).join("");
    const dir = mkdtempSync(join(tmpdir(), "zengin-palette-"));
    try {
      const pkg = join(dir, "node_modules", "@dub", "ui");
      mkdirSync(join(pkg, "dist"), { recursive: true });
      writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@dub/ui", version: "0.3.21", types: "dist/index.d.ts" }));
      writeFileSync(join(pkg, "dist", "index.d.ts"), "declare function Button(props: { variant?: 'primary' }): any;\nexport { Button };\n");
      writeFileSync(join(pkg, "styles.css"), ":root { --bg-default: 255 255 255; }");
      writeFileSync(join(pkg, "dist", "index.css"), palette + "/* utilities */".repeat(200));
      const d = derivePackage(dir, "@dub/ui");
      expect(d.report.paletteClasses).toBe(10);
      expect(d.config).toContain("allow: palette");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("what a props type says it does not take, and whose props it forwards (defects 10-12)", () => {
  const dts = `import * as React from "react";
import React__default from "react";
import { motion } from "framer-motion";
type ButtonPrimitiveProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { render?: React.ReactElement };
type ButtonProps = Omit<ButtonPrimitiveProps, "className" | "style"> & { variant?: "default" | "ghost" };
declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
declare function Badge(props: React.HTMLAttributes<HTMLDivElement> & { tone?: "info" | "danger" }): React.JSX.Element;
declare function Chip(props: React__default.HTMLAttributes<HTMLSpanElement> & { label: string }): React.JSX.Element;
declare function Pill(props: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element;
type FileUploadReadFileProps = { readFile: true; onChange: (data: { src: string }) => void } | { readFile?: false; onChange: (file: File) => void };
type FileUploadProps = FileUploadReadFileProps & { accept: string; variant?: "default" | "plain" };
declare function FileUpload(props: FileUploadProps): React.JSX.Element;
declare function MenuItem<T extends React.ElementType = "button">(props: { as?: T; icon?: React.ReactNode } & React.ComponentPropsWithoutRef<T>): React.JSX.Element;
declare function AnimatedSizeContainer(props: React.ComponentProps<typeof motion.div> & { width?: boolean }): React.JSX.Element;
declare const Stack: import("react").ForwardRefExoticComponent<{ gap?: "1" | "2"; justify?: "start" | "between" } & import("react").RefAttributes<HTMLDivElement>>;
export { AnimatedSizeContainer, Badge, Button, Chip, FileUpload, MenuItem, Pill, Stack };
`;
  const d = deriveManifestFromTypes(dts, { importFrom: "@acme/ui" });
  const by = (n: string) => d.components.find((c) => c.name === n)!;

  it("records what Omit removes (Comp's DS Button takes no className)", () => {
    expect(by("Button").omits).toEqual(["className", "style"]);
    expect(by("Button").props!["variant"]).toMatchObject({ values: ["default", "ghost"] });
  });

  it("treats React's helpers as React's whichever way React is imported, never as passthrough", () => {
    for (const name of ["Badge", "Chip", "Pill"]) expect(by(name).passthrough).toBeUndefined();
    expect(by("Badge").extends).toBe("div");
    expect(by("Chip").props!["label"]).toEqual({ type: "string" });
  });

  it("reads every member of a union of props shapes (Dub's FileUpload)", () => {
    expect(Object.keys(by("FileUpload").props!).sort()).toEqual(["accept", "onChange", "readFile", "variant"]);
  });

  it("passes through another component's props and a polymorphic element's, instead of guessing div", () => {
    expect(by("AnimatedSizeContainer").passthrough).toEqual(["typeof motion.div"]);
    expect(by("MenuItem").passthrough).toEqual(["ComponentPropsWithoutRef<T> (polymorphic)"]);
  });

  it("recognises a component typed as import(\"react\").ForwardRefExoticComponent (Sim's Button)", () => {
    expect(by("Stack").props!["gap"]).toMatchObject({ values: ["1", "2"] });
  });

  it("the engine reports a className passed to a component that omits it, and leaves classname-policy out of it", async () => {
    const pkg = {
      name: "@acme/ds",
      files: {
        "package.json": JSON.stringify({ name: "@acme/ds", version: "1.0.0", types: "index.d.ts", exports: { "./styles.css": "./styles.css" } }),
        "styles.css": ":root { --primary: #2563eb; }",
        "index.d.ts": dts,
      },
    };
    const app = {
      "package.json": JSON.stringify({ name: "app" }),
      "app/page.tsx": `import { Button, MenuItem, AnimatedSizeContainer } from "@acme/ds";
export default function Page() {
  return (
    <>
      <Button variant="ghost" className="w-full">Go</Button>
      <MenuItem as="a" href="/x" target="_blank">Link</MenuItem>
      <AnimatedSizeContainer initial={false} transition={{ duration: 0.2 }}>x</AnimatedSizeContainer>
    </>
  );
}
`,
    };
    const { violations } = await preflight(pkg, app, false);
    expect(violations.map((v) => `${v.rule} ${v.found}`)).toEqual(['unknown-prop className="w-full"']);
    expect(violations[0]!.message).toContain("its props type omits it");
  });
});

describe("omits and the workspace's own copy (defects 10 and 13)", () => {
  it("an omitted prop the type declares again is accepted", () => {
    const d = deriveManifestFromTypes(
      `import * as React from "react";
interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> { className?: string; to: string }
declare function Link(props: LinkProps): React.JSX.Element;
export { Link };
`,
      { importFrom: "@acme/ui" },
    );
    expect(d.components[0]!.omits).toEqual(["href"]);
  });

  it("warns when node_modules holds a copy of a package whose source is in the workspace", () => {
    const dir = mkdtempSync(join(tmpdir(), "zengin-workspace-"));
    try {
      const write = (rel: string, content: string) => {
        mkdirSync(join(dir, rel, ".."), { recursive: true });
        writeFileSync(join(dir, rel), content);
      };
      write("pnpm-workspace.yaml", "packages: ['apps/*', 'packages/*']\n");
      write("packages/ui/package.json", JSON.stringify({ name: "@dub/ui", version: "0.3.21" }));
      write("apps/web/package.json", JSON.stringify({ name: "web" }));
      write("apps/web/node_modules/@dub/ui/package.json", JSON.stringify({ name: "@dub/ui", version: "0.3.21", types: "index.d.ts" }));
      write("apps/web/node_modules/@dub/ui/index.d.ts", "declare function Button(props: { variant?: 'primary' }): any;\nexport { Button };\n");
      write("apps/web/node_modules/@dub/ui/styles.css", ":root { --bg-default: 255 255 255; }");
      const d = derivePackage(join(dir, "apps", "web"), "@dub/ui");
      expect(d.report.workspaceSource).toBe("../../packages/ui");
      expect(renderReport(d)).toContain("this workspace has its source at ../../packages/ui");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("discriminated unions and React's own props (defect 12, continued)", () => {
  const d = deriveManifestFromTypes(
    `import * as React from "react";
type ChipModalFieldProps = { type: "input"; value: string } | { type: "custom"; render: () => React.ReactNode } | { type: "textarea" | "dropdown"; value: string };
declare function ChipModalField(props: ChipModalFieldProps): React.JSX.Element;
type AccordionItemProps = Omit<React.ComponentPropsWithRef<"div">, "ref"> & { value: string };
declare const AccordionItem: React.ForwardRefExoticComponent<AccordionItemProps & React.RefAttributes<HTMLDivElement>>;
export { AccordionItem, ChipModalField };
`,
    { importFrom: "@sim/emcn" },
  );
  const by = (n: string) => d.components.find((c) => c.name === n)!;

  it("merges a key's values across the members of a union", () => {
    expect(by("ChipModalField").props!["type"]).toEqual({ type: "enum", values: ["input", "custom", "textarea", "dropdown"] });
    expect(Object.keys(by("ChipModalField").props!).sort()).toEqual(["render", "type", "value"]);
  });

  it("never counts ref as omitted: forwardRef gives it back", () => {
    expect(by("AccordionItem").omits).toBeUndefined();
  });
});

describe("scope from what the project tells its tools (defect 9)", () => {
  function project(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "zengin-scope-"));
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(join(dir, rel, ".."), { recursive: true });
      writeFileSync(join(dir, rel), content);
    }
    return dir;
  }

  it("takes Tailwind 3's content folders inside the project (Dub's app and ui), not the monorepo's", () => {
    const dir = project({
      "tailwind.config.ts": 'export default { presets: [{ content: ["./app/**/*.{js,ts,jsx,tsx}", "./ui/**/*.{js,ts,jsx,tsx}", "../../packages/ui/src/**/*{.js,.ts,.jsx,.tsx}"] }] };',
      "app/page.tsx": "",
      "ui/button.tsx": "",
    });
    try {
      const s = deriveScope(dir);
      expect(s.include).toEqual(["app/**/*.{ts,tsx,css}", "ui/**/*.{ts,tsx,css}"]);
      expect(s.from).toEqual(["tailwind.config.ts content"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("scopes the whole project when tsconfig includes **/*.tsx (Sim, whose @source leaves hooks/ out)", () => {
    const dir = project({
      "tsconfig.json": '{\n  // comments are fine, and so is a path glob that looks like one: "./*"\n  "compilerOptions": { "paths": { "@/*": ["./*"] } },\n  "include": ["**/*.ts", "**/*.tsx", "../next-env.d.ts"],\n}',
      "app/_styles/globals.css": "@source '../../app';\n@source '../../ee';\n@source not '../../**/*.test.tsx';",
      "app/page.tsx": "",
      "ee/x.tsx": "",
      "hooks/use-x.ts": "",
    });
    try {
      const s = deriveScope(dir);
      expect(s.include).toEqual(["**/*.{ts,tsx,css}"]);
      expect(s.exclude).toEqual(expect.arrayContaining(["**/.next/**", "**/*.test.{ts,tsx}", "**/*.stories.{ts,tsx}"]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads @source relative to its stylesheet, and adds the default folders that exist", () => {
    const dir = project({
      "app/_styles/globals.css": "@source '../../ee';\n@source '../../../../packages/emcn/src';",
      "ee/x.tsx": "",
      "src/a.tsx": "",
    });
    try {
      expect(deriveScope(dir).include).toEqual(["app/**/*.{ts,tsx,css}", "ee/**/*.{ts,tsx,css}", "src/**/*.{ts,tsx,css}"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
