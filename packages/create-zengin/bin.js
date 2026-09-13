#!/usr/bin/env node
// `npm create zengin my-app -- --template saas` runs this as `create-zengin my-app --template saas`.
// The command line itself lives in @zenginui/cli; this adds the `create` word the npm convention leaves out.
// Any other zengin command still works through it: `npx create-zengin check` is `zengin check`.
const COMMANDS = new Set(["check", "explain", "init", "report", "rollup", "create", "add", "upgrade", "tokens", "registry", "theme", "fonts", "icons", "brand", "figma", "mock", "help"]);
const first = process.argv[2];
if (first === undefined || (!first.startsWith("-") && !COMMANDS.has(first))) process.argv.splice(2, 0, "create");
await import("@zenginui/cli/dist/index.js");
