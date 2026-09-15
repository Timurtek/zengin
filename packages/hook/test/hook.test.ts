import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, findConfigFrom, lineSpansOf, parseHookArgs, runHook, settingsSnippet, type HookInput } from "../src/hook.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "engine", "test", "fixtures");

// The hook reads the written file from disk, so work on a scratch copy of the plain-CSS fixture.
let root: string;
let project: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "zengin-hook-"));
  cpSync(join(fixtures, "system"), join(root, "system"), { recursive: true });
  cpSync(join(fixtures, "project-css"), join(root, "project-css"), { recursive: true });
  project = join(root, "project-css");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const file = (rel: string) => join(project, ...rel.split("/"));

function write(rel: string, content: string): HookInput {
  writeFileSync(file(rel), content);
  return { hook_event_name: "PostToolUse", tool_name: "Write", cwd: project, tool_input: { file_path: file(rel), content } };
}

function edit(rel: string, oldString: string, newString: string): HookInput {
  const before = readFileSync(file(rel), "utf8");
  expect(before).toContain(oldString);
  writeFileSync(file(rel), before.replace(oldString, newString));
  return { hook_event_name: "PostToolUse", tool_name: "Edit", cwd: project, tool_input: { file_path: file(rel), old_string: oldString, new_string: newString } };
}

describe("runHook", () => {
  it("blocks with the violations on stderr after a Write", async () => {
    const input = write(
      "src/features/review/NewBar.tsx",
      `export const NewBar = () => <div style={{ backgroundColor: "#3B82F6", padding: 13 }} />;\n`,
    );
    const r = await runHook(input);
    expect(r.exitCode).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("zengin: src/features/review/NewBar.tsx 2 violations");
    expect(r.stderr).toContain("[color-literal]");
    expect(r.stderr).toContain('fix (exact): "var(--color-primary)"');
    expect(r.stderr).toContain("[spacing-literal]");
    expect(r.preexisting).toBe(0);
  });

  it("stays silent when the written file is clean", async () => {
    const input = write("src/features/review/Clean.tsx", `export const Clean = () => <div style={{ padding: "var(--spacing-3)" }} />;\n`);
    const r = await runHook(input);
    expect(r).toMatchObject({ exitCode: 0, stdout: "", stderr: "", violations: [] });
  });

  it("reports only the changed lines on Edit and counts the rest as pre-existing", async () => {
    // RejectButton.tsx has several violations already. Touch one line with a new one.
    const input = edit("src/features/review/RejectButton.tsx", "        Undo\n", "        <span style={{ color: \"#2563EB\" }}>Undo</span>\n");
    const r = await runHook(input);
    expect(r.exitCode).toBe(2);
    expect(r.violations.map((v) => v.rule)).toEqual(["color-literal"]);
    expect(r.preexisting).toBeGreaterThan(0);
    expect(r.stderr).toMatch(/pre-existing violations? elsewhere in this file were not reported/);
  });

  it("reports the whole file on Edit when scope is file", async () => {
    const input: HookInput = {
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      cwd: project,
      tool_input: { file_path: file("src/features/review/RejectButton.tsx"), old_string: "x", new_string: "x" },
    };
    const r = await runHook(input, { ...DEFAULT_OPTIONS, scope: "file" });
    expect(r.violations.length).toBeGreaterThan(1);
    expect(r.preexisting).toBe(0);
  });

  it("adds context instead of blocking when block-on is never", async () => {
    const input = write("src/features/review/Soft.tsx", `export const Soft = () => <div style={{ color: "#0F172A" }} />;\n`);
    const r = await runHook(input, { ...DEFAULT_OPTIONS, blockOn: "never" });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(out.hookSpecificOutput.additionalContext).toContain("[color-literal]");
  });

  it("does nothing for tools that are not writes, and for files outside scope", async () => {
    // Bash is no longer "not a write": it is a write whose payload names no file, so it goes to the
    // working-tree path instead, which has its own reasons for doing nothing.
    expect((await runHook({ hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {} })).skipped).toMatch(/tool Read/);
    expect((await runHook({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: file("a.tsx") } })).skipped).toMatch(/event/);
    const excluded = write("src/features/review/Thing.stories.tsx", `const a = "#fff";`);
    expect((await runHook(excluded)).skipped).toBe("excluded by scope");
    const readme = write("README.md", "# hi");
    expect((await runHook(readme)).skipped).toBe("not a checked file type");
  });

  it("does nothing when no config exists above the file", async () => {
    const stray = join(root, "elsewhere");
    mkdirSync(stray, { recursive: true });
    writeFileSync(join(stray, "x.tsx"), `const a = "#fff";`);
    const r = await runHook({ hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: join(stray, "x.tsx") } });
    expect(r.skipped).toMatch(/no zengin.config.yaml/);
  });

  it("honours the foundation scope: theme files are never blocked", async () => {
    const input = write("src/theme/extra.css", `:root { --color-brand: #ff0000; }\n`);
    const r = await runHook(input);
    expect(r.exitCode).toBe(0);
    expect(r.violations).toEqual([]);
  });
});

