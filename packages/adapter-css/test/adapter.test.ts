import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, loadTokens, resolveConfig, TokenIndex } from "@zengin/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classify, deriveManifestFromTypes, derivePackage, deriveTokensFromCss, writePackage } from "../src/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const zenCss = readFileSync(join(fixtures, "zen.css"), "utf8");
const zenDts = readFileSync(join(fixtures, "zen.d.ts"), "utf8");

type Group = Record<string, { $value: string; $extensions: { zengin: { cssVar: string } } }>;

describe("tokens from a stylesheet's custom properties", () => {
  const d = deriveTokensFromCss(zenCss);
  const color = d.tokens["color"] as Group;

  it("keeps the variable names and records them as the token's cssVar", () => {
    expect(color["surface-base"]).toEqual({ $value: "#ffffff", $extensions: { zengin: { cssVar: "--surface-base" } } });
    expect(color["gray-900"]!.$value).toBe("oklch(0.205 0 0)");
  });

  it("turns var() references into DTCG aliases within a group", () => {
    expect(color["primary"]!.$value).toBe("{color.gray-900}");
    expect(color["text-muted"]!.$value).toBe("{color.gray-500}");
  });

  it("classifies dimensions by name: radius, padding, gap", () => {
    expect((d.tokens["radius"] as Group)["radius-default"]!.$value).toBe("0.375rem");
    expect((d.tokens["space"] as Group)["padding-x-default"]!.$value).toBe("0.75rem");
    expect((d.tokens["space"] as Group)["gap-default"]!.$value).toBe("0.75rem");
    expect((d.tokens["shadow"] as Group)["shadow-default"]).toBeDefined();
    expect((d.tokens["font"] as Group)["font-family-mono"]).toBeDefined();
  });

  it("reads the dark block as overrides of light tokens only", () => {
    expect(d.report.dark).toBeGreaterThan(10);
    const dark = d.tokensDark!["color"] as Group;
    expect(dark["primary"]!.$value).toBe("{color.gray-100}");
    expect(dark["surface-base"]!.$value).toBe("{color.gray-900}"); // dark aliases resolve against the light palette
    for (const key of Object.keys(dark)) expect(color[key], key).toBeDefined();
  });

  it("ignores palette variants and other selectors that are not the theme root", () => {
    // [data-palette="slate"] redefines --gray-*; the light tokens come from :root.
    expect(color["gray-50"]!.$value).toBe("oklch(0.985 0 0)");
  });

  it("classifies values before names", () => {
    expect(classify("--anything", "#fff")).toBe("color");
    expect(classify("--radius-sm", "4px")).toBe("radius");
    expect(classify("--text-sm", "0.875rem")).toBe("text");
    expect(classify("--x", "1.5")).toBe("other");
    expect(classify("--x", "var(--nope)")).toBeUndefined();
    expect(classify("--x", "url(a.png)")).toBeUndefined();
  });

  it("loads into the engine with the original variable names", () => {
    const idx = new TokenIndex(loadTokens(d.tokens));
    expect(idx.byName.get("color.surface-base")?.cssVar).toBe("--surface-base");
    expect(idx.byName.get("color.primary")?.value).toBe("#171717"); // the engine normalizes colors to hex
    expect(["--primary-foreground", "--surface-base"]).toContain(idx.exactColor("#ffffff")?.cssVar);
  });
});

