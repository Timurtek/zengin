---
"@zenginui/cli": minor
"@zenginui/registry": minor
---

`zengin doctor`: is this project's plumbing what this version of Zengin expects?

Every other command answers a question about the code. This one answers a question about the project, and it
exists because of a fault the others cannot see: a project is wired to Zengin once, when it is created, and
never again. `zengin upgrade` carries the owned components forward; the agent wiring, the version pins and the
generated files have no upgrade path at all, so a project created before a fix keeps that fault for as long as
it lives and nothing tells it.

Projects created before 0.4.0 wrote the MCP server and the edit hook as bare binaries an agent cannot launch.
Their enforcement loop never ran — and a loop that never runs looks exactly like a project that never drifts.
The first report of it came from a session that had spent a day building against a design system with the hook
silently dead.

It checks the agent wiring (present, and in a form an agent can launch), the version pins against what this
Zengin pins, the definitions, the generated token stylesheet, and whether every component on disk is in the
manifest, the barrel and the stylesheet index. An error means configured and broken; a warning means absent or
deliberate. It exits 1 on an error, so CI can run it. Everything is local: no network, no clock, same answer
every time — component drift against the registry stays `zengin upgrade`'s question.

`--fix` repairs the files Zengin itself writes, leaving other MCP servers and other hooks alone, then looks
again and reports what is true afterwards rather than what was wrong before. It will not touch dependencies:
changing a pin means running an install, so it prints the command instead.

`AGENT_WIRING` is now one exported constant in the registry: `create` writes it and `doctor` checks it, so the
two cannot drift apart.

It also catches a hook declared as a command plus an `args` array. The hook schema has one string field, so
only `command` is read and the rest is dropped: the hook runs `node` with no script, or nothing at all. Both
of Zengin's own examples were wired that way, which means the edit hook had never fired in this repository
either — found by running the new command on them.
