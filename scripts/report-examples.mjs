#!/usr/bin/env node
/**
 * Zengin's own rollup history. Every example app is a consumer of @zenginui/ui; this files one snapshot per
 * example under reports/<name>/<time>.json, which the marketing site rolls up into /rollup/ at build time.
 *
 *   node scripts/report-examples.mjs                 # snapshot every example at HEAD
 *   node scripts/report-examples.mjs --backfill 20   # also one snapshot per example per past commit that touched examples/
 *
 * Backfills extract each example's sources at the older commit, borrow the current node_modules, and stamp
 * the snapshot with that commit's time and hash, so the history is what the engine would have said then.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "packages", "cli", "dist", "index.js");
const reports = join(root, "reports");
const args = process.argv.slice(2);
const backfill = args.includes("--backfill") ? Number(args[args.indexOf("--backfill") + 1] ?? 20) : 0;

const git = (cmd, cwd = root) => execFileSync("git", cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const examples = readdirSync(join(root, "examples")).filter((d) => existsSync(join(root, "examples", d, "zengin.config.yaml")));

function report(dir, name, extra = []) {
  const out = execFileSync("node", [cli, "report", "--into", reports, "--repo", name, ...extra], { cwd: dir, encoding: "utf8" });
  process.stdout.write(out);
}

// HEAD: the working tree as it is.
const head = git(["rev-parse", "HEAD"]);
for (const ex of examples) report(join(root, "examples", ex), `examples/${ex}`, ["--commit", head, "--ref", "main"]);

if (backfill > 0) {
  const commits = git(["log", `-${backfill}`, "--format=%H %cI", "--", "examples"]).split("\n").filter(Boolean).map((l) => l.split(" "));
  const work = mkdtempSync(join(tmpdir(), "zengin-backfill-"));
  try {
    for (const [sha, at] of commits.reverse()) {
      if (sha === head) continue;
      for (const ex of examples) {
        const rel = `examples/${ex}`;
        let listing;
        try {
          listing = git(["ls-tree", "-r", "--name-only", sha, rel]);
        } catch {
          continue;
        }
        if (!listing.includes(`${rel}/zengin.config.yaml`)) continue; // the example did not exist yet
        const dir = join(work, sha.slice(0, 7), ex);
        mkdirSync(dir, { recursive: true });
        execFileSync("sh", ["-c", `git archive ${sha} ${rel} | tar -x --strip-components=2 -C "${dir.replace(/\\/g, "/")}"`], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
        // The engine reads definitions and the version from node_modules; the example's current one serves.
        symlinkSync(join(root, "examples", ex, "node_modules"), join(dir, "node_modules"), "junction");
        try {
          report(dir, `examples/${ex}`, ["--at", at, "--commit", sha, "--ref", "main"]);
        } catch (e) {
          process.stderr.write(`skip ${ex} at ${sha.slice(0, 7)}: ${String(e.message ?? e).split("\n")[0]}\n`);
        }
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