describe("manifest from type declarations", () => {
  const d = deriveManifestFromTypes(zenDts, { importFrom: "@acme/zen", version: "1.2.0" });
  const by = Object.fromEntries(d.components.map((c) => [c.name, c]));

  it("finds the declared component functions", () => {
    expect(Object.keys(by).sort()).toEqual(["Badge", "Button", "Checkbox"]);
    expect(by["Button"]!.export).toEqual({ from: "@acme/zen", name: "Button" });
    expect(by["Button"]!.since).toBe("1.2.0");
  });

  it("reads enum values from the tailwind-variants map named for the component", () => {
    expect(by["Button"]!.props!["variant"]).toEqual({ type: "enum", values: ["default", "primary", "outline", "quiet", "danger", "zero"], default: "default" });
    expect(by["Button"]!.props!["size"]).toEqual({ type: "enum", values: ["xs", "sm", "md", "lg", "xl"] });
    expect(by["Badge"]!.props!["variant"]!.values).toContain("success");
    expect(d.report.withVariants).toBe(2);
  });

  it("reads prop kinds from the Props interface", () => {
    expect(by["Button"]!.props!["isDisabled"]).toEqual({ type: "boolean" });
    expect(by["Button"]!.props!["onPress"]).toEqual({ type: "function" });
    expect(by["Button"]!.props!["className"]).toBeUndefined();
    expect(by["Checkbox"]!.props!["label"]).toEqual({ type: "string" });
    expect(by["Checkbox"]!.props!["value"]).toEqual({ type: "node" });
    expect(by["Checkbox"]!.props!["onChange"]).toEqual({ type: "function" });
  });

  it("records imported prop types as passthrough and reaches variants through VariantProps<typeof x>", () => {
    const d2 = deriveManifestFromTypes(
      `import { VariantProps } from 'tailwind-variants';
import { Popover as Popover$1 } from '@base-ui/react/popover';
declare const button: TVReturnType<{ variant: { a: string; b: string } }, undefined, string, unknown, unknown, undefined>;
type ButtonVariants = VariantProps<typeof button>;
interface ButtonProps extends ButtonVariants { isDisabled?: boolean }
interface LoadingButtonProps extends ButtonProps { isLoading?: boolean }
declare function LoadingButton(props: LoadingButtonProps): JSX.Element;
interface PopoverProps extends Omit<Popover$1.Positioner.Props, 'children'> { isOpen?: boolean }
declare function Popover(props: PopoverProps): JSX.Element;
import { ProgressRoot } from '@base-ui/react/progress';
interface ProgressBarProps extends ProgressRoot.Props { showPercentage?: boolean }
declare function ProgressBar(props: ProgressBarProps): JSX.Element;
declare function Plain({ as, children }: { as?: string; children?: ReactNode }): JSX.Element;
import * as react from 'react';
declare const Alert: react.ForwardRefExoticComponent<react.HTMLAttributes<HTMLDivElement> & react.RefAttributes<HTMLDivElement>>;
`,
      { importFrom: "@acme/zen" },
    );
    const by2 = Object.fromEntries(d2.components.map((c) => [c.name, c]));
    expect(by2["LoadingButton"]!.props!["variant"]).toEqual({ type: "enum", values: ["a", "b"] });
    expect(by2["LoadingButton"]!.props!["isLoading"]).toEqual({ type: "boolean" });
    expect(by2["LoadingButton"]!.passthrough).toBeUndefined();
    expect(by2["Popover"]!.passthrough).toEqual(["@base-ui/react/popover#Popover.Positioner.Props"]);
    expect(by2["Popover"]!.props!["isOpen"]).toEqual({ type: "boolean" });
    expect(by2["ProgressBar"]!.passthrough).toEqual(["@base-ui/react/progress#ProgressRoot.Props"]);
    expect(by2["Plain"]!.props!["as"]).toEqual({ type: "string" });
    expect(by2["Alert"]!.passthrough).toBeUndefined();
    expect(by2["Alert"]!.extends).toBe("div");
  });

  it("marks intrinsic replacements and owned properties", () => {
    expect(by["Button"]!.replaces).toEqual(["button"]);
    expect(by["Button"]!.extends).toBe("button");
    expect(by["Button"]!.owns).toEqual({ "background-color": "variant", color: "variant", "border-color": "variant", padding: "size", font: "size" });
    expect(by["Checkbox"]!.replaces).toEqual([]);
    expect(by["Checkbox"]!.owns).toEqual({});
  });
});

