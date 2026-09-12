import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

function git(projectDir: string, args: string[]): string[] {
  let out: string;
  try {
    out = execFileSync("git", args, { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const msg = e instanceof Error && "stderr" in e ? String((e as { stderr?: unknown }).stderr).trim() : String(e);
    throw new Error(`git ${args.join(" ")} failed in ${projectDir}: ${msg || "is this a git repository?"}`);
  }
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * git reports paths relative to the repository root. The project may be a package inside a monorepo,
 * so every path is re-based onto the project directory and anything outside it is dropped.
 */
function toProject(projectDir: string, rootRelative: string[]): string[] {
  const root = git(projectDir, ["rev-parse", "--show-toplevel"])[0]!;
  return rootRelative
    .map((p) => relative(projectDir, join(root, p)).replace(/\\/g, "/"))
    .filter((p) => p && !p.startsWith("../") && p !== "..")
    .sort();
}

/** Files added, copied, modified or renamed relative to `ref`, plus uncommitted and untracked changes. */
export function changedFiles(projectDir: string, ref: string): string[] {
  const base = ref || "HEAD";
  const committed = git(projectDir, ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]);
  const working = git(projectDir, ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]);
  const untracked = git(projectDir, ["ls-files", "--others", "--exclude-standard", "--full-name"]);
  return toProject(projectDir, [...new Set([...committed, ...working, ...untracked])]);
}

/** Files staged for the next commit. */
export function stagedFiles(projectDir: string): string[] {
  return toProject(projectDir, git(projectDir, ["diff", "--name-only", "--cached", "--diff-filter=ACMR"]));
}
