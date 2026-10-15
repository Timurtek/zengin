import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classify, deriveClaudeDesign, deriveTokensFromCss, readAdherence, renderClaudeDesignReport, writeClaudeDesign } from "../src/index.js";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "claude-design");

type Group = Record<string, { $value: string; $extensions: { zengin: { cssVar: string } } }>;

describe("tokens from a Claude Design export", () => {
  const d = deriveClaudeDesign(fixture);

  it("resolves two-hop aliases and keeps variable names", () => {
    const color = d.tokens["color"] as Group;
    expect(color["brand"]).toEqual({ $value: "{color.coral-500}", $extensions: { zengin: { cssVar: "--brand" } } });
    expect(color["text-strong"]!.$value).toBe("{color.ink-900}");
  });

  it("does not trust the manifest's kind: a font size is text, a text color is a color", () => {
    expect((d.tokens["text"] as Group)["fs-display"]!.$value).toBe("40px");
    expect((d.tokens["radius"] as Group)["r-card"]!.$value).toBe("22px");
    expect((d.tokens["color"] as Group)["text-strong"]).toBeDefined();
    expect(d.report.kindDisagreements).toEqual([
      { name: "--text-strong", kind: "font", group: "color" },
      { name: "--fs-display", kind: "spacing", group: "text" },
      { name: "--r-card", kind: "spacing", group: "radius" },
    ]);
  });

  it("reads the theme the manifest names as overrides, ignoring variables the base theme lacks", () => {
    expect(d.report.themeNames).toEqual(["Night"]);
    const night = d.themes["night"]!["color"] as Group;
    expect(night["ink-900"]!.$value).toBe("#ffffff");
    expect(night["night-only"]).toBeUndefined();
  });

  it("reports the manifest and the stylesheets against each other, and what it could not classify", () => {
    expect(d.report.onlyInManifest).toEqual(["--only-in-manifest"]);
    expect(d.report.onlyInStylesheets).toEqual(["--shadow-brand", "--dur-base", "--ease-quick", "--font-sans", "--sp-4"].sort());
    expect(d.report.skippedVariables).toEqual(["--hero"]);
    expect(d.report.stylesheets).toEqual(["tokens/colors.css", "tokens/type.css"]);
  });
});

describe("a theme the manifest names is a theme", () => {
  const css = `:root{--a:#111111}[data-theme="night"]{--a:#eeeeee}`;
  it("is ignored without the option and read with it", () => {
    expect(deriveTokensFromCss(css).dark).toEqual([]);
    expect(deriveTokensFromCss(css, { themeSelectors: ['[data-theme="night"]'] }).dark.map((t) => t.value)).toEqual(["#eeeeee"]);
  });
  it("classifies --fs- and --r- by name", () => {
    expect(classify("--fs-body", "16px")).toBe("text");
    expect(classify("--r-md", "16px")).toBe("radius");
    expect(classify("--sp-4", "16px")).toBe("space");
  });
  it("keeps tracking out of the space scale, and reads a bare 0 and easing functions", () => {
    expect(classify("--ls-tight", "-0.02em")).toBe("other");
    expect(classify("--bw-chunky", "2px")).toBe("other");
    expect(classify("--fg", "226,224,247")).toBe("other");
    expect(classify("--bg-rgb", "10 10 46")).toBe("other");
    expect(classify("--pageBg", "linear-gradient(168deg,#07091F 0%,#0F1038 42%)")).toBe("other");
    expect(classify("--sp-0", "0")).toBe("space");
    expect(classify("--r-none", "0")).toBe("radius");
    expect(classify("--ease-out", "cubic-bezier(0.22, 1, 0.36, 1)")).toBe("other");
    expect(classify("--ease-quick", ".15s")).toBe("other");
  });
});

