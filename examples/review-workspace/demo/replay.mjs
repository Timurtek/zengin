#!/usr/bin/env node
/**
 * Replays the enforcement loop end to end, deterministically:
 *
 *   1. Put the off-system ReviewCard (demo/before) into src, the way an agent would have written it.
 *   2. Run `zengin check`. Expect violations.
 *   3. Put the corrected ReviewCard (demo/after) into src, the way the agent self-corrects.
 *   4. Run `zengin check`. Expect none.
 *
 * `--assert` exits non-zero unless step 2 finds violations and step 4 finds zero. `--write` saves the
 * transcript to demo/transcript.md. src is always restored to the corrected version at the end.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const cli = resolve(project, "node_modules", "@zenginui", "cli", "dist", "index.js");
const target = join(project, "src", "ReviewCard.tsx");
const targetCss = join(project, "src", "review-card.css");

const args = new Set(process.argv.slice(2));
const transcript = [];
const say = (s = "") => {
  transcript.push(s);
  console.log(s);
};

function check(format) {
  try {
    const out = execFileSync("node", [cli, "check", "--format", format], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { out, exitCode: 0 };
  } catch (e) {
    if (e.status === 2) throw new Error(e.stderr || e.stdout);
    return { out: e.stdout, exitCode: e.status };
  }
}

function place(version) {
  copyFileSync(join(here, version, "ReviewCard.tsx"), target);
  const css = join(here, version, "review-card.css");
  if (existsSync(css)) copyFileSync(css, targetCss);
  else rmSync(targetCss, { force: true });
}

if (!existsSync(cli)) {
  console.error(`zengin CLI not built at ${cli}. Run pnpm build at the repository root first.`);
  process.exit(2);
}

say("# Zengin enforcement loop, replayed");
say();
say("## 1. The agent writes ReviewCard off-system");
say();
say("Every color below is the correct value in the default theme. A screenshot review passes.");
say();
say("```tsx");
say(readFileSync(join(here, "before", "ReviewCard.tsx"), "utf8").trimEnd());
say("```");
say();
say("```css");
say(readFileSync(join(here, "before", "review-card.css"), "utf8").trimEnd());
say("```");
say();

place("before");
say("## 2. zengin check");
say();
say("```");
say("$ zengin check");
const before = check("pretty");
say(before.out.trimEnd());
say(`(exit ${before.exitCode})`);
say("```");
say();
const beforeJson = JSON.parse(check("json").out);
const byRule = Object.entries(beforeJson.summary.byRule)
  .sort((a, b) => b[1] - a[1])
  .map(([r, n]) => `${r} ${n}`)
  .join(", ");
say(`${beforeJson.summary.total} violations: ${byRule}.`);
say();

say("## 3. The agent applies the fixes");
say();
say("Exact fixes verbatim. Nearest fixes by role. The raw buttons and the improvised status badge become the system's Button and Badge; the card becomes Card. The stylesheet goes away because the components own their appearance.");
say();
say("```tsx");
say(readFileSync(join(here, "after", "ReviewCard.tsx"), "utf8").trimEnd());
say("```");
say();

place("after");
say("## 4. zengin check");
say();
say("```");
say("$ zengin check");
const after = check("pretty");
say(after.out.trimEnd());
say(`(exit ${after.exitCode})`);
say("```");
say();
const afterJson = JSON.parse(check("json").out);

const ok = beforeJson.summary.total > 0 && afterJson.summary.total === 0 && before.exitCode === 1 && after.exitCode === 0;
say(ok ? "Loop closed: violations found, corrected, none remaining." : "Loop did not close as expected.");

if (args.has("--write")) {
  writeFileSync(join(here, "transcript.md"), transcript.join("\n") + "\n");
  console.log(`\nWrote ${join(here, "transcript.md")}`);
}
if (args.has("--assert") && !ok) process.exit(1);