describe("helpers", () => {
  it("finds line spans of a needle, including multi-line ones", () => {
    const content = "a\nb\nc\nb\nc\n";
    expect(lineSpansOf(content, "b\nc")).toEqual([
      { start: 2, end: 3 },
      { start: 4, end: 5 },
    ]);
    expect(lineSpansOf(content, "zzz")).toEqual([]);
  });

  it("finds the config walking up", () => {
    expect(findConfigFrom(join(project, "src", "features", "review"))).toBe(join(project, "zengin.config.yaml"));
  });

  it("parses and validates arguments", () => {
    expect(parseHookArgs(["--block-on", "warn", "--scope=file", "--max", "5"])).toMatchObject({ blockOn: "warn", scope: "file", max: 5 });
    expect(() => parseHookArgs(["--block-on", "loud"])).toThrow(/--block-on/);
    expect(parseHookArgs(["settings"]).settings).toBe(true);
  });

  it("prints a valid settings fragment", () => {
    const s = JSON.parse(settingsSnippet());
    expect(s.hooks.PostToolUse[0].matcher).toBe("Write|Edit|MultiEdit");
    expect(s.hooks.PostToolUse[0].hooks[0].command).toBe("zengin-hook");
  });
});

describe("a shell edit", () => {
  // The matcher is a tool filter, so for a long time an agent that reached for `sed` left the loop silently.
  // A shell payload names no file, so the working tree is asked what changed instead.
  const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  const shell: HookInput = { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "sed -i ..." } };

  it("checks what changed in the working tree, once, and only in a repository", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zengin-hook-shell-"));
    try {
      cpSync(join(fixtures, "system"), join(dir, "system"), { recursive: true });
      cpSync(join(fixtures, "project-css"), join(dir, "project-css"), { recursive: true });
      const proj = join(dir, "project-css");

      // No repository: nothing can be asked, and the hook says so rather than pretending to have looked.
      const noRepo = await runHook({ ...shell, cwd: proj }, DEFAULT_OPTIONS);
      expect(noRepo.skipped).toMatch(/not a git repository/);
      expect(noRepo.exitCode).toBe(0);

      git(dir, "init", "-q");
      git(dir, "config", "user.email", "t@example.com");
      git(dir, "config", "user.name", "t");
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "base");

      const clean = join(proj, "src", "features", "review", "clean.css");
      writeFileSync(clean, ".ok { color: var(--color-primary); }\n");
      const good = await runHook({ ...shell, cwd: proj }, DEFAULT_OPTIONS);
      expect(good.violations).toEqual([]);
      expect(good.exitCode).toBe(0);

      writeFileSync(clean, ".bad { color: #ff0000; }\n");
      const bad = await runHook({ ...shell, cwd: proj }, DEFAULT_OPTIONS);
      expect(bad.exitCode).toBe(2);
      expect(bad.violations.map((v) => v.rule)).toContain("color-literal");
      expect(bad.stderr).toContain("changed by the shell");

      // Pre-existing dirt is not re-reported: only files touched since the last look are checked, or every
      // shell command in a project with uncommitted work would block on the same violation forever.
      const again = await runHook({ ...shell, cwd: proj }, DEFAULT_OPTIONS);
      expect(again.exitCode).toBe(0);
      expect(again.skipped).toMatch(/since the last run/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