describe("components from .d.ts, cross-checked against the adherence config", () => {
  const d = deriveClaudeDesign(fixture);

  it("derives props and enum values from the declarations, per manifest component", () => {
    expect(d.components.map((c) => c.name)).toEqual(["Badge", "Button"]);
    expect(d.components[0]!.props!["tone"]).toEqual({ type: "enum", values: ["deal", "savings", "neutral"] });
    expect(d.components[0]!.export).toEqual({ from: "AcmeDesignSystem_1a2b3c", name: "Badge" });
    expect(d.report.withoutTypes).toEqual(["Ghost"]);
  });

  it("reads the allowed props and enum values out of the oxlint selectors", () => {
    const a = readAdherence(readFileSync(join(fixture, "_adherence.oxlintrc.json"), "utf8"));
    expect([...a["Badge"]!.props].sort()).toEqual(["size", "tone", "variant"]);
    expect(a["Badge"]!.enums["tone"]).toEqual(["deal", "scarcity", "savings", "neutral"]);
    expect(Object.keys(a).sort()).toEqual(["Badge", "Tab"]);
  });

  it("reports every disagreement and resolves none", () => {
    const kinds = d.findings.map((f) => `${f.component}:${f.kind}`).sort();
    expect(kinds).toEqual(["Badge:prop-only-in-adherence", "Badge:prop-only-in-types", "Badge:values-differ", "Button:component-without-contract", "Tab:component-only-in-adherence"]);
    expect(d.findings.find((f) => f.kind === "values-differ")!.detail).toContain("scarcity");
    expect(d.components[0]!.props!["tone"]!.values).not.toContain("scarcity");
  });

  it("says in the report that kind is not trusted and that the system has no theme to speak of when it names none", () => {
    const text = renderClaudeDesignReport(d);
    expect(text).toContain("Token kind: not trusted. 3 manifest kinds disagree");
    expect(text).toContain("Contracts cross-checked against _adherence.oxlintrc.json: 5 disagreements");
  });
});

