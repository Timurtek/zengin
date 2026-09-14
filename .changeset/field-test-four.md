---
"@zenginui/engine": minor
"@zenginui/registry": minor
"@zenginui/cli": minor
---

The three ship-blockers from field test four.

A session built a real application on Zengin as a stranger would, from the public packages and the public
registry, and wrote up eighteen findings. Three of them stopped a fresh clone working.

**The enforcement loop did not engage for anyone but its author.** `zengin create` wrote `.mcp.json` and the
edit hook with bare `zengin-mcp` and `zengin-hook` commands. Those live in `node_modules/.bin`, which is on
PATH inside an npm script and nowhere else, and an agent launches them directly. So unless the packages were
installed globally, the MCP server failed to start and the hook never fired, silently. It worked in this
repository because its own examples point at `node ../../packages/mcp/dist/index.js`. Both are now invoked
through `npx`, and `create` ends by saying to open a new agent session in the new directory, since MCP
servers and hooks are read when a session starts.

**Projects did not compile out of the box.** A component's story ships with the component, and nothing
checked that the story's imports were satisfied by what the item delivers: a Loader story demonstrating a
Loader inside a Message landed in projects with no Message, and `tsc` failed immediately after `zengin check`
reported zero. Twelve items had this. Rather than make every story self-contained, which makes worse
documentation, or drag Button into a dozen installs that do not need it, the registry now records what each
story needs beyond its own item and install writes the story only where those are present, naming what was
left out and why.

**A `var()` naming a family the system does not have went unreported.** `var(--tracking-wide)` against a
system with no tracking tokens resolves to nothing at runtime with no error anywhere, and `token-reference`
only looked inside namespaces the system already owned. It now reports these too, which required teaching the
engine two things first so the widening does not invent false positives: every custom property the project's
own stylesheets declare, in any file, so a theme-defined property used in a component is recognised as the
project's own; and the prefixes a dependency uses for properties it sets at runtime, derived from the
project's own dependencies rather than a hard-coded list, so Radix writing `--radix-popover-content-transform-origin`
from JavaScript is left alone. `rules.token-reference.externalVars` adds any the convention misses.

Also from the same report: `create` no longer suggests adding components the chosen template already has.
