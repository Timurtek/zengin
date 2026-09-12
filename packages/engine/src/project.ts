import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import picomatch from "picomatch";
import type { FileInput } from "./types.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

/** Reads every file under `projectDir` that matches the scope globs, as project-relative paths. */
export function readProjectFiles(projectDir: string, include: string[], exclude: string[]): FileInput[] {
  const isIncluded = picomatch(include, { dot: true });
  const isExcluded = exclude.length ? picomatch(exclude, { dot: true }) : () => false;
  const out: FileInput[] = [];

  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      const rel = relative(projectDir, abs).replace(/\\/g, "/");
      if (isIncluded(rel) && !isExcluded(rel)) out.push({ path: rel, content: readFileSync(abs, "utf8") });
    }
  };
  walk(projectDir);
  return out;
}
