#!/usr/bin/env node
import { parseHookArgs, runHook, settingsSnippet, type HookInput } from "./hook.js";

const HELP = `zengin-hook: Claude Code PostToolUse hook for the Zengin conformance engine.

Reads the hook payload on stdin, checks the written file, and reports violations
back to Claude. Exit 2 blocks with the violations as the reason; exit 0 adds them
as context or stays silent when the file is clean.

Usage: zengin-hook [options]
       zengin-hook settings          print the settings.json fragment that installs the hook

Options:
  --config <path>      zengin.config.yaml (default: nearest one above the written file)
  --block-on <level>   error | warn | info | never   (default: error)
  --scope <mode>       changed | file                (default: changed)
                       changed: on Edit/MultiEdit report only violations on the lines touched
  --max <n>            maximum violations rendered   (default: 50)
`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const opts = parseHookArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  if (opts.settings) {
    process.stdout.write(settingsSnippet() + "\n");
    return;
  }

  const raw = await readStdin();
  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    process.stderr.write("zengin-hook: stdin was not JSON; nothing checked.\n");
    return;
  }

  const result = await runHook(input, opts);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr + "\n");
  process.exitCode = result.exitCode;
}

main().catch((e: unknown) => {
  // A broken hook must never block the agent for reasons unrelated to the design system.
  process.stderr.write(`zengin-hook: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
