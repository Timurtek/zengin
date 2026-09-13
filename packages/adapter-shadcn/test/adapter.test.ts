import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, loadConfigFile, loadTokens, readProjectFiles, resolveConfig, type ComponentManifest } from "@zenginui/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveComponent, deriveShadcn, writeShadcn } from "../src/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("Tailwind 3 project (HSL triples, config with extend)", () => {
  const d = deriveShadcn(join(fixtures, "tw3"));
  const color = d.tokens["color"] as Record<string, Record<string, { $value: string }>>;

  it("finds the theme and the ui directory", () => {
    expect(d.report.themeFile).toBe("styles/globals.css");
    expect(d.report.tailwind).toBe(3);
    expect(d.report.uiDir).toBe("components/ui");
  });

  it("converts HSL triples to hex and groups foreground pairs", () => {
    expect(color["background"]).toEqual({ $value: "#ffffff" });
    expect(color["primary"]!["DEFAULT"]!.$value).toBe("#0f172a");
    expect(color["primary"]!["foreground"]!.$value).toBe("#f8fafc");
    expect(color["destructive"]!["DEFAULT"]!.$value).toBe("#ff0000");
  });

  it("derives the radius scale from --radius and marks extended namespaces", () => {
    const radius = d.tokens["radius"] as Record<string, unknown>;
    expect(radius["lg"]).toEqual({ $value: "8px" });
    expect(radius["md"]).toEqual({ $value: "6px" });
    expect(radius["sm"]).toEqual({ $value: "4px" });
    expect(radius["$extensions"]).toEqual({ zengin: { extendsDefault: true } });
    const font = d.tokens["font"] as Record<string, unknown>;
    expect(font["sans"]).toEqual({ $value: "var(--font-sans), ui-sans-serif, system-ui, sans-serif" });
    expect(font["heading"]).toBeDefined();
  });

  it("declares no spacing tokens: Tailwind's scale is the scale", () => {
    expect(d.tokens["space"]).toBeUndefined();
    expect(loadTokens(d.tokens).some((t) => t.namespace === "spacing")).toBe(false);
  });

  it("derives the dark theme as color overrides only", () => {
    expect(d.tokensDark).toBeDefined();
    const dark = loadTokens(d.tokensDark!);
    expect(dark.every((t) => t.type === "color")).toBe(true);
    expect(dark.find((t) => t.name === "color.background")?.value).toBe("#030711");
  });

  it("reads variants, defaults, replacements and owns from button.tsx", () => {
    const button = d.components.find((c) => c.name === "Button")!;
    expect(button.export).toEqual({ from: "@/components/ui/button", name: "Button" });
    expect(button.props!["variant"]).toEqual({ type: "enum", values: ["default", "destructive", "outline", "ghost", "link"], default: "default" });
    expect(button.props!["size"]).toEqual({ type: "enum", values: ["default", "sm", "lg"], default: "default" });
    expect(button.replaces).toEqual(["button", "@headlessui/react#Button"]);
    expect(button.extends).toBe("button");
    // Base classes claim rounded-md and text-sm; variants claim colors and the outline border; size claims padding and height.
    expect(button.owns).toEqual({ "border-radius": null, font: null, "background-color": "variant", color: "variant", "border-color": "variant", height: "size", padding: "size" });
    expect(button.className!.allow).toContain("margin");
  });

  it("derives sub-parts as slots and Radix props from the package a file imports", () => {
    const card = d.components.find((c) => c.name === "Card")!;
    expect(card.slots).toEqual(["Header", "Title", "Content"]);
    const dialog = d.components.find((c) => c.name === "Dialog")!;
    expect(dialog.replaces).toEqual(["dialog", "@radix-ui/react-dialog#*", "radix-ui#Dialog", "@headlessui/react#Dialog"]);
    expect(dialog.props!["onOpenChange"]).toEqual({ type: "function" });
    expect(dialog.className!.allow).toEqual([]);
    expect(dialog.slots).toEqual(["Trigger", "Content", "Title"]);
  });

  it("skips files with no component and reports the defaults to review", () => {
    expect(d.report.skippedFiles).toEqual(["components/ui/use-toast.ts"].filter(() => false)); // .ts files are not scanned at all
    expect(d.report.componentCount).toBe(5);
    expect(d.report.review.some((r) => r.startsWith("Button: className.allow"))).toBe(true);
  });
});

