---
"@zenginui/engine": minor
"@zenginui/cli": minor
---

`surfaces` in the config is now `profiles`.

The name collided with the four surfaces the engine reaches you through, the MCP server, the editor hook,
the CLI and the rollup, which the documentation and the site both use that word for. Two unrelated meanings
of one word is a documentation problem that only gets worse, and the key was hours old with nobody depending
on it, so it is renamed rather than lived with.

Nothing else changed: the shape, the resolution order and what a profile may and may not do are the same. A
config that still says `surfaces:` is refused by name, because ignoring it would check every file against the
base system and look like the feature simply not working.
