---
"@zenginui/registry": minor
"@zenginui/cli": minor
---

The definitions a project owns can be carried forward, so `add` stops leaving a project failing its own check.

Found by the session building TekJobs on Zengin: `zengin add combobox` installed a stylesheet reading
`var(--tracking-wider)` into a project created before the `tracking` family existed. The token resolved to
nothing at runtime, the engine correctly failed the project, and `zengin upgrade` had just reported
"everything is what the registry ships" — because it compares files carrying an ownership pragma, and
`zengin/tokens.json` carries none. JSON has no comments, so the definitions sat outside upgrade's world
entirely. The component was current; the definitions were a release behind; nothing compared them.

**`add` now carries the tokens an arriving component actually reads**, from the same registry and the same
version as the component, and names them in its output because `zengin/tokens.json` is the project's own file.

**`upgrade` now reports the definitions too**, compared token by token rather than file by file: what the
registry defines and the project lacks, and — separately, and left alone — the tokens the project gave its own
values. A brand is the point of owning your definitions, so `--write` is additive and never touches a value
you changed.

This was the third create-time artifact with no upgrade path, after the agent wiring and the version pins.