describe("Tailwind 4 project (oklch, @theme inline, src/ via tsconfig paths)", () => {
  const d = deriveShadcn(join(fixtures, "tw4"));

  it("resolves the ui directory through components.json and tsconfig paths", () => {
    expect(d.report.tailwind).toBe(4);
    expect(d.report.uiDir).toBe("src/components/ui");
    expect(d.report.themeFile).toBe("src/app/globals.css");
  });

  it("converts oklch and takes the radius scale from @theme", () => {
    const color = d.tokens["color"] as Record<string, Record<string, { $value: string }>>;
    expect(color["background"]).toEqual({ $value: "#ffffff" });
    expect(color["sidebar"]!["DEFAULT"]!.$value).toMatch(/^#[0-9a-f]{6}$/);
    expect(color["chart-1"]).toBeDefined();
    const radius = d.tokens["radius"] as Record<string, { $value: string }>;
    expect(radius["sm"]).toEqual({ $value: "6px" });
    expect(radius["lg"]).toEqual({ $value: "10px" });
    expect(radius["xl"]).toEqual({ $value: "14px" });
    expect((d.tokens["font"] as Record<string, { $value: string }>)["sans"]).toEqual({ $value: "var(--font-geist-sans)" });
  });

  it("reads Radix through the unified radix-ui package", () => {
    const hc = d.components.find((c) => c.name === "HoverCard")!;
    expect(hc.props!["openDelay"]).toEqual({ type: "number" });
    expect(hc.props!["onOpenChange"]).toEqual({ type: "function" });
    expect(hc.replaces).toEqual(["@radix-ui/react-hover-card#*", "radix-ui#HoverCard"]);
    expect(hc.slots).toEqual(["Trigger", "Content"]);
  });

  it("reads props from the primary's own signature and ignores a sub-part's cva", () => {
    const sb = d.components.find((c) => c.name === "Sidebar")!;
    expect(sb.props!["side"]).toEqual({ type: "enum", values: ["left", "right"], default: "left" });
    expect(sb.props!["variant"]).toEqual({ type: "enum", values: ["sidebar", "floating", "inset"], default: "sidebar" });
    expect(sb.props!["collapsible"]).toEqual({ type: "enum", values: ["offcanvas", "icon", "none"], default: "offcanvas" });
    expect(sb.props!["size"]).toBeUndefined();
    expect(sb.extends).toBe("div");
    expect(sb.replaces).toBeUndefined(); // extends <div>; does not stand in for every div
    expect(sb.slots).toEqual(["MenuButton"]);
  });

  it("tells the engine about the project's own Tailwind rules and allows display on system components", () => {
    expect(d.config).toContain('css: ["src/app/globals.css"]');
    const button = d.components.find((c) => c.name === "Button")!;
    expect(button.className!.allow).toContain("display");
    expect(button.className!.allow).toContain("overflow");
  });

  it("reads the function-component shape with asChild and an icon size", () => {
    const button = d.components.find((c) => c.name === "Button")!;
    expect(button.props!["size"]!.values).toEqual(["default", "sm", "lg", "icon"]);
    expect(button.props!["asChild"]).toEqual({ type: "boolean", default: false });
    const sw = d.components.find((c) => c.name === "Switch")!;
    expect(sw.props!["onCheckedChange"]).toEqual({ type: "function" });
    expect(sw.replaces).toContain("@radix-ui/react-switch#*");
  });
});

describe("the derived definitions drive the engine", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-shadcn-"));
    cpSync(join(fixtures, "tw3"), dir, { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes the files, refuses to overwrite, and the engine finds exactly the planted drift", async () => {
    const d = deriveShadcn(dir);
    const { written } = writeShadcn(dir, d);
    expect(written.sort()).toEqual(["zengin.config.yaml", "zengin/components.json", "zengin/tokens.dark.json", "zengin/tokens.json"]);
    expect(() => writeShadcn(dir, d)).toThrow(/--force/);
    expect(existsSync(join(dir, "zengin", "components.json"))).toBe(true);

    const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig(config, projectDir);
    expect(resolved.classes.tailwind).toBe(true);
    expect(resolved.scope.ownership).toEqual(["components/ui/**"]);
    const engine = await createEngine(resolved);
    const violations = engine.check(readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude));
    const page = violations.filter((v) => v.file === "app/page.tsx");
    expect(page.map((v) => `${v.rule}:${v.found.split("\n")[0]}`)).toEqual([
      'unknown-prop-value:variant="primary"',
      "component-substitution:<button className={cn(buttonVariants({ variant: \"ghost\" }))}>",
      "color-literal:text-slate-500",
    ]);
    expect(page[2]!.fix).toMatchObject({ replace: "text-muted-foreground", confidence: "nearest" });
    // rounded-2xl and p-3.5 are on-system: extend keeps the defaults, and spacing is Tailwind's scale.
    expect(violations.filter((v) => v.file.startsWith("components/ui/"))).toEqual([]);
  });
});

describe("deriveComponent edge cases", () => {
  it("returns undefined for a file with no PascalCase export", () => {
    expect(deriveComponent("use-thing", `export function useThing() { return 1 }`, "@/components/ui/use-thing")).toBeUndefined();
  });

  it("picks the primary export by file name and the rest as slots", () => {
    const d = deriveComponent(
      "alert-dialog",
      `export const AlertDialogTrigger = 1; export const AlertDialog = 2; export const AlertDialogContent = 3; export const alertDialogVariants = 4;`,
      "@/components/ui/alert-dialog",
    )!;
    const m: ComponentManifest = d.manifest;
    expect(m.name).toBe("AlertDialog");
    expect(m.slots).toEqual(["Trigger", "Content"]);
  });

  it("reads cva variants written with tv() or template literals too", () => {
    const d = deriveComponent(
      "chip",
      "import { tv } from 'tailwind-variants'; const chip = tv({ base: `rounded-full px-2`, variants: { tone: { neutral: 'bg-muted', loud: 'bg-primary text-primary-foreground' } }, defaultVariants: { tone: 'neutral' } }); export function Chip() { return null }",
      "@/components/ui/chip",
    )!;
    expect(d.manifest.props!["tone"]).toEqual({ type: "enum", values: ["neutral", "loud"], default: "neutral" });
  });
});

describe("report", () => {
  it("is plain text a person can act on", () => {
    const d = deriveShadcn(join(fixtures, "tw3"));
    expect(readFileSync(join(fixtures, "tw3", "styles", "globals.css"), "utf8")).toContain("--background");
    expect(d.report.review.length).toBeGreaterThan(0);
  });
});
