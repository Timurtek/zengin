import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CHECK, findConfig, runCheck } from "../src/check.js";
import { renderGithub, renderJson, renderPretty } from "../src/format-cli.js";
import { init } from "../src/init.js";
import { explain, parseArgs } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "engine", "test", "fixtures");
const project = join(fixtures, "project-css");
const expectedCount = JSON.parse(readFileSync(join(fixtures, "expected", "violations-css.json"), "utf8")).length as number;

const opts = (over: Partial<Parameters<typeof runCheck>[0]> = {}) => ({ ...DEFAULT_CHECK, cwd: project, ...over });

describe("zengin check", () => {
  it("checks the whole scope and matches the engine snapshot count", async () => {
    const r = await runCheck(opts());
    expect(r.violations).toHaveLength(expectedCount);
    expect(r.exitCode).toBe(1);
    expect(r.system).toEqual({ package: "@zengin/ui", version: "1.2.0" });
  });

  it("accepts files and directories, relative to cwd", async () => {
    const one = await runCheck(opts({ paths: ["src/features/review/RejectButton.tsx"] }));
    expect(one.filesChecked).toBe(1);
    expect(one.violations.every((v) => v.file === "src/features/review/RejectButton.tsx")).toBe(true);

    const dir = await runCheck(opts({ paths: ["src/features"] }));
    expect(dir.filesChecked).toBeGreaterThan(1);

    await expect(runCheck(opts({ paths: ["src/nope.tsx"] }))).rejects.toThrow(/Path not found/);
  });

  it("still resolves className through stylesheets outside the selection", async () => {
    const r = await runCheck(opts({ paths: ["src/features/review/RejectButton.tsx"] }));
    expect(r.violations.some((v) => v.rule === "classname-policy" && v.found === "reject-button")).toBe(true);
  });

  it("filters by rule and severity and honours fail-on", async () => {
    const rules = await runCheck(opts({ rules: ["unknown-prop-value"] }));
    expect(rules.violations.every((v) => v.rule === "unknown-prop-value")).toBe(true);

    const never = await runCheck(opts({ failOn: "never" }));
    expect(never.exitCode).toBe(0);
    expect(never.violations).toHaveLength(expectedCount);

    const warnOnly = await runCheck(opts({ severity: "warn" }));
    expect(warnOnly.violations).toHaveLength(0);
    expect(warnOnly.exitCode).toBe(0);
  });

  it("finds the config walking up and fails clearly without one", () => {
    expect(findConfig(undefined, join(project, "src", "features"))).toBe(join(project, "zengin.config.yaml"));
    expect(() => findConfig(undefined, tmpdir())).toThrow(/zengin init/);
  });
});

describe("formats", () => {
  it("emits GitHub workflow commands with escaped fields", async () => {
    const r = await runCheck(opts({ paths: ["src/features/review/approve-bar.css"] }));
    const out = renderGithub(r);
    const lines = out.split("\n");
    expect(lines[0]).toMatch(/^::error file=src\/features\/review\/approve-bar\.css,line=\d+,endLine=\d+,col=\d+,endColumn=\d+,title=zengin color-literal::/);
    expect(lines[0]).not.toMatch(/\n/);
    expect(lines.at(-1)).toMatch(/1 files checked/);
  });

  it("emits JSON with the full violation shape", async () => {
    const r = await runCheck(opts({ paths: ["src/features/review/approve-bar.css"] }));
    const j = JSON.parse(renderJson(r));
    expect(j.exitCode).toBe(1);
    expect(j.violations[0]).toHaveProperty("fix.confidence");
    expect(j.summary.byRule).toHaveProperty("color-literal");
  });

  it("renders a readable pretty report", async () => {
    const r = await runCheck(opts({ paths: ["src/features/review/approve-bar.css"] }));
    const out = renderPretty(r, 200);
    expect(out).toContain("src/features/review/approve-bar.css");
    expect(out).toMatch(/error\s+color-literal/);
    expect(out).toContain("fix (exact)  var(--color-primary)");
    expect(out).toMatch(/1 file checked against @zengin\/ui@1\.2\.0/);
  });
});

describe("arguments", () => {
  it("parses commands, positionals and options", () => {
    const p = parseArgs(["check", "src/a.tsx", "--changed", "origin/main", "--rule", "color-literal", "--format=github", "--fail-on", "warn"], "/x");
    expect(p.command).toBe("check");
    expect(p.check).toMatchObject({ paths: ["src/a.tsx"], changed: "origin/main", rules: ["color-literal"], format: "github", failOn: "warn" });

    expect(parseArgs(["src/a.tsx"], "/x")).toMatchObject({ command: "check", check: { paths: ["src/a.tsx"] } });
    expect(parseArgs(["--changed", "--staged"], "/x").check).toMatchObject({ changed: "HEAD", staged: true });
    expect(parseArgs(["explain", "unknown-prop"], "/x")).toMatchObject({ command: "explain", positional: ["unknown-prop"] });
    expect(() => parseArgs(["--format", "xml"], "/x")).toThrow(/--format/);
    expect(() => parseArgs(["--rule", "nope"], "/x")).toThrow(/Unknown rule/);
  });

  it("explains rules", () => {
    expect(explain("classname-policy")).toMatch(/^classname-policy \(contract\)/);
    expect(explain(undefined)).toContain("zengin-allow");
  });
});

describe("zengin init", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-init-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes a template and refuses to overwrite", () => {
    const path = init(dir);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("system:");
    expect(() => init(dir)).toThrow(/already exists/);
  });
});

describe("--changed and --staged against a real git repo", () => {
  let dir: string;
  const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zengin-git-"));
    cpSync(join(fixtures, "system"), join(dir, "system"), { recursive: true });
    cpSync(project, join(dir, "project-css"), { recursive: true });
    g("init", "-q");
    g("config", "user.email", "t@example.com");
    g("config", "user.name", "t");
    g("add", "-A");
    g("commit", "-q", "-m", "base");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("checks only files changed since the ref, including untracked ones", async () => {
    const proj = join(dir, "project-css");
    writeFileSync(join(proj, "src", "features", "review", "New.tsx"), `export const N = () => <div style={{ color: "#3B82F6" }} />;\n`);
    const r = await runCheck({ ...DEFAULT_CHECK, cwd: proj, changed: "HEAD" });
    expect(r.filesChecked).toBe(1);
    expect(r.violations.map((v) => v.file)).toEqual(["src/features/review/New.tsx"]);

    g("add", "-A");
    const staged = await runCheck({ ...DEFAULT_CHECK, cwd: proj, staged: true });
    expect(staged.filesChecked).toBe(1);

    g("commit", "-q", "-m", "add new");
    const clean = await runCheck({ ...DEFAULT_CHECK, cwd: proj, changed: "HEAD" });
    expect(clean.filesChecked).toBe(0);
    expect(clean.exitCode).toBe(0);

    const sinceBase = await runCheck({ ...DEFAULT_CHECK, cwd: proj, changed: "HEAD~1" });
    expect(sinceBase.filesChecked).toBe(1);
  });
});
