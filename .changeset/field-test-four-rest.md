---
"@zenginui/ui": minor
"@zenginui/registry": minor
"@zenginui/cli": minor
"create-zengin": patch
---

The rest of field test four.

**`add` no longer throws a batch away for one typo.** `zengin add markdown tabs codeblock skeleton loader`
added nothing, because one name in five was `codeblock` rather than `code-block`. The four valid items go in
now and the one that is wrong is reported with the registry's own name for it: `did you mean code-block?`.
The full list of items stays in the error too, because that is how someone finds a name the suggestion
misses.

**`add --install` runs the package manager** the project already uses, read from its lockfile. Without the
flag it prints the command, and now also says what to expect until someone runs it: TypeScript will report
the missing module and a second error inside the story that uses it, and both go away with the install. That
second error read as a broken registry item to the session that found it.

**`npm create zengin -- --help` answers the question that was asked.** It forwarded to the whole CLI, so
someone who wanted to create a project got every command from `check` to `figma plugin`, with the create
flags two screens down.

**A monospace text control.** `TextField` and `TextArea` take `font="mono"`, for content that is code or
data rather than prose: a JSON block, an API key, a path. There was no way to do this before, because the
controls own their font through `size`, so a config-editing screen had to reach for a `className` and was
correctly blocked. The manifest now says `font-family` is owned by the `size` and `font` props, so the
violation names the prop that actually helps.

**Letter-spacing tokens.** A `tracking` family, from `tighter` to `caps`, and every hardcoded value in the
examples now names one. Uppercase micro-labels are common enough to deserve a token, and an agent reaching
for `var(--tracking-wide)` will now find it.

**Four components an operator app had to build by hand.** `DataTable` sorts, searches and pages over
`Table`, sorting on the column's value rather than the text in the cell, so a formatted date or a badge
sorts correctly; it tells the difference between having no rows and matching none. `StatTile` colours a
change by what the metric means rather than by the sign of the number, because a fall in churn is good and a
fall in revenue is not. `EmptyState` gives the three different nothings, not yet, no match, and all clear,
somewhere to live. `Kbd` renders a key or a chord.