describe("the manifest is validated before it is used", () => {
  let dir: string;
  const original = JSON.parse(readFileSync(join(fixture, "_ds_manifest.json"), "utf8")) as Record<string, unknown>;
  const derive = (patch: Record<string, unknown>) => {
    writeFileSync(join(dir, "_ds_manifest.json"), JSON.stringify({ ...original, ...patch }));
    return () => deriveClaudeDesign(dir);
  };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-claude-design-bad-"));
    cpSync(fixture, dir, { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("names the field when a type is wrong", () => {
    expect(derive({ namespace: 42 })).toThrow(/"namespace" must be a JavaScript identifier/);
    expect(derive({ components: "Badge" })).toThrow(/"components" must be an array/);
    expect(derive({ components: [{ name: "Badge" }] })).toThrow(/components\[0\]\.sourcePath/);
    expect(derive({ globalCssPaths: "a.css" })).toThrow(/"globalCssPaths" must be an array/);
    expect(derive({ tokens: [{ name: "--a" }] })).toThrow(/tokens\[0\] needs a string name and kind/);
    expect(derive({ themes: [{ label: "Night" }] })).toThrow(/themes\[0\]\.selector/);
  });

  it("rejects a manifest that is not JSON or not an object", () => {
    writeFileSync(join(dir, "_ds_manifest.json"), "{nope");
    expect(() => deriveClaudeDesign(dir)).toThrow(/not valid JSON/);
    writeFileSync(join(dir, "_ds_manifest.json"), "[]");
    expect(() => deriveClaudeDesign(dir)).toThrow(/expected a JSON object/);
  });

  it("rejects paths that leave the export", () => {
    expect(derive({ globalCssPaths: ["../secrets.css"] })).toThrow(/globalCssPaths\[0\].*inside the export/);
    expect(derive({ globalCssPaths: [resolve(dir, "..", "x.css")] })).toThrow(/globalCssPaths\[0\]/);
    expect(derive({ components: [{ name: "Badge", sourcePath: "../../etc/Badge.jsx" }] })).toThrow(/components\[0\]\.sourcePath.*inside the export/);
  });

  it("rejects a theme label that is not a string", () => {
    expect(derive({ themes: [{ selector: ".night", label: 42 }] })).toThrow(/themes\[0\]\.label must be a string/);
  });

  it("will not merge several named themes into one", () => {
    expect(derive({ themes: [{ selector: ".one" }, { selector: ".two" }] })).toThrow(/names 2 themes.*will not merge/);
  });

  it("does not follow a link that leaves the export", () => {
    const outside = mkdtempSync(join(tmpdir(), "zengin-claude-design-outside-"));
    try {
      writeFileSync(join(outside, "a.css"), ":root { --a: #111111; }");
      symlinkSync(outside, join(dir, "linked"), "junction");
      expect(derive({ globalCssPaths: ["linked/a.css"] })).toThrow(/outside the export/);
    } finally {
      rmSync(join(dir, "linked"), { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("writes a Windows-style stylesheet path as a forward-slash, escaped YAML string", () => {
    const d = deriveClaudeDesign(fixture);
    expect(d.config).not.toMatch(/\\/);
    writeFileSync(join(dir, "_ds_manifest.json"), JSON.stringify({ ...original, globalCssPaths: (original.globalCssPaths as string[]).map((p) => p.replace(/\//g, "\\")) }));
    const win = deriveClaudeDesign(dir);
    expect(win.report.stylesheets).toEqual(d.report.stylesheets);
    expect(win.config).toBe(d.config);
  });

  it("will not put a namespace or path that could break the YAML into the config", () => {
    expect(derive({ namespace: 'A"\nsystem: {x' })).toThrow(/"namespace"/);
    expect(derive({ globalCssPaths: ['tokens/a".css'] })).toThrow(/globalCssPaths\[0\]/);
  });
});

describe("every listed stylesheet and the adherence config are required and validated", () => {
  let dir: string;
  const original = JSON.parse(readFileSync(join(fixture, "_ds_manifest.json"), "utf8")) as { globalCssPaths: string[] };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-claude-design-req-"));
    cpSync(fixture, dir, { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const manifestWith = (globalCssPaths: string[]) => writeFileSync(join(dir, "_ds_manifest.json"), JSON.stringify({ ...original, globalCssPaths }));

  it("rejects a missing stylesheet even when another one exists", () => {
    manifestWith([...original.globalCssPaths, "tokens/missing.css"]);
    expect(() => deriveClaudeDesign(dir)).toThrow(/globalCssPaths\[2\] "tokens\/missing\.css" does not exist/);
  });

  it("rejects a directory listed as a stylesheet", () => {
    mkdirSync(join(dir, "tokens", "dir.css"), { recursive: true });
    manifestWith([...original.globalCssPaths, "tokens/dir.css"]);
    expect(() => deriveClaudeDesign(dir)).toThrow(/globalCssPaths\[2\] "tokens\/dir\.css" is not a file/);
  });

  it("names the file and the entry when the adherence config is malformed", () => {
    manifestWith(original.globalCssPaths);
    const adherence = join(dir, "_adherence.oxlintrc.json");
    writeFileSync(adherence, "null");
    expect(() => deriveClaudeDesign(dir)).toThrow(/_adherence\.oxlintrc\.json: expected a JSON object/);
    writeFileSync(adherence, "{nope");
    expect(() => deriveClaudeDesign(dir)).toThrow(/_adherence\.oxlintrc\.json: not valid JSON/);
    writeFileSync(adherence, JSON.stringify({ rules: { "no-restricted-syntax": ["error", { selector: 42 }] } }));
    expect(() => deriveClaudeDesign(dir)).toThrow(/no-restricted-syntax\[1\]\.selector must be a string/);
    writeFileSync(adherence, JSON.stringify({ rules: { "no-restricted-syntax": ["error", null] } }));
    expect(() => deriveClaudeDesign(dir)).toThrow(/no-restricted-syntax\[1\]\.selector/);
    expect(() => readAdherence("null")).toThrow(/expected a JSON object/);
  });
});

describe("generated files stay inside the export", () => {
  let dir: string;
  let outside: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-claude-design-escape-"));
    outside = mkdtempSync(join(tmpdir(), "zengin-claude-design-outside-"));
    cpSync(fixture, dir, { recursive: true });
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("refuses a zengin directory that is a link out of the export, with and without force", () => {
    symlinkSync(outside, join(dir, "zengin"), "junction");
    const d = deriveClaudeDesign(dir);
    expect(() => writeClaudeDesign(dir, d)).toThrow(/outside the export/);
    expect(() => writeClaudeDesign(dir, d, true)).toThrow(/outside the export/);
    expect(readdirSync(outside)).toEqual([]);
    rmSync(join(dir, "zengin"), { recursive: true, force: true });
  });

  it("refuses a target file that is a link to a file outside the export, with and without force", () => {
    const sentinel = join(outside, "sentinel.yaml");
    writeFileSync(sentinel, "untouched");
    rmSync(join(dir, "zengin.config.yaml"), { force: true });
    symlinkSync(sentinel, join(dir, "zengin.config.yaml"), "file");
    const d = deriveClaudeDesign(dir);
    expect(() => writeClaudeDesign(dir, d)).toThrow(/link/);
    expect(() => writeClaudeDesign(dir, d, true)).toThrow(/link/);
    expect(readFileSync(sentinel, "utf8")).toBe("untouched");
  });
});

describe("writing", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-claude-design-"));
    cpSync(fixture, dir, { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes definitions beside the export and refuses to overwrite without force", () => {
    const d = deriveClaudeDesign(dir);
    const { written } = writeClaudeDesign(dir, d);
    expect(written).toEqual(["zengin/tokens.json", "zengin/components.json", "zengin.config.yaml", "zengin/tokens.dark.json"]);
    expect(existsSync(join(dir, "zengin", "tokens.json"))).toBe(true);
    expect(() => writeClaudeDesign(dir, d)).toThrow(/--force/);
    writeClaudeDesign(dir, d, true);
  });

  it("the engine checks a consumer of the export against the .d.ts contracts and names the export's own variables", async () => {
    mkdirSync(join(dir, "ui_kits"), { recursive: true });
    writeFileSync(
      join(dir, "ui_kits", "probe.jsx"),
      `import { Badge, Button } from "AcmeDesignSystem_1a2b3c";
export const Probe = () => (
  <div style={{ color: "#FF4D3D", gap: 16, fontSize: 40 }}>
    <Badge tone="hot" colour="red">x</Badge>
    <Button variant="primary" size="sm">ok</Button>
  </div>
);
`,
    );
    writeClaudeDesign(dir, deriveClaudeDesign(dir), true);
    const { loadConfigFile, readProjectFiles, resolveConfig, createEngine } = await import("@zenginui/engine");
    const { config } = loadConfigFile(join(dir, "zengin.config.yaml"));
    const resolved = resolveConfig(config, dir);
    const engine = await createEngine(resolved);
    const violations = engine.check(readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude));
    const at = (rule: string, line: number) => violations.find((v) => v.rule === rule && v.range.start.line === line);
    expect(at("unknown-prop-value", 4)?.message).toContain("tone");
    expect(at("unknown-prop", 4)?.message).toContain("colour");
    expect(violations.filter((v) => v.range.start.line === 5)).toEqual([]);
    // Two tokens hold #FF4D3D (--coral-500 and, through the alias, --brand); the engine names them rather than choosing.
    expect(at("color-literal", 3)?.fix.candidates ?? [at("color-literal", 3)?.fix.token]).toEqual(expect.arrayContaining([expect.stringMatching(/coral-500|brand/)]));
    expect(at("spacing-literal", 3)?.fix.replace).toBe('"var(--sp-4)"');
  });

  it("explains a folder that is not an export", () => {
    expect(() => deriveClaudeDesign(join(dir, "tokens"))).toThrow(/not a Claude Design export/);
  });
});
