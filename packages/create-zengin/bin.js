#!/usr/bin/env node
// `npm create zengin my-app -- --template saas` runs this as `create-zengin my-app --template saas`.
// The command line itself lives in @zenginui/cli; this adds the `create` word the npm convention leaves out.
// Any other zengin command still works through it: `npx create-zengin check` is `zengin check`.
const COMMANDS = new Set(["check", "explain", "init", "report", "rollup", "create", "add", "upgrade", "tokens", "registry", "theme", "fonts", "icons", "brand", "figma", "mock", "define", "help"]);

// Someone who runs `npm create zengin -- --help` asked how to create a project. Forwarding to the full CLI
// answered with every command from `check` to `figma plugin`, and put the create flags two screens down.
const HELP = `npm create zengin@latest <directory> [options]

  A new project on Zengin UI: the components copied in as source, the engine, the
  MCP server, the edit hook and Storybook wired, checked before it prints.

Options:
  --template <name>     blank (default) | marketing | review | saas | chat | auth | docs | storefront
  --framework <name>    vite (default) | next
  --theme <name>        default | zengin | meadow | plex | spec-sheet | brutal
  --name <name>         package name (default: the directory name)
  --no-storybook        skip the Storybook config and stories
  --registry <dir|url>  where items come from (default: the public registry)

Examples:
  npm create zengin@latest acme -- --template saas
  npm create zengin@latest acme -- --template docs --theme brutal --framework next

Then:
  cd acme && npm install && npm run dev
  npx zengin --help     every other command, once the project exists
`;

const first = process.argv[2];
if (first === "--help" || first === "-h" || first === "help") {
  process.stdout.write(HELP);
  process.exit(0);
}
if (first === undefined || (!first.startsWith("-") && !COMMANDS.has(first))) process.argv.splice(2, 0, "create");
await import("@zenginui/cli/dist/index.js");