describe("an installed package end to end", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-adapter-css-"));
    const pkg = join(dir, "node_modules", "@acme", "zen");
    mkdirSync(join(pkg, "dist"), { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/zen", version: "1.2.0", types: "dist/index.d.ts", exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.mjs" }, "./styles.css": "./styles.css", "./styles.full.css": "./styles.full.css" } }),
    );
    writeFileSync(join(pkg, "styles.css"), zenCss);
    // The utility sheet: precompiled classes, larger than the theme sheet, defining no :root variables.
    writeFileSync(join(pkg, "styles.full.css"), `@layer utilities{.w-full{width:100%}.max-w-md{max-width:28rem}.bg-white{background-color:#fff}.p-4{padding:calc(var(--spacing)*4)}}\n` + "/* padding */".repeat(2000));
    writeFileSync(join(pkg, "dist", "index.d.ts"), zenDts);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "theme.css"), ":root { --brand: #ff0000; }\n.x { color: #00ff00; }\n");
    writeFileSync(
      join(dir, "src", "App.tsx"),
      `import { Button } from "@acme/zen";
export function App() {
  return (
    <div className="w-full bg-white" style={{ background: "#ffffff" }}>
      <Button variant="ghost" size="md">Go</Button>
      <Button variant="primary" className="max-w-md">Go</Button>
    </div>
  );
}
`,
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("picks the theme sheet, the utility sheet and the declarations", () => {
    const d = derivePackage(dir, "@acme/zen");
    expect(d.report.version).toBe("1.2.0");
    expect(d.report.themeFile).toBe("node_modules/@acme/zen/styles.css");
    expect(d.report.utilityFile).toBe("node_modules/@acme/zen/styles.full.css");
    expect(d.report.typesFile).toBe("node_modules/@acme/zen/dist/index.d.ts");
    expect(d.report.componentCount).toBe(3);
    expect(d.config).toContain('package: "@acme/zen"');
    expect(d.config).toContain('css: ["node_modules/@acme/zen/styles.full.css"]');
    expect(d.report.foundations).toEqual(["src/theme.css"]);
    expect(d.config).toContain('foundations: ["src/theme.css"]');
  });

  it("writes the definitions and refuses to overwrite without force", () => {
    const d = derivePackage(dir, "@acme/zen");
    const { written } = writePackage(dir, d);
    expect(written).toEqual(["zengin/tokens.json", "zengin/components.json", "zengin.config.yaml", "zengin/tokens.dark.json"]);
    expect(existsSync(join(dir, "zengin", "tokens.json"))).toBe(true);
    expect(() => writePackage(dir, d)).toThrow(/--force/);
    writePackage(dir, d, true);
  });

  it("the engine checks the project with those definitions", async () => {
    const { loadConfigFile, readProjectFiles } = await import("@zengin/engine");
    const { config } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig(config, dir);
    const engine = await createEngine(resolved);
    const files = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
    const violations = engine.check(files);
    const ids = violations.map((v) => `${v.rule}:${v.range.start.line}`);
    // The literal white in inline style is a token: the fix names the package's own variable, not a renamed one.
    const white = violations.find((v) => v.rule === "color-literal" && v.range.start.line === 4 && v.found === '"#ffffff"');
    expect(white?.fix.replace).toMatch(/^"var\(--[a-z-]+\)"$/);
    expect(white?.fix.candidates).toContain("color.surface-base");
    // "ghost" is not a Button variant.
    expect(ids).toContain("unknown-prop-value:5");
    // bg-white resolves through the package's utility sheet to a color literal; w-full is placement and passes.
    expect(violations.some((v) => v.rule === "color-literal" && v.range.start.line === 4 && v.found === "bg-white")).toBe(true);
    expect(violations.filter((v) => v.range.start.line === 6)).toEqual([]);
  });

  it("explains a missing package", () => {
    expect(() => derivePackage(dir, "@acme/nope")).toThrow(/not installed/);
  });
});
